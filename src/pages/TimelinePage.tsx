import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import {
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Pill,
  Users,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';

export const TimelinePage: React.FC = () => {
  const { activityLogs, careProfile } = useCare();
  const [filter, setFilter] = useState<string>('all');

  const filteredLogs = activityLogs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'doses') return log.activity_type.startsWith('dose_');
    if (filter === 'alerts') return log.activity_type.includes('alert') || log.activity_type.includes('escalated');
    if (filter === 'appointments') return log.activity_type.startsWith('appointment_');
    if (filter === 'members') return log.activity_type.startsWith('member_');
    return true;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'dose_taken':
        return <CheckCircle2 className="w-4 h-4 text-forest" />;
      case 'dose_skipped':
        return <XCircle className="w-4 h-4 text-terracotta" />;
      case 'dose_unconfirmed_escalated':
        return <AlertTriangle className="w-4 h-4 text-terracotta" />;
      case 'alert_acknowledged':
        return <ShieldCheck className="w-4 h-4 text-forest" />;
      case 'appointment_created':
      case 'appointment_cancelled':
        return <Calendar className="w-4 h-4 text-forest" />;
      case 'member_joined':
      case 'member_removed':
        return <Users className="w-4 h-4 text-forest" />;
      default:
        return <Pill className="w-4 h-4 text-forest" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
            Shared Care Activity Timeline
          </h1>
          <p className="text-sm text-charcoal-light mt-1">
            Immutable audit record of medication confirmations, appointments, caregiver follow-ups, and circle actions for{' '}
            <strong>{careProfile?.full_name}</strong>.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-light p-1 rounded-xl border border-stone">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === 'all' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setFilter('doses')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === 'doses' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Medication Doses
          </button>
          <button
            onClick={() => setFilter('alerts')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === 'alerts' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Alerts & Follow-ups
          </button>
          <button
            onClick={() => setFilter('appointments')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filter === 'appointments' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Doctor Visits
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-white border border-stone rounded-2xl">
            <History className="w-10 h-10 text-forest mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-charcoal">
              No matching activity logged for this filter.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 border-l-2 border-stone space-y-6">
            {filteredLogs.map(log => (
              <div key={log.id} className="relative group">
                {/* Timeline node dot */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-7 h-7 rounded-full bg-white border-2 border-forest flex items-center justify-center shadow-warm-sm">
                  {getActivityIcon(log.activity_type)}
                </div>

                {/* Card */}
                <div className="bg-white border border-stone rounded-2xl p-5 shadow-warm-sm hover:shadow-warm transition-all space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-base text-charcoal">
                        {log.actor_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone text-charcoal-muted font-bold uppercase tracking-wider">
                        {log.actor_role}
                      </span>
                    </div>

                    <span className="text-xs text-charcoal-muted font-medium">
                      {format(new Date(log.created_at), 'EEEE, MMMM d, yyyy • h:mm a')}
                    </span>
                  </div>

                  <p className="text-sm text-charcoal-light leading-relaxed">
                    {log.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
