import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Appointment } from '@/types';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  XCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

export const AppointmentsPage: React.FC = () => {
  const { appointments, cancelAppointment, currentUser } = useCare();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | undefined>(undefined);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canManage =
    currentUser.role === 'elderly' || currentUser.role === 'caretaker' || currentUser.role === 'family';

  const now = new Date();

  const upcoming = appointments.filter(
    a => a.status === 'scheduled' && !isBefore(new Date(`${a.appointment_date}T23:59:59`), now)
  );

  const pastOrCancelled = appointments.filter(
    a => a.status === 'cancelled' || isBefore(new Date(`${a.appointment_date}T23:59:59`), now)
  );

  const handleCancel = async (id: string) => {
    if (confirm('Cancel this doctor appointment? Reminders for cancelled appointments will be suppressed.')) {
      setCancellingId(id);
      try {
        await cancelAppointment(id);
      } finally {
        setCancellingId(null);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
            Medical Appointments
          </h1>
          <p className="text-sm text-charcoal-light mt-1">
            Doctor visits, specialist consultations, and appointment preparation notes.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setEditingApt(undefined);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest text-ivory text-sm font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Appointment</span>
          </button>
        )}
      </div>

      {/* Upcoming Section */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-charcoal">
          Upcoming Consultations ({upcoming.length})
        </h2>

        {upcoming.length === 0 ? (
          <div className="p-8 text-center bg-white border border-stone rounded-2xl">
            <Calendar className="w-10 h-10 text-forest mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-charcoal">
              No upcoming appointments scheduled.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcoming.map(apt => (
              <div
                key={apt.id}
                className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-forest/10 text-forest">
                        {apt.specialty || 'General Practice'}
                      </span>
                      <h3 className="font-serif text-2xl font-bold text-charcoal mt-1.5">
                        {apt.doctor_name}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleCancel(apt.id)}
                      disabled={cancellingId === apt.id}
                      className="text-xs text-charcoal-muted hover:text-terracotta p-1.5 rounded-lg hover:bg-stone-light transition-colors"
                      title="Cancel appointment"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-2 text-sm text-charcoal">
                    <div className="flex items-center gap-2 text-forest font-semibold">
                      <Calendar className="w-4 h-4" />
                      <span>{apt.appointment_date}</span>
                      <span className="text-charcoal-muted font-normal">•</span>
                      <Clock className="w-4 h-4" />
                      <span>{apt.appointment_time}</span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-charcoal-light">
                      <MapPin className="w-4 h-4 text-terracotta shrink-0 mt-0.5" />
                      <span>{apt.location}</span>
                    </div>
                  </div>

                  {apt.notes && (
                    <div className="bg-cream-light p-3 rounded-xl border border-stone/60 text-xs text-charcoal-light space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-forest">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Preparation Checklist:</span>
                      </div>
                      <p>{apt.notes}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-stone/50 flex items-center justify-between text-xs text-charcoal-muted">
                  <span className="inline-flex items-center gap-1 text-forest font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reminder Active
                  </span>
                  <span>Scheduled for circle review</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past or Cancelled */}
      {pastOrCancelled.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-stone">
          <h2 className="font-serif text-xl font-bold text-charcoal-muted">
            Past & Cancelled Consultations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastOrCancelled.map(apt => (
              <div
                key={apt.id}
                className="bg-stone-light/50 border border-stone/60 rounded-xl p-4 text-xs space-y-1 opacity-75"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-charcoal">{apt.doctor_name}</span>
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${
                    apt.status === 'cancelled'
                      ? 'bg-terracotta/10 text-terracotta'
                      : 'bg-stone text-charcoal-muted'
                  }`}>
                    {apt.status === 'cancelled' ? 'Cancelled' : 'Past Visit'}
                  </span>
                </div>
                <p className="text-charcoal-muted">{apt.specialty} • {apt.appointment_date}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isModalOpen && (
        <AppointmentModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingApt(undefined);
          }}
          appointmentToEdit={editingApt}
        />
      )}
    </div>
  );
};
