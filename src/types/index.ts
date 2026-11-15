export type UserRole = 'elderly' | 'family' | 'caretaker';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  emergency_contact?: string;
  timezone?: string;
  created_at?: string;
}

export interface CareProfile {
  id: string;
  owner_id: string;
  full_name: string;
  preferred_name?: string;
  date_of_birth?: string;
  blood_group?: string;
  allergies?: string[];
  emergency_phone?: string;
  address?: string;
  medical_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CareMember {
  id: string;
  care_profile_id: string;
  user_id: string;
  role: 'owner' | 'family' | 'caretaker';
  can_manage_medications: boolean;
  can_manage_appointments: boolean;
  can_invite_members: boolean;
  can_acknowledge_alerts: boolean;
  receive_email_alerts: boolean;
  status: 'active' | 'revoked';
  joined_at: string;
  profile?: UserProfile;
}

export interface Invitation {
  id: string;
  care_profile_id: string;
  inviter_id: string;
  role: 'family' | 'caretaker';
  invite_code_hash: string;
  code_hint: string;
  invitee_email?: string;
  status: 'pending' | 'redeemed' | 'expired' | 'revoked';
  expires_at: string;
  redeemed_at?: string;
  redeemed_by?: string;
  created_at: string;
  care_profile?: CareProfile;
}

export interface Medication {
  id: string;
  care_profile_id: string;
  name: string;
  generic_name?: string;
  dosage: string;
  form: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'drops' | 'patch';
  instructions?: string;
  prescribing_doctor?: string;
  rx_number?: string;
  refill_date?: string;
  refill_quantity?: number;
  color_code?: string;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  created_at?: string;
  schedules?: MedicationSchedule[];
}

export interface MedicationSchedule {
  id: string;
  care_profile_id: string;
  medication_id: string;
  time_of_day: string; // '08:00'
  label?: string;      // 'Morning dose'
  days_of_week: number[]; // [0,1,2,3,4,5,6]
  grace_period_minutes: number;
  escalation_delay_minutes: number;
  is_active: boolean;
  medication?: Medication;
}

export type DoseStatus = 'scheduled' | 'due' | 'taken' | 'skipped' | 'unconfirmed';

export interface DoseLog {
  id: string;
  care_profile_id: string;
  medication_id: string;
  schedule_id?: string;
  dose_identity: string; // e.g., 'dose_med123_2026-03-01_08:00'
  scheduled_date: string; // 'YYYY-MM-DD'
  scheduled_time: string; // '08:00'
  status: DoseStatus;
  confirmed_at?: string;
  confirmed_by?: string;
  notes?: string;
  skip_reason?: string;
  created_at?: string;
  medication?: Medication;
  schedule?: MedicationSchedule;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  care_profile_id: string;
  doctor_name: string;
  specialty?: string;
  location: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
  status: AppointmentStatus;
  reminder_sent: boolean;
  created_by?: string;
  created_at?: string;
}

export type NotificationCategory =
  | 'upcoming_dose'
  | 'unconfirmed_escalation'
  | 'caregiver_acknowledgement'
  | 'upcoming_appointment'
  | 'invitation'
  | 'care_activity';

export type NotificationPriority = 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  care_profile_id: string;
  user_id?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: 'pending' | 'sent' | 'acknowledged' | 'resolved';
  email_status: 'none' | 'pending' | 'sent' | 'failed';
  email_recipient?: string;
  email_sent_at?: string;
  email_error?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  care_profile_id: string;
  actor_id?: string;
  actor_name: string;
  actor_role: string;
  activity_type:
    | 'medication_created'
    | 'medication_updated'
    | 'dose_taken'
    | 'dose_skipped'
    | 'dose_unconfirmed_escalated'
    | 'alert_acknowledged'
    | 'appointment_created'
    | 'appointment_cancelled'
    | 'member_joined'
    | 'member_removed';
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CareInsight {
  id: string;
  type: 'missed_pattern' | 'adherence_shift' | 'acknowledgement_delay' | 'appointment_upcoming' | 'routine_stability';
  title: string;
  observation: string;
  evidence: {
    count: number;
    timeframe: string;
    eventIds: string[];
    doseIdentities?: string[];
  };
  recommendedAction: string;
  severity: 'info' | 'attention' | 'urgent';
  generatedAt: string;
}

export interface AdherenceAnalytics {
  totalScheduled: number;
  confirmedCount: number;
  skippedCount: number;
  unconfirmedCount: number;
  adherenceRate: number; // percentage 0-100
  weeklyTrend: {
    date: string;
    dayLabel: string;
    total: number;
    confirmed: number;
    rate: number;
  }[];
}
