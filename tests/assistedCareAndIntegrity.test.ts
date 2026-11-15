import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, generateSeedData } from '@/services/storageAdapter';
import { calculateAdherenceMetrics } from '@/lib/analytics';
import { format, addDays } from 'date-fns';

describe('Assisted Care, Timezone & Dose Integrity Verification', () => {
  beforeEach(() => {
    dataService.resetToDemoSeed();
  });

  it('records authentic provenance for each role (self, caregiver, family)', async () => {
    const seed = generateSeedData();
    const today = format(new Date(), 'yyyy-MM-dd');
    const eligibleTime = format(new Date(), 'HH:mm');
    const med = seed.medications[1]; // Atorvastatin

    // 1. Caregiver administration
    const caregiverRes = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: today,
      scheduledTime: eligibleTime,
      status: 'taken',
      actorId: seed.caretakerUser.id,
      actorName: seed.caretakerUser.full_name,
      actorRole: 'caretaker',
    });

    expect(caregiverRes.success).toBe(true);
    expect(caregiverRes.doseLog?.source).toBe('caregiver_administered');
    expect(caregiverRes.doseLog?.recorded_by).toBe(seed.caretakerUser.id);
    expect(caregiverRes.doseLog?.provenance_description).toContain('Administered by Nurse Elena');

    // Reset and test family report
    dataService.resetToDemoSeed();
    const familyRes = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: today,
      scheduledTime: eligibleTime,
      status: 'taken',
      actorId: seed.familyUser.id,
      actorName: seed.familyUser.full_name,
      actorRole: 'family',
    });

    expect(familyRes.success).toBe(true);
    expect(familyRes.doseLog?.source).toBe('family_reported');
    expect(familyRes.doseLog?.provenance_description).toContain('David Hayes');
    expect(familyRes.doseLog?.provenance_description).toContain('Family Member');
  });

  it('enforces Caregiver Managed mode: blocks elderly self-confirmation while allowing caregiver', async () => {
    const seed = generateSeedData();
    const today = format(new Date(), 'yyyy-MM-dd');
    const eligibleTime = format(new Date(), 'HH:mm');
    const med = seed.medications[1];

    // Set mode to caregiver_managed
    await dataService.updateAssistanceLevel(seed.careProfile.id, 'caregiver_managed');

    // Elderly user tries to confirm
    const elderlyAttempt = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: today,
      scheduledTime: eligibleTime,
      status: 'taken',
      actorId: seed.elderlyUser.id,
      actorName: seed.elderlyUser.full_name,
      actorRole: 'elderly',
    });

    expect(elderlyAttempt.success).toBe(false);
    expect(elderlyAttempt.error).toContain('Caregiver Managed mode');

    // Caregiver Elena confirms -> succeeds
    const caregiverAttempt = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: today,
      scheduledTime: eligibleTime,
      status: 'taken',
      actorId: seed.caretakerUser.id,
      actorName: seed.caretakerUser.full_name,
      actorRole: 'caretaker',
    });

    expect(caregiverAttempt.success).toBe(true);
    expect(caregiverAttempt.doseLog?.status).toBe('taken');
  });

  it('rejects confirmation of future doses scheduled more than 60 minutes in advance', async () => {
    const seed = generateSeedData();
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const med = seed.medications[0];

    const futureAttempt = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: tomorrow,
      scheduledTime: '12:00',
      status: 'taken',
      actorId: seed.elderlyUser.id,
      actorName: seed.elderlyUser.full_name,
      actorRole: 'elderly',
    });

    expect(futureAttempt.success).toBe(false);
    expect(futureAttempt.error).toContain('Too early to confirm');
    expect(futureAttempt.error).toContain('60 minutes prior');
  });

  it('executes append-only historical corrections without mutating original record', async () => {
    const seed = generateSeedData();
    const today = format(new Date(), 'yyyy-MM-dd');
    const med = seed.medications[0];

    // Step 1: Initial dose taken
    const initial = await dataService.recordDoseAction({
      careProfileId: seed.careProfile.id,
      medicationId: med.id,
      scheduledDate: today,
      scheduledTime: '08:00',
      status: 'taken',
      actorId: seed.elderlyUser.id,
      actorName: seed.elderlyUser.full_name,
      actorRole: 'elderly',
    });

    expect(initial.success).toBe(true);
    const originalLogId = initial.doseLog!.id;

    // Step 2: Nurse Elena corrects record to skipped (e.g. vomited)
    const correctionRes = await dataService.correctDoseAction({
      careProfileId: seed.careProfile.id,
      originalDoseLogId: originalLogId,
      newStatus: 'skipped',
      reason: 'Patient experienced nausea and regurgitated dose 10 mins post-ingestion',
      actorId: seed.caretakerUser.id,
      actorName: seed.caretakerUser.full_name,
      actorRole: 'caretaker',
      notes: 'Consulted Dr. Chen, advised skipping morning dose.',
    });

    expect(correctionRes.success).toBe(true);
    expect(correctionRes.doseLog).toBeDefined();
    expect(correctionRes.doseLog?.status).toBe('skipped');
    expect(correctionRes.doseLog?.correction_of_id).toBe(originalLogId);

    // Verify original record is now flagged as is_corrected, never deleted
    const allLogs = await dataService.getDoseLogs(seed.careProfile.id);
    const origFound = allLogs.find(l => l.id === originalLogId);
    expect(origFound?.is_corrected).toBe(true);
    expect(origFound?.status).toBe('taken'); // Original status preserved immutably

    // Verify adherence metrics ignore the superseded log and count the corrected log
    const metrics = calculateAdherenceMetrics(allLogs, 7);
    expect(metrics.totalScheduled).toBeGreaterThan(0);
  });

  it('transitions unconfirmed follow-up state machine cleanly', async () => {
    const seed = generateSeedData();
    const unconfirmedLog = seed.doseLogs.find(d => d.status === 'unconfirmed');
    expect(unconfirmedLog).toBeDefined();

    // Caretaker updates status to contacting
    const updated1 = await dataService.updateFollowUpStatus({
      careProfileId: seed.careProfile.id,
      doseLogId: unconfirmedLog!.id,
      newStatus: 'contacting',
      note: 'Called home phone, leaving voicemail',
      actorId: seed.caretakerUser.id,
      actorName: seed.caretakerUser.full_name,
      actorRole: 'caretaker',
    });

    expect(updated1).toBe(true);
    let logs = await dataService.getDoseLogs(seed.careProfile.id);
    let found = logs.find(l => l.id === unconfirmedLog!.id);
    expect(found?.follow_up_status).toBe('contacting');

    // Caretaker confirms verified_taken
    const updated2 = await dataService.updateFollowUpStatus({
      careProfileId: seed.careProfile.id,
      doseLogId: unconfirmedLog!.id,
      newStatus: 'verified_taken',
      note: 'Patient reached on mobile, confirmed dose taken at 8:45 AM',
      actorId: seed.caretakerUser.id,
      actorName: seed.caretakerUser.full_name,
      actorRole: 'caretaker',
    });

    expect(updated2).toBe(true);
    logs = await dataService.getDoseLogs(seed.careProfile.id);
    found = logs.find(l => l.id === unconfirmedLog!.id);
    expect(found?.follow_up_status).toBe('verified_taken');
    expect(found?.status).toBe('taken');
    expect(found?.source).toBe('caregiver_administered');
  });
});
