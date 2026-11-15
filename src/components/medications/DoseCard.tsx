import React, { useState } from 'react';
import { Medication, DoseLog } from '@/types';
import { useCare } from '@/contexts/CareContext';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Check, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DoseCardProps {
  medication: Medication;
  scheduleTime: string;
  scheduleLabel?: string;
  doseLog?: DoseLog;
  scheduledDate: string;
  simplifiedView?: boolean;
}

export const DoseCard: React.FC<DoseCardProps> = ({
  medication,
  scheduleTime,
  scheduleLabel,
  doseLog,
  scheduledDate,
  simplifiedView = false,
}) => {
  const { recordDose, currentUser } = useCare();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [alreadyNotice, setAlreadyNotice] = useState<string | null>(null);

  const isTaken = doseLog?.status === 'taken';
  const isSkipped = doseLog?.status === 'skipped';
  const isUnconfirmed = doseLog?.status === 'unconfirmed';

  const handleConfirmTaken = async () => {
    setIsSubmitting(true);
    setAlreadyNotice(null);
    try {
      const res = await recordDose({
        medicationId: medication.id,
        scheduledDate,
        scheduledTime: scheduleTime,
        status: 'taken',
      });
      if (res.alreadyConfirmed) {
        setAlreadyNotice('Already confirmed previously.');
        setTimeout(() => setAlreadyNotice(null), 3000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSkip = async () => {
    setIsSubmitting(true);
    try {
      await recordDose({
        medicationId: medication.id,
        scheduledDate,
        scheduledTime: scheduleTime,
        status: 'skipped',
        skipReason: skipReason.trim() || 'Patient reported feeling unwell or fasting',
      });
      setShowSkipModal(false);
      setSkipReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all p-5 ${
        isTaken
          ? 'bg-forest/5 border-forest/20'
          : isUnconfirmed
          ? 'bg-terracotta/5 border-terracotta/30 ring-1 ring-terracotta/20'
          : 'bg-white border-stone shadow-warm-sm hover:shadow-warm'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Dose time, name, dosage & instructions */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-light text-forest text-sm font-semibold tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              {scheduleTime}
            </span>
            {scheduleLabel && (
              <span className="text-xs text-charcoal-muted font-medium">
                {scheduleLabel}
              </span>
            )}
            {isTaken && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-forest text-ivory text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Taken {doseLog?.confirmed_at ? `at ${format(new Date(doseLog.confirmed_at), 'hh:mm a')}` : ''}
              </span>
            )}
            {isSkipped && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone text-charcoal text-xs font-medium">
                <XCircle className="w-3.5 h-3.5 text-charcoal-muted" />
                Skipped: {doseLog?.skip_reason}
              </span>
            )}
            {isUnconfirmed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terracotta text-ivory text-xs font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unconfirmed (Escalated to circle)
              </span>
            )}
          </div>

          <div className="pt-1">
            <h3 className={`font-serif text-charcoal ${simplifiedView ? 'text-2xl font-bold' : 'text-xl font-bold'}`}>
              {medication.name}{' '}
              <span className="text-base font-sans font-normal text-charcoal-light">
                ({medication.dosage})
              </span>
            </h3>
            {medication.instructions && (
              <p className={`text-charcoal-light ${simplifiedView ? 'text-base font-medium' : 'text-sm'}`}>
                {medication.instructions}
              </p>
            )}
          </div>

          {!simplifiedView && medication.prescribing_doctor && (
            <p className="text-xs text-charcoal-muted">
              Prescribed by {medication.prescribing_doctor}
            </p>
          )}

          {alreadyNotice && (
            <p className="text-xs text-forest font-semibold animate-bounce">
              {alreadyNotice}
            </p>
          )}
        </div>

        {/* Right: Touch-friendly confirmation actions */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          {isTaken ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-forest font-medium">
                Dose complete
              </span>
              <button
                onClick={() => setShowSkipModal(true)}
                className="text-xs text-charcoal-muted hover:text-charcoal underline px-2 py-1"
                title="Change or record note"
              >
                Change status
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleConfirmTaken}
                disabled={isSubmitting}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 rounded-xl font-bold transition-all touch-target-elderly ${
                  simplifiedView ? 'text-lg py-3' : 'text-base py-2.5'
                } bg-forest text-ivory hover:bg-forest-light shadow-warm active:scale-95`}
                aria-label={`Confirm taken ${medication.name} at ${scheduleTime}`}
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>I Took This</span>
              </button>

              <button
                onClick={() => setShowSkipModal(true)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-stone bg-white text-charcoal-muted hover:text-charcoal hover:bg-stone-light text-sm font-medium transition-colors touch-target-elderly"
                aria-label={`Skip dose of ${medication.name}`}
              >
                Skip...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skip reason modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-ivory border border-stone rounded-2xl max-w-md w-full p-6 shadow-warm-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-serif text-xl font-bold text-charcoal">
                  Record Dose Exception
                </h4>
                <p className="text-xs text-charcoal-muted">
                  {medication.name} ({medication.dosage}) at {scheduleTime}
                </p>
              </div>
              <button
                onClick={() => setShowSkipModal(false)}
                className="text-charcoal-muted hover:text-charcoal p-1"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider">
                Reason for skipping / exception:
              </label>
              <textarea
                value={skipReason}
                onChange={e => setSkipReason(e.target.value)}
                rows={3}
                placeholder="e.g. Fasting for morning lab test, mild stomach upset, doctor advised pausing..."
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />

              <div className="p-3 bg-cream-light border border-stone rounded-xl text-xs text-charcoal-muted">
                <strong>Safety Notice: </strong> Never double up on your next dose to make up for a skipped dose unless explicitly directed by your prescribing physician.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="px-4 py-2 rounded-xl border border-stone text-sm text-charcoal-muted hover:text-charcoal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSkip}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-terracotta text-ivory text-sm font-semibold hover:bg-terracotta-dark shadow-warm-sm"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
