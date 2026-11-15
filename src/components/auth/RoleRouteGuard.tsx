import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCare } from '@/contexts/CareContext';
import { UserRole } from '@/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoleRouteGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectPath?: string;
}

export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({
  children,
  allowedRoles,
  redirectPath = '/',
}) => {
  const { currentUser, careProfile } = useCare();
  const location = useLocation();

  const isAllowed = allowedRoles.includes(currentUser.role);

  if (!isAllowed) {
    // If the elderly user navigated to an administrative or analytics page
    if (currentUser.role === 'elderly') {
      return (
        <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-stone rounded-3xl shadow-warm text-center space-y-5 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-forest/10 text-forest mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-forest" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-bold text-forest">
              Simplified Care View
            </h1>
            <p className="text-base text-charcoal-light leading-relaxed">
              This section is managed by your family and care team. Your personal view is kept simple and focused on your daily medications and doctor visits.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-forest hover:bg-forest-light text-ivory text-lg font-bold shadow-warm touch-target-elderly"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to My Home</span>
            </Link>
          </div>
        </div>
      );
    }

    // Otherwise redirect to permitted default path
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
