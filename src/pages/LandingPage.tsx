import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import {
  Heart,
  ShieldCheck,
  Brain,
  Zap,
  Users,
  CheckCircle2,
  Calendar,
  Pill,
  ArrowRight,
  PhoneCall,
  Clock,
  Sparkles,
  Accessibility,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { switchRole, setDemoMode } = useCare();
  const navigate = useNavigate();

  const handleLaunchRole = (role: 'elderly' | 'family' | 'caretaker', targetPath: string = '/') => {
    setDemoMode(true);
    switchRole(role);
    navigate(targetPath);
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-300">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 border border-forest/20 text-forest text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>CareCircle — Collaborative Elderly Healthcare Platform</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-6xl font-bold text-forest tracking-tight leading-[1.15]">
          Connected care. <br className="hidden sm:inline" />
          <span className="italic font-normal text-charcoal">Independent living.</span>
        </h1>

        <p className="text-base sm:text-lg text-charcoal-light max-w-2xl mx-auto leading-relaxed">
          A smart, interconnected healthcare ecosystem designed to help elderly individuals manage daily medications and medical appointments while keeping their family members and personal caretakers informed through secure passcode-based access.
        </p>

        {/* Primary CTAs with Role Presets */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleLaunchRole('elderly')}
            className="px-6 py-3 rounded-2xl bg-forest text-ivory text-base font-bold hover:bg-forest-light shadow-warm transition-all touch-target-elderly flex items-center gap-2 cursor-pointer"
          >
            <span>Launch Elderly Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleLaunchRole('family', '/intelligence')}
            className="px-6 py-3 rounded-2xl border border-stone bg-white text-forest text-base font-semibold hover:bg-stone-light shadow-warm-sm transition-all cursor-pointer"
          >
            Explore Care Intelligence
          </button>
        </div>

        {/* Quick persona preview pills */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-charcoal-muted">
          <span>Jump into demo as:</span>
          <button
            type="button"
            onClick={() => handleLaunchRole('elderly')}
            className="px-3 py-1 rounded-lg bg-stone hover:bg-stone-dark/20 text-charcoal font-medium cursor-pointer"
          >
            👵 Margaret (Elderly Individual)
          </button>
          <button
            type="button"
            onClick={() => handleLaunchRole('family')}
            className="px-3 py-1 rounded-lg bg-stone hover:bg-stone-dark/20 text-charcoal font-medium cursor-pointer"
          >
            👨‍👧 David (Family Member)
          </button>
          <button
            type="button"
            onClick={() => handleLaunchRole('caretaker')}
            className="px-3 py-1 rounded-lg bg-stone hover:bg-stone-dark/20 text-charcoal font-medium cursor-pointer"
          >
            🩺 Elena (Registered Caretaker)
          </button>
        </div>
      </section>

      {/* 4 Core Pillars Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-stone p-6 rounded-2xl shadow-warm-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center text-forest">
            <Pill className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal">
            Medication Adherence
          </h3>
          <p className="text-xs text-charcoal-light leading-relaxed">
            One-touch dose confirmations with strict idempotency to prevent duplicate dose logs. Accurate adherence metrics excluding future doses.
          </p>
        </div>

        <div className="bg-white border border-stone p-6 rounded-2xl shadow-warm-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center text-forest">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal">
            Missed-Dose Escalation
          </h3>
          <p className="text-xs text-charcoal-light leading-relaxed">
            Automatic follow-up after the configured grace period. Sends notifications and emails to circle members, requiring documented caregiver check-in.
          </p>
        </div>

        <div className="bg-white border border-stone p-6 rounded-2xl shadow-warm-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center text-forest">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal">
            Care Intelligence
          </h3>
          <p className="text-xs text-charcoal-light leading-relaxed">
            Transparent, rule-based observations backed by explicit event IDs and dose identities. No generic hallucinations, strictly non-medical advice.
          </p>
        </div>

        <div className="bg-white border border-stone p-6 rounded-2xl shadow-warm-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center text-forest">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal">
            Passcode Protected
          </h3>
          <p className="text-xs text-charcoal-light leading-relaxed">
            Cryptographically hashed (SHA-256) one-time passcodes for family and caretakers. The elderly individual owns and governs their health profile.
          </p>
        </div>
      </section>

      {/* Accessibility & Design Philosophy Section */}
      <section className="bg-cream-light border border-stone p-8 rounded-3xl shadow-warm-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone/60 pb-4">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest">
              Warm Editorial Design & Elderly Accessibility
            </h2>
            <p className="text-xs text-charcoal-muted mt-1">
              Crafted in accordance with WCAG 2.2 AA accessibility guidelines.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest text-ivory text-xs font-semibold">
            <Accessibility className="w-4 h-4" />
            Inclusive Healthcare Design
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-charcoal-light">
          <div className="space-y-1.5">
            <h4 className="font-bold text-sm text-charcoal">Large Touch Targets</h4>
            <p className="leading-relaxed">
              Buttons and confirmation cards feature generous padding and minimum 52px target zones, reducing cognitive load and accidental taps.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-sm text-charcoal">High-Contrast Typography</h4>
            <p className="leading-relaxed">
              Warm charcoal on ivory surfaces paired with botanical forest greens ensures optimal readability for aging eyes.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-sm text-charcoal">Non-Color Status Cues</h4>
            <p className="leading-relaxed">
              Every status indicator combines distinct iconography, clear badge text, and accessible ARIA labels for color-blind accessibility.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
