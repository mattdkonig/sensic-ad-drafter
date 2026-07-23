import { test, expect } from '@playwright/test';

test('Successful create request transitions to Results and preserves state', async ({ page }) => {
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

  // Mock the /api/create-drafts endpoint to return success
  await page.route('/api/create-drafts', async route => {
    // Assert the payload contains the selected asset
    const postData = JSON.parse(route.request().postData());
    expect(postData.items[0].assets[0].url).toBe('http://example.com/image.jpg');
    
    await route.fulfill({ status: 200, json: { ok: true, created: 1, requested: 1, drafted_rows: ['row1'] } });
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

  // Click create
  await page.locator('#create').click();

  // Handle batch modal
  await page.locator('#batch-confirm').click();

  // Wait for success screen
  await page.waitForSelector('text=Results — 1 of 1 created PAUSED');
  const successText = await page.locator('.section-h h2').textContent();
  expect(successText).toContain('Results — 1 of 1 created PAUSED');
});
