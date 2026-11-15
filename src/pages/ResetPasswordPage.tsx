import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useCare();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    try {
      const res = await updatePassword(password);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-forest rounded-2xl p-1"
          aria-label="CareCircle Home"
        >
          <div className="w-12 h-12 rounded-2xl bg-forest text-ivory flex items-center justify-center shadow-warm font-serif text-2xl font-bold">
            CC
          </div>
          <span className="font-serif text-3xl font-bold text-forest tracking-tight">
            CareCircle
          </span>
        </Link>
        <h1 className="mt-4 font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
          Set New Password
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Choose a secure, memorable password for your CareCircle account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border-2 border-stone rounded-3xl shadow-warm">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-forest/10 text-forest mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-forest" />
              </div>
              <h2 className="font-serif text-xl font-bold text-forest">
                Password Updated!
              </h2>
              <p className="text-sm text-charcoal-muted leading-relaxed">
                Your password has been securely reset. You can now log in using your new credentials.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-forest text-ivory font-bold text-base shadow-warm hover:bg-forest-light transition-all cursor-pointer"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-terracotta/10 border border-terracotta/30 flex items-start gap-3 text-terracotta text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="reset-password-input"
                  className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5"
                >
                  New Password * (min 6 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="reset-password-input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[52px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reset-password-confirm"
                  className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5"
                >
                  Confirm New Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="reset-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[52px]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-forest hover:bg-forest-light text-ivory font-bold text-base shadow-warm transition-all cursor-pointer disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-ivory/30 border-t-ivory rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Save New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
