import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { NoCircleOnboarding } from '@/components/care-circle/NoCircleOnboarding';

export const AuthRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading, isLoading, careProfile, careProfiles, isDemoMode } = useCare();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-3 border-forest/20 border-t-forest rounded-full animate-spin" />
        <span className="text-sm font-serif text-charcoal-muted tracking-wide">
          Verifying security session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated in real production mode (not demo mode) but has not yet joined or created any care circle
  const isDemo = isDemoMode || (typeof window !== 'undefined' && localStorage.getItem('carecircle_demo_mode') === 'true');
  if (!isDemo && !isLoading && (!careProfile || careProfiles.length === 0)) {
    return <NoCircleOnboarding />;
  }

  return <>{children}</>;
};
