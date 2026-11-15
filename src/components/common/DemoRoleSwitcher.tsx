import React, { useState, useEffect } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Sparkles, ChevronDown, ChevronUp, EyeOff } from 'lucide-react';

export const DemoRoleSwitcher: React.FC = () => {
  const { currentUser, switchRole, isDemoMode } = useCare();
  // Collapsed by default as required
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if production mode is active (via URL param, localStorage flag, or Vite demo flag)
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const isProdParam = searchParams.get('mode') === 'production' || searchParams.get('prod') === 'true';
      const isProdStorage = localStorage.getItem('carecircle_production_mode') === 'true';
      const isDemoDisabled = import.meta.env.VITE_DEMO_MODE === 'false';

      if (isProdParam || isProdStorage || isDemoDisabled) {
        setIsProduction(true);
      }
    } catch {
      // Default to demo if window is not available
    }
  }, []);

  // Completely absent in production mode, if disabled, or if dismissed by evaluator
  if (isProduction || isDismissed || !isDemoMode) {
    return null;
  }

  // Collapsed Mode: Small, unobtrusive floating launcher
  if (isCollapsed) {
    return (
      <aside
        aria-label="Demo mode role switcher"
        className="fixed bottom-3 right-3 z-30 print:hidden transition-all duration-200"
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-charcoal/90 hover:bg-charcoal text-ivory text-xs font-semibold shadow-warm-md border border-white/20 transition-all cursor-pointer opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-forest"
          aria-label="Open Demo Role Switcher"
          title="Click to switch simulated demo roles (Margaret, David, Elena)"
        >
          <Sparkles className="w-3.5 h-3.5 text-sage-light shrink-0" />
          <span className="font-sans">Demo Mode ({(currentUser?.full_name || 'User').split(' ')[0]})</span>
          <ChevronUp className="w-3 h-3 text-ivory/70 shrink-0" />
        </button>
      </aside>
    );
  }

  // Expanded Mode: Clean, non-intrusive modal dock
  return (
    <aside
      aria-label="Demo mode role switcher"
      className="fixed bottom-3 right-3 z-30 print:hidden transition-all duration-200"
    >
      <div className="bg-charcoal/95 backdrop-blur-md text-ivory border border-stone-dark/50 rounded-2xl shadow-2xl p-3 max-w-sm w-80 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between gap-3 px-1 pb-1.5 border-b border-white/10 text-xs">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-sage-light">
            <Sparkles className="w-3.5 h-3.5 text-terracotta-light" />
            <span>Demo Mode</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-ivory/70 hover:text-ivory rounded hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Collapse role simulator"
              title="Collapse dock"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-ivory/70 hover:text-ivory rounded hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Hide role simulator for this session"
              title="Hide for this session (simulates production mode)"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <p className="text-[11px] text-ivory/70 px-1 leading-snug">
            Simulate role personas in Demo Mode:
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => switchRole('elderly')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                currentUser.role === 'elderly'
                  ? 'bg-forest text-ivory ring-2 ring-sage-light shadow-warm-sm'
                  : 'bg-white/10 hover:bg-white/20 text-ivory/80'
              }`}
              title="Switch to Margaret Hayes (Elderly profile owner)"
            >
              👵 Margaret
              <span className="block text-[9px] font-normal opacity-75">Elderly</span>
            </button>

            <button
              onClick={() => switchRole('family')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                currentUser.role === 'family'
                  ? 'bg-forest text-ivory ring-2 ring-sage-light shadow-warm-sm'
                  : 'bg-white/10 hover:bg-white/20 text-ivory/80'
              }`}
              title="Switch to David Hayes (Family circle member)"
            >
              👨‍👧 David
              <span className="block text-[9px] font-normal opacity-75">Family</span>
            </button>

            <button
              onClick={() => switchRole('caretaker')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                currentUser.role === 'caretaker'
                  ? 'bg-forest text-ivory ring-2 ring-sage-light shadow-warm-sm'
                  : 'bg-white/10 hover:bg-white/20 text-ivory/80'
              }`}
              title="Switch to Elena Rostova (Registered Caregiver)"
            >
              🩺 Elena
              <span className="block text-[9px] font-normal opacity-75">Nurse</span>
            </button>
          </div>

          <div className="pt-1 flex items-center justify-between text-[10px] text-ivory/50 px-1 border-t border-white/5">
            <span>Active role: <strong className="text-sage-light">{currentUser.role}</strong></span>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-sage-light hover:underline cursor-pointer"
            >
              Collapse dock
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
