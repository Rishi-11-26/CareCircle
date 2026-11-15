-- ============================================================================
-- CARECIRCLE MIGRATION: 20260301000003_p0_security_and_immutability.sql
-- Hardened Authorization, Append-Only Audit, and Rate Limiting
-- ============================================================================

-- 1. Create atomic rate limit table for concurrent-safe brute-force lockout
CREATE TABLE IF NOT EXISTS public.invitation_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Prevent duplicate corrections targeting the same original confirmed event
CREATE UNIQUE INDEX IF NOT EXISTS uq_dose_logs_single_correction 
    ON public.dose_logs (correction_of_id) 
    WHERE (correction_of_id IS NOT NULL);

-- 3. Strict immutability trigger: confirmed dose events cannot be updated or deleted
CREATE OR REPLACE FUNCTION public.enforce_dose_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Strictly reject ANY attempt to DELETE dose log records
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Dose logs are immutable medical audit records and cannot be deleted.';
    END IF;

    -- 2. Strictly reject ANY attempt to UPDATE confirmed dose log records
    IF TG_OP = 'UPDATE' THEN
        -- Confirmed dose events (taken or skipped) cannot be updated at all, ever (including is_corrected, updated_at, notes, or status)
        IF OLD.status IN ('taken', 'skipped') THEN
            RAISE EXCEPTION 'Confirmed dose events (status: %) are immutable audit records and cannot be modified or updated in place. Record an append-only correction instead.', OLD.status;
        END IF;

        -- For preliminary/unconfirmed entries (scheduled, due, unconfirmed), preserve confirmation transition
        -- but strictly prohibit tampering with core schedule and profile identity attributes
        IF NEW.scheduled_date <> OLD.scheduled_date OR
           NEW.scheduled_time <> OLD.scheduled_time OR
           NEW.medication_id <> OLD.medication_id OR
           NEW.care_profile_id <> OLD.care_profile_id OR
           NEW.dose_identity <> OLD.dose_identity THEN
            RAISE EXCEPTION 'Core schedule identity attributes of a dose record cannot be modified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dose_logs_immutability ON public.dose_logs;
CREATE TRIGGER trg_dose_logs_immutability
    BEFORE UPDATE OR DELETE ON public.dose_logs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_dose_log_immutability();

-- 4. Effective dose state projection view
CREATE OR REPLACE VIEW public.v_effective_dose_logs AS
WITH ranked_events AS (
    SELECT
        d.*,
        COALESCE(d.correction_of_id, d.id) AS event_chain_root_id,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(d.correction_of_id, d.id)
            ORDER BY d.created_at DESC, d.id DESC
        ) AS rn
    FROM public.dose_logs d
)
SELECT
    id,
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
    follow_up_status,
    source,
    recorded_by,
    recorded_by_role,
    confirmed_at,
    confirmed_by,
    notes,
    skip_reason,
    correction_of_id,
    correction_reason,
    (correction_of_id IS NOT NULL) AS is_correction,
    event_chain_root_id,
    created_at
FROM ranked_events
WHERE rn = 1;

-- 5. Atomic notification deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_escalation_dose 
    ON public.notifications (care_profile_id, category, (metadata->>'dose_identity'))
    WHERE (category IN ('upcoming_dose', 'unconfirmed_escalation'));

