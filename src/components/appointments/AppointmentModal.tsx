import React, { useState } from 'react';
import { Appointment } from '@/types';
import { useCare } from '@/contexts/CareContext';
import { X } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentToEdit?: Appointment;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointmentToEdit,
}) => {
  const { saveAppointment } = useCare();
  const [doctorName, setDoctorName] = useState(appointmentToEdit?.doctor_name || '');
  const [specialty, setSpecialty] = useState(appointmentToEdit?.specialty || '');
  const [location, setLocation] = useState(appointmentToEdit?.location || '');
  const [appointmentDate, setAppointmentDate] = useState(
    appointmentToEdit?.appointment_date || format(addDays(new Date(), 3), 'yyyy-MM-dd')
  );
  const [appointmentTime, setAppointmentTime] = useState(appointmentToEdit?.appointment_time || '10:00');
  const [notes, setNotes] = useState(appointmentToEdit?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!doctorName.trim()) {
      setError('Physician or specialist name is required.');
      return;
    }
    if (!location.trim()) {
      setError('Clinic or hospital location is required.');
      return;
    }
    if (!appointmentDate) {
      setError('Appointment date is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await saveAppointment({
        id: appointmentToEdit?.id,
        care_profile_id: '',
        doctor_name: doctorName.trim(),
        specialty: specialty.trim() || undefined,
        location: location.trim(),
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        notes: notes.trim() || undefined,
        status: appointmentToEdit?.status || 'scheduled',
        reminder_sent: false,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory border border-stone rounded-2xl max-w-lg w-full p-6 shadow-warm-lg space-y-6">
        <div className="flex items-center justify-between border-b border-stone pb-3">
          <h3 className="font-serif text-2xl font-bold text-forest">
            {appointmentToEdit ? 'Edit Medical Appointment' : 'Schedule Medical Appointment'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-charcoal-muted hover:text-charcoal hover:bg-stone/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-terracotta/10 border border-terracotta/30 text-terracotta-dark text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Doctor / Provider *
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={e => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Robert Chen"
                required
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Specialty / Department
              </label>
              <input
                type="text"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology, Optometry"
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
              Location / Clinic Address *
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Memorial Medical Center, Suite 400"
              required
              className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Date *
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={e => setAppointmentDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Time *
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={e => setAppointmentTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
              Preparation Notes / Checklist
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Bring updated medication list, fast 8 hours prior for bloodwork..."
              className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone text-sm text-charcoal-muted hover:text-charcoal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-forest text-ivory text-sm font-bold hover:bg-forest-light shadow-warm transition-all touch-target-elderly"
            >
              {isSubmitting ? 'Scheduling...' : 'Save Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
