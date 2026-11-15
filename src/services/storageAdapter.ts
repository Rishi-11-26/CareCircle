import {
  UserProfile,
  CareProfile,
  CareMember,
  Invitation,
  Medication,
  MedicationSchedule,
  DoseLog,
  Appointment,
  Notification,
  ActivityLog,
  AssistanceLevel,
  DoseEventSource,
  FollowUpStatus,
} from '@/types';
import { hashPasscode, maskPasscodeHint } from '@/lib/crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { validateConfirmationWindow, DEFAULT_PROFILE_TIMEZONE } from '@/lib/dateUtils';
import { format, subDays, addDays } from 'date-fns';

const STORAGE_KEYS = {
  USER: 'carecircle_current_user',
  CARE_PROFILES: 'carecircle_care_profiles',
  CARE_MEMBERS: 'carecircle_care_members',
  INVITATIONS: 'carecircle_invitations',
  MEDICATIONS: 'carecircle_medications',
  SCHEDULES: 'carecircle_schedules',
  DOSE_LOGS: 'carecircle_dose_logs',
  APPOINTMENTS: 'carecircle_appointments',
  NOTIFICATIONS: 'carecircle_notifications',
  ACTIVITY_LOGS: 'carecircle_activity_logs',
};

// Seed synthetic data generator for demonstration
export function generateSeedData() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const dayBefore = format(subDays(new Date(), 2), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const inThreeDays = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const elderlyUser: UserProfile = {
    id: 'user_margaret',
    email: 'margaret.hayes@example.org',
    full_name: 'Margaret Hayes',
    role: 'elderly',
    phone: '(555) 234-8901',
    emergency_contact: 'David Hayes (Son) - (555) 876-5432',
    avatar_url: '',
    created_at: subDays(new Date(), 30).toISOString(),
  };

  const familyUser: UserProfile = {
    id: 'user_david',
    email: 'david.hayes@example.org',
    full_name: 'David Hayes',
    role: 'family',
    phone: '(555) 876-5432',
    created_at: subDays(new Date(), 28).toISOString(),
  };

  const caretakerUser: UserProfile = {
    id: 'user_elena',
    email: 'elena.rostova@carepartners.org',
    full_name: 'Nurse Elena Rostova',
    role: 'caretaker',
    phone: '(555) 345-6789',
    created_at: subDays(new Date(), 20).toISOString(),
  };

  const careProfile: CareProfile = {
    id: 'profile_margaret',
    owner_id: elderlyUser.id,
    full_name: 'Margaret Hayes',
    preferred_name: 'Margaret',
    date_of_birth: '1948-06-14',
    blood_group: 'A+',
    allergies: ['Penicillin', 'Sulfa Antibiotics'],
    emergency_phone: '(555) 876-5432',
    address: '422 Elmwood Terrace, Apt 3B, Portland, OR',
    medical_notes: 'Mild hypertension, early osteoarthritis in knees. Prefers large print and simple reminder alerts.',
    assistance_level: 'needs_assistance',
    timezone: 'America/Los_Angeles',
    created_at: subDays(new Date(), 30).toISOString(),
  };

  const careMembers: CareMember[] = [
    {
      id: 'member_owner',
      care_profile_id: careProfile.id,
      user_id: elderlyUser.id,
      role: 'owner',
      can_manage_medications: true,
      can_manage_appointments: true,
      can_invite_members: true,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: subDays(new Date(), 30).toISOString(),
      profile: elderlyUser,
    },
    {
      id: 'member_family',
      care_profile_id: careProfile.id,
      user_id: familyUser.id,
      role: 'family',
      can_manage_medications: false,
      can_manage_appointments: true,
      can_invite_members: false,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: subDays(new Date(), 28).toISOString(),
      profile: familyUser,
    },
    {
      id: 'member_caretaker',
      care_profile_id: careProfile.id,
      user_id: caretakerUser.id,
      role: 'caretaker',
      can_manage_medications: true,
      can_manage_appointments: true,
      can_invite_members: false,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: subDays(new Date(), 20).toISOString(),
      profile: caretakerUser,
    },
  ];

  const medications: Medication[] = [
    {
      id: 'med_lisinopril',
      care_profile_id: careProfile.id,
      name: 'Lisinopril',
      generic_name: 'Lisinopril ACE Inhibitor',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'Take 1 tablet every morning with a glass of water.',
      prescribing_doctor: 'Dr. Robert Chen (Cardiology)',
      rx_number: 'RX-884219',
      refill_date: format(addDays(new Date(), 18), 'yyyy-MM-dd'),
      refill_quantity: 30,
      color_code: '#25483D',
      is_active: true,
      start_date: format(subDays(new Date(), 60), 'yyyy-MM-dd'),
    },
    {
      id: 'med_metformin',
      care_profile_id: careProfile.id,
      name: 'Metformin',
      generic_name: 'Metformin Hydrochloride',
      dosage: '500mg',
      form: 'tablet',
      instructions: 'Take with food to minimize stomach upset. Morning & evening.',
      prescribing_doctor: 'Dr. Michael Taylor (Endocrinology)',
      rx_number: 'RX-441029',
      refill_date: format(addDays(new Date(), 25), 'yyyy-MM-dd'),
      refill_quantity: 60,
      color_code: '#C9795B',
      is_active: true,
      start_date: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
    },
    {
      id: 'med_calcium',
      care_profile_id: careProfile.id,
      name: 'Calcium + Vit D3',
      generic_name: 'Calcium Carbonate / Cholecalciferol',
      dosage: '600mg',
      form: 'capsule',
      instructions: 'Take at lunchtime with meal for optimal absorption.',
      prescribing_doctor: 'Dr. Sarah Jenkins',
      rx_number: 'OTC-22819',
      color_code: '#A5B59A',
      is_active: true,
      start_date: format(subDays(new Date(), 120), 'yyyy-MM-dd'),
    },
    {
      id: 'med_atorvastatin',
      care_profile_id: careProfile.id,
      name: 'Atorvastatin',
      generic_name: 'Atorvastatin Calcium',
      dosage: '20mg',
      form: 'tablet',
      instructions: 'Take 1 tablet at bedtime.',
      prescribing_doctor: 'Dr. Robert Chen',
      rx_number: 'RX-991204',
      refill_date: format(addDays(new Date(), 12), 'yyyy-MM-dd'),
      refill_quantity: 30,
      color_code: '#292D29',
      is_active: true,
      start_date: format(subDays(new Date(), 45), 'yyyy-MM-dd'),
    },
  ];

  const schedules: MedicationSchedule[] = [
    {
      id: 'sched_lisinopril_morning',
      care_profile_id: careProfile.id,
      medication_id: 'med_lisinopril',
      time_of_day: '08:00',
      label: 'Morning with Breakfast',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      grace_period_minutes: 30,
      escalation_delay_minutes: 60,
      is_active: true,
    },
    {
      id: 'sched_metformin_morning',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      time_of_day: '08:00',
      label: 'Morning with Breakfast',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      grace_period_minutes: 30,
      escalation_delay_minutes: 60,
      is_active: true,
    },
    {
      id: 'sched_calcium_noon',
      care_profile_id: careProfile.id,
      medication_id: 'med_calcium',
      time_of_day: '12:00',
      label: 'Lunchtime',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      grace_period_minutes: 45,
      escalation_delay_minutes: 90,
      is_active: true,
    },
    {
      id: 'sched_metformin_evening',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      time_of_day: '18:00',
      label: 'Dinner Time',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      grace_period_minutes: 45,
      escalation_delay_minutes: 90,
      is_active: true,
    },
    {
      id: 'sched_atorvastatin_night',
      care_profile_id: careProfile.id,
      medication_id: 'med_atorvastatin',
      time_of_day: '21:00',
      label: 'Bedtime',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      grace_period_minutes: 45,
      escalation_delay_minutes: 90,
      is_active: true,
    },
  ];

  const doseLogs: DoseLog[] = [
    // Two days ago (all taken)
    {
      id: 'dose_log_1',
      care_profile_id: careProfile.id,
      medication_id: 'med_lisinopril',
      schedule_id: 'sched_lisinopril_morning',
      dose_identity: `dose_med_lisinopril_${dayBefore}_08:00`,
      scheduled_date: dayBefore,
      scheduled_time: '08:00',
      status: 'taken',
      confirmed_at: `${dayBefore}T08:15:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_2',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_morning',
      dose_identity: `dose_med_metformin_${dayBefore}_08:00`,
      scheduled_date: dayBefore,
      scheduled_time: '08:00',
      status: 'taken',
      confirmed_at: `${dayBefore}T08:15:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_3',
      care_profile_id: careProfile.id,
      medication_id: 'med_calcium',
      schedule_id: 'sched_calcium_noon',
      dose_identity: `dose_med_calcium_${dayBefore}_12:00`,
      scheduled_date: dayBefore,
      scheduled_time: '12:00',
      status: 'taken',
      confirmed_at: `${dayBefore}T12:25:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_4',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_evening',
      dose_identity: `dose_med_metformin_${dayBefore}_18:00`,
      scheduled_date: dayBefore,
      scheduled_time: '18:00',
      status: 'taken',
      confirmed_at: `${dayBefore}T18:10:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_5',
      care_profile_id: careProfile.id,
      medication_id: 'med_atorvastatin',
      schedule_id: 'sched_atorvastatin_night',
      dose_identity: `dose_med_atorvastatin_${dayBefore}_21:00`,
      scheduled_date: dayBefore,
      scheduled_time: '21:00',
      status: 'taken',
      confirmed_at: `${dayBefore}T21:05:00Z`,
      confirmed_by: elderlyUser.id,
    },

    // Yesterday (one skipped due to fasting procedure, rest taken)
    {
      id: 'dose_log_6',
      care_profile_id: careProfile.id,
      medication_id: 'med_lisinopril',
      schedule_id: 'sched_lisinopril_morning',
      dose_identity: `dose_med_lisinopril_${yesterday}_08:00`,
      scheduled_date: yesterday,
      scheduled_time: '08:00',
      status: 'taken',
      confirmed_at: `${yesterday}T08:12:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_7',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_morning',
      dose_identity: `dose_med_metformin_${yesterday}_08:00`,
      scheduled_date: yesterday,
      scheduled_time: '08:00',
      status: 'taken',
      confirmed_at: `${yesterday}T08:12:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_8',
      care_profile_id: careProfile.id,
      medication_id: 'med_calcium',
      schedule_id: 'sched_calcium_noon',
      dose_identity: `dose_med_calcium_${yesterday}_12:00`,
      scheduled_date: yesterday,
      scheduled_time: '12:00',
      status: 'skipped',
      confirmed_at: `${yesterday}T12:30:00Z`,
      confirmed_by: elderlyUser.id,
      skip_reason: 'Lab blood test scheduled in afternoon requiring calcium fast.',
    },
    {
      id: 'dose_log_9',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_evening',
      dose_identity: `dose_med_metformin_${yesterday}_18:00`,
      scheduled_date: yesterday,
      scheduled_time: '18:00',
      status: 'taken',
      confirmed_at: `${yesterday}T18:22:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_10',
      care_profile_id: careProfile.id,
      medication_id: 'med_atorvastatin',
      schedule_id: 'sched_atorvastatin_night',
      dose_identity: `dose_med_atorvastatin_${yesterday}_21:00`,
      scheduled_date: yesterday,
      scheduled_time: '21:00',
      status: 'taken',
      confirmed_at: `${yesterday}T21:18:00Z`,
      confirmed_by: elderlyUser.id,
    },

    // Today's Doses
    {
      id: 'dose_log_11',
      care_profile_id: careProfile.id,
      medication_id: 'med_lisinopril',
      schedule_id: 'sched_lisinopril_morning',
      dose_identity: `dose_med_lisinopril_${today}_08:00`,
      scheduled_date: today,
      scheduled_time: '08:00',
      status: 'taken',
      adherence_status: 'on_time',
      source: 'self',
      recorded_by: elderlyUser.id,
      recorded_by_role: 'elderly',
      confirmed_at: new Date(today + 'T08:08:00').toISOString(),
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_12',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_morning',
      dose_identity: `dose_med_metformin_${today}_08:00`,
      scheduled_date: today,
      scheduled_time: '08:00',
      status: 'taken',
      adherence_status: 'on_time',
      source: 'caregiver_administered',
      recorded_by: caretakerUser.id,
      recorded_by_role: 'caretaker',
      confirmed_at: new Date(today + 'T08:08:00').toISOString(),
      confirmed_by: caretakerUser.id,
    },
    {
      id: 'dose_log_13',
      care_profile_id: careProfile.id,
      medication_id: 'med_calcium',
      schedule_id: 'sched_calcium_noon',
      dose_identity: `dose_med_calcium_${today}_12:00`,
      scheduled_date: today,
      scheduled_time: '12:00',
      status: 'unconfirmed',
      adherence_status: 'unconfirmed',
      follow_up_status: 'contacting',
    },
    {
      id: 'dose_log_14',
      care_profile_id: careProfile.id,
      medication_id: 'med_metformin',
      schedule_id: 'sched_metformin_evening',
      dose_identity: `dose_med_metformin_${today}_18:00`,
      scheduled_date: today,
      scheduled_time: '18:00',
      status: 'scheduled',
    },
    {
      id: 'dose_log_15',
      care_profile_id: careProfile.id,
      medication_id: 'med_atorvastatin',
      schedule_id: 'sched_atorvastatin_night',
      dose_identity: `dose_med_atorvastatin_${today}_21:00`,
      scheduled_date: today,
      scheduled_time: '21:00',
      status: 'scheduled',
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'apt_cardiologist',
      care_profile_id: careProfile.id,
      doctor_name: 'Dr. Robert Chen',
      specialty: 'Cardiology',
      location: 'Providence Heart Clinic, Suite 400',
      appointment_date: inThreeDays,
      appointment_time: '10:30',
      notes: '6-month blood pressure review. Bring current medication list and past 2 weeks BP readings.',
      status: 'scheduled',
      reminder_sent: false,
      created_by: elderlyUser.id,
      created_at: subDays(new Date(), 10).toISOString(),
    },
    {
      id: 'apt_optometrist',
      care_profile_id: careProfile.id,
      doctor_name: 'Dr. Sarah Jenkins',
      specialty: 'Optometry & Eye Care',
      location: 'Rose City Vision, 1200 NW 23rd Ave',
      appointment_date: format(addDays(new Date(), 24), 'yyyy-MM-dd'),
      appointment_time: '14:00',
      notes: 'Annual diabetic eye screening and updated reading prescription check.',
      status: 'scheduled',
      reminder_sent: false,
      created_by: familyUser.id,
      created_at: subDays(new Date(), 5).toISOString(),
    },
  ];

  const notifications: Notification[] = [
    {
      id: 'notif_apt_cardio',
      care_profile_id: careProfile.id,
      category: 'upcoming_appointment',
      title: 'Upcoming Appointment: Dr. Robert Chen',
      message: `Cardiology checkup in 3 days (${inThreeDays} at 10:30 AM). Remember to bring current prescription list.`,
      priority: 'normal',
      status: 'pending',
      email_status: 'none',
      metadata: { appointment_id: 'apt_cardiologist' },
      created_at: subDays(new Date(), 1).toISOString(),
    },
    {
      id: 'notif_refill_atorvastatin',
      care_profile_id: careProfile.id,
      category: 'care_activity',
      title: 'Prescription Refill Reminder',
      message: 'Atorvastatin (20mg) has approximately 12 days remaining. Consider calling pharmacy.',
      priority: 'normal',
      status: 'sent',
      email_status: 'none',
      metadata: { medication_id: 'med_atorvastatin' },
      created_at: subDays(new Date(), 2).toISOString(),
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'act_1',
      care_profile_id: careProfile.id,
      actor_id: elderlyUser.id,
      actor_name: 'Margaret Hayes',
      actor_role: 'elderly',
      activity_type: 'dose_taken',
      description: 'Margaret Hayes self-confirmed Lisinopril (10mg) for morning schedule.',
      created_at: new Date(today + 'T08:08:00').toISOString(),
    },
    {
      id: 'act_1b',
      care_profile_id: careProfile.id,
      actor_id: caretakerUser.id,
      actor_name: 'Nurse Elena Rostova',
      actor_role: 'caretaker',
      activity_type: 'dose_taken',
      description: 'Administered by Nurse Elena Rostova — Caretaker. (Metformin 500mg morning dose)',
      created_at: new Date(today + 'T08:08:00').toISOString(),
    },
    {
      id: 'act_2',
      care_profile_id: careProfile.id,
      actor_id: familyUser.id,
      actor_name: 'David Hayes',
      actor_role: 'family',
      activity_type: 'appointment_created',
      description: 'David Hayes scheduled an Optometry appointment with Dr. Sarah Jenkins for next month.',
      created_at: subDays(new Date(), 5).toISOString(),
    },
    {
      id: 'act_3',
      care_profile_id: careProfile.id,
      actor_id: caretakerUser.id,
      actor_name: 'Nurse Elena Rostova',
      actor_role: 'caretaker',
      activity_type: 'member_joined',
      description: 'Nurse Elena Rostova joined the care circle as registered Caretaker.',
      created_at: subDays(new Date(), 20).toISOString(),
    },
    {
      id: 'act_4',
      care_profile_id: careProfile.id,
      actor_id: familyUser.id,
      actor_name: 'David Hayes',
      actor_role: 'family',
      activity_type: 'member_joined',
      description: 'David Hayes joined the care circle as Family Member.',
      created_at: subDays(new Date(), 28).toISOString(),
    },
  ];

  const invitations: Invitation[] = [
    {
      id: 'inv_sample_family',
      care_profile_id: careProfile.id,
      inviter_id: elderlyUser.id,
      role: 'family',
      invite_code_hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', // hash of CARE-1234
      code_hint: 'CARE-1***',
      status: 'pending',
      expires_at: addDays(new Date(), 7).toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  return {
    elderlyUser,
    familyUser,
    caretakerUser,
    careProfile,
    careMembers,
    medications,
    schedules,
    doseLogs,
    appointments,
    notifications,
    activityLogs,
    invitations,
  };
}

class StorageDataService {
  private isDemoMode: boolean = false;
  private inMemoryCache: {
    initialized: boolean;
    currentUser: UserProfile | null;
    users: UserProfile[];
    careProfiles: CareProfile[];
    careMembers: CareMember[];
    invitations: Invitation[];
    medications: Medication[];
    schedules: MedicationSchedule[];
    doseLogs: DoseLog[];
    appointments: Appointment[];
    notifications: Notification[];
    activityLogs: ActivityLog[];
  } = {
    initialized: false,
    currentUser: null,
    users: [],
    careProfiles: [],
    careMembers: [],
    invitations: [],
    medications: [],
    schedules: [],
    doseLogs: [],
    appointments: [],
    notifications: [],
    activityLogs: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    if (this.inMemoryCache.initialized) return;

    try {
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.CARE_PROFILES);
      if (storedProfiles) {
        this.inMemoryCache.careProfiles = JSON.parse(storedProfiles);
        this.inMemoryCache.careMembers = JSON.parse(localStorage.getItem(STORAGE_KEYS.CARE_MEMBERS) || '[]');
        this.inMemoryCache.medications = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEDICATIONS) || '[]');
        this.inMemoryCache.schedules = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
        this.inMemoryCache.doseLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOSE_LOGS) || '[]');
        this.inMemoryCache.appointments = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
        this.inMemoryCache.notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        this.inMemoryCache.activityLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS) || '[]');
        this.inMemoryCache.invitations = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVITATIONS) || '[]');

        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          this.inMemoryCache.currentUser = JSON.parse(storedUser);
        }
      } else {
        // First run: seed synthetic data
        const seed = generateSeedData();
        this.inMemoryCache.users = [seed.elderlyUser, seed.familyUser, seed.caretakerUser];
        this.inMemoryCache.currentUser = seed.elderlyUser;
        this.inMemoryCache.careProfiles = [seed.careProfile];
        this.inMemoryCache.careMembers = seed.careMembers;
        this.inMemoryCache.medications = seed.medications;
        this.inMemoryCache.schedules = seed.schedules;
        this.inMemoryCache.doseLogs = seed.doseLogs;
        this.inMemoryCache.appointments = seed.appointments;
        this.inMemoryCache.notifications = seed.notifications;
        this.inMemoryCache.activityLogs = seed.activityLogs;
        this.inMemoryCache.invitations = seed.invitations;
        this.saveAll();
      }
    } catch {
      // Fallback for non-browser environments or quota issues
      const seed = generateSeedData();
      this.inMemoryCache.users = [seed.elderlyUser, seed.familyUser, seed.caretakerUser];
      this.inMemoryCache.currentUser = seed.elderlyUser;
      this.inMemoryCache.careProfiles = [seed.careProfile];
      this.inMemoryCache.careMembers = seed.careMembers;
      this.inMemoryCache.medications = seed.medications;
      this.inMemoryCache.schedules = seed.schedules;
      this.inMemoryCache.doseLogs = seed.doseLogs;
      this.inMemoryCache.appointments = seed.appointments;
      this.inMemoryCache.notifications = seed.notifications;
      this.inMemoryCache.activityLogs = seed.activityLogs;
      this.inMemoryCache.invitations = seed.invitations;
    }

    this.inMemoryCache.initialized = true;
  }

  private saveAll() {
    try {
      localStorage.setItem(STORAGE_KEYS.CARE_PROFILES, JSON.stringify(this.inMemoryCache.careProfiles));
      localStorage.setItem(STORAGE_KEYS.CARE_MEMBERS, JSON.stringify(this.inMemoryCache.careMembers));
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(this.inMemoryCache.medications));
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(this.inMemoryCache.schedules));
      localStorage.setItem(STORAGE_KEYS.DOSE_LOGS, JSON.stringify(this.inMemoryCache.doseLogs));
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(this.inMemoryCache.appointments));
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.inMemoryCache.notifications));
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(this.inMemoryCache.activityLogs));
      localStorage.setItem(STORAGE_KEYS.INVITATIONS, JSON.stringify(this.inMemoryCache.invitations));
      if (this.inMemoryCache.currentUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.inMemoryCache.currentUser));
      }
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }
  }

  // --- Auth & User Profile ---
  getCurrentUser(): UserProfile | null {
    return this.inMemoryCache.currentUser;
  }

  setCurrentUser(user: UserProfile | null) {
    this.inMemoryCache.currentUser = user;
    this.saveAll();
  }

  switchUserRole(role: 'elderly' | 'family' | 'caretaker'): UserProfile {
    const seed = generateSeedData();
    let targetUser = seed.elderlyUser;
    if (role === 'family') targetUser = seed.familyUser;
    if (role === 'caretaker') targetUser = seed.caretakerUser;

    this.setCurrentUser(targetUser);
    return targetUser;
  }

  setDemoMode(enabled: boolean) {
    this.isDemoMode = enabled;
  }

  isDemoModeActive(): boolean {
    if (this.isDemoMode) return true;
    try {
      if (typeof window !== 'undefined') {
        const flag = localStorage.getItem('carecircle_demo_mode');
        if (flag === 'true') return true;
      }
    } catch {}
    return false;
  }

  // --- Care Profiles & Members ---
  getInitialCareProfile(): CareProfile | null {
    if (!this.isDemoModeActive() && isSupabaseConfigured()) {
      return null;
    }
    return this.inMemoryCache.careProfiles[0] || null;
  }

  async getCareProfiles(): Promise<CareProfile[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('care_profiles').select('*');
      if (error) {
        console.warn('[StorageAdapter] getCareProfiles query error:', error.message);
        return [];
      }
      return data || [];
    }
    return this.inMemoryCache.careProfiles;
  }

  async createCareProfile(params: {
    fullName: string;
    preferredName?: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    allergies?: string[];
    emergencyPhone?: string;
    address?: string;
    medicalNotes?: string;
    assistanceLevel?: AssistanceLevel;
    timezone: string;
    ownerId?: string;
  }): Promise<CareProfile> {
    const defaultTz = params.timezone || DEFAULT_PROFILE_TIMEZONE;
    const isValidUUID = (id?: string) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      let ownerId = params.ownerId;
      if (!ownerId || !isValidUUID(ownerId)) {
        const { data: authData } = await supabase.auth.getUser();
        ownerId = authData.user?.id;
      }

      if (ownerId && isValidUUID(ownerId)) {
        const payload = {
          owner_id: ownerId,
          full_name: params.fullName.trim(),
          preferred_name: params.preferredName?.trim() || null,
          date_of_birth: params.dateOfBirth || null,
          blood_group: params.bloodGroup?.trim() || null,
          allergies: params.allergies || [],
          emergency_phone: params.emergencyPhone?.trim() || null,
          address: params.address?.trim() || null,
          medical_notes: params.medicalNotes?.trim() || null,
          assistance_level: params.assistanceLevel || 'independent',
          timezone: defaultTz,
        };

        const { data, error } = await supabase
          .from('care_profiles')
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.warn('[StorageAdapter] Supabase care profile insert error:', error.message);
        } else if (data) {
          return data as CareProfile;
        }
      }
    }

    // In-memory / local fallback
    const newId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newOwnerId = params.ownerId || this.getCurrentUser()?.id || 'user_margaret';

    const newProfile: CareProfile = {
      id: newId,
      owner_id: newOwnerId,
      full_name: params.fullName.trim(),
      preferred_name: params.preferredName?.trim() || params.fullName.split(' ')[0],
      date_of_birth: params.dateOfBirth,
      blood_group: params.bloodGroup,
      allergies: params.allergies || [],
      emergency_phone: params.emergencyPhone,
      address: params.address,
      medical_notes: params.medicalNotes,
      assistance_level: params.assistanceLevel || 'independent',
      timezone: defaultTz,
      created_at: new Date().toISOString(),
    };

    this.inMemoryCache.careProfiles.push(newProfile);

    const newMember: CareMember = {
      id: `member_${Date.now()}`,
      care_profile_id: newId,
      user_id: newOwnerId,
      role: 'owner',
      can_manage_medications: true,
      can_manage_appointments: true,
      can_invite_members: true,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: new Date().toISOString(),
      profile: this.getCurrentUser() || undefined,
    };
    this.inMemoryCache.careMembers.push(newMember);
    this.saveAll();

    return newProfile;
  }

  async getCareProfile(id: string): Promise<CareProfile | null> {
    const profiles = await this.getCareProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  async getCareMembers(careProfileId: string): Promise<CareMember[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('care_members')
        .select('*, profile:profiles(*)')
        .eq('care_profile_id', careProfileId)
        .eq('status', 'active');
      if (!error && data) return data;
    }
    return this.inMemoryCache.careMembers.filter(
      m => m.care_profile_id === careProfileId && m.status === 'active'
    );
  }

  // --- Invitations & Passcode Redemption ---
  async createInvitation(params: {
    careProfileId: string;
    role: 'family' | 'caretaker';
    passcode: string;
    inviterId: string;
    inviteeEmail?: string;
  }): Promise<Invitation> {
    const hash = await hashPasscode(params.passcode);
    const hint = maskPasscodeHint(params.passcode);
    const expiresAt = addDays(new Date(), 7).toISOString();

    const invitation: Invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      care_profile_id: params.careProfileId,
      inviter_id: params.inviterId,
      role: params.role,
      invite_code_hash: hash,
      code_hint: hint,
      invitee_email: params.inviteeEmail,
      status: 'pending',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.from('invitations').insert(invitation).select().single();
      if (data) return data;
    }

    this.inMemoryCache.invitations.push(invitation);
    this.saveAll();
    return invitation;
  }

  async revokeInvitation(id: string): Promise<boolean> {
    const invite = this.inMemoryCache.invitations.find(i => i.id === id);
    if (!invite) return false;
    invite.status = 'revoked';
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id);
    }
    this.saveAll();
    return true;
  }

  private failedAttempts: Record<string, { count: number; lockedUntil: number }> = {};

  async redeemInvitation(passcode: string, user?: UserProfile): Promise<{ success: boolean; error?: string; careProfileId?: string }> {
    const activeUser = user || this.getCurrentUser() || this.inMemoryCache.users[0];
    // 1. Client & Server-side Rate Limiting check: max 5 failed attempts in 15 mins
    const userAttempts = this.failedAttempts[activeUser.id];
    if (userAttempts && userAttempts.lockedUntil > Date.now()) {
      const minsRemaining = Math.ceil((userAttempts.lockedUntil - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed passcode attempts. For security, please wait ${minsRemaining} minute(s) before trying again.`,
      };
    }

    const recordFailedAttempt = () => {
      const current = this.failedAttempts[activeUser.id] || { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= 5) {
        current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
      }
      this.failedAttempts[activeUser.id] = current;
    };

    const hash = await hashPasscode(passcode);

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('redeem_invitation', {
        p_code: passcode,
      });
      if (error) {
        recordFailedAttempt();
        return { success: false, error: error.message };
      }
      if (!data.success) {
        recordFailedAttempt();
      } else {
        delete this.failedAttempts[activeUser.id];
      }
      return data;
    }

    // Local / In-memory validation
    const invite = this.inMemoryCache.invitations.find(i => i.invite_code_hash === hash);
    if (!invite) {
      recordFailedAttempt();
      return { success: false, error: 'Invalid invitation passcode. Please check spelling.' };
    }
    if (invite.status === 'redeemed') {
      recordFailedAttempt();
      return { success: false, error: 'This invitation passcode has already been used.' };
    }
    if (invite.status === 'revoked') {
      recordFailedAttempt();
      return { success: false, error: 'This invitation has been revoked by the care circle.' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      invite.status = 'expired';
      recordFailedAttempt();
      this.saveAll();
      return { success: false, error: 'This invitation passcode has expired.' };
    }

    // Reset failed attempts upon successful validation
    delete this.failedAttempts[activeUser.id];

    // Check existing membership
    const existing = this.inMemoryCache.careMembers.find(
      m => m.care_profile_id === invite.care_profile_id && m.user_id === activeUser.id
    );
    if (existing && existing.status === 'active') {
      return { success: false, error: 'You are already an active member of this Care Circle.' };
    }

    // Join circle
    const newMember: CareMember = {
      id: `member_${Date.now()}`,
      care_profile_id: invite.care_profile_id,
      user_id: activeUser.id,
      role: invite.role,
      can_manage_medications: invite.role === 'caretaker',
      can_manage_appointments: invite.role === 'caretaker',
      can_invite_members: false,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: new Date().toISOString(),
      profile: activeUser,
    };

    if (existing) {
      existing.status = 'active';
      existing.role = invite.role;
    } else {
      this.inMemoryCache.careMembers.push(newMember);
    }

    invite.status = 'redeemed';
    invite.redeemed_at = new Date().toISOString();
    invite.redeemed_by = activeUser.id;

    // Log activity
    this.addActivityLog({
      careProfileId: invite.care_profile_id,
      actorId: activeUser.id,
      actorName: activeUser.full_name,
      actorRole: invite.role,
      activityType: 'member_joined',
      description: `${activeUser.full_name} joined the Care Circle as ${invite.role === 'family' ? 'Family Member' : 'Caretaker'}.`,
    });

    this.saveAll();
    return { success: true, careProfileId: invite.care_profile_id };
  }

  // --- Medications & Schedules ---
  async getMedications(careProfileId: string): Promise<Medication[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('medications')
        .select('*, schedules:medication_schedules(*)')
        .eq('care_profile_id', careProfileId)
        .order('created_at', { ascending: true });
      if (!error && data) return data;
    }

    const meds = this.inMemoryCache.medications.filter(m => m.care_profile_id === careProfileId);
    return meds.map(m => ({
      ...m,
      schedules: this.inMemoryCache.schedules.filter(s => s.medication_id === m.id && s.is_active),
    }));
  }

  async saveMedication(
    medication: Omit<Medication, 'id'> & { id?: string },
    scheduleTimes: { time: string; label?: string }[]
  ): Promise<Medication> {
    const medId = medication.id || `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullMed: Medication = {
      ...medication,
      id: medId,
      created_at: medication.created_at || new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { data: savedMed } = await supabase.from('medications').upsert(fullMed).select().single();
      if (savedMed) {
        // Update schedules
        await supabase.from('medication_schedules').delete().eq('medication_id', medId);
        const newScheds = scheduleTimes.map(st => ({
          care_profile_id: fullMed.care_profile_id,
          medication_id: medId,
          time_of_day: st.time,
          label: st.label || 'Scheduled Dose',
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          grace_period_minutes: 30,
          escalation_delay_minutes: 60,
          is_active: true,
        }));
        await supabase.from('medication_schedules').insert(newScheds);
        return savedMed;
      }
    }

    // In-memory
    const existingIndex = this.inMemoryCache.medications.findIndex(m => m.id === medId);
    if (existingIndex >= 0) {
      this.inMemoryCache.medications[existingIndex] = fullMed;
    } else {
      this.inMemoryCache.medications.push(fullMed);
    }

    // Remove old schedules
    this.inMemoryCache.schedules = this.inMemoryCache.schedules.filter(s => s.medication_id !== medId);
    // Add new schedules
    scheduleTimes.forEach((st, idx) => {
      this.inMemoryCache.schedules.push({
        id: `sched_${medId}_${idx}`,
        care_profile_id: fullMed.care_profile_id,
        medication_id: medId,
        time_of_day: st.time,
        label: st.label || 'Scheduled Dose',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        grace_period_minutes: 30,
        escalation_delay_minutes: 60,
        is_active: true,
      });
    });

    const currentUser = this.getCurrentUser();
    this.addActivityLog({
      careProfileId: fullMed.care_profile_id,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name || 'CareCircle User',
      actorRole: currentUser?.role || 'elderly',
      activityType: existingIndex >= 0 ? 'medication_updated' : 'medication_created',
      description: `${existingIndex >= 0 ? 'Updated' : 'Added'} medication ${fullMed.name} (${fullMed.dosage}).`,
    });

    this.saveAll();
    return fullMed;
  }

  async deleteMedication(id: string): Promise<boolean> {
    const med = this.inMemoryCache.medications.find(m => m.id === id);
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('medications').delete().eq('id', id);
    }
    this.inMemoryCache.medications = this.inMemoryCache.medications.filter(m => m.id !== id);
    this.inMemoryCache.schedules = this.inMemoryCache.schedules.filter(s => s.medication_id !== id);

    if (med) {
      const currentUser = this.getCurrentUser();
      this.addActivityLog({
        careProfileId: med.care_profile_id,
        actorId: currentUser?.id,
        actorName: currentUser?.full_name || 'CareCircle User',
        actorRole: currentUser?.role || 'elderly',
        activityType: 'medication_updated',
        description: `Discontinued medication ${med.name}.`,
      });
    }

    this.saveAll();
    return true;
  }

  // --- Dose Tracking & Confirmation ---
  async getDoseLogs(careProfileId: string): Promise<DoseLog[]> {
    let logs: DoseLog[] = [];
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('dose_logs')
        .select('*, medication:medications(*)')
        .eq('care_profile_id', careProfileId)
        .order('scheduled_date', { ascending: false });
      if (!error && data) logs = data;
    } else {
      logs = this.inMemoryCache.doseLogs
        .filter(d => d.care_profile_id === careProfileId)
        .map(d => ({
          ...d,
          medication: this.inMemoryCache.medications.find(m => m.id === d.medication_id),
        }));
    }

    // Derive effective is_corrected state dynamically from correction links without mutating original records
    const correctedTargetIds = new Set(logs.map(l => l.correction_of_id).filter(Boolean));
    return logs.map(d => ({
      ...d,
      is_corrected: Boolean(d.is_corrected || correctedTargetIds.has(d.id)),
    }));
  }

  /**
   * Idempotent Dose Confirmation & Atomic Event Recording
   * Enforces window validation, assisted-care permissions, append-only history,
   * and authentic actor/source provenance.
   */
  async recordDose(params: Parameters<StorageDataService['recordDoseAction']>[0]) {
    return this.recordDoseAction(params);
  }

  async recordDoseAction(params: {
    careProfileId: string;
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    source?: DoseEventSource;
    actorId?: string;
    actorName: string;
    actorRole: string;
    skipReason?: string;
    notes?: string;
    isCorrection?: boolean;
    correctingLogId?: string;
    correctionReason?: string;
  }): Promise<{ success: boolean; alreadyConfirmed: boolean; error?: string; doseLog: DoseLog }> {
    const doseIdentity = `dose_${params.medicationId}_${params.scheduledDate}_${params.scheduledTime}`;
    const source: DoseEventSource =
      params.source ||
      (params.actorRole === 'caretaker'
        ? 'caregiver_administered'
        : params.actorRole === 'family'
        ? 'family_reported'
        : 'self');

    // 1. Window Validation: Prevent future dose confirmation (unless documenting exception/correction)
    if (params.status === 'taken' && !params.isCorrection) {
      const windowCheck = validateConfirmationWindow(params.scheduledDate, params.scheduledTime);
      if (windowCheck.isEarly) {
        return {
          success: false,
          alreadyConfirmed: false,
          error: windowCheck.reason || 'Dose is scheduled for later. Confirmation is not yet open.',
          doseLog: null as any,
        };
      }
    }

    // 2. Assistance Level Guardrail Check
    const careProfile = this.inMemoryCache.careProfiles.find(p => p.id === params.careProfileId);
    if (
      careProfile?.assistance_level === 'caregiver_managed' &&
      (source === 'self' || params.actorRole === 'elderly')
    ) {
      return {
        success: false,
        alreadyConfirmed: false,
        error: 'This profile is in Caregiver Managed mode. Medications must be administered and recorded by an authorized caregiver.',
        doseLog: null as any,
      };
    }

    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.rpc('record_dose_event', {
        p_care_profile_id: params.careProfileId,
        p_medication_id: params.medicationId,
        p_schedule_id: params.scheduleId || null,
        p_scheduled_date: params.scheduledDate,
        p_scheduled_time: params.scheduledTime,
        p_status: params.status,
        p_source: source,
        p_notes: params.notes || null,
        p_skip_reason: params.skipReason || null,
        p_is_correction: params.isCorrection || false,
        p_correcting_log_id: params.correctingLogId || null,
        p_correction_reason: params.correctionReason || null,
      });
      if (data) {
        return {
          success: data.success,
          alreadyConfirmed: data.already_confirmed || false,
          error: data.error,
          doseLog: data.log,
        };
      }
    }

    // Local / In-memory execution
    let log = this.inMemoryCache.doseLogs.find(
      l => l.care_profile_id === params.careProfileId && l.dose_identity === doseIdentity && !l.is_corrected
    );

    let alreadyConfirmed = false;
    const nowIso = new Date().toISOString();
    const med = this.inMemoryCache.medications.find(m => m.id === params.medicationId);
    const windowCheck = validateConfirmationWindow(params.scheduledDate, params.scheduledTime);
    const adherenceStatus = params.status === 'skipped' ? 'skipped' : windowCheck.isLate ? 'late' : 'on_time';

    // Handle Append-Only Correction Workflow
    if (params.isCorrection && params.correctingLogId) {
      // Note: In append-only audit mode, the original confirmed event is preserved immutable in memory and DB
      log = {
        id: `dose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        care_profile_id: params.careProfileId,
        medication_id: params.medicationId,
        schedule_id: params.scheduleId,
        dose_identity: `${doseIdentity}_corr_${Date.now()}`,
        scheduled_date: params.scheduledDate,
        scheduled_time: params.scheduledTime,
        status: params.status,
        adherence_status: adherenceStatus,
        source,
        recorded_by: params.actorId,
        recorded_by_role: params.actorRole,
        confirmed_at: nowIso,
        confirmed_by: params.actorId,
        actual_at: nowIso,
        correction_of_id: params.correctingLogId,
        correction_reason: params.correctionReason,
        skip_reason: params.skipReason,
        notes: params.notes,
        is_corrected: false,
        created_at: nowIso,
      };
      this.inMemoryCache.doseLogs.push(log);

      this.addActivityLog({
        careProfileId: params.careProfileId,
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        activityType: 'dose_corrected',
        description: `${params.actorName} corrected dose record for ${med?.name || 'medication'}: ${params.correctionReason || 'Clinical adjustment'} (Status: ${params.status}).`,
      });

      this.saveAll();
      return { success: true, alreadyConfirmed: false, doseLog: log };
    }

    if (log) {
      if (log.status === 'taken' && params.status === 'taken') {
        alreadyConfirmed = true;
        return { success: true, alreadyConfirmed: true, doseLog: log };
      }
      log.status = params.status;
      log.adherence_status = adherenceStatus;
      log.source = source;
      log.recorded_by = params.actorId;
      log.recorded_by_role = params.actorRole;
      log.confirmed_at = nowIso;
      log.confirmed_by = params.actorId;
      log.actual_at = nowIso;
      log.skip_reason = params.skipReason;
      log.notes = params.notes;
    } else {
      log = {
        id: `dose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        care_profile_id: params.careProfileId,
        medication_id: params.medicationId,
        schedule_id: params.scheduleId,
        dose_identity: doseIdentity,
        scheduled_date: params.scheduledDate,
        scheduled_time: params.scheduledTime,
        status: params.status,
        adherence_status: adherenceStatus,
        source,
        recorded_by: params.actorId,
        recorded_by_role: params.actorRole,
        confirmed_at: nowIso,
        confirmed_by: params.actorId,
        actual_at: nowIso,
        skip_reason: params.skipReason,
        notes: params.notes,
        created_at: nowIso,
      };
      this.inMemoryCache.doseLogs.push(log);
    }

    // Resolve any pending escalation notifications for this dose
    this.inMemoryCache.notifications
      .filter(n => n.category === 'unconfirmed_escalation' && n.metadata?.dose_identity === doseIdentity)
      .forEach(n => {
        n.status = 'resolved';
        n.acknowledged_at = nowIso;
        n.acknowledged_by = params.actorId;
      });

    // Truthful Provenance Attribution description
    let provenanceDesc = '';
    if (source === 'caregiver_administered') {
      provenanceDesc = `Administered by ${params.actorName} — Caretaker. (${med?.name || 'Medication'} ${med?.dosage || ''})`;
    } else if (source === 'family_reported') {
      provenanceDesc = `Reported taken by ${params.actorName} — Family Member. (${med?.name || 'Medication'} ${med?.dosage || ''})`;
    } else if (source === 'self') {
      provenanceDesc = `${careProfile?.full_name || 'Margaret'} confirmed this dose. (${med?.name || 'Medication'} ${med?.dosage || ''})`;
    } else {
      provenanceDesc = `${params.actorName} marked ${med?.name || 'medication'} (${params.scheduledTime}) as ${params.status}.`;
    }

    log.provenance_description = provenanceDesc;

    this.addActivityLog({
      careProfileId: params.careProfileId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      activityType: params.status === 'taken' ? 'dose_taken' : 'dose_skipped',
      description: provenanceDesc,
    });

    this.saveAll();
    return { success: true, alreadyConfirmed, doseLog: log };
  }

  // --- Append-Only Historical Corrections ---
  async correctDoseAction(params: {
    careProfileId: string;
    originalDoseLogId: string;
    newStatus: 'taken' | 'skipped';
    reason: string;
    actorId?: string;
    actorName: string;
    actorRole: string;
    source?: DoseEventSource;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; doseLog?: DoseLog }> {
    const orig = this.inMemoryCache.doseLogs.find(l => l.id === params.originalDoseLogId);
    if (!orig) return { success: false, error: 'Original dose record not found.' };

    const res = await this.recordDoseAction({
      careProfileId: params.careProfileId,
      medicationId: orig.medication_id,
      scheduleId: orig.schedule_id,
      scheduledDate: orig.scheduled_date,
      scheduledTime: orig.scheduled_time,
      status: params.newStatus,
      source: params.source || (params.actorRole === 'caretaker' ? 'caregiver_administered' : 'family_reported'),
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      notes: params.notes,
      isCorrection: true,
      correctingLogId: params.originalDoseLogId,
      correctionReason: params.reason,
    });

    return { success: res.success, error: res.error, doseLog: res.doseLog };
  }

  // --- No-Response Follow-up Workflow State Machine ---
  async updateFollowUpStatus(params: {
    careProfileId: string;
    doseLogId: string;
    newStatus: FollowUpStatus;
    note?: string;
    actorId?: string;
    actorName: string;
    actorRole: string;
  }): Promise<boolean> {
    const log = this.inMemoryCache.doseLogs.find(l => l.id === params.doseLogId);
    if (!log) return false;

    log.follow_up_status = params.newStatus;
    if (params.newStatus === 'verified_taken') {
      log.status = 'taken';
      log.source = params.actorRole === 'caretaker' ? 'caregiver_administered' : 'family_reported';
      log.confirmed_at = new Date().toISOString();
      log.confirmed_by = params.actorId;
    }

    const med = this.inMemoryCache.medications.find(m => m.id === log.medication_id);
    const statusLabels: Record<FollowUpStatus, string> = {
      none: 'No follow-up',
      unconfirmed: 'Unconfirmed dose follow-up opened',
      contacting: 'Caregiver contacting patient',
      verified_taken: 'Caregiver verified dose was taken',
      verified_not_taken: 'Caregiver verified dose was not taken',
      unable_to_reach: 'Caregiver unable to reach patient',
      refused_reported: 'Reported: Patient refused dose',
      escalated: 'Care circle escalated follow-up',
    };

    this.addActivityLog({
      careProfileId: params.careProfileId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      activityType: 'follow_up_updated',
      description: `${params.actorName} updated follow-up on ${med?.name || 'medication'} (${log.scheduled_time}): ${statusLabels[params.newStatus]}${params.note ? ` — Note: "${params.note}"` : '.'}`,
    });

    this.saveAll();
    return true;
  }

  // --- Update Care Profile Assistance Level ---
  async updateAssistanceLevel(careProfileId: string, level: AssistanceLevel): Promise<boolean> {
    const profile = this.inMemoryCache.careProfiles.find(p => p.id === careProfileId);
    if (!profile) return false;

    profile.assistance_level = level;
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('care_profiles').update({ assistance_level: level }).eq('id', careProfileId);
    }

    const user = this.getCurrentUser();
    this.addActivityLog({
      careProfileId,
      actorId: user?.id,
      actorName: user?.full_name || 'Care Circle Member',
      actorRole: user?.role || 'elderly',
      activityType: 'medication_updated',
      description: `Assistance mode changed to "${level.replace('_', ' ').toUpperCase()}".`,
    });

    this.saveAll();
    return true;
  }

  // --- Appointments ---
  async getAppointments(careProfileId: string): Promise<Appointment[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('care_profile_id', careProfileId)
        .order('appointment_date', { ascending: true });
      if (!error && data) return data;
    }
    return this.inMemoryCache.appointments
      .filter(a => a.care_profile_id === careProfileId)
      .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  }

  async saveAppointment(
    apt: Omit<Appointment, 'id'> & { id?: string }
  ): Promise<Appointment> {
    const aptId = apt.id || `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullApt: Appointment = {
      ...apt,
      id: aptId,
      created_at: apt.created_at || new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.from('appointments').upsert(fullApt).select().single();
      if (data) return data;
    }

    const index = this.inMemoryCache.appointments.findIndex(a => a.id === aptId);
    if (index >= 0) {
      this.inMemoryCache.appointments[index] = fullApt;
    } else {
      this.inMemoryCache.appointments.push(fullApt);
    }

    const currentUser = this.getCurrentUser();
    this.addActivityLog({
      careProfileId: fullApt.care_profile_id,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name || 'CareCircle User',
      actorRole: currentUser?.role || 'elderly',
      activityType: index >= 0 ? 'appointment_created' : 'appointment_created',
      description: `${index >= 0 ? 'Updated' : 'Scheduled'} medical appointment with ${fullApt.doctor_name} for ${fullApt.appointment_date}.`,
    });

    this.saveAll();
    return fullApt;
  }

  async cancelAppointment(id: string): Promise<boolean> {
    const apt = this.inMemoryCache.appointments.find(a => a.id === id);
    if (!apt) return false;

    apt.status = 'cancelled';
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    }

    const currentUser = this.getCurrentUser();
    this.addActivityLog({
      careProfileId: apt.care_profile_id,
      actorId: currentUser?.id,
      actorName: currentUser?.full_name || 'CareCircle User',
      actorRole: currentUser?.role || 'elderly',
      activityType: 'appointment_cancelled',
      description: `Cancelled appointment with ${apt.doctor_name} on ${apt.appointment_date}.`,
    });

    this.saveAll();
    return true;
  }

  // --- Notifications & Escalation Acknowledgement ---
  async getNotifications(careProfileId: string): Promise<Notification[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('care_profile_id', careProfileId)
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return this.inMemoryCache.notifications
      .filter(n => n.care_profile_id === careProfileId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async acknowledgeNotification(
    notificationId: string,
    actorId: string,
    actorName: string,
    actorRole: string,
    note?: string
  ): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.rpc('acknowledge_escalation_alert', {
        p_notification_id: notificationId,
        p_note: note || null,
      });
      if (data?.success) return true;
    }

    const notif = this.inMemoryCache.notifications.find(n => n.id === notificationId);
    if (!notif) return false;

    notif.status = 'acknowledged';
    notif.acknowledged_at = new Date().toISOString();
    notif.acknowledged_by = actorId;
    if (note) {
      notif.metadata = { ...(notif.metadata || {}), acknowledgement_note: note };
    }

    this.addActivityLog({
      careProfileId: notif.care_profile_id,
      actorId,
      actorName,
      actorRole,
      activityType: 'alert_acknowledged',
      description: `${actorName} acknowledged follow-up alert: "${notif.title}"${note ? ` Note: "${note}"` : '.'}`,
    });

    this.saveAll();
    return true;
  }

  /**
   * Triggers an escalation cycle: checks past-due doses,
   * transitions to 'unconfirmed', and generates in-app notifications
   */
  async runEscalationCycle(careProfileId: string): Promise<{ createdEscalations: number }> {
    const meds = await this.getMedications(careProfileId);
    const profile = await this.getCareProfile(careProfileId);
    if (!profile) return { createdEscalations: 0 };

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let createdCount = 0;

    for (const med of meds) {
      for (const sched of med.schedules || []) {
        const [h, m] = sched.time_of_day.split(':').map(Number);
        const schedMinutes = h * 60 + m;
        const elapsed = currentMinutes - schedMinutes;

        // If time is past scheduled time + grace period (default 30 mins)
        if (elapsed > (sched.grace_period_minutes || 30)) {
          const doseIdentity = `dose_${med.id}_${todayStr}_${sched.time_of_day}`;
          const existingDose = this.inMemoryCache.doseLogs.find(
            d => d.care_profile_id === careProfileId && d.dose_identity === doseIdentity
          );

          if (!existingDose || existingDose.status === 'due' || existingDose.status === 'scheduled') {
            // Update dose to unconfirmed
            if (existingDose) {
              existingDose.status = 'unconfirmed';
            } else {
              this.inMemoryCache.doseLogs.push({
                id: `dose_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                care_profile_id: careProfileId,
                medication_id: med.id,
                schedule_id: sched.id,
                dose_identity: doseIdentity,
                scheduled_date: todayStr,
                scheduled_time: sched.time_of_day,
                status: 'unconfirmed',
                created_at: now.toISOString(),
              });
            }

            // Check if notification already exists
            const existingNotif = this.inMemoryCache.notifications.find(
              n => n.care_profile_id === careProfileId &&
                   n.category === 'unconfirmed_escalation' &&
                   n.metadata?.dose_identity === doseIdentity
            );

            if (!existingNotif) {
              this.inMemoryCache.notifications.unshift({
                id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                care_profile_id: careProfileId,
                category: 'unconfirmed_escalation',
                title: `Unconfirmed Dose: ${med.name} (${med.dosage})`,
                message: `${profile.preferred_name || profile.full_name}'s scheduled dose at ${sched.time_of_day} was not confirmed within the ${sched.grace_period_minutes} min window.`,
                priority: 'urgent',
                status: 'pending',
                email_status: 'none',
                metadata: {
                  dose_identity: doseIdentity,
                  medication_id: med.id,
                  scheduled_time: sched.time_of_day,
                  elapsed_minutes: elapsed,
                },
                created_at: now.toISOString(),
              });

              this.addActivityLog({
                careProfileId,
                actorName: 'Care Intelligence System',
                actorRole: 'system',
                activityType: 'dose_unconfirmed_escalated',
                description: `Automated escalation triggered for unconfirmed ${med.name} dose (${sched.time_of_day}).`,
              });

              createdCount++;
            }
          }
        }
      }
    }

    this.saveAll();
    return { createdEscalations: createdCount };
  }

  // --- Shared Activity Timeline ---
  async getActivityLogs(careProfileId: string): Promise<ActivityLog[]> {
    if (!this.isDemoModeActive() && isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('care_profile_id', careProfileId)
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return this.inMemoryCache.activityLogs
      .filter(a => a.care_profile_id === careProfileId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  addActivityLog(log: {
    careProfileId: string;
    actorId?: string;
    actorName: string;
    actorRole: string;
    activityType: ActivityLog['activity_type'];
    description: string;
    metadata?: Record<string, any>;
  }) {
    const newEntry: ActivityLog = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      care_profile_id: log.careProfileId,
      actor_id: log.actorId,
      actor_name: log.actorName,
      actor_role: log.actorRole,
      activity_type: log.activityType,
      description: log.description,
      metadata: log.metadata,
      created_at: new Date().toISOString(),
    };
    this.inMemoryCache.activityLogs.unshift(newEntry);
  }

  // Reset to original demo seed
  resetToDemoSeed() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        localStorage.setItem('carecircle_demo_mode', 'true');
        localStorage.setItem('carecircle_selected_profile_id', 'profile_margaret');
      }
    } catch {}
    this.failedAttempts = {};
    this.inMemoryCache.initialized = false;
    this.init();
  }

  resetRateLimits() {
    this.failedAttempts = {};
  }
}

export const dataService = new StorageDataService();
