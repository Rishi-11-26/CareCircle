import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import {
  Heart,
  Pill,
  Calendar,
  Users,
  Brain,
  History,
  BarChart3,
  Bell,
  Menu,
  X,
  UserCheck,
  Shield,
  Sparkles,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, switchRole, unreadAlertsCount, careProfile } = useCare();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Heart },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/appointments', label: 'Appointments', icon: Calendar },
    { to: '/care-circle', label: 'Care Circle', icon: Users },
    {
      to: '/intelligence',
      label: 'Care Intelligence',
      icon: Brain,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
    { to: '/timeline', label: 'Timeline', icon: History },
    { to: '/analytics', label: 'Adherence', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-ivory border-b border-stone sticky top-0 z-40">
      {/* Top utility row: Role switcher & profile owner indicator */}
      <div className="border-b border-stone/60 bg-cream-light/60 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              Care Profile:
            </span>
            <span className="font-serif text-forest text-base font-medium">
              {careProfile?.full_name || 'Margaret Hayes'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone text-charcoal-muted font-medium">
              Passcode Protected
            </span>
          </div>

          {/* Interactive Role Switcher for Hackathon Demonstration */}
          <div className="flex items-center gap-1.5 bg-stone-light p-1 rounded-lg border border-stone">
            <span className="text-xs text-charcoal-muted px-2 font-medium hidden sm:inline">
              Simulate Role:
            </span>
            <button
              onClick={() => switchRole('elderly')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all min-h-[32px] ${
                currentUser.role === 'elderly'
                  ? 'bg-forest text-ivory shadow-warm-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              👵 Margaret (Elderly)
            </button>
            <button
              onClick={() => switchRole('family')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all min-h-[32px] ${
                currentUser.role === 'family'
                  ? 'bg-forest text-ivory shadow-warm-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              👨‍👧 David (Family)
            </button>
            <button
              onClick={() => switchRole('caretaker')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all min-h-[32px] ${
                currentUser.role === 'caretaker'
                  ? 'bg-forest text-ivory shadow-warm-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              🩺 Elena (Caretaker)
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation row */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-lg">
          <div className="w-10 h-10 rounded-full bg-forest text-ivory flex items-center justify-center shadow-warm font-serif text-xl font-bold tracking-tight">
            CC
          </div>
          <div>
            <span className="font-serif text-2xl text-forest font-bold tracking-tight block leading-none">
              CareCircle
            </span>
            <span className="text-xs text-charcoal-muted font-sans tracking-normal block mt-0.5">
              Connected care. Independent living.
            </span>
          </div>
        </Link>

        {/* Desktop links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(link => {
            const active = isActive(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-h-[44px] ${
                  active
                    ? 'bg-stone text-forest font-semibold'
                    : 'text-charcoal hover:bg-stone/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-forest' : 'text-charcoal-muted'}`} />
                <span>{link.label}</span>
                {link.badge && (
                  <span className="px-1.5 py-0.2 rounded-full bg-terracotta text-ivory text-xs font-bold leading-tight">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side actions: Notifications & Mobile Menu */}
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg text-charcoal hover:bg-stone/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-charcoal" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-terracotta ring-2 ring-ivory" />
            )}
          </Link>

          <Link
            to="/settings"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone bg-ivory text-sm font-medium text-charcoal hover:bg-stone-light min-h-[40px]"
          >
            <Shield className="w-4 h-4 text-forest" />
            <span>Settings</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-charcoal hover:bg-stone/60 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone bg-ivory px-4 py-4 space-y-2 animate-in slide-in-from-top duration-200">
          {navLinks.map(link => {
            const active = isActive(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium touch-target-elderly ${
                  active
                    ? 'bg-forest text-ivory font-semibold'
                    : 'text-charcoal hover:bg-stone/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-terracotta text-ivory text-xs font-bold">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-charcoal hover:bg-stone/60 touch-target-elderly"
          >
            <Shield className="w-5 h-5" />
            <span>Settings & Access Control</span>
          </Link>
        </div>
      )}
    </header>
  );
};