-- 6. Hardened Invitation Redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_invitation(
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_code_hash TEXT;
    v_invite RECORD;
    v_profile RECORD;
    v_existing_member RECORD;
    v_rate_limit RECORD;
    v_new_attempts INTEGER;
BEGIN
    -- 1. Authentication Check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated: Valid user session required to redeem invitations.');
    END IF;

    -- Get caller profile & email
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User profile not found. Please complete profile setup.');
    END IF;
    v_caller_email := v_profile.email;

    -- 2. Concurrency-Safe Server-side Rate Limiting via Exclusive Row Lock
    INSERT INTO public.invitation_rate_limits (user_id, failed_attempts, last_attempt_at)
    VALUES (v_caller_id, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_rate_limit
    FROM public.invitation_rate_limits
    WHERE user_id = v_caller_id
    FOR UPDATE;

    -- Check if currently locked out
    IF v_rate_limit.locked_until IS NOT NULL AND v_rate_limit.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Too many failed passcode attempts. For security, please wait 15 minutes before trying again.'
        );
    END IF;

    -- If lockout has elapsed, reset counter
    IF v_rate_limit.locked_until IS NOT NULL AND v_rate_limit.locked_until <= NOW() THEN
        UPDATE public.invitation_rate_limits
        SET failed_attempts = 0, locked_until = NULL, last_attempt_at = NOW()
        WHERE user_id = v_caller_id;
        v_rate_limit.failed_attempts := 0;
    END IF;

    -- 3. Compute sha256 hash of normalized upper-trimmed passcode
    v_code_hash := encode(extensions.digest(TRIM(UPPER(p_code)), 'sha256'), 'hex');

    -- 4. Find and lock invitation record
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE invite_code_hash = v_code_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        v_new_attempts := v_rate_limit.failed_attempts + 1;
        UPDATE public.invitation_rate_limits
        SET failed_attempts = v_new_attempts,
            locked_until = CASE WHEN v_new_attempts >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            last_attempt_at = NOW()
        WHERE user_id = v_caller_id;

        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (v_caller_id, NOW(), FALSE);
        RETURN jsonb_build_object('success', false, 'error', 'Invalid passcode. Please verify code.');
    END IF;

    -- 5. Status Validations
    IF v_invite.status = 'redeemed' THEN
        v_new_attempts := v_rate_limit.failed_attempts + 1;
        UPDATE public.invitation_rate_limits
        SET failed_attempts = v_new_attempts,
            locked_until = CASE WHEN v_new_attempts >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            last_attempt_at = NOW()
        WHERE user_id = v_caller_id;

        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (v_caller_id, NOW(), FALSE);
        RETURN jsonb_build_object('success', false, 'error', 'This invitation passcode has already been redeemed.');
    END IF;

    IF v_invite.status = 'revoked' THEN
        v_new_attempts := v_rate_limit.failed_attempts + 1;
        UPDATE public.invitation_rate_limits
        SET failed_attempts = v_new_attempts,
            locked_until = CASE WHEN v_new_attempts >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            last_attempt_at = NOW()
        WHERE user_id = v_caller_id;

        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (v_caller_id, NOW(), FALSE);
        RETURN jsonb_build_object('success', false, 'error', 'This invitation has been revoked by the care circle.');
    END IF;

    IF v_invite.expires_at < NOW() THEN
        UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;

        v_new_attempts := v_rate_limit.failed_attempts + 1;
        UPDATE public.invitation_rate_limits
        SET failed_attempts = v_new_attempts,
            locked_until = CASE WHEN v_new_attempts >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            last_attempt_at = NOW()
        WHERE user_id = v_caller_id;

        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (v_caller_id, NOW(), FALSE);
        RETURN jsonb_build_object('success', false, 'error', 'This invitation passcode has expired.');
    END IF;

    -- 6. Email restriction enforcement (if invitation was scoped to a specific recipient email)
    IF v_invite.invitee_email IS NOT NULL AND TRIM(v_invite.invitee_email) <> '' THEN
        IF LOWER(TRIM(v_invite.invitee_email)) <> LOWER(TRIM(v_caller_email)) THEN
            v_new_attempts := v_rate_limit.failed_attempts + 1;
            UPDATE public.invitation_rate_limits
            SET failed_attempts = v_new_attempts,
                locked_until = CASE WHEN v_new_attempts >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
                last_attempt_at = NOW()
            WHERE user_id = v_caller_id;

            INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
            VALUES (v_caller_id, NOW(), FALSE);
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This invitation was issued to a different email address (' || v_invite.invitee_email || ').'
            );
        END IF;
    END IF;

    -- 7. Check existing membership
    SELECT * INTO v_existing_member
    FROM public.care_members
    WHERE care_profile_id = v_invite.care_profile_id
      AND user_id = v_caller_id;

    IF FOUND AND v_existing_member.status = 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already an active member of this Care Circle.');
    END IF;

    -- 8. Activate or Join Circle with Role Permissions
    IF FOUND THEN
        UPDATE public.care_members
        SET status = 'active', role = v_invite.role, joined_at = NOW()
        WHERE id = v_existing_member.id;
    ELSE
        INSERT INTO public.care_members (
            care_profile_id, user_id, role,
            can_manage_medications, can_manage_appointments,
            can_invite_members, can_acknowledge_alerts, receive_email_alerts, status
        ) VALUES (
            v_invite.care_profile_id, v_caller_id, v_invite.role,
            (v_invite.role = 'caretaker'), (v_invite.role = 'caretaker'),
            FALSE, TRUE, TRUE, 'active'
        );
    END IF;

    -- 9. Atomic One-Use Redemption: Update invitation ONLY if still pending
    UPDATE public.invitations
    SET status = 'redeemed', redeemed_at = NOW(), redeemed_by = v_caller_id
    WHERE id = v_invite.id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'This invitation passcode has already been redeemed.');
    END IF;

    -- Reset rate limit counter upon successful redemption
    UPDATE public.invitation_rate_limits
    SET failed_attempts = 0, locked_until = NULL, last_attempt_at = NOW()
    WHERE user_id = v_caller_id;

    -- Record success attempt
    INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
    VALUES (v_caller_id, NOW(), TRUE);

    -- 10. Audit Log in Activity Timeline
    INSERT INTO public.activity_logs (
        care_profile_id, actor_id, actor_name, actor_role, activity_type, description
    ) VALUES (
        v_invite.care_profile_id, v_caller_id,
        v_profile.full_name, v_invite.role,
        'member_joined',
        v_profile.full_name || ' joined the care circle with verified passcode.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'care_profile_id', v_invite.care_profile_id,
        'role', v_invite.role
    );
