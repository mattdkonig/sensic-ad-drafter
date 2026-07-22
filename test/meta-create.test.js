import { describe, it, expect, vi } from 'vitest';
import { createCleanDraft } from '../lib/fb-draft-ads.mjs';

// Mock fetch for graphPost
global.fetch = vi.fn().mockImplementation((url, options) => {
  if (url.includes('adcreatives')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 'creative-123' })
    });
  }
  if (url.includes('ads')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 'ad-123' })
    });
  }
  return Promise.resolve({ ok: false });
});

describe('Meta Create Contract', () => {
  it('createCleanDraft returns ok: true', async () => {
    const result = await createCleanDraft({
      token: 'test-token',
      secret: 'test-secret',
      accountId: 'act_123',
      adsetId: 'adset-123',
      plan: { page_id: 'page-123', link: 'http://link', ad_name: 'Test Ad' },
      imageUrl: 'http://image'
    });
    
    expect(result.ok).toBe(true);
    expect(result.ad_id).toBe('ad-123');
    expect(result.creative_id).toBe('creative-123');
    expect(result.status).toBe('PAUSED');
  });
});
