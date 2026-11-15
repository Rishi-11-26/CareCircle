import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CareProvider } from '@/contexts/CareContext';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleRouteGuard } from '@/components/auth/RoleRouteGuard';
import { AuthRouteGuard } from '@/components/auth/AuthRouteGuard';

// Lazy-loaded route views for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })));
const MedicationsPage = lazy(() => import('@/pages/MedicationsPage').then(m => ({ default: m.MedicationsPage })));
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const CareCirclePage = lazy(() => import('@/pages/CareCirclePage').then(m => ({ default: m.CareCirclePage })));
const CareIntelligencePage = lazy(() => import('@/pages/CareIntelligencePage').then(m => ({ default: m.CareIntelligencePage })));
const TimelinePage = lazy(() => import('@/pages/TimelinePage').then(m => ({ default: m.TimelinePage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Lazy-loaded Authentication routes
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/SignupPage').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="w-8 h-8 border-3 border-forest/20 border-t-forest rounded-full animate-spin" />
    <span className="text-xs font-serif text-charcoal-muted tracking-wide">
      Loading CareCircle...
    </span>
  </div>
);

export const App: React.FC = () => {
  return (
    <CareProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppLayout>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Authentication & Marketing Routes */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected Clinical Routes */}
                <Route
                  path="/"
                  element={
                    <AuthRouteGuard>
                      <DashboardPage />
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/medications"
                  element={
                    <AuthRouteGuard>
                      <MedicationsPage />
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <AuthRouteGuard>
                      <AppointmentsPage />
                    </AuthRouteGuard>
                  }
                />

                {/* Family-Only Administrative Routes */}
                <Route
                  path="/care-circle"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family']}>
                        <CareCirclePage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />

                {/* Family & Caregiver Collaborative Clinical Routes */}
                <Route
                  path="/intelligence"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                        <CareIntelligencePage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/timeline"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                        <TimelinePage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                        <NotificationsPage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                        <AnalyticsPage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <AuthRouteGuard>
                      <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                        <SettingsPage />
                      </RoleRouteGuard>
                    </AuthRouteGuard>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </BrowserRouter>
      </AccessibilityProvider>
    </CareProvider>
  );
};

export default App;
