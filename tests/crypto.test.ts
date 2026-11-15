import { describe, it, expect } from 'vitest';
import { generatePasscode, hashPasscode, maskPasscodeHint } from '@/lib/crypto';

describe('Crypto & Passcode Helpers', () => {
  it('generates high-clarity passcode with CARE- prefix', () => {
    const code = generatePasscode();
    expect(code).toMatch(/^CARE-\d{4}$/);
  });

  it('generates different random passcodes', () => {
    const code1 = generatePasscode();
    const code2 = generatePasscode();
    expect(code1).not.toBe(code2);
  });

  it('computes deterministic SHA-256 hash irrespective of case or whitespace', async () => {
    const hash1 = await hashPasscode('CARE-1234');
    const hash2 = await hashPasscode('  care-1234  ');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string length
  });

  it('masks passcode for safe UI hint display', () => {
    expect(maskPasscodeHint('CARE-8924')).toBe('CARE-***');
    expect(maskPasscodeHint('AB')).toBe('***');
  });
});
