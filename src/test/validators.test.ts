import { describe, it, expect } from 'vitest';

// Test the validation patterns used throughout the app
describe('Aadhaar validation', () => {
  const isValidAadhaar = (v: string) => /^\d{12}$/.test(v);

  it('accepts 12-digit number', () => {
    expect(isValidAadhaar('123456789012')).toBe(true);
  });
  it('rejects 11 digits', () => {
    expect(isValidAadhaar('12345678901')).toBe(false);
  });
  it('rejects 13 digits', () => {
    expect(isValidAadhaar('1234567890123')).toBe(false);
  });
  it('rejects with letters', () => {
    expect(isValidAadhaar('12345678901a')).toBe(false);
  });
  it('rejects empty', () => {
    expect(isValidAadhaar('')).toBe(false);
  });
  it('rejects with spaces', () => {
    expect(isValidAadhaar('1234 5678 9012')).toBe(false);
  });
});

describe('Phone validation', () => {
  const isValidPhone = (v: string) => /^\d{10}$/.test(v);

  it('accepts 10-digit number', () => {
    expect(isValidPhone('9876543210')).toBe(true);
  });
  it('rejects 9 digits', () => {
    expect(isValidPhone('987654321')).toBe(false);
  });
  it('rejects with spaces', () => {
    expect(isValidPhone('98765 43210')).toBe(false);
  });
  it('rejects 11 digits', () => {
    expect(isValidPhone('98765432101')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });
  it('rejects with country code prefix', () => {
    expect(isValidPhone('+919876543210')).toBe(false);
  });
});

describe('Email validation', () => {
  const isValidEmail = (v: string) => v.includes('@');

  it('accepts email with @', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });
  it('rejects email without @', () => {
    expect(isValidEmail('testexample.com')).toBe(false);
  });
  it('accepts minimal @ format', () => {
    expect(isValidEmail('a@b')).toBe(true);
  });
  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('Proctor type validation', () => {
  const VALID_TYPES = ['WFO', 'ODP', 'Hybrid'];
  const isValidType = (v: string) => VALID_TYPES.includes(v);

  it('accepts WFO', () => expect(isValidType('WFO')).toBe(true));
  it('accepts ODP', () => expect(isValidType('ODP')).toBe(true));
  it('accepts Hybrid', () => expect(isValidType('Hybrid')).toBe(true));
  it('rejects invalid type', () => expect(isValidType('FTE')).toBe(false));
  it('rejects empty string', () => expect(isValidType('')).toBe(false));
  it('rejects lowercase variant', () => expect(isValidType('wfo')).toBe(false));
});

describe('Name validation', () => {
  const isValidName = (v: string) => v.trim().length >= 2;

  it('accepts full name', () => {
    expect(isValidName('John Doe')).toBe(true);
  });
  it('accepts single name with 2+ chars', () => {
    expect(isValidName('Jo')).toBe(true);
  });
  it('rejects single character', () => {
    expect(isValidName('J')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidName('')).toBe(false);
  });
  it('rejects whitespace-only', () => {
    expect(isValidName('   ')).toBe(false);
  });
});
