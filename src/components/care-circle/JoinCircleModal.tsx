import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { X, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

interface JoinCircleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinCircleModal: React.FC<JoinCircleModalProps> = ({ isOpen, onClose }) => {
  const { redeemInvitation, currentUser } = useCare();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError('Please enter your invitation passcode.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await redeemInvitation(code.trim());
      if (!res.success) {
        setError(res.error || 'Failed to redeem invitation code.');
      } else {
        setSuccess(true);
      }
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
              Join a Care Circle
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-charcoal-muted hover:text-charcoal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-forest/10 rounded-full flex items-center justify-center mx-auto text-forest">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-xl font-bold text-forest">
              Welcome to the Circle!
            </h4>
            <p className="text-xs text-charcoal-light">
              You have successfully joined as an authorized care circle member with secure role permissions.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-forest text-ivory text-sm font-semibold hover:bg-forest-light"
            >
              Enter Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <p className="text-xs text-charcoal-light leading-relaxed">
              Enter the 8-character secure invitation code provided by the care profile owner (e.g. <span className="font-mono font-bold text-forest">CARE-1234</span>).
            </p>

            {error && (
              <div className="p-3 bg-terracotta/10 border border-terracotta/30 text-terracotta-dark text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Passcode Code
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="CARE-XXXX"
                required
                className="w-full font-mono text-center text-lg font-bold tracking-widest px-3 py-2.5 rounded-xl border border-stone bg-white text-forest focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div className="p-3 bg-cream-light border border-stone rounded-xl text-[11px] text-charcoal-muted">
              Joining as <strong>{currentUser.full_name}</strong> ({currentUser.email}).
            </div>

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
                className="px-6 py-2 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Join Circle'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
