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
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Dose logs are immutable medical audit records and cannot be deleted.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Confirmed dose events (taken or skipped) cannot be updated at all, ever
        IF OLD.status IN ('taken', 'skipped') THEN
            RAISE EXCEPTION 'Confirmed dose events are immutable audit records and cannot be modified. Record an append-only correction instead.';
        END IF;

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

-- 5. Revoke default PUBLIC privileges and grant least-privilege access
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_care_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_medications(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_appointments(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite_members(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_dose_event(UUID, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_escalation_alert(UUID, TEXT) TO authenticated, service_role;
GRANT SELECT ON public.v_effective_dose_logs TO authenticated, service_role;
