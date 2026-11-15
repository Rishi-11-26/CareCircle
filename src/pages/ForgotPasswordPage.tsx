import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useCare();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(email);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setIsSent(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password reset email.');
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
          Recover Your Password
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border-2 border-stone rounded-3xl shadow-warm">
          {isSent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-forest/10 text-forest mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-forest" />
              </div>
              <h2 className="font-serif text-xl font-bold text-forest">
                Reset Link Sent
              </h2>
              <p className="text-sm text-charcoal-muted leading-relaxed">
                If an account exists for <strong className="text-charcoal">{email}</strong>, you will receive an email with instructions to securely set a new password.
              </p>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-forest text-ivory font-bold text-sm shadow-warm hover:bg-forest-light transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>
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
                  htmlFor="reset-email"
                  className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5"
                >
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
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
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-charcoal-muted hover:text-forest transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
