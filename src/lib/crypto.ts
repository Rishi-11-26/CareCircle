/**
 * Cryptographic helpers for CareCircle Passcode Access
 * Uses Web Crypto API for secure random generation and SHA-256 hashing.
 * Uses an unambiguous alphanumeric charset (excluding 0, O, 1, I) to prevent
 * elderly reading confusion while providing over 1.07 billion random combinations (>30 bits entropy).
 */

const UNAMBIGUOUS_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 characters

export function generatePasscode(): string {
  const length = 6;
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += UNAMBIGUOUS_CHARSET[randomBytes[i] % UNAMBIGUOUS_CHARSET.length];
  }
  return `CARE-${result}`;
}

export const generateInvitationPasscode = generatePasscode;

export async function hashPasscode(passcode: string): Promise<string> {
  const normalized = passcode.trim().toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function maskPasscodeHint(passcode: string): string {
  if (!passcode || passcode.length < 6) return 'CARE-***';
  return `${passcode.slice(0, 7)}***`;
}
