import React from 'react';
import { useCare } from '@/contexts/CareContext';
import { Phone, X, AlertCircle, Heart, User } from 'lucide-react';

interface CallFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CallFamilyModal: React.FC<CallFamilyModalProps> = ({ isOpen, onClose }) => {
  const { careProfile, careMembers } = useCare();

  if (!isOpen) return null;

  const rawPhone = careProfile?.emergency_phone?.trim();
  const sanitizedPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : '';
  const contactName = careProfile?.emergency_contact_name || 'David Hayes';
  const familyMember = careMembers.find(m => m.role === 'family');
  const relationship = familyMember?.relationship || 'Son & Family Circle';

  const hasValidPhone = Boolean(sanitizedPhone && sanitizedPhone.length >= 7);

  const handleCall = () => {
    if (hasValidPhone) {
      window.location.href = `tel:${sanitizedPhone}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-family-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-stone p-6 sm:p-8 space-y-6 text-charcoal">
        <div className="flex items-center justify-between border-b border-stone/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-terracotta/10 text-terracotta flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 id="call-family-title" className="font-serif text-xl sm:text-2xl font-bold text-forest">
                Call Family
              </h2>
              <p className="text-xs text-charcoal-muted">Direct contact to your care circle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal-muted hover:text-charcoal hover:bg-stone/50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasValidPhone ? (
          <div className="space-y-4">
            <div className="bg-cream-light/60 p-4 rounded-2xl border border-stone flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-forest text-ivory flex items-center justify-center font-bold text-lg shrink-0">
                {contactName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-charcoal-muted font-medium block">Primary Emergency Contact</span>
                <span className="font-bold text-base text-forest block truncate">{contactName}</span>
                <span className="text-xs text-charcoal-light block">{relationship}</span>
              </div>
            </div>

            <div className="bg-stone-light/50 p-4 rounded-2xl border border-stone/80 text-center space-y-1">
              <span className="text-xs text-charcoal-muted uppercase tracking-wider font-semibold">Configured Phone</span>
              <p className="text-2xl font-bold text-forest font-mono">{rawPhone}</p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleCall}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-terracotta hover:bg-terracotta-dark text-ivory text-lg font-bold shadow-warm min-h-[56px] touch-target-elderly transition-all cursor-pointer"
              >
                <Phone className="w-5 h-5" />
                <span>Call {contactName.split(' ')[0]} Now</span>
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-semibold text-charcoal-muted hover:text-charcoal cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm text-amber-950">
                <span className="font-bold block">No phone number configured</span>
                <p>
                  There is currently no emergency telephone number saved for <strong>{contactName}</strong>.
                </p>
                <p className="text-xs text-amber-800 pt-1">
                  Please ask David or Elena to add a valid telephone number in the Care Circle profile settings.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-forest hover:bg-forest-light text-ivory text-base font-bold shadow-warm touch-target-elderly cursor-pointer"
            >
              I Understand
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
