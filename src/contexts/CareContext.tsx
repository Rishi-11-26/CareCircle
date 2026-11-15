import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserProfile,
  CareProfile,
  CareMember,
  Medication,
  DoseLog,
  Appointment,
  Notification,
  ActivityLog,
  CareInsight,
  AdherenceAnalytics,
} from '@/types';
import { dataService } from '@/services/storageAdapter';
import { analyzeCareEvents, CareIntelligenceReport } from '@/lib/careIntelligence';
import { calculateAdherenceMetrics } from '@/lib/analytics';

interface CareContextType {
  currentUser: UserProfile;
  switchRole: (role: 'elderly' | 'family' | 'caretaker') => void;
  careProfile: CareProfile | null;
  careMembers: CareMember[];
  medications: Medication[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  intelligenceReport: CareIntelligenceReport;
  adherenceMetrics: AdherenceAnalytics;
  isLoading: boolean;
  unreadAlertsCount: number;

  // Actions
  recordDose: (params: {
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    skipReason?: string;
    notes?: string;
  }) => Promise<{ success: boolean; alreadyConfirmed: boolean }>;

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
  const [currentUser, setCurrentUser] = useState<UserProfile>(
    () => dataService.getCurrentUser() || dataService.switchUserRole('elderly')
  );
  const [careProfile, setCareProfile] = useState<CareProfile | null>(null);
  const [careMembers, setCareMembers] = useState<CareMember[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const profiles = await dataService.getCareProfiles();
      const currentCP = profiles[0] || null;
      setCareProfile(currentCP);

      if (currentCP) {
        const [members, meds, doses, apts, notifs, acts] = await Promise.all([
          dataService.getCareMembers(currentCP.id),
          dataService.getMedications(currentCP.id),
          dataService.getDoseLogs(currentCP.id),
          dataService.getAppointments(currentCP.id),
          dataService.getNotifications(currentCP.id),
          dataService.getActivityLogs(currentCP.id),
        ]);

        setCareMembers(members);
        setMedications(meds);
        setDoseLogs(doses);
        setAppointments(apts);
        setNotifications(notifs);
        setActivityLogs(acts);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const switchRole = (role: 'elderly' | 'family' | 'caretaker') => {
    const newUser = dataService.switchUserRole(role);
    setCurrentUser({ ...newUser });
  };

  const recordDose = async (params: {
    medicationId: string;
    scheduleId?: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped';
    skipReason?: string;
    notes?: string;
  }) => {
    if (!careProfile) return { success: false, alreadyConfirmed: false };
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
      skipReason: params.skipReason,
      notes: params.notes,
    });
    await refreshData();
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

  // Adherence analytics
  const adherenceMetrics = useMemo(() => {
    return calculateAdherenceMetrics(doseLogs, 7);
  }, [doseLogs]);

  // Unread urgent notifications count
  const unreadAlertsCount = useMemo(() => {
    return notifications.filter(n => n.status === 'pending' || n.status === 'sent').length;
  }, [notifications]);

  return (
    <CareContext.Provider
      value={{
        currentUser,
        switchRole,
        careProfile,
        careMembers,
        medications,
        doseLogs,
        appointments,
        notifications,
        activityLogs,
        intelligenceReport,
        adherenceMetrics,
        isLoading,
        unreadAlertsCount,
        recordDose,
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
