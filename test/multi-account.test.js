import { describe, it, expect } from 'vitest';
import { accountsForSlug } from '../data.mjs';

describe('Multi-Account Logic', () => {
  it('returns array of account objects for a slug', () => {
    const accounts = accountsForSlug('chief-aus');
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).toHaveProperty('id');
    expect(accounts[0]).toHaveProperty('name');
  });

  it('returns empty array for unknown slug', () => {
    const accounts = accountsForSlug('unknown-slug-123');
    expect(accounts.length).toBe(0);
  });
});
