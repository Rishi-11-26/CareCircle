import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CareProvider, useCare } from '../src/contexts/CareContext';
import { AuthRouteGuard } from '../src/components/auth/AuthRouteGuard';
import { LoginPage } from '../src/pages/LoginPage';
import { SignupPage } from '../src/pages/SignupPage';
import { ForgotPasswordPage } from '../src/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../src/pages/ResetPasswordPage';
import { signUpUser, signInUser, signOutUser, requestPasswordReset, updateUserPassword } from '../src/lib/supabase';

// Mock Supabase client module for tests
vi.mock('../src/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    signUpUser: vi.fn(async (params) => {
      if (!params.email || !params.password) {
        return { user: null, session: null, error: 'Email and password required' };
      }
      return {
        user: { id: 'test-user-id-uuid', email: params.email },
        session: { access_token: 'fake-token' },
        error: null,
      };
    }),
    signInUser: vi.fn(async (email, password) => {
      if (password === 'wrong') {
        return { user: null, session: null, error: 'Invalid login credentials' };
      }
      return {
        user: { id: 'test-user-id-uuid', email },
        session: { access_token: 'fake-token' },
        error: null,
      };
    }),
    signOutUser: vi.fn(async () => ({ error: null })),
    requestPasswordReset: vi.fn(async (email) => {
      if (!email.includes('@')) {
        return { error: 'Invalid email address' };
      }
      return { error: null };
    }),
    updateUserPassword: vi.fn(async (newPassword) => {
      if (newPassword.length < 6) {
        return { error: 'Password too short' };
      }
      return { error: null };
    }),
    fetchUserProfile: vi.fn(async (userId) => ({
      id: userId,
      email: 'david@example.com',
      full_name: 'David Hayes',
      role: 'family',
      timezone: 'America/Los_Angeles',
      created_at: new Date().toISOString(),
    })),
  };
});

