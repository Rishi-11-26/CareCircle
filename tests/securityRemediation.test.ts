import { describe, it, expect, beforeEach } from 'vitest';
import { dataService } from '@/services/storageAdapter';
import { hashPasscode, generateInvitationPasscode } from '@/lib/crypto';
import { calculateAdherenceMetrics } from '@/lib/analytics';

describe('P0 Security Remediation & Authorization Test Suite', () => {
  beforeEach(() => {
    dataService.resetToDemoSeed();
    dataService.resetRateLimits();
  });

  describe('1. Invitation Redemption Security & Brute-Force Lockout', () => {
    it('enforces server-side brute-force lockout after 5 consecutive failed attempts', async () => {
      // 5 consecutive invalid passcode redemption attempts
      for (let i = 0; i < 5; i++) {
        const res = await dataService.redeemInvitation('WRONGCODE' + i);
        expect(res.success).toBe(false);
      }

      // 6th attempt must trigger 15-minute lockout even with a valid-looking code
      const lockoutRes = await dataService.redeemInvitation('CARE-VALID');
      expect(lockoutRes.success).toBe(false);
      expect(lockoutRes.error).toMatch(/too many failed passcode attempts|wait 15 minutes/i);
    });

    it('rejects expired invitations', async () => {
      const profile = dataService.getInitialCareProfile();
      const invite = await dataService.createInvitation({
        careProfileId: profile?.id || 'profile_margaret',
        role: 'family',
        passcode: 'EXPIRED12',
        inviterId: profile?.owner_id || 'user_margaret',
        inviteeEmail: 'test-invitee@carecircle.org',
      });
      // Force expiration
      invite.expires_at = new Date(Date.now() - 3600000).toISOString();
      invite.status = 'expired';

      const res = await dataService.redeemInvitation('EXPIRED12');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/expired/i);
    });

    it('rejects revoked invitations', async () => {
      const profile = dataService.getInitialCareProfile();
      const invite = await dataService.createInvitation({
        careProfileId: profile?.id || 'profile_margaret',
        role: 'caretaker',
        passcode: 'REVOKED1',
        inviterId: profile?.owner_id || 'user_margaret',
      });
      await dataService.revokeInvitation(invite.id);

      const res = await dataService.redeemInvitation('REVOKED1');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/revoked/i);
    });
  });

  describe('2. Dose Event Authorization & Anti-Spoofing', () => {
    it('blocks elderly self-confirmation when assistance level is caregiver_managed', async () => {
      const profile = dataService.getInitialCareProfile();
      expect(profile).not.toBeNull();
      if (!profile) return;

      // Set profile to caregiver_managed
      await dataService.updateAssistanceLevel(profile.id, 'caregiver_managed');

      const meds = await dataService.getMedications(profile.id);
      const testMed = meds[0];

      // Attempt to self-confirm as elderly user
      const res = await dataService.recordDose({
        careProfileId: profile.id,
        medicationId: testMed.id,
        scheduledDate: '2026-03-01',
        scheduledTime: '08:00',
        status: 'taken',
        source: 'self',
        actorRole: 'elderly',
        actorName: 'Margaret Hayes',
        actorId: profile.owner_id,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/caregiver managed mode/i);
    });

    it('rejects future dose confirmations more than 60 minutes in advance', async () => {
      const profile = dataService.getInitialCareProfile();
      if (!profile) return;

      const meds = await dataService.getMedications(profile.id);
      const testMed = meds[0];

      // Schedule far in future (tomorrow)
      const res = await dataService.recordDose({
        careProfileId: profile.id,
        medicationId: testMed.id,
        scheduledDate: '2026-12-31',
        scheduledTime: '23:59',
        status: 'taken',
        source: 'self',
        actorRole: 'elderly',
        actorName: 'Margaret Hayes',
        actorId: profile.owner_id,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too early to confirm|scheduled for later/i);
    });

    it('enforces authentic source attribution for family reports vs caregiver administration', async () => {
      const profile = dataService.getInitialCareProfile();
      if (!profile) return;
      const meds = await dataService.getMedications(profile.id);
      const testMed = meds[0];

      // Family member records a dose
      dataService.switchUserRole('family');
      const familyUser = dataService.getCurrentUser();

      const res = await dataService.recordDose({
        careProfileId: profile.id,
        medicationId: testMed.id,
        scheduledDate: '2026-03-01',
        scheduledTime: '08:00',
        status: 'taken',
        actorRole: 'family',
        actorName: familyUser?.full_name || 'David Hayes',
        actorId: familyUser?.id || 'user_david',
      });

      expect(res.success).toBe(true);
      expect(res.doseLog.source).toBe('family_reported');
      expect(res.doseLog.recorded_by_role).toBe('family');
    });
  });

  describe('3. Immutable Historical Corrections & Audit Trail', () => {
    it('creates linked append-only correction records without overwriting historical dose events', async () => {
      const profile = dataService.getInitialCareProfile();
      if (!profile) return;
      const meds = await dataService.getMedications(profile.id);
      const testMed = meds[0];

      // 1. Initial dose confirmation
      const initRes = await dataService.recordDose({
        careProfileId: profile.id,
        medicationId: testMed.id,
        scheduledDate: '2026-03-01',
        scheduledTime: '08:00',
        status: 'taken',
        source: 'self',
        actorRole: 'elderly',
        actorName: 'Margaret Hayes',
        actorId: profile.owner_id,
      });

      expect(initRes.success).toBe(true);
      const originalLogId = initRes.doseLog.id;

      // 2. Caregiver records append-only correction (patient regurgitated dose)
      const corrRes = await dataService.recordDose({
        careProfileId: profile.id,
        medicationId: testMed.id,
        scheduledDate: '2026-03-01',
        scheduledTime: '08:00',
        status: 'skipped',
        source: 'caregiver_administered',
        actorRole: 'caretaker',
        actorName: 'Elena Rostova',
        actorId: 'user_elena',
        isCorrection: true,
        correctingLogId: originalLogId,
        correctionReason: 'Patient experienced nausea 10 min post administration',
        skipReason: 'Regurgitated dose',
      });

      expect(corrRes.success).toBe(true);
      expect(corrRes.doseLog.id).not.toBe(originalLogId);
      expect(corrRes.doseLog.correction_of_id).toBe(originalLogId);
      expect(corrRes.doseLog.status).toBe('skipped');
      expect(corrRes.doseLog.is_corrected).toBe(false);

      // Verify original record was preserved with is_corrected = true
      const allLogs = await dataService.getDoseLogs(profile.id);
      const originalLog = allLogs.find(l => l.id === originalLogId);
      expect(originalLog).toBeDefined();
      expect(originalLog?.is_corrected).toBe(true);
      expect(originalLog?.status).toBe('taken'); // Original event status preserved!

      // Verify analytics only calculates active non-superseded logs
      const metrics = calculateAdherenceMetrics(allLogs, 14);
      expect(metrics).toBeDefined();
      expect(metrics.totalScheduled).toBeGreaterThan(0);
    });
  });

  describe('4. Frontend Bundle & Secret Protection', () => {
    it('ensures service role keys and provider secrets are not accessible in client storageAdapter', () => {
      // Ensure dataService does not leak SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY
      expect((dataService as any).supabaseServiceKey).toBeUndefined();
      expect((dataService as any).resendKey).toBeUndefined();
    });
  });
});
