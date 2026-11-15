import React, { useState, useRef, useEffect } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Users, ChevronDown, Check, Plus } from 'lucide-react';

interface CareCircleSwitcherProps {
  onOpenCreate?: () => void;
}

export const CareCircleSwitcher: React.FC<CareCircleSwitcherProps> = ({ onOpenCreate }) => {
  const { careProfiles, careProfile, selectCareProfile } = useCare();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!careProfiles || careProfiles.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
          Care Profile:
        </span>
        <span className="font-serif text-forest text-base font-medium">
          {careProfile?.full_name || 'Margaret Hayes'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone bg-white text-xs font-medium text-charcoal hover:bg-stone-light shadow-warm-xs transition-colors cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Users className="w-3.5 h-3.5 text-forest" />
        <span className="font-serif text-sm font-semibold text-forest">
          {careProfile?.full_name || 'Select Circle'}
        </span>
        <span className="text-[10px] bg-stone px-1.5 py-0.2 rounded-full text-charcoal-muted font-bold">
          {careProfiles.length}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-charcoal-muted" />
      </button>

      {isOpen && (
        <div className="origin-top-left absolute left-0 mt-1 w-64 rounded-xl shadow-warm-lg bg-white border border-stone ring-1 ring-black/5 divide-y divide-stone z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2">
            <span className="block px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">
              Switch Care Circle
            </span>
            {careProfiles.map(p => {
              const isSelected = p.id === careProfile?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    selectCareProfile(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-forest/10 font-bold text-forest' : 'text-charcoal hover:bg-stone/50'
                  }`}
                >
                  <div className="truncate">
                    <span className="block truncate font-serif text-sm">
                      {p.full_name}
                    </span>
                    <span className="block text-[10px] text-charcoal-muted">
                      {p.timezone}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-forest shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {onOpenCreate && (
            <div className="p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreate();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 text-forest font-bold hover:bg-forest/5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add / Join Care Circle</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
