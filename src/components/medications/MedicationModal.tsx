import React, { useState } from 'react';
import { Medication } from '@/types';
import { useCare } from '@/contexts/CareContext';
import { X, Plus, Trash2 } from 'lucide-react';

interface MedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicationToEdit?: Medication;
}

export const MedicationModal: React.FC<MedicationModalProps> = ({
  isOpen,
  onClose,
  medicationToEdit,
}) => {
  const { saveMedication } = useCare();
  const [name, setName] = useState(medicationToEdit?.name || '');
  const [dosage, setDosage] = useState(medicationToEdit?.dosage || '');
  const [form, setForm] = useState<Medication['form']>(medicationToEdit?.form || 'tablet');
  const [instructions, setInstructions] = useState(medicationToEdit?.instructions || '');
  const [prescribingDoctor, setPrescribingDoctor] = useState(medicationToEdit?.prescribing_doctor || '');
  const [rxNumber, setRxNumber] = useState(medicationToEdit?.rx_number || '');
  const [refillDate, setRefillDate] = useState(medicationToEdit?.refill_date || '');

  // Schedule times state
  const [schedules, setSchedules] = useState<{ time: string; label?: string }[]>(() => {
    if (medicationToEdit?.schedules && medicationToEdit.schedules.length > 0) {
      return medicationToEdit.schedules.map(s => ({ time: s.time_of_day, label: s.label }));
    }
    return [{ time: '08:00', label: 'Morning with Breakfast' }];
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddSchedule = () => {
    setSchedules([...schedules, { time: '18:00', label: 'Dinner Dose' }]);
  };

  const handleRemoveSchedule = (index: number) => {
    if (schedules.length === 1) return;
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleScheduleChange = (index: number, field: 'time' | 'label', val: string) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: val };
    setSchedules(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Medication name is required.');
      return;
    }
    if (!dosage.trim()) {
      setError('Dosage is required (e.g. 10mg, 1 tablet).');
      return;
    }
    if (schedules.length === 0) {
      setError('Please add at least one schedule time.');
      return;
    }

    try {
      setIsSubmitting(true);
      await saveMedication(
        {
          id: medicationToEdit?.id,
          care_profile_id: '',
          name: name.trim(),
          dosage: dosage.trim(),
          form,
          instructions: instructions.trim(),
          prescribing_doctor: prescribingDoctor.trim(),
          rx_number: rxNumber.trim(),
          refill_date: refillDate || undefined,
          is_active: true,
          start_date: medicationToEdit?.start_date || new Date().toISOString().split('T')[0],
        },
        schedules
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save medication');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory border border-stone rounded-2xl max-w-xl w-full p-6 shadow-warm-lg my-8 space-y-6">
        <div className="flex items-center justify-between border-b border-stone pb-3">
          <h3 className="font-serif text-2xl font-bold text-forest">
            {medicationToEdit ? 'Edit Medication' : 'Add New Prescription'}
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
                Medication Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Lisinopril, Metformin"
                required
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Dosage & Unit *
              </label>
              <input
                type="text"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder="e.g. 10mg, 1 tablet, 2 puffs"
                required
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Form
              </label>
              <select
                value={form}
                onChange={e => setForm(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              >
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="liquid">Liquid</option>
                <option value="inhaler">Inhaler</option>
                <option value="drops">Drops</option>
                <option value="injection">Injection</option>
                <option value="patch">Patch</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Prescribing Physician
              </label>
              <input
                type="text"
                value={prescribingDoctor}
                onChange={e => setPrescribingDoctor(e.target.value)}
                placeholder="e.g. Dr. Robert Chen"
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
              Instructions & Patient Guidance
            </label>
            <input
              type="text"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="e.g. Take with food, drink full glass of water, morning only"
              className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Rx Number
              </label>
              <input
                type="text"
                value={rxNumber}
                onChange={e => setRxNumber(e.target.value)}
                placeholder="e.g. RX-992102"
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
                Next Refill Target Date
              </label>
              <input
                type="date"
                value={refillDate}
                onChange={e => setRefillDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone bg-white text-sm focus:ring-2 focus:ring-forest focus:outline-none"
              />
            </div>
          </div>

          {/* Daily Schedule Times */}
          <div className="pt-2 border-t border-stone space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Daily Dose Times
              </label>
              <button
                type="button"
                onClick={handleAddSchedule}
                className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:text-forest-light"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Dose Time
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {schedules.map((sched, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-cream-light p-2 rounded-xl border border-stone">
                  <input
                    type="time"
                    value={sched.time}
                    onChange={e => handleScheduleChange(idx, 'time', e.target.value)}
                    required
                    className="px-2 py-1.5 rounded-lg border border-stone bg-white text-sm font-medium text-charcoal"
                  />
                  <input
                    type="text"
                    value={sched.label || ''}
                    onChange={e => handleScheduleChange(idx, 'label', e.target.value)}
                    placeholder="Routine label (e.g. Morning, Bedtime)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone bg-white text-xs text-charcoal"
                  />
                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSchedule(idx)}
                      className="p-1.5 text-charcoal-muted hover:text-terracotta"
                      aria-label="Remove schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
              {isSubmitting ? 'Saving...' : medicationToEdit ? 'Update Prescription' : 'Save Prescription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
