-- ============================================================================
-- CARECIRCLE MIGRATION 003: P0 SECURITY REMEDIATION, IMMUTABILITY & RPC HARDENING
-- ============================================================================

-- 1. Ensure extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Immutability & Anti-Escalation Triggers
CREATE OR REPLACE FUNCTION public.enforce_dose_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Dose logs are immutable medical audit records and cannot be deleted.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('taken', 'skipped') THEN
            IF NEW.scheduled_date <> OLD.scheduled_date OR
               NEW.scheduled_time <> OLD.scheduled_time OR
               NEW.medication_id <> OLD.medication_id OR
               NEW.care_profile_id <> OLD.care_profile_id OR
               NEW.dose_identity <> OLD.dose_identity OR
               NEW.recorded_by <> OLD.recorded_by THEN
                RAISE EXCEPTION 'Core medical attributes of a confirmed dose record cannot be modified. Record an append-only correction instead.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dose_logs_immutability ON public.dose_logs;
CREATE TRIGGER trg_dose_logs_immutability
    BEFORE UPDATE OR DELETE ON public.dose_logs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_dose_log_immutability();

CREATE OR REPLACE FUNCTION public.enforce_activity_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Activity logs are immutable audit records and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_logs_immutability ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_immutability
    BEFORE UPDATE OR DELETE ON public.activity_logs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_log_immutability();

CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND auth.uid() = OLD.id AND NEW.role <> OLD.role THEN
        RAISE EXCEPTION 'Users cannot elevate their own profile role. Roles are assigned through verified circle invitations.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_self_escalation();
