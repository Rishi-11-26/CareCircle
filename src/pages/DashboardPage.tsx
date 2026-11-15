import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
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
  Pill,
  Clock,
  Printer,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { MedicationModal } from '@/components/medications/MedicationModal';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { AcknowledgeModal } from '@/components/notifications/AcknowledgeModal';
import { DoctorVisitBriefModal } from '@/components/appointments/DoctorVisitBriefModal';
import { CallFamilyModal } from '@/components/common/CallFamilyModal';
import { Notification, Appointment } from '@/types';

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
    assistanceLevel,
    updateAssistanceLevel,
    recordDose,
  } = useCare();

  const { largePrintMode } = useAccessibility();
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isAptModalOpen, setIsAptModalOpen] = useState(false);
  const [selectedNotifForAck, setSelectedNotifForAck] = useState<Notification | null>(null);
  const [selectedAptForBrief, setSelectedAptForBrief] = useState<Appointment | null>(null);
  const [heroActionNotice, setHeroActionNotice] = useState<string | null>(null);
  const [isCallFamilyModalOpen, setIsCallFamilyModalOpen] = useState(false);

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

  // Find next pending dose for elderly hero card
  const nextPendingDose = todaysScheduleItems.find(
    i => i.doseLog?.status !== 'taken' && i.doseLog?.status !== 'skipped'
  );

  const handleConfirmNextDose = async (item: (typeof todaysScheduleItems)[0]) => {
    setHeroActionNotice(null);
    const res = await recordDose({
      medicationId: item.medication.id,
      scheduledDate: todayStr,
      scheduledTime: item.time,
      status: 'taken',
    });
    if (res.alreadyConfirmed) {
      setHeroActionNotice('Already confirmed previously.');
      setTimeout(() => setHeroActionNotice(null), 3000);
    } else if (!res.success && res.error) {
      setHeroActionNotice(res.error);
      setTimeout(() => setHeroActionNotice(null), 5000);
    }
  };

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
              Your care circle is connected. Everything you need for your daily health routine is below.
            </p>
          </div>
        </div>

        {/* 4 Primary Navigation Destinations for Elderly Individuals */}
        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" aria-label="Main Destinations">
          <div className="bg-forest text-ivory p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-warm min-h-[64px] border-2 border-forest">
            <Heart className="w-7 h-7 mb-1 text-ivory" />
            <span className="font-bold text-base">Home</span>
          </div>
          <Link
            to="/medications"
            className="bg-white hover:bg-stone-light text-charcoal p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-warm-sm border border-stone min-h-[64px] transition-all hover:scale-[1.02] focus:ring-2 focus:ring-forest cursor-pointer"
          >
            <Pill className="w-7 h-7 mb-1 text-forest" />
            <span className="font-bold text-base">My Medicines</span>
          </Link>
          <Link
            to="/appointments"
            className="bg-white hover:bg-stone-light text-charcoal p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-warm-sm border border-stone min-h-[64px] transition-all hover:scale-[1.02] focus:ring-2 focus:ring-forest cursor-pointer"
          >
            <Calendar className="w-7 h-7 mb-1 text-forest" />
            <span className="font-bold text-base">Doctor Visits</span>
          </Link>
          <button
            onClick={() => setIsCallFamilyModalOpen(true)}
            className="bg-terracotta hover:bg-terracotta-dark text-ivory p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-warm min-h-[64px] transition-all hover:scale-[1.02] focus:ring-2 focus:ring-terracotta cursor-pointer"
            aria-label="Call Family"
          >
            <Phone className="w-7 h-7 mb-1 text-ivory" />
            <span className="font-bold text-base">Call Family</span>
          </button>
        </nav>

        {/* HERO CARD: "Your Next Medicine" */}
        {nextPendingDose ? (
          <section
            aria-labelledby="next-medicine-heading"
            className="bg-gradient-to-br from-cream-light via-ivory to-stone-light/50 border-2 border-forest/30 p-6 sm:p-8 rounded-3xl shadow-warm space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                id="next-medicine-heading"
                className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 bg-forest text-ivory rounded-full shadow-warm-xs"
              >
                Your Next Medicine
              </span>
              <span className="text-sm font-semibold text-charcoal flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-stone/60">
                <Clock className="w-4 h-4 text-forest" />
                Scheduled for {nextPendingDose.time}
                {nextPendingDose.label ? ` • ${nextPendingDose.label}` : ''}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
              <div className="space-y-1.5">
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
                  {nextPendingDose.medication.name}
                </h2>
                <p className="text-lg font-semibold text-charcoal">
                  Dosage: {nextPendingDose.medication.dosage}
                </p>
                {nextPendingDose.medication.instructions && (
                  <p className="text-base text-charcoal-light">
                    Instructions: {nextPendingDose.medication.instructions}
                  </p>
                )}
                {nextPendingDose.medication.color && (
                  <p className="text-xs text-charcoal-muted font-medium pt-1">
                    Appearance: {nextPendingDose.medication.color} {nextPendingDose.medication.shape || 'tablet'}
                  </p>
                )}
              </div>

              {/* Action Buttons for Next Medicine */}
              {assistanceLevel === 'caregiver_managed' ? (
                <div className="bg-white border-2 border-forest/30 p-5 rounded-2xl flex items-center gap-3 max-w-md shadow-warm-sm">
                  <ShieldCheck className="w-8 h-8 text-forest shrink-0" />
                  <p className="text-xs text-charcoal leading-relaxed font-medium">
                    <strong>Caregiver Managed Mode:</strong> Nurse Elena administers this dose. Your care circle is updated automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleConfirmNextDose(nextPendingDose)}
                    className="px-8 py-4 rounded-2xl bg-forest hover:bg-forest-light text-ivory text-xl font-bold shadow-warm flex items-center gap-2.5 min-h-[56px] min-w-[56px] active:scale-95 cursor-pointer transition-all"
                    aria-label={`Confirm I Took My ${nextPendingDose.medication.name}`}
                  >
                    <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    <span>I Took It</span>
                  </button>

                  <button
                    onClick={() => setIsCallFamilyModalOpen(true)}
                    className="px-6 py-4 rounded-2xl border-2 border-stone bg-white hover:bg-stone-light text-charcoal font-bold text-base flex items-center gap-2 min-h-[56px] min-w-[56px] cursor-pointer"
                    aria-label="Call Family"
                  >
                    <Phone className="w-5 h-5 text-terracotta" />
                    <span>Call Family</span>
                  </button>
                </div>
              )}
            </div>

            {heroActionNotice && (
              <p className="text-xs font-semibold text-terracotta bg-terracotta/10 px-3 py-1.5 rounded-lg border border-terracotta/20">
                {heroActionNotice}
              </p>
            )}
          </section>
        ) : (
          <div className="bg-forest/5 border border-forest/20 p-6 rounded-3xl flex items-center gap-4">
            <CheckCircle2 className="w-10 h-10 text-forest shrink-0" />
            <div>
              <h3 className="font-serif text-xl font-bold text-forest">
                All medications complete for today!
              </h3>
              <p className="text-sm text-charcoal-light">
                You are all caught up on your scheduled doses. Your family and caregivers have been notified.
              </p>
            </div>
          </div>
        )}

        {/* Today's Full Medication Schedule */}
        <section className="space-y-4" aria-labelledby="today-meds-heading">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="today-meds-heading" className="font-serif text-2xl font-bold text-charcoal">
                Today's Medication Schedule
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
                  simplifiedView={largePrintMode}
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
                  <div key={apt.id} className="p-3 bg-stone-light/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-charcoal">{apt.doctor_name}</span>
                      <span className="text-xs font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">
                        {apt.appointment_date} at {apt.appointment_time}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-light">{apt.specialty || 'General Practitioner'} • {apt.location}</p>
                    <div className="flex items-center justify-between pt-1">
                      {apt.notes ? <p className="text-[11px] text-charcoal-muted italic">{apt.notes}</p> : <span />}
                      <button
                        onClick={() => setSelectedAptForBrief(apt)}
                        className="inline-flex items-center gap-1 text-xs text-forest hover:underline font-semibold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Clinical Brief</span>
                      </button>
                    </div>
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

        {selectedAptForBrief && (
          <DoctorVisitBriefModal
            appointment={selectedAptForBrief}
            onClose={() => setSelectedAptForBrief(null)}
          />
        )}

        <CallFamilyModal
          isOpen={isCallFamilyModalOpen}
          onClose={() => setIsCallFamilyModalOpen(false)}
        />
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
            <div className="flex items-center justify-between text-xs text-charcoal-muted">
              <span>Next: {upcomingApts[0]?.doctor_name || 'None pending'}</span>
              {upcomingApts[0] && (
                <button
                  type="button"
                  onClick={() => setSelectedAptForBrief(upcomingApts[0])}
                  className="text-forest hover:underline font-semibold cursor-pointer"
                >
                  Brief
                </button>
              )}
            </div>
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

        {selectedAptForBrief && (
          <DoctorVisitBriefModal
            appointment={selectedAptForBrief}
            onClose={() => setSelectedAptForBrief(null)}
          />
        )}

        <CallFamilyModal
          isOpen={isCallFamilyModalOpen}
          onClose={() => setIsCallFamilyModalOpen(false)}
        />
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

      {/* Assisted Care Mode Configuration */}
      <section className="bg-white border border-stone p-6 rounded-3xl shadow-warm-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone/60 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-forest" />
            <h3 className="font-serif text-xl font-bold text-forest">
              Assisted Care Configuration
            </h3>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-forest/10 text-forest self-start sm:self-auto">
            Active Mode: {assistanceLevel.replace('_', ' ')}
          </span>
        </div>

        <p className="text-xs text-charcoal-muted leading-relaxed">
          Configure {personName}'s level of independence. The system automatically restricts or enables self-confirmations and schedules corresponding caregiver supervision.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <button
            type="button"
            onClick={() => updateAssistanceLevel('independent')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              assistanceLevel === 'independent'
                ? 'border-forest bg-forest/5 shadow-warm ring-2 ring-forest/30'
                : 'border-stone hover:bg-stone-light/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-forest">Independent</span>
              {assistanceLevel === 'independent' && (
                <CheckCircle2 className="w-4 h-4 text-forest" />
              )}
            </div>
            <p className="text-xs text-charcoal-light leading-relaxed">
              Margaret personally manages and self-confirms her medicines on her own schedule.
            </p>
          </button>

          <button
            type="button"
            onClick={() => updateAssistanceLevel('needs_assistance')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              assistanceLevel === 'needs_assistance'
                ? 'border-forest bg-forest/5 shadow-warm ring-2 ring-forest/30'
                : 'border-stone hover:bg-stone-light/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-forest">Needs Assistance</span>
              {assistanceLevel === 'needs_assistance' && (
                <CheckCircle2 className="w-4 h-4 text-forest" />
              )}
            </div>
            <p className="text-xs text-charcoal-light leading-relaxed">
              Margaret or Elena/David can record doses. Active reminders and check-ins assist.
            </p>
          </button>

          <button
            type="button"
            onClick={() => updateAssistanceLevel('caregiver_managed')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              assistanceLevel === 'caregiver_managed'
                ? 'border-forest bg-forest/5 shadow-warm ring-2 ring-forest/30'
                : 'border-stone hover:bg-stone-light/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-forest">Caregiver Managed</span>
              {assistanceLevel === 'caregiver_managed' && (
                <CheckCircle2 className="w-4 h-4 text-forest" />
              )}
            </div>
            <p className="text-xs text-charcoal-light leading-relaxed">
              Nurse Elena administers doses. Margaret's screen is read-only to prevent confusion.
            </p>
          </button>
        </div>
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
      {selectedAptForBrief && (
        <DoctorVisitBriefModal
          appointment={selectedAptForBrief}
          onClose={() => setSelectedAptForBrief(null)}
        />
      )}
    </div>
  );
};
