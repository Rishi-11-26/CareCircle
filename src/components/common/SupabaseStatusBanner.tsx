import React, { useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Database, Zap, CheckCircle2, X } from 'lucide-react';
import { useCare } from '@/contexts/CareContext';

export const SupabaseStatusBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const { triggerEscalationCycle } = useCare();
  const configured = isSupabaseConfigured();

  const handleRunEscalation = async () => {
    setIsEscalating(true);
    setEscalationMessage(null);
    try {
      const res = await triggerEscalationCycle();
      setEscalationMessage(
        res.createdEscalations > 0
          ? `Escalation check complete: ${res.createdEscalations} overdue dose(s) escalated to circle.`
          : 'Escalation check complete: All scheduled doses are currently up to date or within grace period.'
      );
    } finally {
      setIsEscalating(false);
      setTimeout(() => setEscalationMessage(null), 6000);
    }
  };

  if (dismissed) return null;

  return (
    <div className="bg-stone-light/90 border-b border-stone px-4 py-2 text-xs text-charcoal">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {configured ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-forest/10 text-forest font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
              Live Dedicated Supabase Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sage/20 text-forest font-medium">
              <Database className="w-3.5 h-3.5 text-forest" />
              Dedicated Storage Mode (Zero-crash offline persistence active)
            </span>
          )}
          <span className="hidden md:inline text-charcoal-muted">
            {configured
              ? 'Edge Functions and Row Level Security active.'
              : 'Add VITE_SUPABASE_URL in .env to connect dedicated cloud backend.'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {escalationMessage && (
            <span className="text-terracotta-dark font-medium animate-pulse">
              {escalationMessage}
            </span>
          )}
          <button
            onClick={handleRunEscalation}
            disabled={isEscalating}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-forest text-ivory hover:bg-forest-light transition-colors font-medium touch-target-elderly sm:touch-target-auto min-h-[32px]"
            title="Evaluate missed doses and trigger escalation workflow"
          >
            <Zap className={`w-3 h-3 ${isEscalating ? 'animate-spin' : ''}`} />
            {isEscalating ? 'Checking...' : 'Run Escalation Cycle'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="text-charcoal-muted hover:text-charcoal p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
