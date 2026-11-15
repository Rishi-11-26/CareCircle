import React, { useState } from 'react';
import { Notification } from '@/types';
import { useCare } from '@/contexts/CareContext';
import { X, CheckCircle, ShieldAlert } from 'lucide-react';

interface AcknowledgeModalProps {
  notification: Notification | null;
  onClose: () => void;
}

export const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({
  notification,
  onClose,
}) => {
  const { acknowledgeAlert, currentUser } = useCare();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!notification) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await acknowledgeAlert(
        notification.id,
        note.trim() || 'Caregiver acknowledged and followed up directly with individual.'
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-ivory border border-stone rounded-2xl max-w-md w-full p-6 shadow-warm-lg space-y-5">
        <div className="flex items-center justify-between border-b border-stone pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-terracotta" />
            <h3 className="font-serif text-xl font-bold text-charcoal">
              Acknowledge Follow-up
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-charcoal-muted hover:text-charcoal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-terracotta/5 border border-terracotta/20 rounded-xl space-y-1">
          <h4 className="text-sm font-bold text-charcoal">
            {notification.title}
          </h4>
          <p className="text-xs text-charcoal-light">
            {notification.message}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
              Caregiver Follow-up Note
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Spoke with Margaret over phone; confirmed she took the pill with tea. Reminded her about evening dose."
              className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            />
          </div>

          <p className="text-[11px] text-charcoal-muted">
            Acknowledging records this event to the shared care activity timeline with your name ({currentUser.full_name}) and timestamp.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone text-xs text-charcoal-muted hover:text-charcoal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm flex items-center gap-1.5 touch-target-elderly"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Acknowledge & Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
