import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CareProvider } from '@/contexts/CareContext';
import { AppLayout } from '@/components/layout/AppLayout';

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
      <BrowserRouter>
        <AppLayout>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/medications" element={<MedicationsPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/care-circle" element={<CareCirclePage />} />
              <Route path="/intelligence" element={<CareIntelligencePage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </CareProvider>
  );
};

export default App;
