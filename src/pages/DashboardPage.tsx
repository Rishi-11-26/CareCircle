import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { DoseCard } from '@/components/medications/DoseCard';
import {
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  Brain,
  Sparkles,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { MedicationModal } from '@/components/medications/MedicationModal';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { AcknowledgeModal } from '@/components/notifications/AcknowledgeModal';
import { Notification } from '@/types';

export const DashboardPage: React.FC = () => {
  const {
    currentUser,
    careProfile,
    medications,
    doseLogs,
    appointments,
    notifications,
    activityLogs,
    adherenceMetrics,
    intelligenceReport,
  } = useCare();

  const [simplifiedElderlyView, setSimplifiedElderlyView] = useState(false);
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isAptModalOpen, setIsAptModalOpen] = useState(false);
  const [selectedNotifForAck, setSelectedNotifForAck] = useState<Notification | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Build today's dose schedule instances
  const todaysScheduleItems: {
    medication: (typeof medications)[0];
    time: string;
    label?: string;
    doseLog?: (typeof doseLogs)[0];
  }[] = [];

  medications.forEach(med => {
    if (!med.is_active) return;
    (med.schedules || []).forEach(sched => {
      const log = doseLogs.find(
        d =>
          d.medication_id === med.id &&
          d.scheduled_date === todayStr &&
          d.scheduled_time.slice(0, 5) === sched.time_of_day.slice(0, 5)
      );
      todaysScheduleItems.push({
        medication: med,
        time: sched.time_of_day,
        label: sched.label,
        doseLog: log,
      });
    });
  });

  // Sort by time
  todaysScheduleItems.sort((a, b) => a.time.localeCompare(b.time));

  // Upcoming appointments
  const upcomingApts = appointments
    .filter(a => a.status === 'scheduled')
    .slice(0, 3);

  // Urgent pending alerts
  const urgentAlerts = notifications.filter(
    n => n.category === 'unconfirmed_escalation' && n.status === 'pending'
  );

  const personName = careProfile?.preferred_name || careProfile?.full_name || 'Margaret';

  // =========================================================================
  // VIEW 1: ELDERLY INDIVIDUAL DASHBOARD (Accessible, simple, high clarity)
  // =========================================================================
  if (currentUser.role === 'elderly') {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Header Greeting & Simplified View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream-light border border-stone p-6 rounded-3xl shadow-warm-sm">
          <div>
            <span className="text-xs font-semibold text-terracotta uppercase tracking-wider">
              {format(new Date(), 'EEEE, MMMM d')}
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest mt-1">
              Good day, {personName}
            </h1>
            <p className="text-sm text-charcoal-light mt-1 max-w-xl">
              Your care circle is active. Here is your daily medication schedule and routine for today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSimplifiedElderlyView(!simplifiedElderlyView)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                simplifiedElderlyView
                  ? 'bg-forest text-ivory border-forest shadow-warm'
                  : 'bg-white text-forest border-stone hover:bg-stone-light'
              }`}
            >
              {simplifiedElderlyView ? 'Standard View' : '🔍 Large Print Mode'}
            </button>

            <a
              href={`tel:${careProfile?.emergency_phone || '5558765432'}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta text-ivory text-xs font-bold hover:bg-terracotta-dark shadow-warm touch-target-elderly"
            >
              <Phone className="w-4 h-4" />
              <span>Call Family</span>
            </a>
          </div>
        </div>

        {/* Today's Medication Schedule */}
        <section className="space-y-4" aria-labelledby="today-meds-heading">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="today-meds-heading" className="font-serif text-2xl font-bold text-charcoal">
                Today's Medications
              </h2>
              <p className="text-xs text-charcoal-muted">
                Tap "I Took This" after taking your medication to keep your circle informed.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-stone rounded-full text-forest">
              {todaysScheduleItems.filter(i => i.doseLog?.status === 'taken').length} of {todaysScheduleItems.length} Taken
            </span>
          </div>

          {todaysScheduleItems.length === 0 ? (
            <div className="p-8 text-center bg-white border border-stone rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-forest mx-auto mb-2" />
              <p className="text-base font-semibold text-charcoal">
                No medications scheduled for today.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {todaysScheduleItems.map((item, idx) => (
                <DoseCard
                  key={idx}
                  medication={item.medication}
                  scheduleTime={item.time}
                  scheduleLabel={item.label}
                  doseLog={item.doseLog}
                  scheduledDate={todayStr}
                  simplifiedView={simplifiedElderlyView}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick Row: Doctor Visits & Emergency Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Upcoming Doctor Visits */}
          <div className="bg-white border border-stone p-6 rounded-2xl shadow-warm-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone/60 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-forest" />
                <h3 className="font-serif text-xl font-bold text-forest">
                  Upcoming Doctor Visits
                </h3>
              </div>
              <Link to="/appointments" className="text-xs font-semibold text-terracotta hover:underline">
                View all
              </Link>
            </div>

            {upcomingApts.length === 0 ? (
              <p className="text-xs text-charcoal-muted">No upcoming appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingApts.map(apt => (
                  <div key={apt.id} className="p-3 bg-stone-light/60 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-charcoal">{apt.doctor_name}</span>
                      <span className="text-xs font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">
                        {apt.appointment_date} at {apt.appointment_time}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-light">{apt.specialty || 'General Practitioner'} • {apt.location}</p>
                    {apt.notes && <p className="text-[11px] text-charcoal-muted italic">{apt.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medical Notes & Allergy Safety */}
          <div className="bg-cream-light/60 border border-stone p-6 rounded-2xl shadow-warm-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-stone/60 pb-3">
              <ShieldCheck className="w-5 h-5 text-forest" />
              <h3 className="font-serif text-xl font-bold text-forest">
                Health Profile & Safety
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone/40">
                <span className="text-charcoal-muted font-medium">Blood Group:</span>
                <span className="font-bold text-charcoal">{careProfile?.blood_group || 'A+'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone/40">
                <span className="text-charcoal-muted font-medium">Allergies:</span>
                <span className="font-bold text-terracotta-dark">
                  {careProfile?.allergies?.join(', ') || 'Penicillin'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone/40">
                <span className="text-charcoal-muted font-medium">Emergency Contact:</span>
                <span className="font-bold text-charcoal">{careProfile?.emergency_phone || '(555) 876-5432'}</span>
              </div>
              <div className="pt-2 text-charcoal-light italic">
                "{careProfile?.medical_notes}"
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FAMILY MEMBER DASHBOARD (Peace-of-mind, adherence, alerts)
  // =========================================================================
  if (currentUser.role === 'family') {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Family Greeting & Peace-of-Mind Hero */}
        <div className="bg-cream-light border border-stone p-6 rounded-3xl shadow-warm-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-forest uppercase tracking-wider">
              Family Member Care Overview
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
              {personName}'s Care Circle
            </h1>
            <p className="text-sm text-charcoal-light max-w-xl">
              Connected care status for {personName}. Staying coordinated helps ensure peace of mind and independent living.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/intelligence"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest text-ivory text-sm font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
            >
              <Brain className="w-4 h-4" />
              <span>Care Intelligence ({intelligenceReport.insights.length})</span>
            </Link>
            <Link
              to="/care-circle"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone bg-white text-charcoal text-sm font-semibold hover:bg-stone-light"
            >
              <Users className="w-4 h-4 text-forest" />
              <span>Circle Passcodes</span>
            </Link>
          </div>
        </div>

        {/* Adherence & Status Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-stone p-5 rounded-2xl shadow-warm-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-charcoal-muted font-semibold uppercase">
              <span>7-Day Adherence</span>
              <TrendingUp className="w-4 h-4 text-forest" />
            </div>
            <div className="font-serif text-3xl font-bold text-forest">
              {adherenceMetrics.adherenceRate}%
            </div>
            <p className="text-xs text-charcoal-muted">
              {adherenceMetrics.confirmedCount} of {adherenceMetrics.totalScheduled} eligible doses confirmed
            </p>
          </div>

          <div className="bg-white border border-stone p-5 rounded-2xl shadow-warm-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-charcoal-muted font-semibold uppercase">
              <span>Routine Status</span>
              <Sparkles className="w-4 h-4 text-forest" />
            </div>
            <div className="font-serif text-2xl font-bold text-charcoal capitalize">
              {intelligenceReport.overallStatus.replace('_', ' ')}
            </div>
            <p className="text-xs text-charcoal-muted">
              {intelligenceReport.summary.slice(0, 50)}...
            </p>
          </div>

          <div className="bg-white border border-stone p-5 rounded-2xl shadow-warm-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-charcoal-muted font-semibold uppercase">
              <span>Upcoming Appointments</span>
              <Calendar className="w-4 h-4 text-forest" />
            </div>
            <div className="font-serif text-3xl font-bold text-forest">
              {upcomingApts.length}
            </div>
            <p className="text-xs text-charcoal-muted">
              Next: {upcomingApts[0]?.doctor_name || 'None pending'}
            </p>
          </div>
        </div>

        {/* Unconfirmed Alerts Banner if any */}
        {urgentAlerts.length > 0 && (
          <div className="p-5 bg-terracotta/10 border border-terracotta/30 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-terracotta-dark font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-terracotta" />
              <span>Pending Unconfirmed Dose Follow-up</span>
            </div>
            {urgentAlerts.map(alert => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-terracotta/20">
                <div className="text-xs">
                  <p className="font-bold text-charcoal">{alert.title}</p>
                  <p className="text-charcoal-light">{alert.message}</p>
                </div>
                <button
                  onClick={() => setSelectedNotifForAck(alert)}
                  className="px-4 py-1.5 rounded-lg bg-terracotta text-ivory text-xs font-semibold hover:bg-terracotta-dark self-start sm:self-auto min-h-[36px]"
                >
                  Acknowledge Check-in
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Two-column layout: Today's Schedule & Recent Activity Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold text-charcoal">
                Today's Medication Tracker
              </h2>
              <Link to="/medications" className="text-xs font-semibold text-forest hover:underline">
                Manage all prescriptions &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {todaysScheduleItems.map((item, idx) => (
                <DoseCard
                  key={idx}
                  medication={item.medication}
                  scheduleTime={item.time}
                  scheduleLabel={item.label}
                  doseLog={item.doseLog}
                  scheduledDate={todayStr}
                />
              ))}
            </div>
          </div>

          {/* Activity Timeline snippet */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-charcoal">
                Recent Circle Activity
              </h2>
              <Link to="/timeline" className="text-xs font-semibold text-forest hover:underline">
                Full history
              </Link>
            </div>

            <div className="bg-white border border-stone rounded-2xl p-4 shadow-warm-sm space-y-3">
              {activityLogs.slice(0, 5).map(act => (
                <div key={act.id} className="border-b border-stone/50 pb-2.5 last:border-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between text-charcoal-muted mb-0.5">
                    <span className="font-semibold text-forest">{act.actor_name}</span>
                    <span className="text-[10px]">{format(new Date(act.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-charcoal-light">{act.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedNotifForAck && (
          <AcknowledgeModal
            notification={selectedNotifForAck}
            onClose={() => setSelectedNotifForAck(null)}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: CARETAKER / NURSE DASHBOARD (Clinical management, alert triage)
  // =========================================================================
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Caretaker Header & Action Bar */}
      <div className="bg-cream-light border border-stone p-6 rounded-3xl shadow-warm-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-forest uppercase tracking-wider">
            Professional Caretaker & Nurse Console
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
            Assigned Patient: {personName}
          </h1>
          <p className="text-sm text-charcoal-light max-w-xl">
            You are authorized to assist with medication tracking, acknowledge alerts, schedule doctor appointments, and record clinical observations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsMedModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
          <button
            onClick={() => setIsAptModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone bg-white text-charcoal text-xs font-semibold hover:bg-stone-light"
          >
            <Calendar className="w-4 h-4 text-forest" />
            <span>Schedule Visit</span>
          </button>
        </div>
      </div>

      {/* Clinical Caregiver Alert Triage Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl font-bold text-charcoal">
              Follow-Up & Escalation Queue
            </h2>
            {urgentAlerts.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-terracotta text-ivory text-xs font-bold">
                {urgentAlerts.length} Action Needed
              </span>
            )}
          </div>
          <Link to="/notifications" className="text-xs font-semibold text-forest hover:underline">
            View notification history &rarr;
          </Link>
        </div>

        {urgentAlerts.length === 0 ? (
          <div className="p-6 bg-white border border-stone rounded-2xl flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-forest shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-charcoal">
                All follow-ups acknowledged and resolved.
              </h4>
              <p className="text-xs text-charcoal-muted">
                No active unconfirmed dose escalations pending caregiver intervention.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {urgentAlerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white border-2 border-terracotta/40 p-5 rounded-2xl shadow-warm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-terracotta text-ivory text-[10px] font-bold uppercase tracking-wider">
                      Overdue Escalation
                    </span>
                    <span className="text-xs text-charcoal-muted">
                      {format(new Date(alert.created_at), 'h:mm a, MMM d')}
                    </span>
                  </div>
                  <h4 className="font-serif text-lg font-bold text-charcoal">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-charcoal-light">
                    {alert.message}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedNotifForAck(alert)}
                  className="px-6 py-2.5 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
                >
                  Acknowledge & Record Note
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Today's Administration Schedule */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-charcoal">
          Medication Administration Schedule
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {todaysScheduleItems.map((item, idx) => (
            <DoseCard
              key={idx}
              medication={item.medication}
              scheduleTime={item.time}
              scheduleLabel={item.label}
              doseLog={item.doseLog}
              scheduledDate={todayStr}
            />
          ))}
        </div>
      </section>

      {/* Modals */}
      {isMedModalOpen && (
        <MedicationModal
          isOpen={isMedModalOpen}
          onClose={() => setIsMedModalOpen(false)}
        />
      )}
      {isAptModalOpen && (
        <AppointmentModal
          isOpen={isAptModalOpen}
          onClose={() => setIsAptModalOpen(false)}
        />
      )}
      {selectedNotifForAck && (
        <AcknowledgeModal
          notification={selectedNotifForAck}
          onClose={() => setSelectedNotifForAck(null)}
        />
      )}
    </div>
  );
};
