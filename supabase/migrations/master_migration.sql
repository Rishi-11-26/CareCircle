-- ============================================================================
-- CARECIRCLE DEDICATED DATABASE MASTER MIGRATION
-- Connected care. Independent living.
--
-- Complete production schema, least-privilege RLS policies, audit indexes,
-- immutability triggers, and secure stored procedures (RPCs) with full
-- authentication and role authorization checks.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ============================================================================
-- 2. TABLE DEFINITIONS
-- ============================================================================

-- User Profiles (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'elderly' CHECK (role IN ('elderly', 'family', 'caretaker')),
    avatar_url TEXT,
    emergency_contact TEXT,
    timezone TEXT NOT NULL CHECK (timezone IS NOT NULL AND length(trim(timezone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Care Profiles (The Elderly Individual's Core Healthcare Profile)
CREATE TABLE IF NOT EXISTS public.care_profiles (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    preferred_name TEXT,
    date_of_birth DATE,
    blood_group TEXT,
    allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    emergency_phone TEXT,
    emergency_contact_name TEXT,
    address TEXT,
    medical_notes TEXT,
    assistance_level TEXT NOT NULL DEFAULT 'independent'
        CHECK (assistance_level IN ('independent', 'needs_assistance', 'caregiver_managed')),
    timezone TEXT NOT NULL CHECK (timezone IS NOT NULL AND length(trim(timezone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Care Members (Circle Access, Roles & Granular Permissions)
CREATE TABLE IF NOT EXISTS public.care_members (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'family', 'caretaker')),
    relationship TEXT,
    can_manage_medications BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_appointments BOOLEAN NOT NULL DEFAULT FALSE,
    can_invite_members BOOLEAN NOT NULL DEFAULT FALSE,
    can_acknowledge_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    receive_email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (care_profile_id, user_id)
);

-- Invitations (Passcode-based cryptographically hashed access)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('family', 'caretaker')),
    invite_code_hash TEXT NOT NULL, -- SHA-256 hash of high-entropy 6-character alphanumeric passcode
    code_hint TEXT NOT NULL,        -- Masked hint, e.g. "CARE-***"
    invitee_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track failed passcode redemption attempts for server-side brute-force lockout
CREATE TABLE IF NOT EXISTS public.invitation_redemption_attempts (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE
);

-- Atomic per-user rate limit state for concurrent-safe brute-force lockout
CREATE TABLE IF NOT EXISTS public.invitation_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medications Catalog & Prescriptions
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    generic_name TEXT,
    dosage TEXT NOT NULL,           -- e.g. "50mg", "1 tablet"
    form TEXT DEFAULT 'tablet',     -- tablet, capsule, liquid, injection, inhaler, drops
    instructions TEXT,              -- e.g. "Take with food, morning and night"
    prescribing_doctor TEXT,
    rx_number TEXT,
    refill_date DATE,
    refill_quantity INTEGER,
    current_supply INTEGER,
    color TEXT,
    shape TEXT,
    color_code TEXT DEFAULT '#25483D',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medication Daily Schedules
CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    time_of_day TIME NOT NULL,      -- e.g. '08:00:00'
    label TEXT,                     -- e.g. "Morning Dose"
    days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun, 6=Sat
    grace_period_minutes INTEGER NOT NULL DEFAULT 30,
    escalation_delay_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dose Logs (Idempotent tracking with immutable append-only history and authentic provenance)
CREATE TABLE IF NOT EXISTS public.dose_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
    dose_identity TEXT NOT NULL,    -- Composite unique idempotency key: e.g. "dose_<medId>_2026-03-01_08:00"
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    scheduled_at TIMESTAMPTZ,
    actual_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'due', 'taken', 'skipped', 'unconfirmed')),
    adherence_status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (adherence_status IN ('scheduled', 'on_time', 'late', 'missed', 'unconfirmed', 'skipped')),
    follow_up_status TEXT NOT NULL DEFAULT 'none'
        CHECK (follow_up_status IN ('none', 'unconfirmed', 'contacting', 'verified_taken', 'verified_not_taken', 'unable_to_reach', 'refused_reported', 'escalated')),
    source TEXT NOT NULL DEFAULT 'self'
        CHECK (source IN ('self', 'caregiver_administered', 'family_reported', 'system')),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_by_role TEXT NOT NULL DEFAULT 'elderly'
        CHECK (recorded_by_role IN ('owner', 'elderly', 'family', 'caretaker', 'system')),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    skip_reason TEXT,
    correction_of_id UUID REFERENCES public.dose_logs(id) ON DELETE SET NULL,
    correction_reason TEXT,
    is_corrected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (care_profile_id, dose_identity)
);

-- Medical Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    doctor_name TEXT NOT NULL,
    specialty TEXT,
    location TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications & Escalations
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'upcoming_dose',
        'unconfirmed_escalation',
        'caregiver_acknowledgement',
        'upcoming_appointment',
        'invitation',
        'care_activity'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'resolved')),
    email_status TEXT NOT NULL DEFAULT 'none' CHECK (email_status IN ('none', 'pending', 'sent', 'failed')),
    email_recipient TEXT,
    email_sent_at TIMESTAMPTZ,
    email_error TEXT,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Logs (Immutable Shared Care Timeline)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE & AUDIT QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_care_members_profile ON public.care_members(care_profile_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dose_logs_profile_date ON public.dose_logs(care_profile_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_identity ON public.dose_logs(dose_identity);
CREATE INDEX IF NOT EXISTS idx_dose_logs_profile_status ON public.dose_logs(care_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_dose_logs_scheduled_at ON public.dose_logs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dose_logs_correction ON public.dose_logs(correction_of_id);
CREATE INDEX IF NOT EXISTS idx_med_schedules_profile ON public.medication_schedules(care_profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_profile_date ON public.appointments(care_profile_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(care_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_profile ON public.activity_logs(care_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(invite_code_hash);
CREATE INDEX IF NOT EXISTS idx_invite_attempts_user ON public.invitation_redemption_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON public.invitation_rate_limits(user_id);

-- Enforce single correction per confirmed dose event
CREATE UNIQUE INDEX IF NOT EXISTS uq_dose_logs_single_correction 
    ON public.dose_logs (correction_of_id) 
    WHERE (correction_of_id IS NOT NULL);

-- Enforce atomic single notification per scheduled dose event under concurrency
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_escalation_dose 
    ON public.notifications (care_profile_id, category, (metadata->>'dose_identity'))
    WHERE (category IN ('upcoming_dose', 'unconfirmed_escalation'));

-- ============================================================================
-- 4. SECURITY DEFINER HELPER FUNCTIONS FOR AUTHORIZATION
-- ============================================================================

-- Helper: Verify active circle membership or ownership
CREATE OR REPLACE FUNCTION public.is_care_member(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.care_members
        WHERE care_profile_id = p_profile_id
          AND user_id = auth.uid()
          AND status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.care_profiles
        WHERE id = p_profile_id
          AND owner_id = auth.uid()
    );
$$;

-- Helper: Check if caller can manage medications in this circle
CREATE OR REPLACE FUNCTION public.can_manage_medications(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.care_members
        WHERE care_profile_id = p_profile_id
          AND user_id = auth.uid()
          AND status = 'active'
          AND can_manage_medications = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.care_profiles
        WHERE id = p_profile_id
          AND owner_id = auth.uid()
    );
$$;

-- Helper: Check if caller can manage appointments in this circle
CREATE OR REPLACE FUNCTION public.can_manage_appointments(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.care_members
        WHERE care_profile_id = p_profile_id
          AND user_id = auth.uid()
          AND status = 'active'
          AND can_manage_appointments = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.care_profiles
        WHERE id = p_profile_id
          AND owner_id = auth.uid()
    );
$$;

-- Helper: Check if caller can invite new members to this circle
CREATE OR REPLACE FUNCTION public.can_invite_members(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.care_members
        WHERE care_profile_id = p_profile_id
          AND user_id = auth.uid()
          AND status = 'active'
          AND can_invite_members = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.care_profiles
        WHERE id = p_profile_id
          AND owner_id = auth.uid()
    );
$$;

-- ============================================================================
-- 5. IMMUTABILITY & ANTI-ESCALATION DATABASE TRIGGERS
-- ============================================================================

-- Trigger Function: Enforce immutable audit records on dose_logs
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

-- Trigger Function: Enforce immutable activity logs
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

-- Trigger Function: Prevent user profile role self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent an authenticated user from changing their own global profile role
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

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES — IDEMPOTENT & LEAST-PRIVILEGE
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_redemption_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- --- RLS: profiles ---
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- --- RLS: care_profiles ---
DROP POLICY IF EXISTS "Circle members can view care profile" ON public.care_profiles;
CREATE POLICY "Circle members can view care profile"
    ON public.care_profiles FOR SELECT
    USING (public.is_care_member(id));

DROP POLICY IF EXISTS "Owners can update care profile" ON public.care_profiles;
CREATE POLICY "Owners can update care profile"
    ON public.care_profiles FOR UPDATE
    USING (owner_id = auth.uid());

-- --- RLS: care_members ---
DROP POLICY IF EXISTS "Circle members can view roster" ON public.care_members;
CREATE POLICY "Circle members can view roster"
    ON public.care_members FOR SELECT
    USING (public.is_care_member(care_profile_id));

DROP POLICY IF EXISTS "Owners can manage members" ON public.care_members;
CREATE POLICY "Owners can manage members"
    ON public.care_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.care_profiles
            WHERE id = care_members.care_profile_id AND owner_id = auth.uid()
        )
    );

-- --- RLS: invitations ---
DROP POLICY IF EXISTS "Authorized members can view circle invitations" ON public.invitations;
CREATE POLICY "Authorized members can view circle invitations"
    ON public.invitations FOR SELECT
    USING (public.can_invite_members(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can create invitations" ON public.invitations;
CREATE POLICY "Authorized members can create invitations"
    ON public.invitations FOR INSERT
    WITH CHECK (public.can_invite_members(care_profile_id) AND inviter_id = auth.uid());

DROP POLICY IF EXISTS "Authorized members can revoke invitations" ON public.invitations;
CREATE POLICY "Authorized members can revoke invitations"
    ON public.invitations FOR UPDATE
    USING (public.can_invite_members(care_profile_id));

-- --- RLS: medications ---
DROP POLICY IF EXISTS "Circle members can view medications" ON public.medications;
CREATE POLICY "Circle members can view medications"
    ON public.medications FOR SELECT
    USING (public.is_care_member(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can insert medications" ON public.medications;
CREATE POLICY "Authorized members can insert medications"
    ON public.medications FOR INSERT
    WITH CHECK (public.can_manage_medications(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can update medications" ON public.medications;
CREATE POLICY "Authorized members can update medications"
    ON public.medications FOR UPDATE
    USING (public.can_manage_medications(care_profile_id));

-- --- RLS: medication_schedules ---
DROP POLICY IF EXISTS "Circle members can view schedules" ON public.medication_schedules;
CREATE POLICY "Circle members can view schedules"
    ON public.medication_schedules FOR SELECT
    USING (public.is_care_member(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can insert schedules" ON public.medication_schedules;
CREATE POLICY "Authorized members can insert schedules"
    ON public.medication_schedules FOR INSERT
    WITH CHECK (public.can_manage_medications(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can update schedules" ON public.medication_schedules;
CREATE POLICY "Authorized members can update schedules"
    ON public.medication_schedules FOR UPDATE
    USING (public.can_manage_medications(care_profile_id));

-- --- RLS: dose_logs ---
DROP POLICY IF EXISTS "Circle members can view dose logs" ON public.dose_logs;
CREATE POLICY "Circle members can view dose logs"
    ON public.dose_logs FOR SELECT
    USING (public.is_care_member(care_profile_id));

-- Note: Dose log confirmations and corrections are executed via the record_dose_event RPC
-- which strictly enforces authentication, role validity, and window limits under SECURITY DEFINER.

-- --- RLS: appointments ---
DROP POLICY IF EXISTS "Circle members can view appointments" ON public.appointments;
CREATE POLICY "Circle members can view appointments"
    ON public.appointments FOR SELECT
    USING (public.is_care_member(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can insert appointments" ON public.appointments;
CREATE POLICY "Authorized members can insert appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (public.can_manage_appointments(care_profile_id));

DROP POLICY IF EXISTS "Authorized members can update appointments" ON public.appointments;
CREATE POLICY "Authorized members can update appointments"
    ON public.appointments FOR UPDATE
    USING (public.can_manage_appointments(care_profile_id));

-- --- RLS: notifications ---
DROP POLICY IF EXISTS "Circle members can view notifications" ON public.notifications;
CREATE POLICY "Circle members can view notifications"
    ON public.notifications FOR SELECT
    USING (public.is_care_member(care_profile_id));

-- --- RLS: activity_logs ---
DROP POLICY IF EXISTS "Circle members can view activity logs" ON public.activity_logs;
CREATE POLICY "Circle members can view activity logs"
    ON public.activity_logs FOR SELECT
    USING (public.is_care_member(care_profile_id));

-- ============================================================================
-- 7. HARDENED RPC STORED PROCEDURES (P0 SECURITY REMEDIATION)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: redeem_invitation
-- Derives identity exclusively from auth.uid(), locks row with FOR UPDATE,
-- enforces 5-attempt/15-min brute force lockout, and checks email restrictions.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- RPC 2: record_dose_event
-- Hardened dose confirmation and append-only correction engine.
-- Rejects unauthenticated callers, validates membership, verifies medication/schedule
-- ownership, validates role-to-source relationships, and enforces timezone-aware windows.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- RPC 3: acknowledge_escalation_alert
-- Validates caller identity from auth.uid(), checks active circle membership
-- and alert acknowledgment permissions, locks notification record, and writes
-- audit entry transactionally.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_escalation_alert(
    p_notification_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_name TEXT;
    v_caller_role TEXT;
    v_can_ack BOOLEAN := FALSE;
    v_notif RECORD;
BEGIN
    -- 1. Authentication Check
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated: Valid user session required.');
    END IF;

    -- 2. Lock notification record
    SELECT * INTO v_notif FROM public.notifications WHERE id = p_notification_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Notification not found.');
    END IF;

    -- 3. Authorization Check: Derive caller name and role from database
    SELECT role, can_acknowledge_alerts INTO v_caller_role, v_can_ack
    FROM public.care_members
    WHERE care_profile_id = v_notif.care_profile_id AND user_id = v_caller_id AND status = 'active';

    IF v_caller_role IS NULL THEN
        SELECT 'owner', true INTO v_caller_role, v_can_ack
        FROM public.care_profiles
        WHERE id = v_notif.care_profile_id AND owner_id = v_caller_id;
    END IF;

    IF v_caller_role IS NULL OR NOT v_can_ack THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Caller is not permitted to acknowledge alerts for this care circle.'
        );
    END IF;

    SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = v_caller_id;

    -- 4. State validation
    IF v_notif.status = 'acknowledged' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Alert was already acknowledged.');
    END IF;

    -- 5. Atomic Update
    UPDATE public.notifications
    SET status = 'acknowledged',
        acknowledged_at = NOW(),
        acknowledged_by = v_caller_id,
        metadata = jsonb_set(COALESCE(metadata, '{}'::JSONB), '{acknowledgement_note}', to_jsonb(COALESCE(p_note, '')))
    WHERE id = p_notification_id;

    -- 6. Audit Timeline Logging
    INSERT INTO public.activity_logs (
        care_profile_id, actor_id, actor_name, actor_role, activity_type, description
    ) VALUES (
        v_notif.care_profile_id, v_caller_id,
        COALESCE(v_caller_name, 'Care Circle Member'), v_caller_role,
        'alert_acknowledged',
        COALESCE(v_caller_name, 'Caregiver') || ' acknowledged escalation alert: "' || v_notif.title || '"' ||
        CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN ' Note: "' || p_note || '"' ELSE '.' END
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 8. EFFECTIVE DOSE STATE PROJECTION VIEW
-- Derives the current effective dose state through an append-only projection
-- without modifying original confirmed dose records.
-- ============================================================================
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

-- Prevent duplicate corrections targeting the same original confirmed event
CREATE UNIQUE INDEX IF NOT EXISTS uq_dose_logs_single_correction 
    ON public.dose_logs (correction_of_id) 
    WHERE (correction_of_id IS NOT NULL);

-- ============================================================================
-- 9. LEAST-PRIVILEGE FUNCTION PERMISSIONS & GRANTS
-- Revokes default PUBLIC execution rights from all SECURITY DEFINER functions
-- and grants access strictly to authenticated users and service_role.
-- ============================================================================
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_care_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_medications(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_appointments(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite_members(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_dose_event(UUID, UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_escalation_alert(UUID, TEXT) TO authenticated, service_role;

-- Grant access to effective dose state view
GRANT SELECT ON public.v_effective_dose_logs TO authenticated, service_role;
