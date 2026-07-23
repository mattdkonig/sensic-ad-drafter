import { describe, it, expect } from 'vitest';
import { stageAsset } from '../lib/staging.mjs';

describe('Durable Asset Staging', () => {
  it('returns ok: true if asset is already staged', async () => {
    const env = {
      DRAFTER_KV: {
        get: async (key) => {
          if (key === 'staged:123') return { stagedId: 'staged-456' };
          return null;
        }
      }
    };
    const res = await stageAsset(env, 'https://drive.google.com/file/d/123/view', 'fake-token');
    expect(res.ok).toBe(true);
    expect(res.stagedId).toBe('staged-456');
  });

  it('returns error if drive URL is invalid', async () => {
    const res = await stageAsset({}, 'invalid-url', 'fake-token');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('invalid_drive_url');
  });
});
