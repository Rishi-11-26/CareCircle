-- ============================================================================
-- CARECIRCLE STORED PROCEDURES & RPC FUNCTIONS
-- Secure Passcode Verification, Rate Limiting, Dose Confirmation & Caregiver Acknowledgement
-- ============================================================================

-- Table to track failed passcode redemption attempts for rate limiting
CREATE TABLE IF NOT EXISTS public.invitation_redemption_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_user
    ON public.invitation_redemption_attempts(user_id, attempted_at DESC);

-- Function to redeem an invitation passcode securely with server-side rate limiting
CREATE OR REPLACE FUNCTION public.redeem_invitation(
    p_code TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code_hash TEXT;
    v_invite RECORD;
    v_profile RECORD;
    v_care_profile RECORD;
    v_existing_member RECORD;
    v_failed_attempts INTEGER;
BEGIN
    -- 1. Server-side Rate Limiting: Max 5 failed attempts per 15 minutes
    SELECT COUNT(*) INTO v_failed_attempts
    FROM public.invitation_redemption_attempts
    WHERE user_id = p_user_id
      AND attempted_at > (NOW() - INTERVAL '15 minutes')
      AND success = FALSE;

    IF v_failed_attempts >= 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Too many failed passcode attempts. For security, please wait 15 minutes before trying again.'
        );
    END IF;

    -- 2. Compute sha256 hash of the normalized upper-trimmed passcode
    v_code_hash := encode(digest(TRIM(UPPER(p_code)), 'sha256'), 'hex');

    -- 3. Find the invitation
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE invite_code_hash = v_code_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Record failed attempt
        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (p_user_id, NOW(), FALSE);

        RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation passcode.');
    END IF;

    IF v_invite.status = 'redeemed' THEN
        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (p_user_id, NOW(), FALSE);

        RETURN jsonb_build_object('success', false, 'error', 'This invitation passcode has already been redeemed.');
    END IF;

    IF v_invite.status = 'revoked' THEN
        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (p_user_id, NOW(), FALSE);

        RETURN jsonb_build_object('success', false, 'error', 'This invitation has been revoked by the care circle owner.');
    END IF;

    IF v_invite.expires_at < NOW() THEN
        UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;
        INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
        VALUES (p_user_id, NOW(), FALSE);

        RETURN jsonb_build_object('success', false, 'error', 'This invitation passcode has expired.');
    END IF;

    -- 4. Check if user is already an active member
    SELECT * INTO v_existing_member
    FROM public.care_members
    WHERE care_profile_id = v_invite.care_profile_id AND user_id = p_user_id;

    IF FOUND AND v_existing_member.status = 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already an active member of this Care Circle.');
    END IF;

    -- Retrieve user profile details for logging
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_care_profile FROM public.care_profiles WHERE id = v_invite.care_profile_id;

    -- 5. Insert or reactivate care member
    IF FOUND THEN
        UPDATE public.care_members
        SET status = 'active',
            role = v_invite.role,
            joined_at = NOW()
        WHERE id = v_existing_member.id;
    ELSE
        INSERT INTO public.care_members (
            care_profile_id,
            user_id,
            role,
            can_manage_medications,
            can_manage_appointments,
            can_invite_members,
            can_acknowledge_alerts,
            receive_email_alerts,
            status
        ) VALUES (
            v_invite.care_profile_id,
            p_user_id,
            v_invite.role,
            (v_invite.role = 'caretaker'),
            (v_invite.role = 'caretaker'),
            false,
            true,
            true,
            'active'
        );
    END IF;

    -- 6. Mark invitation as redeemed (one-time redemption guarantee)
    UPDATE public.invitations
    SET status = 'redeemed',
        redeemed_at = NOW(),
        redeemed_by = p_user_id
    WHERE id = v_invite.id;

    -- Record successful attempt to reset rate limits
    INSERT INTO public.invitation_redemption_attempts (user_id, attempted_at, success)
    VALUES (p_user_id, NOW(), TRUE);

    -- 7. Insert into activity logs
    INSERT INTO public.activity_logs (
        care_profile_id,
        actor_id,
        actor_name,
        actor_role,
        activity_type,
        description,
        metadata
    ) VALUES (
        v_invite.care_profile_id,
        p_user_id,
        COALESCE(v_profile.full_name, 'New Member'),
        v_invite.role,
        'member_joined',
        COALESCE(v_profile.full_name, 'New Member') || ' joined the care circle as ' || INITCAP(v_invite.role) || '.',
        jsonb_build_object('role', v_invite.role, 'invitation_id', v_invite.id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'care_profile_id', v_invite.care_profile_id,
        'role', v_invite.role,
        'care_profile_name', v_care_profile.full_name
    );
END;
$$;

-- Function to record or update dose log idempotently with duplicate prevention
CREATE OR REPLACE FUNCTION public.record_dose_action(
    p_care_profile_id UUID,
    p_medication_id UUID,
    p_schedule_id UUID,
    p_scheduled_date DATE,
    p_scheduled_time TIME,
    p_status TEXT, -- 'taken' or 'skipped'
    p_confirmed_by UUID,
    p_actor_name TEXT,
    p_actor_role TEXT,
    p_notes TEXT DEFAULT NULL,
    p_skip_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dose_identity TEXT;
    v_existing_log RECORD;
    v_med_record RECORD;
    v_result_log RECORD;
BEGIN
    -- Validate action status
    IF p_status NOT IN ('taken', 'skipped') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status. Must be taken or skipped.');
    END IF;

    -- Form unique dose identity
    v_dose_identity := 'dose_' || p_medication_id || '_' || to_char(p_scheduled_date, 'YYYY-MM-DD') || '_' || to_char(p_scheduled_time, 'HH24:MI');

    -- Lookup medication
    SELECT * INTO v_med_record FROM public.medications WHERE id = p_medication_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Medication not found.');
    END IF;

    -- Check if dose log already exists
    SELECT * INTO v_existing_log
    FROM public.dose_logs
    WHERE care_profile_id = p_care_profile_id AND dose_identity = v_dose_identity;

    IF FOUND THEN
        -- If already confirmed as taken, prevent duplicate accidental confirmation
        IF v_existing_log.status = 'taken' AND p_status = 'taken' THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_confirmed', true,
                'message', 'Dose was already confirmed as taken at ' || to_char(v_existing_log.confirmed_at, 'HH12:MI AM') || '.',
                'log', row_to_json(v_existing_log)
            );
        END IF;

        -- Update the log
        UPDATE public.dose_logs
        SET status = p_status,
            confirmed_at = NOW(),
            confirmed_by = p_confirmed_by,
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
            status,
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
            p_status,
            NOW(),
            p_confirmed_by,
            p_notes,
            p_skip_reason
        )
        RETURNING * INTO v_result_log;
    END IF;

    -- Resolve any pending unconfirmed escalation notifications for this specific dose
    UPDATE public.notifications
    SET status = 'resolved',
        acknowledged_at = NOW(),
        acknowledged_by = p_confirmed_by
    WHERE care_profile_id = p_care_profile_id
      AND category = 'unconfirmed_escalation'
      AND status IN ('pending', 'sent')
      AND metadata->>'dose_identity' = v_dose_identity;

    -- Record activity
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
        p_confirmed_by,
        p_actor_name,
        p_actor_role,
        CASE WHEN p_status = 'taken' THEN 'dose_taken' ELSE 'dose_skipped' END,
        p_actor_name || ' recorded ' || v_med_record.name || ' (' || v_med_record.dosage || ') as ' || p_status || '.',
        jsonb_build_object(
            'medication_id', p_medication_id,
            'medication_name', v_med_record.name,
            'dosage', v_med_record.dosage,
            'dose_identity', v_dose_identity,
            'scheduled_time', p_scheduled_time,
            'scheduled_date', p_scheduled_date,
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

-- Function to acknowledge an escalation alert by caregiver
CREATE OR REPLACE FUNCTION public.acknowledge_escalation_alert(
    p_notification_id UUID,
    p_acknowledged_by UUID,
    p_actor_name TEXT,
    p_actor_role TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_notif RECORD;
BEGIN
    SELECT * INTO v_notif
    FROM public.notifications
    WHERE id = p_notification_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Notification not found.');
    END IF;

    IF v_notif.status = 'acknowledged' THEN
        RETURN jsonb_build_object('success', true, 'already_acknowledged', true);
    END IF;

    UPDATE public.notifications
    SET status = 'acknowledged',
        acknowledged_at = NOW(),
        acknowledged_by = p_acknowledged_by,
        metadata = jsonb_set(COALESCE(metadata, '{}'::JSONB), '{acknowledgement_note}', to_jsonb(p_note))
    WHERE id = p_notification_id;

    -- Log to activity timeline
    INSERT INTO public.activity_logs (
        care_profile_id,
        actor_id,
        actor_name,
        actor_role,
        activity_type,
        description,
        metadata
    ) VALUES (
        v_notif.care_profile_id,
        p_acknowledged_by,
        p_actor_name,
        p_actor_role,
        'alert_acknowledged',
        p_actor_name || ' (' || INITCAP(p_actor_role) || ') acknowledged the unconfirmed dose alert: "' || v_notif.title || '".',
        jsonb_build_object(
            'notification_id', p_notification_id,
            'note', p_note,
            'original_title', v_notif.title
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
