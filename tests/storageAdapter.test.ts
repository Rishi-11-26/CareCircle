import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, generateSeedData } from '@/services/storageAdapter';

describe('Storage Data Service & Workflows', () => {
  beforeEach(() => {
    dataService.resetToDemoSeed();
  });

  it('prevents duplicate dose confirmations idempotently', async () => {
    const seed = generateSeedData();
    const result1 = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: seed.medications[0].id,
      scheduledDate: '2026-03-10',
      scheduledTime: '08:00',
      status: 'taken',
      actorName: 'Margaret Hayes',
      actorRole: 'elderly',
    });

    expect(result1.success).toBe(true);
    expect(result1.alreadyConfirmed).toBe(false);

    // Attempt confirming the exact same dose again
    const result2 = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: seed.medications[0].id,
      scheduledDate: '2026-03-10',
      scheduledTime: '08:00',
      status: 'taken',
      actorName: 'Margaret Hayes',
      actorRole: 'elderly',
    });

    expect(result2.success).toBe(true);
    expect(result2.alreadyConfirmed).toBe(true); // Duplicate safely intercepted!
  });

  it('allows invitation creation and verification through cryptographic hash', async () => {
    const seed = generateSeedData();
    const invite = await dataService.createInvitation({
      careProfileId: seed.careProfile.id,
      role: 'family',
      passcode: 'CARE-9999',
      inviterId: seed.elderlyUser.id,
    });

    expect(invite.id).toBeDefined();
    expect(invite.status).toBe('pending');
    expect(invite.code_hint).toBe('CARE-***');

    const newUser = {
      id: 'user_alex',
      email: 'alex@example.org',
      full_name: 'Alex Hayes',
      role: 'family' as const,
    };

    // Redeem with wrong passcode should fail
    const failResult = await dataService.redeemInvitation('CARE-0000', newUser);
    expect(failResult.success).toBe(false);

    // Redeem with valid passcode should succeed
    const successResult = await dataService.redeemInvitation('CARE-9999', newUser);
    expect(successResult.success).toBe(true);
    expect(successResult.careProfileId).toBe(seed.careProfile.id);

    // Re-redeeming already redeemed code should fail
    const secondRedeem = await dataService.redeemInvitation('CARE-9999', newUser);
    expect(secondRedeem.success).toBe(false);
  });

  it('records caregiver acknowledgement of escalation alert and logs to activity timeline', async () => {
    const seed = generateSeedData();
    const notifs = await dataService.getNotifications(seed.careProfile.id);
    expect(notifs.length).toBeGreaterThan(0);

    const targetNotif = notifs[0];
    const ackResult = await dataService.acknowledgeNotification(
      targetNotif.id,
      seed.caretakerUser.id,
      seed.caretakerUser.full_name,
      seed.caretakerUser.role,
      'Called Margaret, confirmed she took it during morning tea.'
    );

    expect(ackResult).toBe(true);

    const updatedNotifs = await dataService.getNotifications(seed.careProfile.id);
    const updated = updatedNotifs.find(n => n.id === targetNotif.id);
    expect(updated?.status).toBe('acknowledged');
    expect(updated?.metadata?.acknowledgement_note).toContain('Called Margaret');

    const activity = await dataService.getActivityLogs(seed.careProfile.id);
    const ackLog = activity.find(a => a.activity_type === 'alert_acknowledged');
    expect(ackLog).toBeDefined();
    expect(ackLog?.description).toContain('acknowledged follow-up alert');
  });
});
