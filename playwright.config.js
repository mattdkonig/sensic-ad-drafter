import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e-browser',
  use: {
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npx wrangler dev --port 8787',
    port: 8787,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
