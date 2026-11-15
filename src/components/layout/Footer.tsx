import React from 'react';
import { Heart, ShieldCheck, Accessibility } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-cream-light border-t border-stone mt-16 py-8 px-4 text-sm text-charcoal-muted">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-forest font-serif text-lg font-bold">
              <span>CareCircle</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-forest/10 font-sans font-medium text-forest">
                Elderly Care & Medication Management
              </span>
            </div>
            <p className="text-xs text-charcoal-muted max-w-xl">
              Connected care ecosystem designed to help elderly individuals manage their health routines while keeping authorized family members and caretakers informed.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-forest font-medium">
              <ShieldCheck className="w-4 h-4 text-forest" />
              Passcode Protected Circle
            </span>
            <span className="inline-flex items-center gap-1.5 text-forest font-medium">
              <Accessibility className="w-4 h-4 text-forest" />
              WCAG 2.2 AA Accessible
            </span>
          </div>
        </div>

        {/* Essential Non-Medical Disclaimer Guardrail */}
        <div className="p-3.5 rounded-xl bg-ivory border border-stone text-xs text-charcoal-light leading-relaxed">
          <strong className="text-forest font-semibold">Important Medical Guardrail: </strong>
          CareCircle is a collaborative care coordination tool and does not provide medical diagnoses, treatment recommendations, or emergency response dispatch. Dose schedules and doctor visits are managed under the direction of licensed healthcare professionals. In case of a medical emergency, immediately contact local emergency services.
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-charcoal-muted pt-2 border-t border-stone/50">
          <span>&copy; {new Date().getFullYear()} CareCircle. All rights reserved.</span>
          <span>Designed with Warm Editorial Healthcare Aesthetics</span>
        </div>
      </div>
    </footer>
  );
};
