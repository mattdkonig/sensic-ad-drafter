import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';

// We just want to make sure the module loads and the handler doesn't throw a ReferenceError on missing imports
it('worker.js loads without missing imports', async () => {
  const workerModule = await import('../worker.js');
  expect(workerModule).toBeDefined();
  expect(workerModule.default).toBeDefined();
  expect(typeof workerModule.default.fetch).toBe('function');
});
