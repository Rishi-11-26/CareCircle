-- ============================================================================
-- CARECIRCLE MIGRATION 20260301000002
-- Assisted Care Mode, Provenance Attribution, Timezone & Atomic Dose Recording
-- ============================================================================

-- 1. Extend care_profiles with Assisted Care Level & IANA Timezone
ALTER TABLE public.care_profiles
    ADD COLUMN IF NOT EXISTS assistance_level TEXT NOT NULL DEFAULT 'independent'
        CHECK (assistance_level IN ('independent', 'needs_assistance', 'caregiver_managed')),
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- 2. Extend dose_logs with Provenance, Concrete Timestamps, Follow-up State & Append-Only Corrections
ALTER TABLE public.dose_logs
    ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recorded_by_role TEXT NOT NULL DEFAULT 'elderly'
        CHECK (recorded_by_role IN ('elderly', 'family', 'caretaker', 'system')),
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self'
        CHECK (source IN ('self', 'caregiver_administered', 'family_reported', 'system')),
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS adherence_status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (adherence_status IN ('scheduled', 'on_time', 'late', 'missed', 'unconfirmed', 'skipped')),
    ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'none'
        CHECK (follow_up_status IN ('none', 'unconfirmed', 'contacting', 'verified_taken', 'verified_not_taken', 'unable_to_reach', 'refused_reported', 'escalated')),
    ADD COLUMN IF NOT EXISTS correction_of_id UUID REFERENCES public.dose_logs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS correction_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT FALSE;

