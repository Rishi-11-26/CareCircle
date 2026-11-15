import { DoseLog, Appointment, Notification, CareInsight, CareProfile } from '@/types';

export interface CareIntelligenceReport {
  summary: string;
  insights: CareInsight[];
  overallStatus: 'stable' | 'attention_needed' | 'action_required';
  calculatedAt: string;
}

/**
 * Care Intelligence Engine
 * A rule-based, transparent, evidence-traceable intelligence engine for elderly care.
 * Strictly adheres to healthcare boundaries: non-medical recommendations only,
 * 100% grounded in real stored event logs.
 */
export function analyzeCareEvents(params: {
  careProfile: CareProfile;
  doseLogs: DoseLog[];
  appointments: Appointment[];
  notifications: Notification[];
  lookbackDays?: number;
}): CareIntelligenceReport {
  const { careProfile, doseLogs, appointments, notifications, lookbackDays = 7 } = params;
  const insights: CareInsight[] = [];
  const personName = careProfile.preferred_name || careProfile.full_name;

  const now = new Date();
  const lookbackDate = new Date();
  lookbackDate.setDate(now.getDate() - lookbackDays);

  // Filter logs within lookback window
  const recentLogs = doseLogs.filter(log => {
    const logDate = new Date(`${log.scheduled_date}T${log.scheduled_time || '00:00'}`);
    return logDate >= lookbackDate && logDate <= now;
  });

  // 1. REPEATED UNCONFIRMED DOSE DETECTION
  const unconfirmedLogs = recentLogs.filter(l => l.status === 'unconfirmed');
  if (unconfirmedLogs.length >= 2) {
    // Group by time of day to detect routine conflict patterns
    const timeSlots: Record<string, typeof unconfirmedLogs> = {};
    unconfirmedLogs.forEach(l => {
      const slot = l.scheduled_time ? l.scheduled_time.slice(0, 2) + ':00' : 'Unknown';
      if (!timeSlots[slot]) timeSlots[slot] = [];
      timeSlots[slot].push(l);
    });

    const recurringSlot = Object.entries(timeSlots).find(([_, logs]) => logs.length >= 2);

    if (recurringSlot) {
      const [slot, logs] = recurringSlot;
      insights.push({
        id: `insight_time_cluster_${slot.replace(':', '')}`,
        type: 'missed_pattern',
        title: `Recurring unconfirmed doses around ${slot}`,
        observation: `${logs.length} scheduled doses around ${slot} remained unconfirmed during the last ${lookbackDays} days.`,
        evidence: {
          count: logs.length,
          timeframe: `Past ${lookbackDays} days`,
          eventIds: logs.map(l => l.id),
          doseIdentities: logs.map(l => l.dose_identity),
        },
        recommendedAction: `Check with ${personName} to see if their ${slot} schedule conflicts with meal preparation, sleep routines, or morning activities.`,
        severity: logs.length >= 3 ? 'urgent' : 'attention',
        generatedAt: now.toISOString(),
      });
    } else {
      insights.push({
        id: 'insight_unconfirmed_general',
        type: 'missed_pattern',
        title: `Unconfirmed doses detected`,
        observation: `${unconfirmedLogs.length} scheduled doses remained unconfirmed during the last ${lookbackDays} days.`,
        evidence: {
          count: unconfirmedLogs.length,
          timeframe: `Past ${lookbackDays} days`,
          eventIds: unconfirmedLogs.map(l => l.id),
          doseIdentities: unconfirmedLogs.map(l => l.dose_identity),
        },
        recommendedAction: `Kindly contact ${personName} to verify if doses were taken and whether reminders need adjustment.`,
        severity: 'attention',
        generatedAt: now.toISOString(),
      });
    }
  }

  // 2. ADHERENCE TREND ANALYSIS
  const midPoint = new Date();
  midPoint.setDate(now.getDate() - Math.floor(lookbackDays / 2));

  const firstHalfLogs = recentLogs.filter(l => new Date(`${l.scheduled_date}T${l.scheduled_time}`) < midPoint);
  const secondHalfLogs = recentLogs.filter(l => new Date(`${l.scheduled_date}T${l.scheduled_time}`) >= midPoint);

  const calcRate = (logs: DoseLog[]) => {
    if (logs.length === 0) return null;
    const taken = logs.filter(l => l.status === 'taken').length;
    return Math.round((taken / logs.length) * 100);
  };

  const rateEarly = calcRate(firstHalfLogs);
  const rateRecent = calcRate(secondHalfLogs);

  if (rateEarly !== null && rateRecent !== null && firstHalfLogs.length >= 3 && secondHalfLogs.length >= 3) {
    const diff = rateRecent - rateEarly;
    if (diff <= -15) {
      insights.push({
        id: 'insight_adherence_drop',
        type: 'adherence_shift',
        title: 'Recent adherence rate decline',
        observation: `Adherence decreased from ${rateEarly}% in the prior period to ${rateRecent}% in recent days (${diff}% change).`,
        evidence: {
          count: secondHalfLogs.filter(l => l.status !== 'taken').length,
          timeframe: `Comparing prior ${Math.floor(lookbackDays / 2)} days vs recent ${Math.floor(lookbackDays / 2)} days`,
          eventIds: secondHalfLogs.map(l => l.id),
        },
        recommendedAction: `Review whether recent changes in daily routine, medication side effects, or feeling unwell contributed to this change.`,
        severity: 'attention',
        generatedAt: now.toISOString(),
      });
    } else if (diff >= 15) {
      insights.push({
        id: 'insight_adherence_gain',
        type: 'routine_stability',
        title: 'Positive adherence improvement',
        observation: `Adherence improved from ${rateEarly}% to ${rateRecent}% in recent days (+${diff}% gain).`,
        evidence: {
          count: secondHalfLogs.filter(l => l.status === 'taken').length,
          timeframe: `Past ${lookbackDays} days`,
          eventIds: secondHalfLogs.map(l => l.id),
        },
        recommendedAction: `Acknowledge and encourage ${personName}'s consistent routine management.`,
        severity: 'info',
        generatedAt: now.toISOString(),
      });
    }
  }

  // 3. PENDING CAREGIVER ACKNOWLEDGEMENT LATENCY
  const pendingAlerts = notifications.filter(
    n => n.category === 'unconfirmed_escalation' && n.status === 'pending'
  );
  if (pendingAlerts.length > 0) {
    const oldestPending = pendingAlerts[0];
    const hoursElapsed = Math.round((now.getTime() - new Date(oldestPending.created_at).getTime()) / (1000 * 60 * 60));

    if (hoursElapsed >= 4) {
      insights.push({
        id: 'insight_unacknowledged_alert',
        type: 'acknowledgement_delay',
        title: 'Unacknowledged care follow-up alerts',
        observation: `${pendingAlerts.length} follow-up alert(s) have remained unacknowledged for over ${hoursElapsed} hours.`,
        evidence: {
          count: pendingAlerts.length,
          timeframe: `Active alerts awaiting response`,
          eventIds: pendingAlerts.map(n => n.id),
        },
        recommendedAction: `Care circle members should coordinate and acknowledge these notifications to ensure follow-up is documented.`,
        severity: hoursElapsed >= 12 ? 'urgent' : 'attention',
        generatedAt: now.toISOString(),
      });
    }
  }

  // 4. UPCOMING MEDICAL APPOINTMENTS WITHIN 48 HOURS
  const upcomingSoon = appointments.filter(apt => {
    if (apt.status === 'cancelled') return false;
    const aptDate = new Date(`${apt.appointment_date}T${apt.appointment_time || '00:00'}`);
    const diffHours = (aptDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 48;
  });

  if (upcomingSoon.length > 0) {
    const apt = upcomingSoon[0];
    insights.push({
      id: `insight_apt_${apt.id}`,
      type: 'appointment_upcoming',
      title: `Upcoming appointment: ${apt.doctor_name}`,
      observation: `Doctor visit scheduled with ${apt.doctor_name} (${apt.specialty || 'General'}) on ${apt.appointment_date} at ${apt.appointment_time}.`,
      evidence: {
        count: 1,
        timeframe: 'Next 48 hours',
        eventIds: [apt.id],
      },
      recommendedAction: `Prepare a list of recent medication doses, refills needed, and any logged symptom notes to share with the physician.`,
      severity: 'info',
      generatedAt: now.toISOString(),
    });
  }

  // Determine overall status
  let overallStatus: 'stable' | 'attention_needed' | 'action_required' = 'stable';
  if (insights.some(i => i.severity === 'urgent')) {
    overallStatus = 'action_required';
  } else if (insights.some(i => i.severity === 'attention')) {
    overallStatus = 'attention_needed';
  }

  // Generate readable summary
  let summary = '';
  if (overallStatus === 'stable') {
    summary = `${personName}'s care routine is stable with no critical follow-ups pending. Medication adherence is consistent across recorded schedules.`;
  } else if (overallStatus === 'attention_needed') {
    summary = `Care routine for ${personName} has ${insights.length} item(s) recommending friendly check-in or schedule review.`;
  } else {
    summary = `Care circle attention required: ${insights.length} follow-up item(s) require active coordination and check-in.`;
  }

  return {
    summary,
    insights,
    overallStatus,
    calculatedAt: now.toISOString(),
  };
}
