import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { Heart, Lock, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, setDemoMode, session } = useCare();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const destination = (location.state as any)?.from?.pathname || '/';

  // If already authenticated with an active user session, redirect
  React.useEffect(() => {
    if (session?.user) {
      navigate(destination, { replace: true });
    }
  }, [session, navigate, destination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(email, password);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchDemo = () => {
    setDemoMode(true);
    navigate('/', { replace: true });
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
          Sign In to Your Account
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Connected care and medication coordination for your family.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 border-2 border-stone rounded-3xl shadow-warm">
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
                htmlFor="login-email"
                className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="login-email"
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-charcoal uppercase tracking-wider"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-forest hover:text-forest-light underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone text-center space-y-4">
            <p className="text-xs text-charcoal-muted">
              Don't have an account yet?{' '}
              <Link to="/signup" className="font-bold text-forest hover:text-forest-light underline">
                Create an account
              </Link>
            </p>

            {/* Demo Mode Access */}
            <div className="bg-stone-light/60 p-3 rounded-2xl border border-stone">
              <button
                type="button"
                onClick={handleLaunchDemo}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 border border-forest/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-terracotta" />
                <span>Explore Demo Mode</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
