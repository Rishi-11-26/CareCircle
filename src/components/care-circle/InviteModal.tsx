import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { generatePasscode } from '@/lib/crypto';
import { X, Copy, Check, ShieldCheck, KeyRound } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { createInvitation } = useCare();
  const [role, setRole] = useState<'family' | 'caretaker'>('family');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState(generatePasscode());
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(passcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createInvitation({
        role,
        passcode,
        inviteeEmail: email.trim() || undefined,
      });
      setSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-ivory border border-stone rounded-2xl max-w-md w-full p-6 shadow-warm-lg space-y-5">
        <div className="flex items-center justify-between border-b border-stone pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-forest" />
            <h3 className="font-serif text-xl font-bold text-forest">
              Create Secure Passcode
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-charcoal-muted hover:text-charcoal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-forest/10 rounded-full flex items-center justify-center mx-auto text-forest">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-xl font-bold text-forest">
              Passcode Created & Hashed
            </h4>
            <p className="text-xs text-charcoal-light">
              Only the SHA-256 cryptographic hash has been saved to the database. Share this one-time passcode with your {role === 'family' ? 'family member' : 'caretaker'}:
            </p>

            <div className="p-4 bg-cream-light border border-stone rounded-xl flex items-center justify-between gap-3">
              <span className="font-mono text-xl font-bold tracking-widest text-forest">
                {passcode}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest text-ivory text-xs font-semibold hover:bg-forest-light"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-forest text-ivory text-sm font-semibold hover:bg-forest-light"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1.5">
                Role to Assign
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('family')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'family'
                      ? 'border-forest bg-forest/5 text-forest font-semibold ring-1 ring-forest'
                      : 'border-stone bg-white text-charcoal-muted hover:bg-stone-light'
                  }`}
                >
                  <span className="block text-sm">Family Member</span>
                  <span className="block text-[11px] text-charcoal-muted mt-0.5">
                    View schedule, adherence & receive alerts
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('caretaker')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'caretaker'
                      ? 'border-forest bg-forest/5 text-forest font-semibold ring-1 ring-forest'
                      : 'border-stone bg-white text-charcoal-muted hover:bg-stone-light'
                  }`}
                >
                  <span className="block text-sm">Caretaker / Nurse</span>
                  <span className="block text-[11px] text-charcoal-muted mt-0.5">
                    Assist tracking, acknowledge follow-up alerts
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Generated Passcode
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={passcode}
                  className="flex-1 font-mono font-bold text-center tracking-widest px-3 py-2 rounded-xl border border-stone bg-cream-light text-forest text-base"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-xl border border-stone bg-white hover:bg-stone-light text-charcoal text-xs font-medium flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-forest" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-charcoal-muted mt-1">
                Passcode expires automatically after 7 days.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Invitee Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone">
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
                className="px-5 py-2 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm"
              >
                {isSubmitting ? 'Generating...' : 'Confirm & Save Passcode'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
