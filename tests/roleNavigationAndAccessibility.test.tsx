import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CareProvider, useCare } from '@/contexts/CareContext';
import { AccessibilityProvider, useAccessibility } from '@/contexts/AccessibilityContext';
import { Navbar } from '@/components/layout/Navbar';
import { RoleRouteGuard } from '@/components/auth/RoleRouteGuard';
import { DemoRoleSwitcher } from '@/components/common/DemoRoleSwitcher';
import { CallFamilyModal } from '@/components/common/CallFamilyModal';
import { DashboardPage } from '@/pages/DashboardPage';
import { dataService } from '@/services/storageAdapter';

// Test wrapper providing Contexts & Router
const TestNavWrapper = ({ initialRoute = '/', role = 'elderly' }: { initialRoute?: string; role?: 'elderly' | 'family' | 'caretaker' }) => {
  dataService.switchUserRole(role);
  return (
    <CareProvider>
      <AccessibilityProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Navbar />
          <Routes>
            <Route path="/" element={<div data-testid="page-home">Home Page</div>} />
            <Route path="/medications" element={<div data-testid="page-meds">Medications Page</div>} />
            <Route path="/appointments" element={<div data-testid="page-apts">Appointments Page</div>} />
            <Route
              path="/care-circle"
              element={
                <RoleRouteGuard allowedRoles={['family']}>
                  <div data-testid="page-care-circle">Care Circle Admin</div>
                </RoleRouteGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RoleRouteGuard allowedRoles={['family', 'caretaker']}>
                  <div data-testid="page-settings">Settings Page</div>
                </RoleRouteGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      </AccessibilityProvider>
    </CareProvider>
  );
};

describe('Role-Based Navigation & Accessibility Suite', () => {
  beforeEach(() => {
    dataService.resetToDemoSeed();
    localStorage.clear();
    document.documentElement.removeAttribute('data-large-print');
    document.body.classList.remove('large-print-active');
  });

  it('renders ONLY 4 primary destinations for Margaret (elderly role) and omits advanced navigation', () => {
    render(<TestNavWrapper role="elderly" />);

    // Margaret's 4 primary destinations
    expect(screen.getAllByRole('link', { name: /home/i })[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my medicines/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /doctor visits/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /call family/i })[0]).toBeInTheDocument();

    // Advanced admin links MUST be completely absent
    expect(screen.queryByRole('link', { name: /care circle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /care intelligence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /adherence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();

    // Production role simulator must NOT be inside the elderly navigation
    expect(screen.queryByText(/Simulate Role:/i)).not.toBeInTheDocument();
  });

  it('renders complete clinical & management navigation for David (family role)', () => {
    render(<TestNavWrapper role="family" />);

    // Family member retains full navigation
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /medications/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /care circle/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /care intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /adherence/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('blocks elderly direct URL access to administrative routes via RoleRouteGuard', () => {
    // Attempting direct URL access to /care-circle as elderly user
    render(<TestNavWrapper initialRoute="/care-circle" role="elderly" />);

    expect(screen.queryByTestId('page-care-circle')).not.toBeInTheDocument();
    expect(screen.getByText(/Simplified Care View/i)).toBeInTheDocument();
    expect(screen.getByText(/This section is managed by your family and care team/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to my home/i })).toBeInTheDocument();
  });

  it('permits family member access to administrative routes', () => {
    render(<TestNavWrapper initialRoute="/care-circle" role="family" />);

    expect(screen.getByTestId('page-care-circle')).toBeInTheDocument();
  });

  it('toggles Large Print Mode, updates DOM data attribute, label, and persists in localStorage', () => {
    render(<TestNavWrapper role="elderly" />);

    const toggleBtn = screen.getByRole('button', { name: /large print mode/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.getAttribute('data-large-print')).toBeNull();

    // Click to enable Large Print Mode
    fireEvent.click(toggleBtn);

    expect(document.documentElement.getAttribute('data-large-print')).toBe('true');
    expect(document.body.classList.contains('large-print-active')).toBe(true);
    expect(localStorage.getItem('carecircle_large_print_mode')).toBe('true');
    expect(screen.getByText(/Standard Text Mode/i)).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // Click again to restore Standard Mode
    fireEvent.click(toggleBtn);

    expect(document.documentElement.getAttribute('data-large-print')).toBeNull();
    expect(document.body.classList.contains('large-print-active')).toBe(false);
    expect(localStorage.getItem('carecircle_large_print_mode')).toBe('false');
    expect(screen.getByText(/Large Print Mode/i)).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders Demo Evaluator Dock collapsed by default and expands on click', () => {
    dataService.switchUserRole('elderly');
    render(
      <CareProvider>
        <DemoRoleSwitcher />
      </CareProvider>
    );

    // Collapsed launcher is present by default
    const launcherBtn = screen.getByRole('button', { name: /open demo evaluator persona switcher/i });
    expect(launcherBtn).toBeInTheDocument();
    expect(screen.getByText(/Demo Switcher \(Margaret\)/i)).toBeInTheDocument();

    // Expanded role buttons are not yet visible
    expect(screen.queryByTitle(/switch to david hayes/i)).not.toBeInTheDocument();

    // Click to expand dock
    fireEvent.click(launcherBtn);

    // Expanded controls are now visible
    expect(screen.getByTitle(/switch to david hayes/i)).toBeInTheDocument();
    expect(screen.getByTitle(/switch to elena rostova/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collapse role simulator/i })).toBeInTheDocument();

    // Collapse dock again
    fireEvent.click(screen.getByRole('button', { name: /collapse role simulator/i }));
    expect(screen.queryByTitle(/switch to david hayes/i)).not.toBeInTheDocument();
  });

  it('completely hides Demo Evaluator Dock in production mode', () => {
    localStorage.setItem('carecircle_production_mode', 'true');
    dataService.switchUserRole('elderly');

    render(
      <CareProvider>
        <DemoRoleSwitcher />
      </CareProvider>
    );

    // Completely absent in production
    expect(screen.queryByRole('button', { name: /open demo evaluator persona switcher/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo Switcher/i)).not.toBeInTheDocument();
  });

  it('ensures exactly one Large Print toggle exists on elderly home (no duplicate in greeting)', () => {
    dataService.switchUserRole('elderly');
    render(
      <CareProvider>
        <AccessibilityProvider>
          <MemoryRouter>
            <Navbar />
            <DashboardPage />
          </MemoryRouter>
        </AccessibilityProvider>
      </CareProvider>
    );

    // Exactly one toggle button labeled "Large Print Mode" in the entire document
    const buttons = screen.getAllByRole('button', { name: /large print mode/i });
    expect(buttons).toHaveLength(1);
  });

  it('opens Call Family modal and handles configured vs missing phone gracefully', () => {
    // 1. With configured emergency contact
    const { rerender } = render(
      <CareProvider>
        <CallFamilyModal isOpen={true} onClose={() => {}} />
      </CareProvider>
    );

    expect(screen.getByText(/Primary Emergency Contact/i)).toBeInTheDocument();
    expect(screen.getByText(/David Hayes/i)).toBeInTheDocument();
    expect(screen.getByText(/Call David Now/i)).toBeInTheDocument();

    // 2. Missing emergency phone number
    const profile = dataService.getInitialCareProfile();
    if (profile) profile.emergency_phone = '';

    rerender(
      <CareProvider>
        <CallFamilyModal isOpen={true} onClose={() => {}} />
      </CareProvider>
    );

    expect(screen.getByText(/No phone number configured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i understand/i })).toBeInTheDocument();
  });
});
