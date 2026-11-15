import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CareProvider } from '@/contexts/CareContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { LandingPage } from '@/pages/LandingPage';
import { MedicationsPage } from '@/pages/MedicationsPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { CareCirclePage } from '@/pages/CareCirclePage';
import { CareIntelligencePage } from '@/pages/CareIntelligencePage';
import { TimelinePage } from '@/pages/TimelinePage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <CareProvider>
      <BrowserRouter>
        <AppLayout>
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
        </AppLayout>
      </BrowserRouter>
    </CareProvider>
  );
};

export default App;
