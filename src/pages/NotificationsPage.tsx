import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Notification } from '@/types';
import { AcknowledgeModal } from '@/components/notifications/AcknowledgeModal';
import {
  Bell,
  AlertTriangle,
  Calendar,
  Pill,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';

export const NotificationsPage: React.FC = () => {
  const { notifications, careProfile, currentUser } = useCare();
  const [selectedNotifForAck, setSelectedNotifForAck] = useState<Notification | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return n.status === 'pending' || n.status === 'sent';
    if (activeFilter === 'escalations') return n.category === 'unconfirmed_escalation';
    if (activeFilter === 'appointments') return n.category === 'upcoming_appointment';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
            Circle Notifications & Alerts
          </h1>
          <p className="text-sm text-charcoal-light mt-1">
            Real-time reminders, missed-dose escalation follow-ups, and caregiver acknowledgements.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-light p-1 rounded-xl border border-stone">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              activeFilter === 'all' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              activeFilter === 'pending' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Awaiting Action
          </button>
          <button
            onClick={() => setActiveFilter('escalations')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              activeFilter === 'escalations' ? 'bg-forest text-ivory font-bold' : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            Overdue Escalations
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-4">
        {filteredNotifs.length === 0 ? (
          <div className="p-8 text-center bg-white border border-stone rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-forest mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-charcoal">
              No notifications matching this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredNotifs.map(n => {
              const isUrgent = n.priority === 'urgent';
              const isPending = n.status === 'pending' || n.status === 'sent';

              return (
                <div
                  key={n.id}
                  className={`bg-white border rounded-2xl p-5 shadow-warm-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    isUrgent && isPending
                      ? 'border-terracotta/50 ring-1 ring-terracotta/20 bg-terracotta/5'
                      : 'border-stone'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isUrgent ? 'bg-terracotta text-ivory' : 'bg-stone text-forest'
                        }`}
                      >
                        {n.category.replace('_', ' ')}
                      </span>

                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          n.status === 'resolved'
                            ? 'bg-forest/10 text-forest'
                            : n.status === 'acknowledged'
                            ? 'bg-forest/10 text-forest font-semibold'
                            : 'bg-stone text-charcoal-muted'
                        }`}
                      >
                        Status: {n.status}
                      </span>

                      <span className="text-xs text-charcoal-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(n.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-serif text-lg font-bold text-charcoal">
                        {n.title}
                      </h3>
                      <p className="text-sm text-charcoal-light leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {n.metadata?.acknowledgement_note && (
                      <p className="text-xs text-forest bg-forest/5 p-2.5 rounded-xl border border-forest/20">
                        <strong>Caregiver Note: </strong>
                        {n.metadata.acknowledgement_note}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="shrink-0">
                      <button
                        onClick={() => setSelectedNotifForAck(n)}
                        className="px-5 py-2.5 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
                      >
                        Acknowledge Follow-up
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedNotifForAck && (
        <AcknowledgeModal
          notification={selectedNotifForAck}
          onClose={() => setSelectedNotifForAck(null)}
        />
      )}
    </div>
  );
};
