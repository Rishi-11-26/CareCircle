import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilityContextType {
  largePrintMode: boolean;
  toggleLargePrintMode: () => void;
  setLargePrintMode: (enabled: boolean) => void;
}

const STORAGE_KEY = 'carecircle_large_print_mode';

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [largePrintMode, setLargePrintState] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(STORAGE_KEY) === 'true';
      }
    } catch {
      // Fallback for private browsing or restricted environments
    }
    return false;
  });

  const applyLargePrint = useCallback((enabled: boolean) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (enabled) {
        root.setAttribute('data-large-print', 'true');
        document.body?.classList.add('large-print-active');
      } else {
        root.removeAttribute('data-large-print');
        document.body?.classList.remove('large-print-active');
      }
    }
  }, []);

  // Sync with document element on mount and when largePrintMode changes
  useEffect(() => {
    applyLargePrint(largePrintMode);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, largePrintMode ? 'true' : 'false');
      }
    } catch {
      // Ignore storage errors
    }
  }, [largePrintMode, applyLargePrint]);

  const toggleLargePrintMode = useCallback(() => {
    setLargePrintState(prev => !prev);
  }, []);

  const setLargePrintMode = useCallback((enabled: boolean) => {
    setLargePrintState(enabled);
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        largePrintMode,
        toggleLargePrintMode,
        setLargePrintMode,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    return {
      largePrintMode: false,
      toggleLargePrintMode: () => {},
      setLargePrintMode: () => {},
    };
  }
  return context;
};