-- Indexes for performance & audit queries
CREATE INDEX IF NOT EXISTS idx_dose_logs_profile_status ON public.dose_logs(care_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_dose_logs_scheduled_at ON public.dose_logs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dose_logs_correction ON public.dose_logs(correction_of_id);

-- 3. Stored Procedure: record_dose_event
-- Enforces server-side authentication, role permissions, window validation,
-- atomic idempotency, append-only corrections, and authentic provenance.
CREATE OR REPLACE FUNCTION public.record_dose_event(
    p_care_profile_id UUID,
    p_medication_id UUID,
    p_schedule_id UUID,
    p_scheduled_date DATE,
    p_scheduled_time TIME,
    p_status TEXT,              -- 'taken' or 'skipped'
    p_source TEXT DEFAULT 'self', -- 'self', 'caregiver_administered', 'family_reported'
    p_notes TEXT DEFAULT NULL,
    p_skip_reason TEXT DEFAULT NULL,
    p_is_correction BOOLEAN DEFAULT FALSE,
    p_correcting_log_id UUID DEFAULT NULL,
    p_correction_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_profile RECORD;
    v_care_profile RECORD;
    v_membership RECORD;
    v_med RECORD;
    v_dose_identity TEXT;
    v_existing_log RECORD;
    v_result_log RECORD;
    v_scheduled_tz TIMESTAMPTZ;
    v_adherence_status TEXT;
    v_provenance_desc TEXT;
    v_minutes_until_due NUMERIC;
    v_minutes_since_due NUMERIC;
BEGIN
    -- 1. Identify caller from auth context (fallback to parameter if invoked via server context)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required to record medication events.');
    END IF;

    -- Retrieve caller profile
    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;

    -- Retrieve care profile
    SELECT * INTO v_care_profile FROM public.care_profiles WHERE id = p_care_profile_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Care profile not found.');
    END IF;

    -- 2. Verify active membership
    SELECT * INTO v_membership
    FROM public.care_members
    WHERE care_profile_id = p_care_profile_id AND user_id = v_caller_id AND status = 'active';

    IF NOT FOUND AND v_care_profile.owner_id != v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. You are not an active member of this Care Circle.');
    END IF;

    -- 3. Check Assistance Level Guardrails
    -- If Caregiver Managed (Level 3), elderly individual cannot self-confirm without caregiver role
    IF v_care_profile.assistance_level = 'caregiver_managed' AND p_source = 'self' THEN
        IF v_caller_id = v_care_profile.owner_id AND (v_membership.role IS NULL OR v_membership.role = 'owner') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This healthcare profile is configured for Caregiver Managed care. Doses must be verified and recorded by an authorized caregiver.'
            );
        END IF;
    END IF;

    -- Lookup medication
    SELECT * INTO v_med FROM public.medications WHERE id = p_medication_id AND care_profile_id = p_care_profile_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Medication not found in this care profile.');
    END IF;

    -- 4. Calculate Scheduled Timestamp with Profile Timezone
    IF v_care_profile.timezone IS NULL OR TRIM(v_care_profile.timezone) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Care profile is missing a configured IANA timezone.');
    END IF;

    BEGIN
        v_scheduled_tz := (p_scheduled_date::TEXT || ' ' || p_scheduled_time::TEXT)::TIMESTAMP
                          AT TIME ZONE v_care_profile.timezone;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid timezone configuration: ' || v_care_profile.timezone);
    END;

    -- 5. Window Validation: Prevent future dose confirmation (unless documenting a past skipped exception)
    v_minutes_until_due := EXTRACT(EPOCH FROM (v_scheduled_tz - NOW())) / 60.0;
    v_minutes_since_due := EXTRACT(EPOCH FROM (NOW() - v_scheduled_tz)) / 60.0;

    -- Reject if more than 60 minutes before scheduled dose time
    IF v_minutes_until_due > 60.0 AND NOT p_is_correction THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This dose is scheduled for ' || to_char(p_scheduled_time, 'HH12:MI AM') || '. Confirmation opens 60 minutes prior to scheduled time.'
        );
    END IF;

    -- 6. Adherence Categorization
    IF p_status = 'skipped' THEN
        v_adherence_status := 'skipped';
    ELSIF v_minutes_since_due <= 45.0 THEN
        v_adherence_status := 'on_time';
    ELSE
        v_adherence_status := 'late';
    END IF;

    -- Form unique dose identity
    v_dose_identity := 'dose_' || p_medication_id || '_' || to_char(p_scheduled_date, 'YYYY-MM-DD') || '_' || to_char(p_scheduled_time, 'HH24:MI');

    -- 7. Handle Append-Only Correction vs Normal Confirmation
    IF p_is_correction AND p_correcting_log_id IS NOT NULL THEN
        -- Target confirmed log is strictly immutable; do not update in-place

        -- Insert new append-only corrected event
        INSERT INTO public.dose_logs (
            care_profile_id,
            medication_id,
            schedule_id,
            dose_identity,
            scheduled_date,
            scheduled_time,
            scheduled_at,
            actual_at,
            status,
            adherence_status,
            source,
            recorded_by,
            recorded_by_role,
            confirmed_at,
            confirmed_by,
            correction_of_id,
            correction_reason,
            notes,
            skip_reason
        ) VALUES (
            p_care_profile_id,
            p_medication_id,
            p_schedule_id,
            v_dose_identity || '_corr_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
            p_scheduled_date,
            p_scheduled_time,
            v_scheduled_tz,
            NOW(),
            p_status,
            v_adherence_status,
            p_source,
            v_caller_id,
            COALESCE(v_membership.role, v_caller_profile.role, 'elderly'),
            NOW(),
            v_caller_id,
            p_correcting_log_id,
            p_correction_reason,
            p_notes,
            p_skip_reason
        ) RETURNING * INTO v_result_log;

        v_provenance_desc := v_caller_profile.full_name || ' (' || INITCAP(COALESCE(v_membership.role, 'Caregiver')) ||
                             ') corrected dose record for ' || v_med.name || ' to ' || p_status ||
                             '. Reason: ' || COALESCE(p_correction_reason, 'Clinical adjustment');
    ELSE
        -- Standard confirmation: Check if already exists
        SELECT * INTO v_existing_log
        FROM public.dose_logs
        WHERE care_profile_id = p_care_profile_id AND dose_identity = v_dose_identity;

        IF FOUND THEN
            -- Idempotency: Prevent duplicate taken confirmation
            IF v_existing_log.status = 'taken' AND p_status = 'taken' AND NOT v_existing_log.is_corrected THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'already_confirmed', true,
                    'message', 'Dose was already recorded at ' || to_char(v_existing_log.confirmed_at, 'HH12:MI AM') || '.',
                    'log', row_to_json(v_existing_log)
                );
            END IF;

            -- Update existing pending/due dose
            UPDATE public.dose_logs
            SET status = p_status,
                adherence_status = v_adherence_status,
                source = p_source,
                recorded_by = v_caller_id,
                recorded_by_role = COALESCE(v_membership.role, v_caller_profile.role, 'elderly'),
                actual_at = NOW(),
                confirmed_at = NOW(),
                confirmed_by = v_caller_id,
                notes = COALESCE(p_notes, v_existing_log.notes),
                skip_reason = p_skip_reason,
                updated_at = NOW()
            WHERE id = v_existing_log.id
            RETURNING * INTO v_result_log;
        ELSE
            -- Insert new dose log
            INSERT INTO public.dose_logs (
                care_profile_id,
                medication_id,
                schedule_id,
                dose_identity,
                scheduled_date,
                scheduled_time,
                scheduled_at,
                actual_at,
                status,
                adherence_status,
                source,
                recorded_by,
                recorded_by_role,
                confirmed_at,
                confirmed_by,
                notes,
                skip_reason
            ) VALUES (
                p_care_profile_id,
                p_medication_id,
                p_schedule_id,
                v_dose_identity,
                p_scheduled_date,
                p_scheduled_time,
                v_scheduled_tz,
                NOW(),
                p_status,
                v_adherence_status,
                p_source,
                v_caller_id,
                COALESCE(v_membership.role, v_caller_profile.role, 'elderly'),
                NOW(),
                v_caller_id,
                p_notes,
                p_skip_reason
            ) RETURNING * INTO v_result_log;
        END IF;

        -- Format truthful provenance attribution
        IF p_source = 'caregiver_administered' THEN
            v_provenance_desc := 'Administered by ' || v_caller_profile.full_name || ' — ' || INITCAP(COALESCE(v_membership.role, 'Caretaker')) || '.';
        ELSIF p_source = 'family_reported' THEN
            v_provenance_desc := 'Reported taken by ' || v_caller_profile.full_name || ' — Family Member.';
        ELSIF p_source = 'self' THEN
            v_provenance_desc := v_care_profile.full_name || ' confirmed this dose.';
        ELSE
            v_provenance_desc := v_caller_profile.full_name || ' recorded ' || v_med.name || ' as ' || p_status || '.';
        END IF;
    END IF;

    -- 8. Resolve any pending unconfirmed escalations for this dose
    UPDATE public.notifications
    SET status = 'resolved',
        acknowledged_at = NOW(),
        acknowledged_by = v_caller_id
    WHERE care_profile_id = p_care_profile_id
      AND category = 'unconfirmed_escalation'
      AND status IN ('pending', 'sent')
      AND metadata->>'dose_identity' = v_dose_identity;

    -- 9. Insert immutable activity log
    INSERT INTO public.activity_logs (
        care_profile_id,
        actor_id,
        actor_name,
        actor_role,
        activity_type,
        description,
        metadata
    ) VALUES (
        p_care_profile_id,
        v_caller_id,
        v_caller_profile.full_name,
        COALESCE(v_membership.role, v_caller_profile.role, 'elderly'),
        CASE WHEN p_is_correction THEN 'dose_corrected'
             WHEN p_status = 'taken' THEN 'dose_taken'
             ELSE 'dose_skipped' END,
        v_provenance_desc || ' (' || v_med.name || ' ' || v_med.dosage || ')',
        jsonb_build_object(
            'medication_id', p_medication_id,
            'medication_name', v_med.name,
            'dosage', v_med.dosage,
            'source', p_source,
            'adherence_status', v_adherence_status,
            'scheduled_time', p_scheduled_time,
            'scheduled_date', p_scheduled_date,
            'is_correction', p_is_correction,
            'skip_reason', p_skip_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_confirmed', false,
        'log', row_to_json(v_result_log)
    );
END;
$$;
