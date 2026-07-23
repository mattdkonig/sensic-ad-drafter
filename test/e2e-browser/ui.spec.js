import { test, expect } from '@playwright/test';

test('Preview card renders CTA and Drive HTML correctly', async ({ page }) => {
  // Mock the /whoami endpoint to simulate login
  await page.route('/whoami', async route => {
    await route.fulfill({ json: { authed: true, email: 'test@example.com' } });
  });

  // Mock the /api/clients endpoint
  await page.route('/api/clients', async route => {
    await route.fulfill({ json: { clients: [{ slug: 'test-client', name: 'Test Client' }] } });
  });

  // Mock the /api/bible endpoint
  await page.route('/api/bible?client=test-client', async route => {
    await route.fulfill({ json: { rows: [{ id: 'row1', concept: 'Test Ad', uploaded: false, type: 'image', num_creatives: 1 }] } });
  });

  // Mock the /api/adsets endpoint
  await page.route('/api/adsets?client=test-client', async route => {
    await route.fulfill({ json: { adsets: [{ id: 'adset1', name: 'Test Adset' }] } });
  });

  // Mock the /api/preview endpoint
  await page.route('/api/preview', async route => {
    await route.fulfill({ json: { plans: [{
      row_id: 'row1',
      ready: true,
      ad_name: 'Test Ad',
      drive_files: [{
        download_url: 'http://example.com/image.jpg',
        mime: 'image/jpeg',
        name: 'image.jpg',
        format: '1:1',
        isDirectFile: true,
        size: 1024
      }]
    }] } });
  });

  await page.goto('http://localhost:8787/');

  // Select client
  await page.locator('#client').selectOption('test-client');

  // Wait for bible rows to load
  await page.waitForSelector('.rowcb');
  
  // Select a row
  await page.locator('.rowcb').check();

  // Click preview
  await page.locator('#preview').click();

  // Wait for preview card
  await page.waitForSelector('.pcard');

  // Assert that CTA select is present
  const ctaSelect = page.locator('.creative-cta');
  await expect(ctaSelect).toBeVisible();

  // Assert that Drive Auto-Resolution section is present
  const driveSection = page.locator('text=Drive Auto-Resolution');
  await expect(driveSection).toBeVisible();

  // Assert that the drive file checkbox is checked
  const driveCb = page.locator('.drive-file-cb');
  await expect(driveCb).toBeChecked();

  // Assert that manual upload input is present
  const fileInput = page.locator('.creative-file');
  await expect(fileInput).toBeVisible();
});
