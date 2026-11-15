import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Medication } from '@/types';
import { MedicationModal } from '@/components/medications/MedicationModal';
import {
  Pill,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export const MedicationsPage: React.FC = () => {
  const { medications, deleteMedication, currentUser } = useCare();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage =
    currentUser.role === 'elderly' || currentUser.role === 'caretaker';

  const handleEdit = (med: Medication) => {
    setEditingMed(med);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingMed(undefined);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to discontinue this medication? Historical dose logs will be preserved.')) {
      setDeletingId(id);
      try {
        await deleteMedication(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
            Prescription Medications
          </h1>
          <p className="text-sm text-charcoal-light mt-1">
            Active medication schedules, dosage instructions, and upcoming refill alerts.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest text-ivory text-sm font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        )}
      </div>

      {/* Medication List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {medications.map(med => {
          let refillDaysLeft: number | null = null;
          if (med.refill_date) {
            refillDaysLeft = differenceInDays(new Date(med.refill_date), new Date());
          }

          return (
            <div
              key={med.id}
              className="bg-white border border-stone rounded-2xl p-6 shadow-warm-sm flex flex-col justify-between space-y-4 hover:shadow-warm transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone text-forest capitalize">
                      {med.form}
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-charcoal mt-1.5">
                      {med.name}
                    </h3>
                    <p className="text-sm font-semibold text-forest">
                      {med.dosage}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(med)}
                        className="p-2 text-charcoal-muted hover:text-forest hover:bg-stone-light rounded-lg transition-colors"
                        aria-label={`Edit ${med.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(med.id)}
                        disabled={deletingId === med.id}
                        className="p-2 text-charcoal-muted hover:text-terracotta hover:bg-stone-light rounded-lg transition-colors"
                        aria-label={`Discontinue ${med.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {med.instructions && (
                  <p className="text-xs text-charcoal-light bg-cream-light p-3 rounded-xl border border-stone/60">
                    <strong className="text-forest">Instructions: </strong>
                    {med.instructions}
                  </p>
                )}

                {/* Scheduled Times */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-charcoal uppercase tracking-wider block">
                    Daily Schedule:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {med.schedules && med.schedules.length > 0 ? (
                      med.schedules.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest/5 border border-forest/20 text-forest text-xs font-semibold"
                        >
                          <Clock className="w-3 h-3" />
                          {s.time_of_day} {s.label ? `(${s.label})` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-charcoal-muted">No scheduled times set.</span>
                    )}
                  </div>
                </div>

                {/* Physician & Rx */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone/50">
                  <div>
                    <span className="text-charcoal-muted block">Prescribing Doctor:</span>
                    <span className="font-semibold text-charcoal">
                      {med.prescribing_doctor || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-charcoal-muted block">Rx Number:</span>
                    <span className="font-mono text-charcoal font-semibold">
                      {med.rx_number || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Refill status */}
              {med.refill_date && (
                <div className="pt-3 border-t border-stone/50 flex items-center justify-between text-xs">
                  <span className="text-charcoal-muted flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-forest" />
                    Refill Target: {med.refill_date}
                  </span>
                  {refillDaysLeft !== null && refillDaysLeft <= 14 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-terracotta-dark bg-terracotta/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Refill in {refillDaysLeft} days
                    </span>
                  ) : (
                    <span className="text-forest font-semibold">Supply Adequate</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <MedicationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingMed(undefined);
          }}
          medicationToEdit={editingMed}
        />
      )}
    </div>
  );
};
