import React from 'react';
import { useCare } from '@/contexts/CareContext';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Activity,
  ArrowRight,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';

export const CareIntelligencePage: React.FC = () => {
  const { intelligenceReport, careProfile, doseLogs, notifications } = useCare();
  const personName = careProfile?.preferred_name || careProfile?.full_name || 'Margaret';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
              Care Intelligence Engine
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest text-ivory font-semibold">
              Signature Innovation
            </span>
          </div>
          <p className="text-sm text-charcoal-light mt-1 max-w-2xl">
            A transparent, rule-based care intelligence system. Generates explainable, evidence-backed follow-up observations from real recorded care events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-charcoal-muted">Engine Status:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest/10 text-forest text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-forest animate-ping" />
            Active Real-time Rules
          </span>
        </div>
      </div>

      {/* Overall Care Routine Status Banner */}
      <div
        className={`p-6 rounded-3xl border shadow-warm flex flex-col md:flex-row md:items-center justify-between gap-6 ${
          intelligenceReport.overallStatus === 'action_required'
            ? 'bg-terracotta/10 border-terracotta/40'
            : intelligenceReport.overallStatus === 'attention_needed'
            ? 'bg-cream-light border-stone'
            : 'bg-forest/5 border-forest/20'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {intelligenceReport.overallStatus === 'action_required' ? (
              <AlertTriangle className="w-6 h-6 text-terracotta" />
            ) : intelligenceReport.overallStatus === 'attention_needed' ? (
              <Info className="w-6 h-6 text-terracotta" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-forest" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
              Current Healthcare Routine Status
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal capitalize">
            {intelligenceReport.overallStatus.replace('_', ' ')}
          </h2>
          <p className="text-sm text-charcoal-light max-w-2xl leading-relaxed">
            {intelligenceReport.summary}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-stone/80 text-xs text-charcoal-light space-y-1.5 shrink-0 min-w-[220px]">
          <div className="flex justify-between">
            <span className="text-charcoal-muted">Evaluated Events:</span>
            <span className="font-bold text-charcoal">{doseLogs.length} Records</span>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-muted">Active Insights:</span>
            <span className="font-bold text-forest">{intelligenceReport.insights.length} Identified</span>
          </div>
          <div className="flex justify-between">
            <span className="text-charcoal-muted">Engine Audit:</span>
            <span className="font-mono text-[10px] text-charcoal-muted">100% Traceable</span>
          </div>
        </div>
      </div>

      {/* Explainable Insights Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold text-charcoal">
            Explainable Observations & Recommendations
          </h2>
          <span className="text-xs text-charcoal-muted">
            All insights backed by explicit database identities
          </span>
        </div>

        {intelligenceReport.insights.length === 0 ? (
          <div className="p-8 text-center bg-white border border-stone rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-forest mx-auto mb-2" />
            <h3 className="font-serif text-xl font-bold text-charcoal">
              Care Routine is Consistent
            </h3>
            <p className="text-xs text-charcoal-muted mt-1">
              No anomalies, unconfirmed dose clusters, or pending caregiver delays detected in recent days.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {intelligenceReport.insights.map(insight => {
              const isUrgent = insight.severity === 'urgent';
              const isAttention = insight.severity === 'attention';

              return (
                <div
                  key={insight.id}
                  className={`bg-white border rounded-2xl p-6 shadow-warm-sm space-y-5 transition-all ${
                    isUrgent
                      ? 'border-terracotta/50 ring-1 ring-terracotta/20'
                      : isAttention
                      ? 'border-terracotta/30'
                      : 'border-stone'
                  }`}
                >
                  {/* Top: Category badge & Title */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isUrgent
                            ? 'bg-terracotta text-ivory'
                            : isAttention
                            ? 'bg-terracotta/10 text-terracotta-dark'
                            : 'bg-forest/10 text-forest'
                        }`}
                      >
                        {insight.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-charcoal-muted font-medium">
                        Timeframe: {insight.evidence.timeframe}
                      </span>
                    </div>

                    <span className="text-[11px] text-charcoal-muted">
                      ID: <span className="font-mono">{insight.id}</span>
                    </span>
                  </div>

                  {/* Observation & Recommendation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* What was observed */}
                    <div className="space-y-2">
                      <h3 className="font-serif text-xl font-bold text-charcoal">
                        {insight.title}
                      </h3>
                      <p className="text-sm text-charcoal-light leading-relaxed">
                        {insight.observation}
                      </p>
                    </div>

                    {/* Non-medical recommended action */}
                    <div className="bg-cream-light/70 border border-stone p-4 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Recommended Action for Circle:
                      </span>
                      <p className="text-xs text-charcoal leading-relaxed font-medium">
                        {insight.recommendedAction}
                      </p>
                    </div>
                  </div>

                  {/* Traceable Evidence Drawer */}
                  <div className="bg-stone-light/50 border border-stone/60 rounded-xl p-3.5 text-xs text-charcoal-muted space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-charcoal">
                      <Layers className="w-3.5 h-3.5 text-forest" />
                      <span>Traceable Supporting Evidence ({insight.evidence.count} Events)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.evidence.eventIds.map((eid, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-white border border-stone font-mono text-[11px] text-charcoal">
                          {eid}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Non-Medical Guardrail Disclaimer */}
      <div className="p-6 rounded-2xl bg-cream-light border border-stone space-y-2 text-xs text-charcoal-light">
        <h4 className="font-serif text-base font-bold text-forest">
          Clinical Guardrails & Scientific Integrity
        </h4>
        <p className="leading-relaxed">
          The CareCircle Care Intelligence Engine does not diagnose diseases, predict medical emergencies, or alter prescription parameters. It assists families and caretakers by highlighting workflow friction, routine conflicts, and communication delays using deterministic stored event logs.
        </p>
      </div>
    </div>
  );
};
