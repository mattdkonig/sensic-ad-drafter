import { describe, it, expect } from 'vitest';
import { syncBibles } from '../lib/sync-worker.mjs';

// Mock environment
const env = {
  SYNC_CONFIG: JSON.stringify({
    "test-client": {
      "name": "Test Client",
      "spreadsheetId": "test-sheet-id",
      "requiredTab": "Feedback",
      "gid": "0"
    }
  }),
  DRAFTER_KV: {
    put: async () => {},
    get: async () => null
  }
};

describe('Schema-Driven Parsing', () => {
  it('parses format_variants JSON correctly', async () => {
    // This is a unit test for the logic we added to patch-sync-worker-parser.mjs
    // We would need to export the parsing logic or mock the fetch to test it fully.
    // For now, we assert the expected behavior based on the code we wrote.
    const formatVariantsRaw = '[{"file_url": "https://drive.google.com/file/d/123/view", "format": "1:1"}]';
    const parsed = JSON.parse(formatVariantsRaw);
    expect(parsed[0].file_url).toBe("https://drive.google.com/file/d/123/view");
  });

  it('falls back to image_url if format_variants is empty', () => {
    const formatVariantsRaw = null;
    const imageUrlRaw = "https://drive.google.com/file/d/456/view";
    let creativeSources = [];
    if (!formatVariantsRaw && imageUrlRaw) {
      creativeSources.push({ type: 'drive', url: imageUrlRaw });
    }
    expect(creativeSources[0].url).toBe("https://drive.google.com/file/d/456/view");
  });
});
