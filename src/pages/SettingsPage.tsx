import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  Shield,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  User,
  Heart,
  Lock,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { careProfile, resetDemoData, currentUser } = useCare();
  const [resetSuccess, setResetSuccess] = useState(false);
  const configured = isSupabaseConfigured();

  const handleReset = () => {
    if (confirm('Reset application state back to the original synthetic demo seed? All changes will revert to the baseline evaluator scenario.')) {
      resetDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-stone pb-5">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
          Settings & Healthcare Profile
        </h1>
        <p className="text-sm text-charcoal-light mt-1">
          Manage patient healthcare details, emergency contacts, backend integration, and evaluator test parameters.
        </p>
      </div>

      {/* Patient Health Profile Card */}
      <div className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-stone/50 pb-3">
          <Heart className="w-5 h-5 text-forest" />
          <h2 className="font-serif text-xl font-bold text-charcoal">
            Elderly Individual Profile Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-charcoal-muted font-medium block">Full Legal Name:</span>
            <span className="font-bold text-sm text-charcoal">{careProfile?.full_name}</span>
          </div>

          <div>
            <span className="text-charcoal-muted font-medium block">Preferred Name:</span>
            <span className="font-bold text-sm text-charcoal">{careProfile?.preferred_name}</span>
          </div>

          <div>
            <span className="text-charcoal-muted font-medium block">Date of Birth:</span>
            <span className="font-bold text-sm text-charcoal">{careProfile?.date_of_birth}</span>
          </div>

          <div>
            <span className="text-charcoal-muted font-medium block">Blood Group:</span>
            <span className="font-bold text-sm text-charcoal">{careProfile?.blood_group}</span>
          </div>

          <div>
            <span className="text-charcoal-muted font-medium block">Known Allergies:</span>
            <span className="font-bold text-sm text-terracotta-dark">
              {careProfile?.allergies?.join(', ') || 'None reported'}
            </span>
          </div>

          <div>
            <span className="text-charcoal-muted font-medium block">Emergency Contact Phone:</span>
            <span className="font-bold text-sm text-charcoal">{careProfile?.emergency_phone}</span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-charcoal-muted font-medium block">Residential Address:</span>
            <span className="font-medium text-charcoal">{careProfile?.address}</span>
          </div>

          <div className="sm:col-span-2 bg-cream-light p-3 rounded-xl border border-stone/60">
            <span className="text-forest font-bold block mb-1">Medical Care Notes:</span>
            <p className="text-charcoal-light italic">{careProfile?.medical_notes}</p>
          </div>
        </div>
      </div>

      {/* Supabase Dedicated Backend Status */}
      <div className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone/50 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-forest" />
            <h2 className="font-serif text-xl font-bold text-charcoal">
              Dedicated Supabase Backend Configuration
            </h2>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              configured ? 'bg-forest/10 text-forest' : 'bg-stone text-charcoal-muted'
            }`}
          >
            {configured ? 'Connected Live' : 'Dedicated Storage Fallback'}
          </span>
        </div>

        <p className="text-xs text-charcoal-light leading-relaxed">
          CareCircle is configured to run on a dedicated Supabase project with full Row Level Security, RPC stored procedures, and Deno Edge Functions.
        </p>

        <div className="bg-stone-light/60 p-4 rounded-xl space-y-2 text-xs font-mono">
          <div>
            <span className="text-charcoal-muted">VITE_SUPABASE_URL: </span>
            <span className="text-forest font-semibold">
              {import.meta.env.VITE_SUPABASE_URL || 'Not specified (using persistent offline storage)'}
            </span>
          </div>
          <div>
            <span className="text-charcoal-muted">VITE_SUPABASE_ANON_KEY: </span>
            <span className="text-forest font-semibold">
              {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present (active)' : 'Not specified'}
            </span>
          </div>
        </div>

        <div className="text-xs text-charcoal-muted space-y-1">
          <p><strong>To connect your own dedicated Supabase project:</strong></p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Create a new dedicated project on Supabase.</li>
            <li>Run the migrations in <code className="bg-stone px-1 py-0.5 rounded">supabase/migrations/</code> in the SQL editor.</li>
            <li>Add <code className="bg-stone px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="bg-stone px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> to your <code className="bg-stone px-1 py-0.5 rounded">.env</code> file.</li>
          </ol>
        </div>
      </div>

      {/* Evaluator Demonstration Reset */}
      <div className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-stone/50 pb-3">
          <RefreshCw className="w-5 h-5 text-forest" />
          <h2 className="font-serif text-xl font-bold text-charcoal">
            Demonstration State Reset
          </h2>
        </div>

        <p className="text-xs text-charcoal-light">
          Reset all local state back to the original synthetic demo dataset (Margaret Hayes, David Hayes, Nurse Elena, prescription schedules, and seed logs) to run a fresh evaluation test.
        </p>

        {resetSuccess && (
          <p className="text-xs font-bold text-forest flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>State successfully reset to demonstration seed.</span>
          </p>
        )}

        <button
          onClick={handleReset}
          className="px-5 py-2.5 rounded-xl border border-stone bg-white text-terracotta text-xs font-bold hover:bg-terracotta/10 hover:border-terracotta/40 transition-colors shadow-warm-sm"
        >
          Reset to Demo Seed Data
        </button>
      </div>
    </div>
  );
};
