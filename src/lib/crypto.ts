/**
 * Cryptographic helpers for CareCircle Passcode Access
 * Uses the Web Crypto API for secure random generation and SHA-256 hashing.
 */

export function generatePasscode(): string {
  // Generate a random 4-digit numeric code with CARE- prefix for high elderly clarity
  const array = new Uint16Array(1);
  crypto.getRandomValues(array);
  const code = (1000 + (array[0] % 9000)).toString();
  return `CARE-${code}`;
}

export async function hashPasscode(passcode: string): Promise<string> {
  const normalized = passcode.trim().toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function maskPasscodeHint(passcode: string): string {
  if (!passcode || passcode.length < 5) return '***';
  return `${passcode.slice(0, 5)}***`;
}
