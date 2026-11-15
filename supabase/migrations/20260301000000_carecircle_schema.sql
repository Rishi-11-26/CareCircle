-- ============================================================================
-- CARECIRCLE DEDICATED DATABASE SCHEMA MIGRATION
-- Connected care. Independent living.
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. User Profiles (Extends auth.users or standalone profile table)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('elderly', 'family', 'caretaker')),
    avatar_url TEXT,
    emergency_contact TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Care Profiles (The Elderly Person's Healthcare Profile)
CREATE TABLE IF NOT EXISTS public.care_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    preferred_name TEXT,
    date_of_birth DATE,
    blood_group TEXT,
    allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    emergency_phone TEXT,
    address TEXT,
    medical_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Care Members (Circle Access & Permissions)
CREATE TABLE IF NOT EXISTS public.care_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'family', 'caretaker')),
    can_manage_medications BOOLEAN DEFAULT FALSE,
    can_manage_appointments BOOLEAN DEFAULT FALSE,
    can_invite_members BOOLEAN DEFAULT FALSE,
    can_acknowledge_alerts BOOLEAN DEFAULT TRUE,
    receive_email_alerts BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (care_profile_id, user_id)
);

-- 5. Invitations (Passcode-based cryptographically hashed access)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('family', 'caretaker')),
    invite_code_hash TEXT NOT NULL, -- SHA-256 hash of random alphanumeric 8-char passcode
    code_hint TEXT NOT NULL,        -- Masked hint, e.g. "CARE-***"
    invitee_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Medications
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    color_code TEXT DEFAULT '#25483D',
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Medication Schedules
CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    time_of_day TIME NOT NULL,      -- e.g. '08:00:00'
    label TEXT,                     -- e.g. "Morning Dose"
    days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun, 6=Sat
    grace_period_minutes INTEGER DEFAULT 30,
    escalation_delay_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Dose Logs (Idempotent tracking with unique dose identities)
CREATE TABLE IF NOT EXISTS public.dose_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
    dose_identity TEXT NOT NULL,    -- Composite unique idempotency key: e.g. "med_<id>_2026-03-01_08:00"
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'due', 'taken', 'skipped', 'unconfirmed')),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    skip_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (care_profile_id, dose_identity)
);

-- 9. Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    doctor_name TEXT NOT NULL,
    specialty TEXT,
    location TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Notifications (In-app and Email Escalation queue)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Optional recipient user
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Activity Logs (Shared Care Timeline)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    care_profile_id UUID NOT NULL REFERENCES public.care_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE & HIGH CONCURRENCY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_care_members_profile ON public.care_members(care_profile_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dose_logs_profile_date ON public.dose_logs(care_profile_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_identity ON public.dose_logs(dose_identity);
CREATE INDEX IF NOT EXISTS idx_med_schedules_profile ON public.medication_schedules(care_profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_profile_date ON public.appointments(care_profile_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(care_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_profile ON public.activity_logs(care_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(invite_code_hash);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and edit their own profile
CREATE POLICY "Users can view any member profile in their circle"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.care_members m1
            JOIN public.care_members m2 ON m1.care_profile_id = m2.care_profile_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
        )
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Care Profiles: Accessible only to members who belong to it with active status
CREATE POLICY "Active care members can view care profile"
    ON public.care_profiles FOR SELECT
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = care_profiles.id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Owner can update care profile"
    ON public.care_profiles FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can create care profile"
    ON public.care_profiles FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Care Members
CREATE POLICY "Members can view membership in their circle"
    ON public.care_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.care_members cm
            WHERE cm.care_profile_id = care_members.care_profile_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    );

CREATE POLICY "Owners or authorized members can manage care members"
    ON public.care_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.care_profiles cp
            WHERE cp.id = care_members.care_profile_id
            AND cp.owner_id = auth.uid()
        )
    );

-- Medications, Schedules, Dose Logs, Appointments, Notifications, Activity Logs
-- Generic policy: Active care circle members have access based on permissions
CREATE POLICY "Active members can view medications"
    ON public.medications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = medications.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Authorized members can manage medications"
    ON public.medications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = medications.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
            AND (care_members.role = 'owner' OR care_members.can_manage_medications = TRUE)
        )
    );

-- Dose logs: All active members can view and record/confirm doses
CREATE POLICY "Active members can view dose logs"
    ON public.dose_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = dose_logs.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Active members can record dose logs"
    ON public.dose_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = dose_logs.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

-- Appointments
CREATE POLICY "Active members can view appointments"
    ON public.appointments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = appointments.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Authorized members can manage appointments"
    ON public.appointments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = appointments.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
            AND (care_members.role = 'owner' OR care_members.can_manage_appointments = TRUE)
        )
    );

-- Notifications
CREATE POLICY "Active members can view circle notifications"
    ON public.notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = notifications.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Active members can update/acknowledge notifications"
    ON public.notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = notifications.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
            AND care_members.can_acknowledge_alerts = TRUE
        )
    );

-- Activity Logs
CREATE POLICY "Active members can view activity logs"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = activity_logs.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );

CREATE POLICY "Active members can create activity logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.care_members
            WHERE care_members.care_profile_id = activity_logs.care_profile_id
            AND care_members.user_id = auth.uid()
            AND care_members.status = 'active'
        )
    );
