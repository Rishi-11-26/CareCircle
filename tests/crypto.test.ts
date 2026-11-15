import { describe, it, expect } from 'vitest';
import { generatePasscode, hashPasscode, maskPasscodeHint } from '@/lib/crypto';

describe('Crypto & Passcode Helpers', () => {
  it('generates high-entropy passcode with CARE- prefix and 6 unambiguous alphanumeric characters', () => {
    const code = generatePasscode();
    // CARE- followed by 6 characters from [23456789ABCDEFGHJKLMNPQRSTUVWXYZ]
    expect(code).toMatch(/^CARE-[2-9A-HJ-NP-Z]{6}$/);
    expect(code.length).toBe(11);
  });

  it('generates different random passcodes with high entropy', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generatePasscode());
    }
    expect(codes.size).toBe(50); // No collisions in 50 generations
  });

  it('computes deterministic SHA-256 hash irrespective of case or whitespace', async () => {
    const hash1 = await hashPasscode('CARE-7X9K2P');
    const hash2 = await hashPasscode('  care-7x9k2p  ');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string length
  });

  it('masks passcode for safe UI hint display', () => {
    expect(maskPasscodeHint('CARE-7X9K2P')).toBe('CARE-7X***');
    expect(maskPasscodeHint('AB')).toBe('CARE-***');
  });
});
