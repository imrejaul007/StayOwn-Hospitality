import { PIIEncryption } from '../../utils/piiEncryption.js';

describe('PIIEncryption', () => {
  let pii;

  beforeEach(() => {
    pii = new PIIEncryption('a-very-secure-encryption-key-32chars!');
  });

  test('encrypts and decrypts correctly', () => {
    const original = 'AB1234567';
    const encrypted = pii.encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // IV:ciphertext format
    const decrypted = pii.decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('returns null/undefined as-is', () => {
    expect(pii.encrypt(null)).toBeNull();
    expect(pii.encrypt(undefined)).toBeUndefined();
    expect(pii.decrypt(null)).toBeNull();
  });

  test('produces different ciphertexts for same input (random IV)', () => {
    const enc1 = pii.encrypt('secret');
    const enc2 = pii.encrypt('secret');
    expect(enc1).not.toBe(enc2); // Different IVs
    expect(pii.decrypt(enc1)).toBe('secret');
    expect(pii.decrypt(enc2)).toBe('secret');
  });

  test('masks values correctly', () => {
    const masked = pii.mask('1234567890', 4);
    expect(masked).toBe('****7890');
  });

  test('masks encrypted values', () => {
    const encrypted = pii.encrypt('1234567890');
    const masked = pii.mask(encrypted, 4);
    expect(masked).toBe('****7890');
  });

  test('detects encrypted values', () => {
    const encrypted = pii.encrypt('test');
    expect(pii.isEncrypted(encrypted)).toBe(true);
    expect(pii.isEncrypted('plaintext')).toBe(false);
    expect(pii.isEncrypted(null)).toBe(false);
  });

  test('throws on short key', () => {
    expect(() => new PIIEncryption('short')).toThrow('at least 32');
  });
});
