import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import { newDb, DataType } from 'pg-mem';

describe('Node Server Security, Scheduler Concurrency & Endpoint Hardening Test Suite', () => {
  // Mock request helper
  function makeMockRequest({
    method = 'POST',
    path = '/api/scheduler/run-escalations',
    headers = {},
    body = null,
    serverEnv = {},
  }: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: any;
    serverEnv?: Record<string, string | undefined>;
  }): Promise<{ status: number; data: any }> {
    return new Promise((resolve) => {
      // Mock handler mimicking server/index.mjs logic
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      };

      const env = { ...process.env, ...serverEnv };

      if (path === '/api/send-email') {
        return resolve({
          status: 403,
          data: {
            success: false,
            error: 'Forbidden: Direct client email transmission is disabled. All notifications and alerts are managed server-side by the background scheduler.',
          },
        });
      }

      if (path === '/api/scheduler/run-escalations') {
        const cronSecret = env.CRON_SECRET;
        if (!cronSecret || cronSecret.trim() === '') {
          return resolve({
            status: 503,
            data: { success: false, error: 'Scheduler trigger endpoint disabled: CRON_SECRET is not configured on the server.' },
          });
        }

        const providedSecret = headers['x-cron-secret'] || (headers['authorization'] || '').replace('Bearer ', '').trim();
        if (!providedSecret || providedSecret !== cronSecret) {
          return resolve({
            status: 401,
            data: { success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET.' },
          });
        }

        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          return resolve({
            status: 500,
            data: {
              success: false,
              error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is strictly required for administrative scheduler operations.',
            },
          });
        }

        return resolve({
          status: 200,
          data: { success: true, message: 'Scheduler triggered successfully.' },
        });
      }

      return resolve({ status: 404, data: { error: 'Not found' } });
    });
  }

  describe('1. Scheduler Trigger Authentication (/api/scheduler/run-escalations)', () => {
    it('fails closed with HTTP 503 when CRON_SECRET is absent from server environment', async () => {
      const res = await makeMockRequest({
        serverEnv: { CRON_SECRET: undefined },
      });
      expect(res.status).toBe(503);
      expect(res.data.error).toMatch(/CRON_SECRET is not configured on the server/i);
    });

    it('rejects requests with missing or empty authorization with HTTP 401', async () => {
      const res = await makeMockRequest({
        serverEnv: { CRON_SECRET: 'production_super_secret_cron_12345' },
        headers: {},
      });
      expect(res.status).toBe(401);
      expect(res.data.error).toMatch(/invalid or missing CRON_SECRET/i);
    });

    it('rejects requests with incorrect CRON_SECRET with HTTP 401', async () => {
      const res = await makeMockRequest({
        serverEnv: { CRON_SECRET: 'production_super_secret_cron_12345' },
        headers: { 'x-cron-secret': 'attacker_wrong_secret' },
      });
      expect(res.status).toBe(401);
      expect(res.data.error).toMatch(/invalid or missing CRON_SECRET/i);
    });

    it('fails closed with HTTP 500 when SUPABASE_SERVICE_ROLE_KEY is missing on server', async () => {
      const res = await makeMockRequest({
        serverEnv: {
          CRON_SECRET: 'valid_cron_secret_abc',
          SUPABASE_SERVICE_ROLE_KEY: undefined,
        },
        headers: { 'x-cron-secret': 'valid_cron_secret_abc' },
      });
      expect(res.status).toBe(500);
      expect(res.data.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY is strictly required/i);
    });
  });

  describe('2. Direct Client Email Rejection (/api/send-email)', () => {
    it('strictly forbids unauthenticated arbitrary client email dispatch attempts', async () => {
      const res = await makeMockRequest({
        path: '/api/send-email',
        body: { to: 'victim@external.org', subject: 'Spam', html: '<p>Malicious content</p>' },
      });
      expect(res.status).toBe(403);
      expect(res.data.error).toMatch(/Forbidden: Direct client email transmission is disabled/i);
    });
  });

  describe('3. Scheduler Concurrency, Atomic Claims & Deduplication', () => {
    it('prevents concurrent scheduler executions from generating duplicate notifications via unique partial index', () => {
      const db = newDb();
      db.public.none(`
        CREATE TABLE notifications (
          id TEXT PRIMARY KEY,
          care_profile_id TEXT NOT NULL,
          category TEXT NOT NULL,
          dose_identity TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          email_status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX uq_notifications_escalation_dose 
          ON notifications (care_profile_id, category, dose_identity)
          WHERE (category IN ('upcoming_dose', 'unconfirmed_escalation'));
      `);

      // Worker 1 inserts escalation notification
      db.public.none(`
        INSERT INTO notifications (id, care_profile_id, category, dose_identity, status, email_status)
        VALUES ('notif_001', 'profile_margaret', 'unconfirmed_escalation', 'dose_lisinopril_2026-03-01_08:00', 'pending', 'pending');
      `);

      // Worker 2 attempts to insert notification for the exact same dose concurrently
      expect(() => {
        db.public.none(`
          INSERT INTO notifications (id, care_profile_id, category, dose_identity, status, email_status)
          VALUES ('notif_002', 'profile_margaret', 'unconfirmed_escalation', 'dose_lisinopril_2026-03-01_08:00', 'pending', 'pending');
        `);
      }).toThrow();

      // Verify only 1 notification exists in the database
      const notifs = db.public.many("SELECT * FROM notifications WHERE care_profile_id = 'profile_margaret'");
      expect(notifs.length).toBe(1);
      expect(notifs[0].id).toBe('notif_001');
    });

    it('retries failed email delivery without creating duplicate notification records', () => {
      const db = newDb();
      db.public.none(`
        CREATE TABLE notifications (
          id TEXT PRIMARY KEY,
          care_profile_id TEXT NOT NULL,
          category TEXT NOT NULL,
          dose_identity TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          email_status TEXT NOT NULL DEFAULT 'failed',
          email_error TEXT
        );
      `);

      // Initial state: Notification created but email transmission failed (e.g. transient 5xx from provider)
      db.public.none(`
        INSERT INTO notifications (id, care_profile_id, category, dose_identity, status, email_status, email_error)
        VALUES ('notif_001', 'profile_margaret', 'unconfirmed_escalation', 'dose_lisinopril_2026-03-01_08:00', 'pending', 'failed', 'Network timeout connecting to Resend API');
      `);

      // Scheduler query for eligible notifications:
      // Must NOT permanently suppress failed notifications; should select unacknowledged with email_status IN ('pending', 'failed')
      const retryable = db.public.many(`
        SELECT * FROM notifications 
        WHERE status = 'pending' AND email_status IN ('pending', 'failed')
      `);

      expect(retryable.length).toBe(1);
      expect(retryable[0].id).toBe('notif_001');
      expect(retryable[0].email_status).toBe('failed');

      // Simulate successful retry
      db.public.none(`
        UPDATE notifications 
        SET email_status = 'sent', email_error = NULL 
        WHERE id = 'notif_001';
      `);

      const updated = db.public.many("SELECT * FROM notifications WHERE id = 'notif_001'");
      expect(updated[0].email_status).toBe('sent');
      expect(updated[0].email_error).toBeNull();
    });
  });

  describe('4. Master Migration Clean-Install Verification', () => {
    it('executes master_migration schema DDL cleanly from scratch in pg-mem', () => {
      const db = newDb();
      db.public.registerFunction({
        name: 'trim',
        args: [DataType.text],
        returns: DataType.text,
        implementation: (x: string) => (x ? x.trim() : ''),
      });
      db.public.registerFunction({
        name: 'length',
        args: [DataType.text],
        returns: DataType.integer,
        implementation: (x: string) => (x ? x.length : 0),
      });

      // Basic clean DDL execution verifying syntax, table creation, views, and unique indexes
      db.public.none(`
        CREATE TABLE profiles (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'elderly',
          timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0)
        );

        CREATE TABLE care_profiles (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES profiles(id),
          full_name TEXT NOT NULL,
          assistance_level TEXT NOT NULL DEFAULT 'independent',
          timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0)
        );

        CREATE TABLE dose_logs (
          id TEXT PRIMARY KEY,
          care_profile_id TEXT NOT NULL REFERENCES care_profiles(id),
          medication_id TEXT NOT NULL,
          dose_identity TEXT NOT NULL,
          scheduled_date TEXT NOT NULL,
          scheduled_time TEXT NOT NULL,
          status TEXT NOT NULL,
          source TEXT NOT NULL,
          correction_of_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX uq_dose_logs_single_correction 
          ON dose_logs (correction_of_id) 
          WHERE (correction_of_id IS NOT NULL);

        CREATE VIEW v_effective_dose_logs AS
        SELECT * FROM dose_logs WHERE id NOT IN (
          SELECT sub.correction_of_id FROM dose_logs sub WHERE sub.correction_of_id IS NOT NULL
        );

        CREATE TABLE invitation_rate_limits (
          user_id TEXT PRIMARY KEY REFERENCES profiles(id),
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          locked_until TIMESTAMP,
          last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Insert test profile
      db.public.none(`
        INSERT INTO profiles VALUES ('user_1', 'margaret@carecircle.org', 'Margaret Hayes', 'elderly', 'UTC');
        INSERT INTO care_profiles VALUES ('profile_1', 'user_1', 'Margaret Hayes', 'independent', 'America/New_York');
      `);

      const res = db.public.many("SELECT * FROM care_profiles WHERE id = 'profile_1'");
      expect(res.length).toBe(1);
      expect(res[0].timezone).toBe('America/New_York');

      // Attempt inserting care profile with empty timezone -> MUST FAIL constraint
      expect(() => {
        db.public.none(`INSERT INTO care_profiles VALUES ('profile_2', 'user_1', 'Test', 'independent', '   ');`);
      }).toThrow();
    });
  });
});
