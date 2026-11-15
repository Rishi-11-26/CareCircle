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
} from '@/types';
import { hashPasscode } from '@/lib/crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
      confirmed_at: `${today}T08:08:00Z`,
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
      confirmed_at: `${today}T08:08:00Z`,
      confirmed_by: elderlyUser.id,
    },
    {
      id: 'dose_log_13',
      care_profile_id: careProfile.id,
      medication_id: 'med_calcium',
      schedule_id: 'sched_calcium_noon',
      dose_identity: `dose_med_calcium_${today}_12:00`,
      scheduled_date: today,
      scheduled_time: '12:00',
      status: 'due',
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
      description: 'Margaret Hayes confirmed Lisinopril (10mg) and Metformin (500mg) taken for morning schedule.',
      created_at: `${today}T08:08:00Z`,
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

  // --- Care Profiles & Members ---
  async getCareProfiles(): Promise<CareProfile[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('care_profiles').select('*');
      if (!error && data) return data;
    }
    return this.inMemoryCache.careProfiles;
  }

  async getCareProfile(id: string): Promise<CareProfile | null> {
    const profiles = await this.getCareProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  async getCareMembers(careProfileId: string): Promise<CareMember[]> {
    if (isSupabaseConfigured() && supabase) {
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
    const hint = `${params.passcode.slice(0, 5)}***`;
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

  async redeemInvitation(passcode: string, user: UserProfile): Promise<{ success: boolean; error?: string; careProfileId?: string }> {
    const hash = await hashPasscode(passcode);

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('redeem_invitation', {
        p_code: passcode,
        p_user_id: user.id,
      });
      if (error) return { success: false, error: error.message };
      return data;
    }

    // Local / In-memory validation
    const invite = this.inMemoryCache.invitations.find(i => i.invite_code_hash === hash);
    if (!invite) {
      return { success: false, error: 'Invalid invitation passcode. Please check spelling.' };
    }
    if (invite.status === 'redeemed') {
      return { success: false, error: 'This invitation passcode has already been used.' };
    }
    if (invite.status === 'revoked') {
      return { success: false, error: 'This invitation has been revoked by the care circle.' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      invite.status = 'expired';
      this.saveAll();
      return { success: false, error: 'This invitation passcode has expired.' };
    }

    // Check existing membership
    const existing = this.inMemoryCache.careMembers.find(
      m => m.care_profile_id === invite.care_profile_id && m.user_id === user.id
    );
    if (existing && existing.status === 'active') {
      return { success: false, error: 'You are already an active member of this Care Circle.' };
    }

    // Join circle
    const newMember: CareMember = {
      id: `member_${Date.now()}`,
      care_profile_id: invite.care_profile_id,
      user_id: user.id,
      role: invite.role,
      can_manage_medications: invite.role === 'caretaker',
      can_manage_appointments: invite.role === 'caretaker',
      can_invite_members: false,
      can_acknowledge_alerts: true,
      receive_email_alerts: true,
      status: 'active',
      joined_at: new Date().toISOString(),
      profile: user,
    };

    if (existing) {
      existing.status = 'active';
      existing.role = invite.role;
    } else {
      this.inMemoryCache.careMembers.push(newMember);
    }

    invite.status = 'redeemed';
    invite.redeemed_at = new Date().toISOString();
    invite.redeemed_by = user.id;

    // Log activity
    this.addActivityLog({
      careProfileId: invite.care_profile_id,
      actorId: user.id,
      actorName: user.full_name,
      actorRole: invite.role,
      activityType: 'member_joined',
      description: `${user.full_name} joined the Care Circle as ${invite.role === 'family' ? 'Family Member' : 'Caretaker'}.`,
    });

    this.saveAll();
    return { success: true, careProfileId: invite.care_profile_id };
  }

  // --- Medications & Schedules ---
  async getMedications(careProfileId: string): Promise<Medication[]> {
    if (isSupabaseConfigured() && supabase) {
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
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('dose_logs')
        .select('*, medication:medications(*)')
        .eq('care_profile_id', careProfileId)
        .order('scheduled_date', { ascending: false });
      if (!error && data) return data;
    }

    return this.inMemoryCache.doseLogs
      .filter(d => d.care_profile_id === careProfileId)
      .map(d => ({
        ...d,
        medication: this.inMemoryCache.medications.find(m => m.id === d.medication_id),
      }));
  }

  /**
   * Idempotent Dose Confirmation:
   * Prevents duplicate confirmations and marks escalation notifications resolved.
   */
  async recordDoseAction(params: {
    careProfileId: string;
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    actorId?: string;
    actorName: string;
    actorRole: string;
    skipReason?: string;
    notes?: string;
  }): Promise<{ success: boolean; alreadyConfirmed: boolean; doseLog: DoseLog }> {
    const doseIdentity = `dose_${params.medicationId}_${params.scheduledDate}_${params.scheduledTime}`;

    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.rpc('record_dose_action', {
        p_care_profile_id: params.careProfileId,
        p_medication_id: params.medicationId,
        p_schedule_id: params.scheduleId || null,
        p_scheduled_date: params.scheduledDate,
        p_scheduled_time: params.scheduledTime,
        p_status: params.status,
        p_confirmed_by: params.actorId || null,
        p_actor_name: params.actorName,
        p_actor_role: params.actorRole,
        p_notes: params.notes || null,
        p_skip_reason: params.skipReason || null,
      });
      if (data) {
        return {
          success: data.success,
          alreadyConfirmed: data.already_confirmed || false,
          doseLog: data.log,
        };
      }
    }

    // Local / In-memory execution
    let log = this.inMemoryCache.doseLogs.find(
      l => l.care_profile_id === params.careProfileId && l.dose_identity === doseIdentity
    );

    let alreadyConfirmed = false;
    const nowIso = new Date().toISOString();

    if (log) {
      if (log.status === 'taken' && params.status === 'taken') {
        alreadyConfirmed = true;
        return { success: true, alreadyConfirmed: true, doseLog: log };
      }
      log.status = params.status;
      log.confirmed_at = nowIso;
      log.confirmed_by = params.actorId;
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
        confirmed_at: nowIso,
        confirmed_by: params.actorId,
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

    // Record activity
    const med = this.inMemoryCache.medications.find(m => m.id === params.medicationId);
    this.addActivityLog({
      careProfileId: params.careProfileId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      activityType: params.status === 'taken' ? 'dose_taken' : 'dose_skipped',
      description: `${params.actorName} marked ${med?.name || 'medication'} (${params.scheduledTime}) as ${params.status}${params.skipReason ? `: ${params.skipReason}` : '.'}`,
    });

    this.saveAll();
    return { success: true, alreadyConfirmed, doseLog: log };
  }

  // --- Appointments ---
  async getAppointments(careProfileId: string): Promise<Appointment[]> {
    if (isSupabaseConfigured() && supabase) {
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
    if (isSupabaseConfigured() && supabase) {
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
        p_acknowledged_by: actorId,
        p_actor_name: actorName,
        p_actor_role: actorRole,
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
    if (isSupabaseConfigured() && supabase) {
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
    localStorage.clear();
    this.inMemoryCache.initialized = false;
    this.init();
  }
}

export const dataService = new StorageDataService();
