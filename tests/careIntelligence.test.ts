import { describe, it, expect } from 'vitest';
import { analyzeCareEvents } from '@/lib/careIntelligence';
import { CareProfile, DoseLog, Appointment, Notification } from '@/types';
import { format, subDays, addDays } from 'date-fns';

describe('Care Intelligence Engine (Rule-based & Evidence-traceable)', () => {
  const profile: CareProfile = {
    id: 'cp1',
    owner_id: 'u1',
    full_name: 'Margaret Hayes',
    preferred_name: 'Margaret',
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');

  it('detects recurring unconfirmed dose clusters around the same time of day', () => {
    const doseLogs: DoseLog[] = [
      {
        id: 'log1',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd1',
        scheduled_date: yesterday,
        scheduled_time: '08:00',
        status: 'unconfirmed',
      },
      {
        id: 'log2',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd2',
        scheduled_date: twoDaysAgo,
        scheduled_time: '08:00',
        status: 'unconfirmed',
      },
    ];

    const report = analyzeCareEvents({
      careProfile: profile,
      doseLogs,
      appointments: [],
      notifications: [],
    });

    expect(report.overallStatus).toBe('attention_needed');
    const clusterInsight = report.insights.find(i => i.type === 'missed_pattern');
    expect(clusterInsight).toBeDefined();
    expect(clusterInsight?.title).toContain('Recurring unconfirmed doses around 08:00');
    expect(clusterInsight?.evidence.count).toBe(2);
    expect(clusterInsight?.evidence.eventIds).toEqual(['log1', 'log2']);
    // Check non-medical recommendation phrasing
    expect(clusterInsight?.recommendedAction).toContain('Check with Margaret to see if their 08:00 schedule conflicts');
  });

  it('detects upcoming medical appointments within 48 hours and suggests preparation', () => {
    const inOneDay = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const appointments: Appointment[] = [
      {
        id: 'apt1',
        care_profile_id: 'cp1',
        doctor_name: 'Dr. Robert Chen',
        specialty: 'Cardiology',
        location: 'Clinic 400',
        appointment_date: inOneDay,
        appointment_time: '10:00',
        status: 'scheduled',
        reminder_sent: false,
      },
    ];

    const report = analyzeCareEvents({
      careProfile: profile,
      doseLogs: [],
      appointments,
      notifications: [],
    });

    const aptInsight = report.insights.find(i => i.type === 'appointment_upcoming');
    expect(aptInsight).toBeDefined();
    expect(aptInsight?.observation).toContain('Dr. Robert Chen');
    expect(aptInsight?.recommendedAction).toContain('Prepare a list of recent medication doses');
  });

  it('flags unacknowledged caregiver follow-up alerts when latency exceeds threshold', () => {
    const oldNotification: Notification = {
      id: 'n1',
      care_profile_id: 'cp1',
      category: 'unconfirmed_escalation',
      title: 'Unconfirmed Dose Alert',
      message: 'Dose not confirmed',
      priority: 'urgent',
      status: 'pending',
      email_status: 'none',
      created_at: subDays(new Date(), 1).toISOString(), // 24 hours ago
    };

    const report = analyzeCareEvents({
      careProfile: profile,
      doseLogs: [],
      appointments: [],
      notifications: [oldNotification],
    });

    const ackInsight = report.insights.find(i => i.type === 'acknowledgement_delay');
    expect(ackInsight).toBeDefined();
    expect(ackInsight?.severity).toBe('urgent');
    expect(report.overallStatus).toBe('action_required');
  });
});