END;
$$;

-- 7. Hardened Dose Event Recording RPC
CREATE OR REPLACE FUNCTION public.record_dose_event(
    p_care_profile_id UUID,
    p_medication_id UUID,
    p_schedule_id UUID,
    p_scheduled_date DATE,
    p_scheduled_time TIME,
    p_status TEXT,                -- 'taken' or 'skipped'
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_can_manage_meds BOOLEAN := FALSE;
    v_care_profile RECORD;
    v_medication RECORD;
    v_schedule RECORD;
    v_target_log RECORD;
    v_dose_identity TEXT;
    v_existing_log RECORD;
    v_new_log RECORD;
    v_adherence_status TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_sched_timestamptz TIMESTAMPTZ;
    v_diff_minutes NUMERIC;
BEGIN
    -- 1. Authentication Check: Caller must be authenticated
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated: Valid user session required.');
    END IF;

    -- 2. Explicit Source Whitelisting & System Impersonation Defense
    IF p_source = 'system' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized source: System-originated events cannot be recorded by client sessions.'
        );
    END IF;

    IF p_source NOT IN ('self', 'caregiver_administered', 'family_reported') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid source: Must be one of: self, caregiver_administered, family_reported.'
        );
    END IF;

    -- 3. Care Profile Verification: Profile must exist and have a valid IANA timezone
    SELECT * INTO v_care_profile FROM public.care_profiles WHERE id = p_care_profile_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Care profile not found.');
    END IF;

    IF v_care_profile.timezone IS NULL OR TRIM(v_care_profile.timezone) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Care profile is missing a configured IANA timezone.');
    END IF;

    -- 4. Authorization & Permissions Check: Derive caller role and permissions from database
    SELECT role, can_manage_medications INTO v_caller_role, v_can_manage_meds
    FROM public.care_members
    WHERE care_profile_id = p_care_profile_id AND user_id = v_caller_id AND status = 'active';

    IF v_caller_role IS NULL THEN
        IF v_care_profile.owner_id = v_caller_id THEN
            v_caller_role := 'owner';
            v_can_manage_meds := (v_care_profile.assistance_level <> 'caregiver_managed');
        ELSE
            -- Strictly reject unassociated or revoked callers
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unauthorized: Caller is not an active member or owner of this care profile.'
            );
        END IF;
    END IF;

    -- 5. Role-to-Source Authenticity & Assisted Care Level Enforcement
    IF p_source = 'self' THEN
        IF v_caller_role NOT IN ('owner', 'elderly') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid source: Caregivers or family cannot record self-administration on behalf of the elderly individual.'
            );
        END IF;
        IF v_care_profile.assistance_level = 'caregiver_managed' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This profile is in Caregiver Managed mode. Medications must be administered and recorded by an authorized caregiver.'
            );
        END IF;
    END IF;

    IF p_source = 'caregiver_administered' THEN
        IF v_caller_role NOT IN ('caretaker', 'owner') OR NOT v_can_manage_meds THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid source or permission: Only authorized caretakers with medication management permission may record caregiver-administered doses.'
            );
        END IF;
    END IF;

    IF p_source = 'family_reported' THEN
        IF v_caller_role NOT IN ('family', 'owner') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid source: Only family circle members may record family-reported doses.'
            );
        END IF;
    END IF;

    -- 6. Medication Ownership Check: Medication must belong to this specific care profile
    SELECT * INTO v_medication
    FROM public.medications
    WHERE id = p_medication_id AND care_profile_id = p_care_profile_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Medication not found or does not belong to the specified care profile.'
        );
    END IF;

    -- 7. Schedule Consistency Check (if schedule is specified)
    IF p_schedule_id IS NOT NULL THEN
        SELECT * INTO v_schedule
        FROM public.medication_schedules
        WHERE id = p_schedule_id AND medication_id = p_medication_id AND care_profile_id = p_care_profile_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Schedule does not match medication or care profile.'
            );
        END IF;
    END IF;

    -- 8. Status Validation
    IF p_status NOT IN ('taken', 'skipped') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status: Must be taken or skipped.');
    END IF;

    -- 9. Timezone-Aware Confirmation Window Check (Block confirmations >60 minutes early)
    IF p_status = 'taken' AND NOT p_is_correction THEN
        -- Convert local scheduled date & time in care profile's configured IANA timezone to UTC
        v_sched_timestamptz := (p_scheduled_date::TEXT || ' ' || p_scheduled_time::TEXT)::TIMESTAMP AT TIME ZONE v_care_profile.timezone;
        v_diff_minutes := EXTRACT(EPOCH FROM (v_sched_timestamptz - v_now)) / 60;
        IF v_diff_minutes > 60 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Too early to confirm. Confirmation opens 60 minutes prior to scheduled time.'
            );
        END IF;
    END IF;

    v_dose_identity := 'dose_' || p_medication_id::TEXT || '_' || p_scheduled_date::TEXT || '_' || p_scheduled_time::TEXT;
    v_adherence_status := CASE WHEN p_status = 'skipped' THEN 'skipped' ELSE 'on_time' END;

    -- 10. Handle Append-Only Historical Correction
    IF p_is_correction THEN
        IF p_correcting_log_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Missing target dose log ID for correction.');
        END IF;

        -- Verify caller has correction authority: caretaker with can_manage_medications or owner
        IF (v_caller_role = 'caretaker' AND NOT v_can_manage_meds) OR v_caller_role NOT IN ('caretaker', 'owner') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unauthorized: Only authorized caretakers with medication management authority or owners may correct historical dose records.'
            );
        END IF;

        -- Lock target dose log
        SELECT * INTO v_target_log
        FROM public.dose_logs
        WHERE id = p_correcting_log_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target dose log for correction not found.');
        END IF;

        -- Validate all relationships: care profile, medication, schedule, and date/time
        IF v_target_log.care_profile_id <> p_care_profile_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target dose log does not belong to the specified care profile.');
        END IF;

        IF v_target_log.medication_id <> p_medication_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target dose log does not match the specified medication.');
        END IF;

        IF p_schedule_id IS NOT NULL AND v_target_log.schedule_id IS NOT NULL AND v_target_log.schedule_id <> p_schedule_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target dose log does not match the specified schedule.');
        END IF;

        IF v_target_log.scheduled_date <> p_scheduled_date OR v_target_log.scheduled_time <> p_scheduled_time THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target dose log date and time do not match correction parameters.');
        END IF;

        IF v_target_log.status NOT IN ('taken', 'skipped') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Only confirmed dose events (taken or skipped) can be corrected.');
        END IF;

        -- Prevent duplicate or conflicting corrections
        IF EXISTS (
            SELECT 1 FROM public.dose_logs WHERE correction_of_id = v_target_log.id
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This dose event has already been corrected and cannot be corrected again.'
            );
        END IF;

        -- Insert new immutable correction event (Original confirmed event is NEVER updated or modified)
        INSERT INTO public.dose_logs (
            care_profile_id, medication_id, schedule_id,
            dose_identity, scheduled_date, scheduled_time, scheduled_at, actual_at,
            status, adherence_status, source,
            recorded_by, recorded_by_role, confirmed_at, confirmed_by,
            correction_of_id, correction_reason, notes, skip_reason, is_corrected, created_at
        ) VALUES (
            p_care_profile_id, p_medication_id, p_schedule_id,
            v_dose_identity || '_corr_' || EXTRACT(EPOCH FROM v_now)::TEXT,
            p_scheduled_date, p_scheduled_time, v_target_log.scheduled_at, v_now,
            p_status, v_adherence_status, p_source,
            v_caller_id, v_caller_role, v_now, v_caller_id,
            v_target_log.id, p_correction_reason, p_notes, p_skip_reason, FALSE, v_now
        ) RETURNING * INTO v_new_log;

        -- Log correction to immutable activity timeline
        INSERT INTO public.activity_logs (
            care_profile_id, actor_id, actor_name, actor_role, activity_type, description
        ) VALUES (
            p_care_profile_id, v_caller_id,
            COALESCE((SELECT full_name FROM public.profiles WHERE id = v_caller_id), 'Caregiver'),
            v_caller_role,
            'dose_corrected',
            'Dose record for ' || v_medication.name || ' corrected: ' || COALESCE(p_correction_reason, 'Reason logged.')
        );

        RETURN jsonb_build_object('success', true, 'already_confirmed', false, 'log', row_to_json(v_new_log));
    END IF;

    -- 11. Normal Dose Confirmation with Idempotency
    SELECT * INTO v_existing_log
    FROM public.dose_logs
    WHERE care_profile_id = p_care_profile_id
      AND dose_identity = v_dose_identity
      AND correction_of_id IS NULL
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_log.status = 'taken' AND p_status = 'taken' THEN
            RETURN jsonb_build_object('success', true, 'already_confirmed', true, 'log', row_to_json(v_existing_log));
        END IF;

        IF v_existing_log.status IN ('taken', 'skipped') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Dose is already confirmed as ' || v_existing_log.status || '. Modifications must be submitted as an append-only correction.'
            );
        END IF;

        -- If existing entry was preliminary/unconfirmed, record confirmation
        UPDATE public.dose_logs
        SET status = p_status,
            adherence_status = v_adherence_status,
            source = p_source,
            recorded_by = v_caller_id,
            recorded_by_role = v_caller_role,
            confirmed_at = v_now,
            confirmed_by = v_caller_id,
            actual_at = v_now,
            skip_reason = p_skip_reason,
            notes = p_notes,
            updated_at = v_now
        WHERE id = v_existing_log.id
        RETURNING * INTO v_new_log;
    ELSE
        INSERT INTO public.dose_logs (
            care_profile_id, medication_id, schedule_id,
            dose_identity, scheduled_date, scheduled_time, scheduled_at, actual_at,
            status, adherence_status, source,
            recorded_by, recorded_by_role, confirmed_at, confirmed_by,
            skip_reason, notes, is_corrected, created_at
        ) VALUES (
            p_care_profile_id, p_medication_id, p_schedule_id,
            v_dose_identity, p_scheduled_date, p_scheduled_time, v_now, v_now,
            p_status, v_adherence_status, p_source,
            v_caller_id, v_caller_role, v_now, v_caller_id,
            p_skip_reason, p_notes, FALSE, v_now
        ) RETURNING * INTO v_new_log;
    END IF;

    -- 12. Auto-resolve pending unconfirmed escalation notifications
    UPDATE public.notifications
    SET status = 'resolved', acknowledged_at = v_now, acknowledged_by = v_caller_id
    WHERE category = 'unconfirmed_escalation'
      AND care_profile_id = p_care_profile_id
      AND metadata->>'dose_identity' = v_dose_identity;

    -- 13. Record Activity Timeline Entry
    INSERT INTO public.activity_logs (
        care_profile_id, actor_id, actor_name, actor_role, activity_type, description
    ) VALUES (
        p_care_profile_id, v_caller_id,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_caller_id), 'Care Circle Member'),
        v_caller_role,
        CASE WHEN p_status = 'taken' THEN 'dose_taken' ELSE 'dose_skipped' END,
        v_medication.name || ' (' || v_medication.dosage || ') ' ||
        CASE WHEN p_status = 'taken' THEN 'confirmed taken' ELSE 'marked skipped' END ||
        ' via ' || p_source || '.'
    );

    RETURN jsonb_build_object('success', true, 'already_confirmed', false, 'log', row_to_json(v_new_log));
END;
$$;

-- 8. Revoke default PUBLIC privileges and grant least-privilege access
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_care_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_medications(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_appointments(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite_members(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_dose_event(UUID, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_escalation_alert(UUID, TEXT) TO authenticated, service_role;
GRANT SELECT ON public.v_effective_dose_logs TO authenticated, service_role;

-- 9. Profile & Care Profile Insertion Policies for Authenticated Users
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own care profile" ON public.care_profiles;
CREATE POLICY "Users can insert own care profile"
    ON public.care_profiles FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- 10. Auto-provision profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, timezone)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'CareCircle User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'family'),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Auto-provision owner membership when care profile is created
CREATE OR REPLACE FUNCTION public.handle_new_care_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.care_members (
        care_profile_id, user_id, role,
        can_manage_medications, can_manage_appointments,
        can_invite_members, can_acknowledge_alerts, receive_email_alerts, status
    ) VALUES (
        NEW.id, NEW.owner_id, 'owner',
        TRUE, TRUE, TRUE, TRUE, TRUE, 'active'
    ) ON CONFLICT (care_profile_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_care_profile_created ON public.care_profiles;
CREATE TRIGGER on_care_profile_created
    AFTER INSERT ON public.care_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_care_profile();
