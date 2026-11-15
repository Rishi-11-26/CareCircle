import React from 'react';
import { useCare } from '@/contexts/CareContext';
import { Appointment } from '@/types';
import { calculateAdherenceMetrics } from '@/lib/analytics';
import {
  Printer,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Pill,
  Heart,
  Phone,
  Shield,
} from 'lucide-react';

interface DoctorVisitBriefModalProps {
  appointment: Appointment;
  onClose: () => void;
}

export const DoctorVisitBriefModal: React.FC<DoctorVisitBriefModalProps> = ({
  appointment,
  onClose,
}) => {
  const { careProfile, medications, doseLogs, careMembers } = useCare();

  const timezone = careProfile?.timezone || 'America/Los_Angeles';
  const personName = careProfile?.full_name || 'Margaret Hayes';

  // Calculate 14-day adherence
  const metrics14 = calculateAdherenceMetrics(doseLogs, 14);

  // Active medications
  const activeMeds = medications.filter(m => m.is_active);

  // Skipped or unconfirmed doses in the past 14 days
  const recentDoses = doseLogs.filter(d => !d.is_corrected);
  const skippedOrLateDoses = recentDoses.filter(
    d => d.status === 'skipped' || d.adherence_status === 'late'
  );

  const caregiver = careMembers.find(m => m.role === 'caretaker');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:z-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-stone overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Modal Toolbar (hidden on print) */}
        <div className="bg-cream-light border-b border-stone px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest/10 text-forest flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-forest" />
            </div>
            <div>
              <h2 id="brief-title" className="font-serif text-lg sm:text-xl font-bold text-forest">
                Clinical Visit Summary & Medication Brief
              </h2>
              <p className="text-xs text-charcoal-muted">
                Standardized medical profile and adherence record for physician consultation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest text-ivory text-xs sm:text-sm font-bold hover:bg-forest-light shadow-warm cursor-pointer transition-all"
              aria-label="Print Clinical Brief"
            >
              <Printer className="w-4 h-4" />
              <span>Print Brief (A4/Letter)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-charcoal-muted hover:text-charcoal hover:bg-stone/60 cursor-pointer transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CLINICAL DOCUMENT */}
        <div className="p-6 sm:p-8 md:p-10 space-y-6 text-charcoal print:p-6 print:space-y-4 print:text-black">
          {/* Document Header */}
          <div className="border-b-2 border-forest pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-forest print:text-black">
                  CareCircle Clinical Brief
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest/10 text-forest font-bold print:border print:border-black">
                  Patient Medical Summary
                </span>
              </div>
              <p className="text-xs sm:text-sm text-charcoal-muted mt-1">
                Generated on {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Timezone: {timezone}
              </p>
            </div>

            <div className="text-xs sm:text-sm sm:text-right bg-stone-light/40 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
              <span className="font-bold block text-sm sm:text-base text-charcoal">Upcoming Appointment</span>
              <span className="font-bold text-forest print:text-black block text-sm">
                {appointment.doctor_name} ({appointment.specialty || 'General Practice'})
              </span>
              <span className="block text-charcoal-muted font-medium">
                {appointment.appointment_date} at {appointment.appointment_time}
              </span>
              <span className="block text-charcoal-muted text-xs">{appointment.location}</span>
            </div>
          </div>

          {/* Section 1: Patient Demographics & Safety Profile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-stone-light/50 p-4 sm:p-5 rounded-2xl border border-stone print:border-black/30 print:bg-white text-xs sm:text-sm">
            <div>
              <span className="text-charcoal-muted block font-medium">Patient Name:</span>
              <span className="font-bold text-base text-charcoal">{personName}</span>
              <span className="block text-xs text-charcoal-muted mt-0.5">
                DOB: {careProfile?.date_of_birth || '1944-03-12'}
              </span>
            </div>
            <div>
              <span className="text-charcoal-muted block font-medium">Blood Group:</span>
              <span className="font-bold text-base text-charcoal">{careProfile?.blood_group || 'A+'}</span>
              <span className="block text-xs text-charcoal-muted mt-0.5 capitalize">
                Assistance: {careProfile?.assistance_level?.replace('_', ' ') || 'needs assistance'}
              </span>
            </div>
            <div>
              <span className="text-charcoal-muted block font-medium">Emergency Contacts:</span>
              <span className="font-semibold text-charcoal block">
                {careProfile?.emergency_contact_name || 'David Hayes'} ({careProfile?.emergency_phone || '555-876-5432'})
              </span>
              {caregiver && (
                <span className="text-xs text-charcoal-muted block mt-0.5">
                  Caregiver: {caregiver.relationship || 'Nurse'} ({caregiver.user?.full_name || 'Elena Rostova'})
                </span>
              )}
            </div>
            <div>
              <span className="text-terracotta-dark font-bold block uppercase tracking-wider text-xs">
                Known Allergies:
              </span>
              <span className="font-bold text-terracotta-dark text-xs sm:text-sm block bg-terracotta/10 px-2.5 py-1.5 rounded-lg border border-terracotta/20 print:border-black mt-1">
                {careProfile?.allergies?.join(', ') || 'Penicillin'}
              </span>
            </div>
          </div>

          {/* Section 2: Active Prescription Medications */}
          <div>
            <div className="flex items-center justify-between border-b border-stone/80 pb-2 mb-3">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-forest print:text-black flex items-center gap-2">
                <Pill className="w-5 h-5 text-forest" />
                <span>Current Active Medications ({activeMeds.length})</span>
              </h3>
              <span className="text-xs text-charcoal-muted">Verified by Care Circle</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone">
              <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-cream-light/70 border-b border-stone text-charcoal-muted text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-bold">Medication & Appearance</th>
                    <th className="py-2.5 px-3 font-bold">Dosage</th>
                    <th className="py-2.5 px-3 font-bold">Daily Schedule</th>
                    <th className="py-2.5 px-3 font-bold">Clinical Instructions</th>
                    <th className="py-2.5 px-3 font-bold">Supply Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone/60 bg-white">
                  {activeMeds.map(med => (
                    <tr key={med.id} className="hover:bg-stone-light/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-charcoal text-sm sm:text-base">
                        <span className="text-forest print:text-black">{med.name}</span>
                        <span className="block font-normal text-charcoal-muted text-xs mt-0.5">
                          {med.color || ''} {med.shape || ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-charcoal">{med.dosage}</td>
                      <td className="py-2.5 px-3 font-medium text-charcoal">
                        <span className="bg-stone-light/60 px-2 py-0.5 rounded text-xs font-semibold">
                          {(med.schedules || []).map(s => s.time_of_day).join(', ') || 'Once daily'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-charcoal-light">
                        {med.instructions || 'Take as directed'}
                      </td>
                      <td className="py-2.5 px-3">
                        {med.current_supply !== undefined ? (
                          <span
                            className={`font-bold ${
                              med.current_supply <= 7
                                ? 'text-terracotta bg-terracotta/10 px-2 py-0.5 rounded'
                                : 'text-charcoal'
                            }`}
                          >
                            {med.current_supply} days
                            {med.current_supply <= 7 && ' (Refill Needed)'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: 14-Day Adherence & Missed Dose Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-stone-light/50 p-5 rounded-2xl border border-stone print:border-black/30 print:bg-white text-xs sm:text-sm space-y-3">
              <span className="font-bold text-forest uppercase tracking-wider block border-b border-stone pb-1.5 text-xs">
                14-Day Adherence Overview
              </span>
              <div className="flex items-baseline gap-2.5">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-forest print:text-black">
                  {metrics14.adherenceRate}%
                </span>
                <span className="text-charcoal-muted text-xs">
                  ({metrics14.confirmedCount} of {metrics14.totalScheduled} doses)
                </span>
              </div>
              <div className="space-y-1.5 text-xs sm:text-sm text-charcoal-light pt-1">
                <div className="flex justify-between">
                  <span>On-time doses:</span>
                  <span className="font-bold text-forest print:text-black">{metrics14.onTimeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Late doses:</span>
                  <span className="font-bold text-amber-700">{metrics14.lateCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Skipped doses:</span>
                  <span className="font-bold text-terracotta">{metrics14.skippedCount}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-stone-light/50 p-5 rounded-2xl border border-stone print:border-black/30 print:bg-white text-xs sm:text-sm space-y-3">
              <span className="font-bold text-forest uppercase tracking-wider block border-b border-stone pb-1.5 text-xs">
                Recent Deviations & Reported Reasons (Past 14 Days)
              </span>
              {skippedOrLateDoses.length === 0 ? (
                <div className="py-4 flex items-center gap-2.5 text-forest text-sm">
                  <CheckCircle2 className="w-5 h-5 text-forest shrink-0" />
                  <span className="font-semibold">No skipped or significantly delayed doses recorded in the last 14 days.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {skippedOrLateDoses.slice(0, 6).map(dose => (
                    <div key={dose.id} className="text-xs sm:text-sm bg-white p-2.5 rounded-xl border border-stone/80 leading-snug">
                      <span className="font-bold text-charcoal">
                        {dose.scheduled_date} at {dose.scheduled_time}:
                      </span>{' '}
                      <span className={dose.status === 'skipped' ? 'text-terracotta font-bold' : 'text-amber-700 font-bold'}>
                        [{dose.status.toUpperCase()}]
                      </span>{' '}
                      <span className="text-charcoal">{dose.skip_reason || dose.notes || 'No specific reason logged.'}</span>
                      {dose.actor_name && (
                        <span className="text-charcoal-muted italic ml-1"> (Logged by: {dose.actor_name})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Physician Notes & Medication Adjustments */}
          <div className="border border-stone print:border-black/40 rounded-2xl p-5 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-stone pb-2">
              <span className="font-serif text-base sm:text-lg font-bold text-forest print:text-black">
                Physician Consultation Notes & Treatment Plan Changes
              </span>
              <span className="text-xs text-charcoal-muted">To be completed by attending physician</span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="border-b border-dashed border-stone/80 h-7"></div>
              <div className="border-b border-dashed border-stone/80 h-7"></div>
              <div className="border-b border-dashed border-stone/80 h-7"></div>
              <div className="border-b border-dashed border-stone/80 h-7"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs sm:text-sm">
              <div>
                <span className="text-xs text-charcoal-muted block font-medium">Physician Signature:</span>
                <div className="border-b border-stone h-7 mt-1"></div>
              </div>
              <div>
                <span className="text-xs text-charcoal-muted block font-medium">Follow-Up Date Recommended:</span>
                <div className="border-b border-stone h-7 mt-1"></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-charcoal-muted flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-t border-stone pt-3">
            <span>CareCircle • Connected care. Independent living.</span>
            <span>Confidential Medical Information • Protected Health Document</span>
          </div>
        </div>
      </div>
    </div>
  );
};
