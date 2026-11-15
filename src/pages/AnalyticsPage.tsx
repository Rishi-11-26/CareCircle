import React from 'react';
import { useCare } from '@/contexts/CareContext';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Info,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { adherenceMetrics, careProfile } = useCare();
  const personName = careProfile?.preferred_name || careProfile?.full_name || 'Margaret';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-stone pb-5">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
          Medication Adherence Analytics
        </h1>
        <p className="text-sm text-charcoal-light mt-1">
          Objective adherence tracking over the past 7 days for {personName}. Strictly evaluates past and current scheduled doses.
        </p>
      </div>

      {/* Top Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-stone rounded-2xl p-5 shadow-warm-sm space-y-1">
          <span className="text-xs font-semibold text-charcoal-muted uppercase tracking-wider block">
            Overall Adherence
          </span>
          <div className="font-serif text-4xl font-bold text-forest">
            {adherenceMetrics.adherenceRate}%
          </div>
          <p className="text-xs text-charcoal-muted">
            Confirmed on-time doses
          </p>
        </div>

        <div className="bg-white border border-stone rounded-2xl p-5 shadow-warm-sm space-y-1">
          <span className="text-xs font-semibold text-charcoal-muted uppercase tracking-wider block">
            Confirmed Taken
          </span>
          <div className="font-serif text-4xl font-bold text-forest">
            {adherenceMetrics.confirmedCount}
          </div>
          <p className="text-xs text-charcoal-muted">
            Doses verified in app
          </p>
        </div>

        <div className="bg-white border border-stone rounded-2xl p-5 shadow-warm-sm space-y-1">
          <span className="text-xs font-semibold text-charcoal-muted uppercase tracking-wider block">
            Confirmed Skipped
          </span>
          <div className="font-serif text-4xl font-bold text-charcoal">
            {adherenceMetrics.skippedCount}
          </div>
          <p className="text-xs text-charcoal-muted">
            Documented exceptions
          </p>
        </div>

        <div className="bg-white border border-stone rounded-2xl p-5 shadow-warm-sm space-y-1">
          <span className="text-xs font-semibold text-charcoal-muted uppercase tracking-wider block">
            Unconfirmed / Overdue
          </span>
          <div className="font-serif text-4xl font-bold text-terracotta">
            {adherenceMetrics.unconfirmedCount}
          </div>
          <p className="text-xs text-charcoal-muted">
            Awaiting follow-up
          </p>
        </div>
      </div>

      {/* 7-Day Trend Visual Breakdown */}
      <section className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone/50 pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-charcoal">
              7-Day Adherence Trend
            </h2>
            <p className="text-xs text-charcoal-muted">
              Daily percentage of confirmed eligible doses.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-forest">
              <span className="w-3 h-3 rounded-full bg-forest" />
              100% Adherence
            </span>
            <span className="flex items-center gap-1.5 text-terracotta">
              <span className="w-3 h-3 rounded-full bg-terracotta" />
              Missed / Unconfirmed
            </span>
          </div>
        </div>

        {/* Accessible Bar Visualizer */}
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end pt-6 min-h-[220px]">
          {adherenceMetrics.weeklyTrend.map((day, idx) => {
            const heightPercent = Math.max(day.rate, 10);
            const isFull = day.rate >= 90;

            return (
              <div key={idx} className="flex flex-col items-center gap-2 group">
                <span className="text-xs font-bold text-charcoal">
                  {day.rate}%
                </span>

                <div className="w-full bg-stone-light rounded-t-xl h-36 flex items-end p-1">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-lg transition-all ${
                      isFull ? 'bg-forest group-hover:bg-forest-light' : 'bg-terracotta group-hover:bg-terracotta-dark'
                    }`}
                  />
                </div>

                <div className="text-center">
                  <span className="block text-xs font-bold text-charcoal">{day.dayLabel}</span>
                  <span className="block text-[10px] text-charcoal-muted">
                    {day.confirmed}/{day.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audit & Calculation Integrity Notice */}
      <div className="p-5 bg-cream-light border border-stone rounded-2xl text-xs text-charcoal-light flex items-start gap-3">
        <Info className="w-5 h-5 text-forest shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-forest font-semibold">Strict Mathematical Precision: </strong>
          Adherence percentage is strictly calculated as <code className="bg-stone px-1 py-0.5 rounded text-charcoal font-mono">Confirmed Doses / Total Eligible Scheduled Doses × 100</code>. Scheduled doses in the future are strictly excluded from the calculation denominator, preventing artificially deflated metrics.
        </div>
      </div>
    </div>
  );
};
