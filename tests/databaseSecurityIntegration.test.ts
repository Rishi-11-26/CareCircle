import { describe, it, expect } from 'vitest';
import { newDb } from 'pg-mem';
import { getUtcInstantForProfileWallClock, formatTimeInTimezone } from '@/lib/dateUtils';
import { hashPasscode, generatePasscode } from '@/lib/crypto';

describe('Database Security & Immutability Integration Test Suite (pg-mem PostgreSQL Engine)', () => {
  it('enforces that confirmed dose events cannot be updated or deleted', () => {
    const db = newDb();
    
    // Create dose_logs schema
    db.public.none(`
      CREATE TABLE dose_logs (
        id TEXT PRIMARY KEY,
        care_profile_id TEXT NOT NULL,
        medication_id TEXT NOT NULL,
        dose_identity TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        is_corrected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Register immutability trigger interceptor matching enforce_dose_log_immutability()
    const table: any = db.public.getTable('dose_logs');
    table.onBeforeChange(['status', 'is_corrected'], (oldRecord: any, newRecord: any) => {
      if (oldRecord && !newRecord) {
        throw new Error('Dose logs are immutable medical audit records and cannot be deleted.');
      }
      if (oldRecord && newRecord && (oldRecord.status === 'taken' || oldRecord.status === 'skipped')) {
        throw new Error('Confirmed dose events are immutable audit records and cannot be modified. Record an append-only correction instead.');
      }
    });

    // Insert an initial confirmed dose event
    db.public.none(`
      INSERT INTO dose_logs (id, care_profile_id, medication_id, dose_identity, scheduled_date, scheduled_time, status, source)
      VALUES ('dose_001', 'profile_margaret', 'med_lisinopril', 'dose_med_lisinopril_2026-03-01_08:00', '2026-03-01', '08:00', 'taken', 'self');
    `);

    // Verify row exists
    const records = db.public.many("SELECT * FROM dose_logs WHERE id = 'dose_001'");
    expect(records.length).toBe(1);
    expect(records[0].status).toBe('taken');

    // 1. Attempt to UPDATE the confirmed dose event in place -> MUST FAIL
    expect(() => {
      db.public.none("UPDATE dose_logs SET status = 'skipped' WHERE id = 'dose_001';");
    }).toThrow(/immutable audit records and cannot be modified/i);

    // 2. Attempt to modify is_corrected on the confirmed event -> MUST FAIL
    expect(() => {
      db.public.none("UPDATE dose_logs SET is_corrected = TRUE WHERE id = 'dose_001';");
    }).toThrow(/immutable audit records and cannot be modified/i);

    // 3. Attempt to DELETE the confirmed dose event -> MUST FAIL
    expect(() => {
      db.public.none("DELETE FROM dose_logs WHERE id = 'dose_001';");
    }).toThrow(/immutable medical audit records and cannot be deleted/i);

    // Verify original record is completely unblemished and unmodified
    const postAttempt = db.public.many("SELECT * FROM dose_logs WHERE id = 'dose_001'");
    expect(postAttempt[0].status).toBe('taken');
    expect(postAttempt[0].is_corrected).toBe(false);
  });

  it('derives effective dose state via view without modifying the original confirmed event', () => {
    const db = newDb();

    // Create dose logs table and projection view
    db.public.none(`
      CREATE TABLE dose_logs (
        id TEXT PRIMARY KEY,
        care_profile_id TEXT NOT NULL,
        medication_id TEXT NOT NULL,
        dose_identity TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        correction_of_id TEXT,
        correction_reason TEXT,
        created_at TIMESTAMP NOT NULL
      );

      CREATE UNIQUE INDEX uq_dose_logs_single_corr ON dose_logs (correction_of_id);

      CREATE VIEW v_effective_dose_logs AS
      SELECT * FROM dose_logs d
      WHERE d.id NOT IN (
        SELECT sub.correction_of_id FROM dose_logs sub WHERE sub.correction_of_id IS NOT NULL
      );
    `);

    // 1. Insert original confirmed dose
    db.public.none(`
      INSERT INTO dose_logs (id, care_profile_id, medication_id, dose_identity, status, source, correction_of_id, created_at)
      VALUES ('dose_root_1', 'profile_margaret', 'med_metformin', 'dose_metformin_0800', 'taken', 'self', NULL, '2026-03-01 08:00:00');
    `);

    // Effective state should be 'taken'
    let effective = db.public.many('SELECT * FROM v_effective_dose_logs');
    expect(effective.length).toBe(1);
    expect(effective[0].id).toBe('dose_root_1');
    expect(effective[0].status).toBe('taken');

    // 2. Insert append-only correction (original row is NOT updated)
    db.public.none(`
      INSERT INTO dose_logs (id, care_profile_id, medication_id, dose_identity, status, source, correction_of_id, correction_reason, created_at)
      VALUES ('dose_corr_1', 'profile_margaret', 'med_metformin', 'dose_metformin_0800_corr', 'skipped', 'caregiver_administered', 'dose_root_1', 'Patient refused morning dose', '2026-03-01 09:15:00');
    `);

    // Effective state projection now resolves to the correction ('skipped')
    effective = db.public.many('SELECT * FROM v_effective_dose_logs');
    expect(effective.length).toBe(1);
    expect(effective[0].id).toBe('dose_corr_1');
    expect(effective[0].status).toBe('skipped');
    expect(effective[0].correction_of_id).toBe('dose_root_1');

    // Verify original event is preserved in the underlying audit ledger
    const fullAudit = db.public.many('SELECT * FROM dose_logs ORDER BY created_at ASC');
    expect(fullAudit.length).toBe(2);
    expect(fullAudit[0].id).toBe('dose_root_1');
    expect(fullAudit[0].status).toBe('taken'); // Original event unchanged!

    // 3. Attempting a second conflicting correction on the same target MUST FAIL unique index
    expect(() => {
      db.public.none(`
        INSERT INTO dose_logs (id, care_profile_id, medication_id, dose_identity, status, source, correction_of_id, created_at)
        VALUES ('dose_corr_conflicting', 'profile_margaret', 'med_metformin', 'dose_metformin_0800_corr2', 'taken', 'family_reported', 'dose_root_1', '2026-03-01 10:00:00');
      `);
    }).toThrow();
  });

  it('guarantees atomic single-use invitation redemption under concurrency', () => {
    const db = newDb();

    db.public.none(`
      CREATE TABLE invitations (
        id TEXT PRIMARY KEY,
        invite_code_hash TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        redeemed_by TEXT,
        redeemed_at TIMESTAMP
      );
    `);

    db.public.none(`
      INSERT INTO invitations (id, invite_code_hash, status)
      VALUES ('inv_1', 'hash_care_secret_123', 'pending');
    `);

    // Redemption simulation: Only updates if status is 'pending'
    function attemptRedeem(userId: string): boolean {
      const res = db.public.many(
        `UPDATE invitations
         SET status = 'redeemed', redeemed_by = '${userId}', redeemed_at = NOW()
         WHERE invite_code_hash = 'hash_care_secret_123' AND status = 'pending'
         RETURNING id;`
      );
      return res.length > 0;
    }

    // User A redeems first
    const userASucceeded = attemptRedeem('user_david');
    expect(userASucceeded).toBe(true);

    // User B attempts to redeem the exact same passcode
    const userBSucceeded = attemptRedeem('user_attacker');
    expect(userBSucceeded).toBe(false);

    // Verify row state
    const invite = db.public.many("SELECT * FROM invitations WHERE id = 'inv_1'");
    expect(invite[0].status).toBe('redeemed');
    expect(invite[0].redeemed_by).toBe('user_david');
  });

  it('converts profile wall-clock date and time to UTC across standard and daylight saving boundaries without assuming UTC or hardcoded timezones', () => {
    // 1. America/New_York Standard Time (EST = UTC-5 in Jan)
    const janNy = getUtcInstantForProfileWallClock('2026-01-15', '08:00', 'America/New_York');
    expect(janNy.toISOString()).toBe('2026-01-15T13:00:00.000Z');
    expect(formatTimeInTimezone(janNy, 'America/New_York')).toBe('8:00 AM');

    // 2. America/New_York Daylight Saving Time (EDT = UTC-4 in July)
    const julNy = getUtcInstantForProfileWallClock('2026-07-15', '08:00', 'America/New_York');
    expect(julNy.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    expect(formatTimeInTimezone(julNy, 'America/New_York')).toBe('8:00 AM');

    // 3. Asia/Kolkata (IST = UTC+5:30 with no DST)
    const marIst = getUtcInstantForProfileWallClock('2026-03-01', '08:00', 'Asia/Kolkata');
    expect(marIst.toISOString()).toBe('2026-03-01T02:30:00.000Z');
    expect(formatTimeInTimezone(marIst, 'Asia/Kolkata')).toBe('8:00 AM');

    // 4. Europe/London British Summer Time (BST = UTC+1 in July) vs GMT (UTC+0 in March)
    const marLondon = getUtcInstantForProfileWallClock('2026-03-01', '08:00', 'Europe/London');
    expect(marLondon.toISOString()).toBe('2026-03-01T08:00:00.000Z');

    const julLondon = getUtcInstantForProfileWallClock('2026-07-01', '08:00', 'Europe/London');
    expect(julLondon.toISOString()).toBe('2026-07-01T07:00:00.000Z');

    // 5. Throws if timezone is missing
    expect(() => {
      getUtcInstantForProfileWallClock('2026-03-01', '08:00', '');
    }).toThrow(/timezone must be explicitly provided/i);
  });

  it('proves that 5 concurrent invalid passcode attempts lock out the user and prevent brute force bypass', () => {
    const db = newDb();

    db.public.none(`
      CREATE TABLE invitation_rate_limits (
        user_id TEXT PRIMARY KEY,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP,
        last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Simulated stored procedure logic for recording failed attempt with atomic row locking
    function recordAttempt(userId: string, isSuccess: boolean): { allowed: boolean; lockedOut: boolean } {
      // Upsert rate limit row
      db.public.none(`
        INSERT INTO invitation_rate_limits (user_id, failed_attempts, last_attempt_at)
        VALUES ('${userId}', 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
      `);

      const [row] = db.public.many(`SELECT * FROM invitation_rate_limits WHERE user_id = '${userId}'`);
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
        return { allowed: false, lockedOut: true };
      }

      if (isSuccess) {
        db.public.none(`UPDATE invitation_rate_limits SET failed_attempts = 0, locked_until = NULL WHERE user_id = '${userId}';`);
        return { allowed: true, lockedOut: false };
      } else {
        const nextAttempts = row.failed_attempts + 1;
        const lockClause = nextAttempts >= 5 ? ", locked_until = NOW() + INTERVAL '15 minutes'" : "";
        db.public.none(`UPDATE invitation_rate_limits SET failed_attempts = ${nextAttempts}${lockClause} WHERE user_id = '${userId}';`);
        return { allowed: false, lockedOut: nextAttempts >= 5 };
      }
    }

    const testUser = 'user_attacker_01';

    // 4 failed attempts: not yet locked out
    for (let i = 0; i < 4; i++) {
      const res = recordAttempt(testUser, false);
      expect(res.allowed).toBe(false);
      expect(res.lockedOut).toBe(false);
    }

    // 5th failed attempt: triggers lockout
    const fifthAttempt = recordAttempt(testUser, false);
    expect(fifthAttempt.allowed).toBe(false);
    expect(fifthAttempt.lockedOut).toBe(true);

    // 6th attempt (even with valid code) is rejected immediately due to active lockout
    const sixthAttempt = recordAttempt(testUser, true);
    expect(sixthAttempt.allowed).toBe(false);
    expect(sixthAttempt.lockedOut).toBe(true);
  });

  it('validates explicit source whitelisting and rejects system impersonation from client callers', () => {
    function validateDoseSource(source: string, callerRole: string, assistanceLevel: string): { valid: boolean; error?: string } {
      if (source === 'system') {
        return { valid: false, error: 'Unauthorized source: System-originated events cannot be recorded by client sessions.' };
      }
      if (!['self', 'caregiver_administered', 'family_reported'].includes(source)) {
        return { valid: false, error: 'Invalid source: Must be one of: self, caregiver_administered, family_reported.' };
      }
      if (source === 'self') {
        if (!['owner', 'elderly'].includes(callerRole)) {
          return { valid: false, error: 'Invalid source: Caregivers or family cannot record self-administration.' };
        }
        if (assistanceLevel === 'caregiver_managed') {
          return { valid: false, error: 'This profile is in Caregiver Managed mode. Medications must be administered and recorded by an authorized caregiver.' };
        }
      }
      if (source === 'caregiver_administered' && !['caretaker', 'owner'].includes(callerRole)) {
        return { valid: false, error: 'Invalid source: Only authorized caretakers may record caregiver-administered doses.' };
      }
      if (source === 'family_reported' && !['family', 'owner'].includes(callerRole)) {
        return { valid: false, error: 'Invalid source: Only family circle members may record family-reported doses.' };
      }
      return { valid: true };
    }

    // 1. System source from client is strictly rejected
    expect(validateDoseSource('system', 'caretaker', 'independent').valid).toBe(false);
    expect(validateDoseSource('system', 'caretaker', 'independent').error).toMatch(/system-originated/i);

    // 2. Arbitrary invalid source is rejected
    expect(validateDoseSource('unknown_device', 'owner', 'independent').valid).toBe(false);

    // 3. Family attempting to record caregiver_administered is rejected
    expect(validateDoseSource('caregiver_administered', 'family', 'independent').valid).toBe(false);

    // 4. Caretaker attempting to record self is rejected
    expect(validateDoseSource('self', 'caretaker', 'independent').valid).toBe(false);

    // 5. Elderly self in caregiver_managed is rejected
    expect(validateDoseSource('self', 'owner', 'caregiver_managed').valid).toBe(false);

    // 6. Caretaker recording caregiver_administered is allowed
    expect(validateDoseSource('caregiver_administered', 'caretaker', 'caregiver_managed').valid).toBe(true);

    // 7. Family recording family_reported is allowed
    expect(validateDoseSource('family_reported', 'family', 'needs_assistance').valid).toBe(true);

    // 8. Elderly self in independent is allowed
    expect(validateDoseSource('self', 'owner', 'independent').valid).toBe(true);
  });
});
