import { describe, it, expect } from 'vitest';
import { generateSerialNumber, generateSignature, verifySignature } from '../src/lib/serial/generator';

describe('Serial Generation', () => {
  it('should generate valid serial number', () => {
    const serial = generateSerialNumber('ABC', 'P1');
    expect(serial).toMatch(/^REZ-ABC-P1-[A-Z0-9]{12}$/);
  });

  it('should generate unique serials', () => {
    const serials = new Set();
    for (let i = 0; i < 100; i++) {
      serials.add(generateSerialNumber('ABC', 'P1'));
    }
    expect(serials.size).toBe(100);
  });

  it('should sign and verify serial', () => {
    const serial = 'REZ-ABC-P1-TEST123456';
    const secret = 'test-secret';
    const signature = generateSignature(serial, secret);
    expect(verifySignature(serial, signature, secret)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const serial = 'REZ-ABC-P1-TEST123456';
    const secret = 'test-secret';
    const wrongSecret = 'wrong-secret';
    const signature = generateSignature(serial, wrongSecret);
    expect(verifySignature(serial, signature, secret)).toBe(false);
  });
});

describe('Serial Parsing', () => {
  it('should parse valid serial', () => {
    const { parseSerialNumber } = require('../src/lib/serial/generator');
    const result = parseSerialNumber('REZ-ABC-P1-X7K9M2N4P6Q8');
    expect(result.prefix).toBe('REZ');
    expect(result.brand).toBe('ABC');
    expect(result.product).toBe('P1');
    expect(result.random).toBe('X7K9M2N4P6Q8');
  });
});
