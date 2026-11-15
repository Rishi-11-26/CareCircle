import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { UserRole } from '@/types';
import { Heart, Lock, Mail, User, Clock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signUp, session } = useCare();
  const navigate = useNavigate();

  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
      : 'America/Los_Angeles';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('family');
  const [timezone, setTimezone] = useState(defaultTz);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (session?.user) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (!timezone.trim()) {
      setErrorMessage('A valid IANA timezone is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUp({
        fullName,
        email,
        password,
        role,
        timezone,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
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
          Create Your Account
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Join a care circle or coordinate senior healthcare with family members.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border-2 border-stone rounded-3xl shadow-warm">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                htmlFor="signup-name"
                className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1"
              >
                Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. David Hayes"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[50px]"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1"
              >
                Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="david@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[50px]"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1"
              >
                Password * (min 6 characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[50px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5">
                Your Primary Role in Care *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'family', label: 'Family Member', desc: 'Coordinator' },
                  { id: 'elderly', label: 'Senior / Self', desc: 'Simplified View' },
                  { id: 'caretaker', label: 'Caregiver / Nurse', desc: 'Clinical Care' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as UserRole)}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer min-h-[54px] flex flex-col justify-center ${
                      role === item.id
                        ? 'border-forest bg-forest/10 font-bold text-forest shadow-warm-xs'
                        : 'border-stone hover:border-forest/40 bg-white text-charcoal'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-charcoal-muted block leading-tight">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-timezone"
                className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1"
              >
                Timezone (IANA) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <Clock className="w-5 h-5" />
                </div>
                <input
                  id="signup-timezone"
                  type="text"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  placeholder="e.g. America/Los_Angeles"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none text-sm text-charcoal min-h-[50px]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-xl bg-forest hover:bg-forest-light text-ivory font-bold text-base shadow-warm transition-all cursor-pointer disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-ivory/30 border-t-ivory rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone text-center">
            <p className="text-xs text-charcoal-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-forest hover:text-forest-light underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
