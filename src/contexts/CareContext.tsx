import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  UserProfile,
  UserRole,
  CareProfile,
  CareMember,
  Medication,
  DoseLog,
  Appointment,
  Notification,
  ActivityLog,
  CareInsight,
  AdherenceAnalytics,
  AssistanceLevel,
  DoseEventSource,
  FollowUpStatus,
} from '@/types';
import { dataService } from '@/services/storageAdapter';
import {
  supabase,
  isSupabaseConfigured,
  signUpUser,
  signInUser,
  signOutUser,
  requestPasswordReset,
  updateUserPassword,
  fetchUserProfile,
} from '@/lib/supabase';
import { analyzeCareEvents, CareIntelligenceReport } from '@/lib/careIntelligence';
import { calculateAdherenceMetrics } from '@/lib/analytics';

interface CareContextType {
  // Authentication & Session
  session: Session | null;
  authUser: User | null;
  currentUser: UserProfile;
  isAuthenticated: boolean;
  authLoading: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;

  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    timezone: string;
  }) => Promise<{ user: User | null; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;

  // Multi-care circle state & operations
  careProfiles: CareProfile[];
  careProfile: CareProfile | null;
  selectCareProfile: (id: string) => void;
  createCareProfile: (params: {
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
  }) => Promise<CareProfile>;

  // Role simulation (for demo / evaluator)
  switchRole: (role: 'elderly' | 'family' | 'caretaker') => void;

  // Domain data & clinical context
  careMembers: CareMember[];
  medications: Medication[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  intelligenceReport: CareIntelligenceReport;
  adherenceMetrics: AdherenceAnalytics;
  unreadAlertsCount: number;
  assistanceLevel: AssistanceLevel;

  // Clinical & medication actions
  recordDose: (params: {
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    source?: DoseEventSource;
    skipReason?: string;
    notes?: string;
  }) => Promise<{ success: boolean; alreadyConfirmed: boolean; error?: string }>;

  correctDose: (params: {
    originalLogId: string;
    newStatus: 'taken' | 'skipped';
    reason: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  updateFollowUp: (params: {
    doseLogId: string;
    newStatus: FollowUpStatus;
    note?: string;
  }) => Promise<boolean>;

  updateAssistanceLevel: (level: AssistanceLevel) => Promise<boolean>;

  saveMedication: (
    med: Omit<Medication, 'id'> & { id?: string },
    schedules: { time: string; label?: string }[]
  ) => Promise<Medication>;

  deleteMedication: (id: string) => Promise<boolean>;

  saveAppointment: (apt: Omit<Appointment, 'id'> & { id?: string }) => Promise<Appointment>;

  cancelAppointment: (id: string) => Promise<boolean>;

  createInvitation: (params: {
    role: 'family' | 'caretaker';
    passcode: string;
    inviteeEmail?: string;
  }) => Promise<any>;

  redeemInvitation: (passcode: string) => Promise<{ success: boolean; error?: string }>;

  acknowledgeAlert: (notificationId: string, note?: string) => Promise<boolean>;

  triggerEscalationCycle: () => Promise<{ createdEscalations: number }>;

  resetDemoData: () => void;
  refreshData: () => Promise<void>;
}

const CareContext = createContext<CareContextType | undefined>(undefined);

export const CareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session & Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Demo mode detection
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    const forcedDemo = localStorage.getItem('carecircle_demo_mode');
    if (forcedDemo === 'true') {
      dataService.setDemoMode(true);
      return true;
    }
    if (!isSupabaseConfigured()) {
      dataService.setDemoMode(true);
      return true;
    }
    const prodMode = localStorage.getItem('carecircle_production_mode') === 'true';
    if (prodMode) return false;
    return false;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    return dataService.getCurrentUser() || dataService.switchUserRole('elderly');
  });

  // Care profile state
  const [careProfiles, setCareProfiles] = useState<CareProfile[]>([]);
  const [careProfile, setCareProfile] = useState<CareProfile | null>(() =>
    dataService.getInitialCareProfile()
  );

  // Clinical domain entities
  const [careMembers, setCareMembers] = useState<CareMember[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to load or synchronize user profile
  const loadUserProfile = useCallback(async (userId: string, email?: string) => {
    try {
      const profile = await fetchUserProfile(userId);
      if (profile) {
        setCurrentUser(profile);
        dataService.setCurrentUser(profile);
      } else {
        const { data: authData } = (await supabase?.auth.getUser()) || { data: { user: null } };
        const meta = authData?.user?.user_metadata;
        const fallbackProfile: UserProfile = {
          id: userId,
          email: email || '',
          full_name: meta?.full_name || email?.split('@')[0] || 'CareCircle User',
          role: (meta?.role as UserRole) || 'family',
          timezone: meta?.timezone || 'America/Los_Angeles',
          created_at: new Date().toISOString(),
        };
        setCurrentUser(fallbackProfile);
        dataService.setCurrentUser(fallbackProfile);
      }
    } catch (err) {
      console.warn('[CareContext] Failed to load user profile:', err);
    }
  }, []);

  // Supabase Auth Initialization & Real-Time Listener
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Restore existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setAuthUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        loadUserProfile(initialSession.user.id, initialSession.user.email);
      }
      setAuthLoading(false);
    }).catch(err => {
      console.warn('[CareContext] Error restoring session:', err);
      if (isMounted) setAuthLoading(false);
    });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setAuthUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadUserProfile(newSession.user.id, newSession.user.email);
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // Main data synchronization
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const profiles = await dataService.getCareProfiles();
      setCareProfiles(profiles);

      const savedProfileId = localStorage.getItem('carecircle_selected_profile_id');
      const matchedProfile = profiles.find(p => p.id === savedProfileId);
      const activeCP = matchedProfile || profiles[0] || null;
      setCareProfile(activeCP);

      if (activeCP) {
        const [members, meds, doses, apts, notifs, acts] = await Promise.all([
          dataService.getCareMembers(activeCP.id),
          dataService.getMedications(activeCP.id),
          dataService.getDoseLogs(activeCP.id),
          dataService.getAppointments(activeCP.id),
          dataService.getNotifications(activeCP.id),
          dataService.getActivityLogs(activeCP.id),
        ]);

        setCareMembers(members);
        setMedications(meds);
        setDoseLogs(doses);
        setAppointments(apts);
        setNotifications(notifs);
        setActivityLogs(acts);
      } else {
        setCareMembers([]);
        setMedications([]);
        setDoseLogs([]);
        setAppointments([]);
        setNotifications([]);
        setActivityLogs([]);
      }
    } catch (err) {
      console.warn('[CareContext] Error refreshing data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, session]);

  const selectCareProfile = useCallback(
    async (id: string) => {
      localStorage.setItem('carecircle_selected_profile_id', id);
      const target = careProfiles.find(p => p.id === id) || null;
      setCareProfile(target);

      if (target) {
        setIsLoading(true);
        try {
          const [members, meds, doses, apts, notifs, acts] = await Promise.all([
            dataService.getCareMembers(target.id),
            dataService.getMedications(target.id),
            dataService.getDoseLogs(target.id),
            dataService.getAppointments(target.id),
            dataService.getNotifications(target.id),
            dataService.getActivityLogs(target.id),
          ]);

          setCareMembers(members);
          setMedications(meds);
          setDoseLogs(doses);
          setAppointments(apts);
          setNotifications(notifs);
          setActivityLogs(acts);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [careProfiles]
  );

  const createCareProfile = async (params: {
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
  }) => {
    const ownerId = authUser?.id || currentUser.id;
    const newProfile = await dataService.createCareProfile({
      ...params,
      ownerId,
    });
    localStorage.setItem('carecircle_selected_profile_id', newProfile.id);
    await refreshData();
    return newProfile;
  };

  const switchRole = (role: 'elderly' | 'family' | 'caretaker') => {
    const newUser = dataService.switchUserRole(role);
    setCurrentUser({ ...newUser });
  };

  const setDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    localStorage.setItem('carecircle_demo_mode', enabled ? 'true' : 'false');
    dataService.setDemoMode(enabled);
    if (enabled) {
      dataService.resetToDemoSeed();
      const newUser = dataService.getCurrentUser() || dataService.switchUserRole('elderly');
      setCurrentUser(newUser);
      localStorage.setItem('carecircle_selected_profile_id', 'profile_margaret');
      const initial = dataService.getInitialCareProfile();
      if (initial) {
        setCareProfile(initial);
        setCareProfiles([initial]);
      }
    }
    refreshData();
  };

  // Auth Operations
  const signUp = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    timezone: string;
  }) => {
    setIsLoading(true);
    try {
      setIsDemoMode(false);
      localStorage.removeItem('carecircle_demo_mode');
      dataService.setDemoMode(false);

      const res = await signUpUser(params);
      if (res.user) {
        setAuthUser(res.user);
        setSession(res.session);
        const newProfile: UserProfile = {
          id: res.user.id,
          email: params.email,
          full_name: params.fullName,
          role: params.role,
          timezone: params.timezone,
          created_at: new Date().toISOString(),
        };
        setCurrentUser(newProfile);
        dataService.setCurrentUser(newProfile);
        await refreshData();
      }
      return { user: res.user, error: res.error };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      setIsDemoMode(false);
      localStorage.removeItem('carecircle_demo_mode');
      dataService.setDemoMode(false);

      const res = await signInUser(email, password);
      if (res.user) {
        setAuthUser(res.user);
        setSession(res.session);
        await loadUserProfile(res.user.id, email);
        await refreshData();
      }
      return { user: res.user, error: res.error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await signOutUser();
      setSession(null);
      setAuthUser(null);
      setIsDemoMode(false);
      localStorage.removeItem('carecircle_demo_mode');
      localStorage.removeItem('carecircle_selected_profile_id');
      localStorage.removeItem('carecircle_current_user');
      dataService.setDemoMode(false);
      dataService.setCurrentUser(null);
      setCareProfile(null);
      setCareProfiles([]);
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    return await requestPasswordReset(email);
  };

  const updatePassword = async (newPassword: string) => {
    return await updateUserPassword(newPassword);
  };

  // Domain Actions
  const recordDose = async (params: {
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    source?: DoseEventSource;
    skipReason?: string;
    notes?: string;
  }) => {
    if (!careProfile) return { success: false, alreadyConfirmed: false, error: 'No care profile selected' };
    const res = await dataService.recordDoseAction({
      careProfileId: careProfile.id,
      medicationId: params.medicationId,
      scheduleId: params.scheduleId,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      status: params.status,
      actorId: currentUser.id,
      actorName: currentUser.full_name,
      actorRole: currentUser.role,
      source: params.source,
      skipReason: params.skipReason,
      notes: params.notes,
    });
    await refreshData();
    return res;
  };

  const correctDose = async (params: {
    originalLogId: string;
    newStatus: 'taken' | 'skipped';
    reason: string;
    notes?: string;
  }) => {
    if (!careProfile) return { success: false, error: 'No care profile selected' };
    const res = await dataService.correctDoseAction({
      careProfileId: careProfile.id,
      originalDoseLogId: params.originalLogId,
      actorId: currentUser.id,
      actorName: currentUser.full_name,
      actorRole: currentUser.role,
      newStatus: params.newStatus,
      reason: params.reason,
      notes: params.notes,
    });
    if (res.success) {
      await refreshData();
    }
    return { success: res.success, error: res.error };
  };

  const updateFollowUp = async (params: {
    doseLogId: string;
    newStatus: FollowUpStatus;
    note?: string;
  }) => {
    if (!careProfile) return false;
    const res = await dataService.updateFollowUpStatus({
      careProfileId: careProfile.id,
      doseLogId: params.doseLogId,
      actorId: currentUser.id,
      actorName: currentUser.full_name,
      actorRole: currentUser.role,
      newStatus: params.newStatus,
      note: params.note,
    });
    if (res) {
      await refreshData();
    }
    return res;
  };

  const updateAssistanceLevel = async (level: AssistanceLevel) => {
    if (!careProfile) return false;
    const res = await dataService.updateAssistanceLevel(careProfile.id, level);
    if (res) {
      await refreshData();
    }
    return res;
  };

  const saveMedication = async (
    med: Omit<Medication, 'id'> & { id?: string },
    schedules: { time: string; label?: string }[]
  ) => {
    if (!careProfile) throw new Error('No care profile selected');
    const res = await dataService.saveMedication({ ...med, care_profile_id: careProfile.id }, schedules);
    await refreshData();
    return res;
  };

  const deleteMedication = async (id: string) => {
    const res = await dataService.deleteMedication(id);
    await refreshData();
    return res;
  };

  const saveAppointment = async (apt: Omit<Appointment, 'id'> & { id?: string }) => {
    if (!careProfile) throw new Error('No care profile selected');
    const res = await dataService.saveAppointment({
      ...apt,
      care_profile_id: careProfile.id,
      created_by: currentUser.id,
    });
    await refreshData();
    return res;
  };

  const cancelAppointment = async (id: string) => {
    const res = await dataService.cancelAppointment(id);
    await refreshData();
    return res;
  };

  const createInvitation = async (params: {
    role: 'family' | 'caretaker';
    passcode: string;
    inviteeEmail?: string;
  }) => {
    if (!careProfile) throw new Error('No care profile selected');
    const res = await dataService.createInvitation({
      careProfileId: careProfile.id,
      inviterId: currentUser.id,
      role: params.role,
      passcode: params.passcode,
      inviteeEmail: params.inviteeEmail,
    });
    await refreshData();
    return res;
  };

  const redeemInvitation = async (passcode: string) => {
    const res = await dataService.redeemInvitation(passcode, currentUser);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const acknowledgeAlert = async (notificationId: string, note?: string) => {
    const res = await dataService.acknowledgeNotification(
      notificationId,
      currentUser.id,
      currentUser.full_name,
      currentUser.role,
      note
    );
    await refreshData();
    return res;
  };

  const triggerEscalationCycle = async () => {
    if (!careProfile) return { createdEscalations: 0 };
    const res = await dataService.runEscalationCycle(careProfile.id);
    await refreshData();
    return res;
  };

  const resetDemoData = () => {
    dataService.resetToDemoSeed();
    const newUser = dataService.getCurrentUser() || dataService.switchUserRole('elderly');
    setCurrentUser(newUser);
    refreshData();
  };

  // Intelligence calculations
  const intelligenceReport = useMemo(() => {
    if (!careProfile) {
      return {
        summary: 'No active profile.',
        insights: [],
        overallStatus: 'stable' as const,
        calculatedAt: new Date().toISOString(),
      };
    }
    return analyzeCareEvents({
      careProfile,
      doseLogs,
      appointments,
      notifications,
      lookbackDays: 7,
    });
  }, [careProfile, doseLogs, appointments, notifications]);

  const adherenceMetrics = useMemo(() => {
    return calculateAdherenceMetrics(doseLogs, 7);
  }, [doseLogs]);

  const unreadAlertsCount = useMemo(() => {
    return notifications.filter(n => n.status === 'pending' || n.status === 'sent').length;
  }, [notifications]);

  const assistanceLevel: AssistanceLevel = careProfile?.assistance_level || 'independent';
  const isAuthenticated = Boolean(session?.user || isDemoMode);

  return (
    <CareContext.Provider
      value={{
        session,
        authUser,
        currentUser,
        isAuthenticated,
        authLoading,
        isLoading,
        isDemoMode,
        setDemoMode,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        careProfiles,
        careProfile,
        selectCareProfile,
        createCareProfile,
        switchRole,
        careMembers,
        medications,
        doseLogs,
        appointments,
        notifications,
        activityLogs,
        intelligenceReport,
        adherenceMetrics,
        unreadAlertsCount,
        assistanceLevel,
        recordDose,
        correctDose,
        updateFollowUp,
        updateAssistanceLevel,
        saveMedication,
        deleteMedication,
        saveAppointment,
        cancelAppointment,
        createInvitation,
        redeemInvitation,
        acknowledgeAlert,
        triggerEscalationCycle,
        resetDemoData,
        refreshData,
      }}
    >
      {children}
    </CareContext.Provider>
  );
};

export const useCare = (): CareContextType => {
  const context = useContext(CareContext);
  if (!context) {
    throw new Error('useCare must be used within a CareProvider');
  }
  return context;
};