describe('Supabase Authentication & Session Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Supabase Auth Helper Functions', () => {
    it('signUpUser returns user and session on valid payload', async () => {
      const res = await signUpUser({
        email: 'TEST@EXAMPLE.COM',
        password: 'securePassword123!',
        fullName: 'Test User',
        role: 'family',
        timezone: 'America/Los_Angeles',
      });

      expect(res.user).toBeDefined();
      expect(res.user?.id).toBe('test-user-id-uuid');
      expect(res.error).toBeNull();
    });

    it('signInUser succeeds with valid credentials and fails on invalid password', async () => {
      const successRes = await signInUser('david@example.com', 'correctPassword');
      expect(successRes.user).toBeDefined();
      expect(successRes.error).toBeNull();

      const failRes = await signInUser('david@example.com', 'wrong');
      expect(failRes.user).toBeNull();
      expect(failRes.error).toBe('Invalid login credentials');
    });

    it('requestPasswordReset validates email and issues recovery request', async () => {
      const validRes = await requestPasswordReset('family@example.com');
      expect(validRes.error).toBeNull();

      const invalidRes = await requestPasswordReset('not-an-email');
      expect(invalidRes.error).toBe('Invalid email address');
    });

    it('updateUserPassword checks password length', async () => {
      const validRes = await updateUserPassword('newSecretPassword123');
      expect(validRes.error).toBeNull();

      const shortRes = await updateUserPassword('123');
      expect(shortRes.error).toBe('Password too short');
    });
  });

  describe('2. Authentication UI Pages & Accessibility', () => {
    it('LoginPage renders accessible inputs and handles valid submission', async () => {
      render(
        <CareProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div data-testid="dashboard-view">Dashboard</div>} />
            </Routes>
          </MemoryRouter>
        </CareProvider>
      );

      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByText(/Explore Demo Mode/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'david@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^Password/i), {
        target: { value: 'validPassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(signInUser).toHaveBeenCalledWith('david@example.com', 'validPassword123');
      });
    });

    it('SignupPage renders role and timezone selectors and registers user', async () => {
      render(
        <CareProvider>
          <MemoryRouter initialEntries={['/signup']}>
            <Routes>
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/" element={<div>Dashboard</div>} />
            </Routes>
          </MemoryRouter>
        </CareProvider>
      );

      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Timezone/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: 'Elena Rostova' },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'elena@carepartners.org' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'nursePassword456' },
      });

      // Select Caregiver / Nurse role
      const caretakerRoleBtn = screen.getByText(/Caregiver \/ Nurse/i);
      fireEvent.click(caretakerRoleBtn);

      fireEvent.click(screen.getByRole('button', { name: /Register Account/i }));

      await waitFor(() => {
        expect(signUpUser).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'Elena Rostova',
            email: 'elena@carepartners.org',
            password: 'nursePassword456',
            role: 'caretaker',
          })
        );
      });
    });

    it('ForgotPasswordPage displays confirmation message upon email submission', async () => {
      render(
        <CareProvider>
          <MemoryRouter initialEntries={['/forgot-password']}>
            <ForgotPasswordPage />
          </MemoryRouter>
        </CareProvider>
      );

      const emailInput = screen.getByLabelText(/Registered Email Address/i);
      fireEvent.change(emailInput, { target: { value: 'david@example.com' } });

      fireEvent.click(screen.getByRole('button', { name: /Send Reset Instructions/i }));

      await waitFor(() => {
        expect(requestPasswordReset).toHaveBeenCalledWith('david@example.com');
        expect(screen.getByText(/Reset Link Sent/i)).toBeInTheDocument();
      });
    });

    it('ResetPasswordPage validates password match and submits new password', async () => {
      render(
        <CareProvider>
          <MemoryRouter initialEntries={['/reset-password']}>
            <ResetPasswordPage />
          </MemoryRouter>
        </CareProvider>
      );

      const newPassInput = screen.getByLabelText(/^New Password/i);
      const confirmPassInput = screen.getByLabelText(/^Confirm New Password/i);

      // Mismatched passwords
      fireEvent.change(newPassInput, { target: { value: 'passwordA123' } });
      fireEvent.change(confirmPassInput, { target: { value: 'passwordB999' } });
      fireEvent.click(screen.getByRole('button', { name: /Save New Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      });

      // Matching passwords
      fireEvent.change(confirmPassInput, { target: { value: 'passwordA123' } });
      fireEvent.click(screen.getByRole('button', { name: /Save New Password/i }));

      await waitFor(() => {
        expect(updateUserPassword).toHaveBeenCalledWith('passwordA123');
        expect(screen.getByText(/Password Updated!/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Multi-Circle Switching & Care Profile Operations', () => {
    const TestCircleConsumer = () => {
      const { careProfiles, careProfile, selectCareProfile, createCareProfile } = useCare();
      return (
        <div>
          <span data-testid="active-profile-name">{careProfile?.full_name}</span>
          <span data-testid="circle-count">{careProfiles.length}</span>
          <button
            onClick={() =>
              createCareProfile({
                fullName: 'Robert Hayes',
                timezone: 'America/Los_Angeles',
              })
            }
          >
            Create Second Circle
          </button>
          {careProfiles.map((p) => (
            <button key={p.id} onClick={() => selectCareProfile(p.id)}>
              Switch to {p.full_name}
            </button>
          ))}
        </div>
      );
    };

    it('allows creating and switching between multiple care circles', async () => {
      render(
        <CareProvider>
          <TestCircleConsumer />
        </CareProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('active-profile-name')).toHaveTextContent('Margaret Hayes');
      });

      // Create a second profile
      fireEvent.click(screen.getByText(/Create Second Circle/i));

      await waitFor(() => {
        expect(screen.getByTestId('circle-count')).toHaveTextContent('2');
        expect(screen.getByTestId('active-profile-name')).toHaveTextContent('Robert Hayes');
      });

      // Switch back to Margaret
      fireEvent.click(screen.getByText(/Switch to Margaret Hayes/i));

      await waitFor(() => {
        expect(screen.getByTestId('active-profile-name')).toHaveTextContent('Margaret Hayes');
      });
    });
  });

  describe('4. AuthRouteGuard Behavior', () => {
    it('renders protected child component when authenticated', async () => {
      render(
        <CareProvider>
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route
                path="/protected"
                element={
                  <AuthRouteGuard>
                    <div data-testid="protected-content">Secret Medical Data</div>
                  </AuthRouteGuard>
                }
              />
            </Routes>
          </MemoryRouter>
        </CareProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });
});
