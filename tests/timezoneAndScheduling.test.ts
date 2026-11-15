import { describe, it, expect } from 'vitest';
import {
  formatDateInTimezone,
  formatTimeInTimezone,
  calculateConfirmationWindow,
  validateConfirmationWindow,
  DEFAULT_PROFILE_TIMEZONE,
} from '@/lib/dateUtils';

describe('Timezone & Medication Scheduling Integrity Test Suite', () => {
  describe('1. Multi-Timezone Deterministic Formatting', () => {
    // 2026-03-15T12:00:00.000Z
    const fixedUtcInstant = '2026-03-15T12:00:00.000Z';

    it('formats time correctly in America/Los_Angeles (UTC-7 during PDT)', () => {
      // 12:00 UTC = 05:00 PDT
      const formattedTime = formatTimeInTimezone(fixedUtcInstant, 'America/Los_Angeles');
      expect(formattedTime).toMatch(/0?5:00 AM/);
    });

    it('formats time correctly in Asia/Kolkata (UTC+5:30)', () => {
      // 12:00 UTC = 17:30 IST
      const formattedTime = formatTimeInTimezone(fixedUtcInstant, 'Asia/Kolkata');
      expect(formattedTime).toMatch(/0?5:30 PM/);
    });

    it('formats time correctly in UTC reference timezone', () => {
      const formattedTime = formatTimeInTimezone(fixedUtcInstant, 'UTC');
      expect(formattedTime).toBe('12:00 PM');
    });

    it('formats time correctly in Europe/London (GMT/BST)', () => {
      // March 15 is GMT (UTC+0)
      const formattedTime = formatTimeInTimezone(fixedUtcInstant, 'Europe/London');
      expect(formattedTime).toBe('12:00 PM');
    });
  });

  describe('2. Confirmation Window & Boundary Calculations', () => {
    it('calculates 60-minute early confirmation window accurately', () => {
      const window = calculateConfirmationWindow('2026-03-01', '08:00', 30, 'America/Los_Angeles');
      expect(window.scheduledDate).toBe('2026-03-01');
      expect(window.scheduledTime).toBe('08:00');
      expect(window.timezone).toBe('America/Los_Angeles');
      expect(window.scheduledAt).toBeDefined();
      expect(window.windowOpensAt).toBeDefined();
      expect(window.windowClosesAt).toBeDefined();

      // Window must open exactly 60 minutes prior to scheduled time
      const schedTime = new Date(window.scheduledAt).getTime();
      const openTime = new Date(window.windowOpensAt).getTime();
      expect(schedTime - openTime).toBe(60 * 60 * 1000);

      // Window must close grace_period_minutes (30 min) after scheduled time
      const closeTime = new Date(window.windowClosesAt).getTime();
      expect(closeTime - schedTime).toBe(30 * 60 * 1000);
    });

    it('flags doses scheduled in the distant future as isEarly: true', () => {
      const futureCheck = validateConfirmationWindow('2029-12-31', '12:00');
      expect(futureCheck.isEarly).toBe(true);
      expect(futureCheck.allowed).toBe(false);
      expect(futureCheck.reason).toMatch(/Too early to confirm/i);
    });

    it('flags doses scheduled in the distant past as isLate: true', () => {
      const pastCheck = validateConfirmationWindow('2020-01-01', '08:00');
      expect(pastCheck.isLate).toBe(true);
      expect(pastCheck.isEarly).toBe(false);
      expect(pastCheck.allowed).toBe(true); // Can record late taken or skip exception
    });
  });

  describe('3. Midnight Boundary & Schedule Integrity', () => {
    it('handles late night doses (23:45) without rollover errors', () => {
      const window = calculateConfirmationWindow('2026-03-01', '23:45', 45, 'Asia/Kolkata');
      expect(window.scheduledDate).toBe('2026-03-01');
      expect(window.scheduledTime).toBe('23:45');
      expect(window.scheduledAt).toBeDefined();
    });

    it('handles early morning doses (00:15) crossing day boundaries correctly', () => {
      const window = calculateConfirmationWindow('2026-03-02', '00:15', 30, 'UTC');
      expect(window.scheduledDate).toBe('2026-03-02');
      expect(window.scheduledTime).toBe('00:15');

      const schedTime = new Date(window.scheduledAt).getTime();
      const openTime = new Date(window.windowOpensAt).getTime();
      // Opens at 23:15 on March 1st (60 min prior)
      expect(schedTime - openTime).toBe(60 * 60 * 1000);
    });
  });
});
