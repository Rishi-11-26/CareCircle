import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { CallFamilyModal } from '@/components/common/CallFamilyModal';
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
  Shield,
  Phone,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, unreadAlertsCount, intelligenceReport, careProfile } = useCare();
  const { largePrintMode, toggleLargePrintMode } = useAccessibility();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [callFamilyModalOpen, setCallFamilyModalOpen] = useState(false);
  const location = useLocation();

  const isElderly = currentUser.role === 'elderly';
  const personName = careProfile?.preferred_name || careProfile?.full_name?.split(' ')[0] || 'Margaret';
  const rawPhone = careProfile?.emergency_phone?.trim();
  const sanitizedPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : '';
  const hasValidPhone = Boolean(sanitizedPhone && sanitizedPhone.length >= 7);

  const handleCallFamily = (e: React.MouseEvent) => {
    if (!hasValidPhone) {
      e.preventDefault();
      setCallFamilyModalOpen(true);
    }
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // =========================================================================
  // ELDERLY USER NAVIGATION (Margaret: ONLY 4 primary destinations)
  // =========================================================================
  if (isElderly) {
    const elderlyNavItems = [
      { to: '/', label: 'Home', icon: Heart },
      { to: '/medications', label: 'My Medicines', icon: Pill },
      { to: '/appointments', label: 'Doctor Visits', icon: Calendar },
    ];

    return (
      <header className="bg-ivory border-b-2 border-stone sticky top-0 z-40 shadow-warm-xs">
        {/* Top Elderly Header: Brand, Greeting, and Accessible Large Print Button */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-3 focus-visible:ring-forest rounded-xl"
            aria-label="CareCircle Home"
          >
            <div className="w-11 h-11 rounded-2xl bg-forest text-ivory flex items-center justify-center shadow-warm font-serif text-2xl font-bold tracking-tight">
              CC
            </div>
            <div>
              <span className="font-serif text-2xl sm:text-3xl text-forest font-bold tracking-tight block leading-none">
                CareCircle
              </span>
              <span className="text-xs sm:text-sm text-charcoal-muted font-sans font-medium block mt-0.5">
                Good day, {personName}
              </span>
            </div>
          </Link>

          {/* Large Print Mode Toggle & Call Family Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLargePrintMode}
              aria-pressed={largePrintMode}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all cursor-pointer min-h-[48px] touch-target-elderly ${
                largePrintMode
                  ? 'bg-forest text-ivory border-forest shadow-warm-md ring-2 ring-forest/40 ring-offset-2 font-extrabold'
                  : 'bg-white text-forest border-2 border-forest/30 hover:border-forest hover:bg-forest/5 font-bold shadow-warm-xs'
              }`}
              title="Toggle Large Print mode for larger, high-contrast text"
            >
              {largePrintMode ? <ZoomOut className="w-4 h-4 shrink-0 text-sage-light" /> : <ZoomIn className="w-4 h-4 shrink-0 text-forest" />}
              <span>{largePrintMode ? 'Standard Text Mode' : 'Large Print Mode'}</span>
              {largePrintMode && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-ivory text-forest ml-1">
                  Active
                </span>
              )}
            </button>

            <a
              href={hasValidPhone ? `tel:${sanitizedPhone}` : '#'}
              onClick={handleCallFamily}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-ivory text-sm font-bold shadow-warm min-h-[48px] touch-target-elderly transition-all cursor-pointer"
              aria-label="Call Family"
            >
              <Phone className="w-4 h-4" />
              <span>Call Family</span>
            </a>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl text-charcoal hover:bg-stone/60 min-h-[48px] min-w-[48px] flex items-center justify-center border border-stone"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop Primary Navigation Row (EXCLUSIVELY 4 Items) */}
        <div className="border-t border-stone/60 bg-cream-light/70 px-4 py-2">
          <nav
            aria-label="Primary Elderly Navigation"
            className="max-w-7xl mx-auto flex items-center justify-start gap-2 sm:gap-4 overflow-x-auto"
          >
            {elderlyNavItems.map(item => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold transition-all text-sm sm:text-base min-h-[52px] touch-target-elderly cursor-pointer ${
                    active
                      ? 'bg-forest text-ivory shadow-warm'
                      : 'text-charcoal bg-white/80 hover:bg-white border border-stone/70'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* 4th Destination: Call Family */}
            <a
              href={hasValidPhone ? `tel:${sanitizedPhone}` : '#'}
              onClick={handleCallFamily}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-sm sm:text-base min-h-[52px] touch-target-elderly bg-terracotta hover:bg-terracotta-dark text-ivory shadow-warm transition-all cursor-pointer ml-auto sm:ml-0"
              aria-label="Call Family"
            >
              <Phone className="w-5 h-5 shrink-0" />
              <span>Call Family</span>
            </a>
          </nav>
        </div>

        {/* Mobile drawer for elderly (strictly the 4 items) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-2 border-stone bg-ivory p-4 space-y-3 animate-in slide-in-from-top duration-200">
            {elderlyNavItems.map(item => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-lg font-bold min-h-[60px] touch-target-elderly ${
                    active ? 'bg-forest text-ivory shadow-warm' : 'bg-white border border-stone text-charcoal'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <a
              href={hasValidPhone ? `tel:${sanitizedPhone}` : '#'}
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleCallFamily(e);
              }}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-lg font-bold min-h-[60px] touch-target-elderly bg-terracotta text-ivory shadow-warm text-left cursor-pointer"
              aria-label="Call Family"
            >
              <Phone className="w-6 h-6" />
              <span>Call Family</span>
            </a>
          </div>
        )}

        <CallFamilyModal
          isOpen={callFamilyModalOpen}
          onClose={() => setCallFamilyModalOpen(false)}
        />
      </header>
    );
  }

  // =========================================================================
  // FAMILY & CARETAKER NAVIGATION (David & Elena: Full Clinical & Admin Views)
  // =========================================================================
  const isCaretaker = currentUser.role === 'caretaker';
  const activeInsightsCount = intelligenceReport.insights.length;

  const familyNavLinks = [
    { to: '/', label: 'Dashboard', icon: Heart },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/appointments', label: 'Appointments', icon: Calendar },
    { to: '/care-circle', label: 'Care Circle', icon: Users },
    {
      to: '/intelligence',
      label: 'Care Intelligence',
      icon: Brain,
      badge: activeInsightsCount > 0 ? activeInsightsCount : undefined,
    },
    { to: '/timeline', label: 'Timeline', icon: History },
    { to: '/analytics', label: 'Adherence', icon: BarChart3 },
  ];

  const caretakerNavLinks = [
    { to: '/', label: 'Care Console', icon: Heart },
    { to: '/medications', label: 'Medications', icon: Pill },
    { to: '/appointments', label: 'Appointments', icon: Calendar },
    {
      to: '/intelligence',
      label: 'Care Intelligence',
      icon: Brain,
      badge: activeInsightsCount > 0 ? activeInsightsCount : undefined,
    },
    { to: '/timeline', label: 'Timeline', icon: History },
  ];

  const links = isCaretaker ? caretakerNavLinks : familyNavLinks;

  return (
    <header className="bg-ivory border-b border-stone sticky top-0 z-40">
      {/* Top utility row: Profile context & Large Print Mode toggle */}
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
            <span className="text-xs px-2 py-0.5 rounded-full bg-forest/10 text-forest font-bold">
              {isCaretaker ? 'Nurse Elena (Caregiver)' : 'David Hayes (Family Member)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLargePrintMode}
              aria-pressed={largePrintMode}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer border ${
                largePrintMode
                  ? 'bg-forest text-ivory border-forest shadow-warm-sm'
                  : 'bg-white text-forest border-stone hover:bg-stone-light'
              }`}
              title="Toggle Large Print Mode"
            >
              {largePrintMode ? 'Standard Text Mode' : '🔍 Large Print Mode'}
            </button>
          </div>
        </div>
      </div>

      {/* Main navigation row */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-lg"
        >
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
        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1">
          {links.map(link => {
            const active = isActive(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-h-[44px] cursor-pointer ${
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

        {/* Right side actions: Notifications & Settings */}
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg text-charcoal hover:bg-stone/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={`Notifications, ${unreadAlertsCount} pending alerts`}
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
          {links.map(link => {
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
