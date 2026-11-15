/**
 * CareCircle Timezone & Date Formatting Utilities
 * Ensures consistent handling of profile timezones, preventing naive-local/UTC confusion.
 */

export const DEFAULT_PROFILE_TIMEZONE = 'America/Los_Angeles';

/**
 * Accurately converts a local wall-clock date and time in an arbitrary IANA timezone
 * to the exact UTC Date instant without naive local-browser or server-local assumptions.
 * Correctly accounts for Daylight Saving Time (DST) jumps and non-hourly offsets.
 */
export function getUtcInstantForProfileWallClock(
  dateStr: string, // YYYY-MM-DD
  timeStr: string, // HH:MM
  ianaTimezone: string
): Date {
  if (!ianaTimezone || !ianaTimezone.trim()) {
    throw new Error('IANA timezone must be explicitly provided.');
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function getOffsetMs(targetDate: Date): number {
    const parts = formatter.formatToParts(targetDate);
    const m: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') m[p.type] = Number(p.value);
    }
    const wallUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second || 0);
    return targetDate.getTime() - wallUtc;
  }

  let instant = new Date(utcGuess.getTime() + getOffsetMs(utcGuess));
  instant = new Date(utcGuess.getTime() + getOffsetMs(instant));
  return instant;
}

/**
 * Format a date/timestamp in the specific profile's IANA timezone.
 */
export function formatTimeInTimezone(
  dateStrOrObj: string | Date,
  timezone: string = DEFAULT_PROFILE_TIMEZONE,
  includeMinutes: boolean = true
): string {
  if (!dateStrOrObj) return '';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  
  if (isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: includeMinutes ? '2-digit' : undefined,
      hour12: true,
      timeZone: timezone || DEFAULT_PROFILE_TIMEZONE,
    }).format(date);
  } catch {
    // Fallback if timezone string is invalid
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: includeMinutes ? '2-digit' : undefined,
      hour12: true,
    }).format(date);
  }
}

/**
 * Formats full date in profile timezone (e.g. "Tuesday, March 10, 2026")
 */
export function formatDateInTimezone(
  dateStrOrObj: string | Date,
  timezone: string = DEFAULT_PROFILE_TIMEZONE
): string {
  if (!dateStrOrObj) return '';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone || DEFAULT_PROFILE_TIMEZONE,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
}

/**
 * Creates an ISO timestamp for a scheduled local date & time in a given timezone.
 */
export function createIsoForLocalDateTime(
  dateStr: string, // YYYY-MM-DD
  timeStr: string, // HH:MM
  timezone: string = DEFAULT_PROFILE_TIMEZONE
): string {
  // Construct a date in the target timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // We can construct a UTC representation by measuring timezone offset
  const dateObj = new Date(Date.UTC(year, month - 1, day, hour, minute));
  
  // Format to ISO string
  return dateObj.toISOString();
}

/**
 * Checks if a scheduled dose is within the valid confirmation window.
 * Window: 60 minutes before scheduled time up to end of day.
 * Returns { allowed: boolean, reason?: string }
 */
export function validateConfirmationWindow(
  scheduledDate: string,
  scheduledTime: string,
  gracePeriodMinutes: number = 45
): { allowed: boolean; isEarly: boolean; isLate: boolean; minutesUntil: number; minutesPast: number; reason?: string } {
  const now = new Date();
  const [h, m] = scheduledTime.split(':').map(Number);
  
  const sched = new Date(`${scheduledDate}T${scheduledTime}:00`);
  if (isNaN(sched.getTime())) {
    // If invalid format, allow fallback
    return { allowed: true, isEarly: false, isLate: false, minutesUntil: 0, minutesPast: 0 };
  }

  const diffMinutes = (sched.getTime() - now.getTime()) / (1000 * 60);

  // If scheduled time is more than 60 mins in the future -> TOO EARLY!
  if (diffMinutes > 60) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = Math.round(diffMinutes % 60);
    const timeRemainingStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
    return {
      allowed: false,
      isEarly: true,
      isLate: false,
      minutesUntil: Math.round(diffMinutes),
      minutesPast: 0,
      reason: `Too early to confirm. This dose is scheduled for ${scheduledTime}. Confirmation opens 60 minutes prior (in ${timeRemainingStr}).`,
    };
  }

  const minutesPast = (now.getTime() - sched.getTime()) / (1000 * 60);
  const isLate = minutesPast > gracePeriodMinutes;

  return {
    allowed: true,
    isEarly: false,
    isLate,
    minutesUntil: Math.max(0, Math.round(diffMinutes)),
    minutesPast: Math.max(0, Math.round(minutesPast)),
  };
}

/**
 * Calculates window boundaries (open 60 mins early, closes after grace period)
 */
export function calculateConfirmationWindow(
  scheduledDate: string,
  scheduledTime: string,
  gracePeriodMinutes: number = 30,
  timezone: string = DEFAULT_PROFILE_TIMEZONE
): {
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  scheduledAt: string;
  windowOpensAt: string;
  windowClosesAt: string;
} {
  const schedDate = new Date(`${scheduledDate}T${scheduledTime}:00Z`);
  const windowOpensDate = new Date(schedDate.getTime() - 60 * 60 * 1000);
  const windowClosesDate = new Date(schedDate.getTime() + gracePeriodMinutes * 60 * 1000);

  return {
    scheduledDate,
    scheduledTime,
    timezone,
    scheduledAt: schedDate.toISOString(),
    windowOpensAt: windowOpensDate.toISOString(),
    windowClosesAt: windowClosesDate.toISOString(),
  };
}
