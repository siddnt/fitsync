import { describe, expect, it } from 'vitest';
import { registerRoles, registerSchema } from './registerSchema.js';

const validPayload = {
  firstName: 'Alex',
  lastName: 'Morgan',
  email: 'alex@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
  role: registerRoles[0],
};

describe('registerSchema', () => {
  it('accepts a fully valid payload', async () => {
    await expect(registerSchema.validate(validPayload, { abortEarly: false })).resolves.toEqual(validPayload);
  });

  it('trims whitespace before validating', async () => {
    const payload = {
      ...validPayload,
      firstName: '  Alex  ',
      email: '  alex@example.com ',
    };

    await expect(registerSchema.validate(payload, { abortEarly: false })).resolves.toEqual(validPayload);
  });

  it('enforces password complexity requirements', async () => {
    const payload = {
      ...validPayload,
      password: 'password1',
      confirmPassword: 'password1',
    };

    await expect(registerSchema.validate(payload, { abortEarly: false })).rejects.toThrow(
      /uppercase, lowercase, and a number/i
    );
  });

  it('strips unknown fields when validating', async () => {
    const payload = {
      ...validPayload,
      unknown: 'value',
    };

    await expect(registerSchema.validate(payload, { abortEarly: false })).resolves.toEqual(validPayload);
  });
});
