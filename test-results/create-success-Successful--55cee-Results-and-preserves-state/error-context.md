# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-success.spec.js >> Successful create request transitions to Results and preserves state
- Location: test/e2e-browser/create-success.spec.js:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#batch-confirm')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]: 🚀
    - generic [ref=e5]: Sensic Ad Drafter client bible → PAUSED draft ads
    - generic [ref=e6]:
      - generic [ref=e7]: test@example.com
      - button "Sign out" [ref=e8] [cursor=pointer]
  - main [ref=e9]:
    - generic [ref=e11]: Some rows have no target ad set. Pick a default ad set above, or choose one per card.
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: 1 · Client
        - combobox [ref=e15]:
          - option "Select…"
          - option "Test Client" [selected]
      - generic [ref=e16]:
        - generic [ref=e17]:
          - text: 2 · Ad set — default for rows that don't auto-match
          - button "2 · Ad set — default for rows that don't auto-match" [ref=e18] [cursor=pointer]: + New ad set / campaign
        - searchbox "Filter campaigns or ad sets…" [ref=e19]
        - combobox [ref=e20]:
          - option "Select an ad set…" [selected]
          - option "Test Adset ()"
    - generic [ref=e22]:
      - generic [ref=e23]: Status of new ads
      - generic [ref=e24]: ⏸ PAUSED (draft) — never goes live automatically
    - generic [ref=e26]:
      - heading "3 · Bible rows — Ad Tracker, not yet uploaded" [level=2] [ref=e27]
      - generic [ref=e28]: 1 eligible · 1 selected
    - generic [ref=e29]:
      - searchbox "Filter rows by name…" [ref=e30]
      - button "Select all" [ref=e31] [cursor=pointer]
      - button "Clear" [ref=e32] [cursor=pointer]
    - generic [ref=e34]:
      - checkbox "Test Ad image · 1 creative" [checked] [ref=e35] [cursor=pointer]
      - generic [ref=e36]:
        - generic [ref=e37]: Test Ad
        - generic [ref=e38]:
          - generic [ref=e39]: image
          - text: · 1 creative
    - generic [ref=e40]:
      - generic [ref=e41]:
        - heading "Preview — undefined will be created PAUSED" [level=2] [ref=e42]
        - generic [ref=e43]: Page not resolved · UTMs auto-added · enhancements OFF
      - generic [ref=e44]:
        - generic [ref=e45]: 0 of 1 auto-matched to an ad set — unmatched rows use the ad set selected above.
        - generic [ref=e46]: "Set all CTAs:"
        - combobox [ref=e47]:
          - option "Shop Now" [selected]
          - option "Learn More"
          - option "Sign Up"
          - option "Subscribe"
          - option "Get Offer"
          - option "Get Quote"
          - option "Order Now"
          - option "Book Now"
          - option "Contact Us"
          - option "Download"
          - option "Visit Store"
          - option "See Menu"
          - option "Watch More"
          - option "Apply Now"
      - generic [ref=e49]:
        - generic [ref=e50]: 🖼
        - generic [ref=e51]:
          - generic [ref=e52]: Test Ad
          - generic [ref=e54]: ✓ ready
          - generic [ref=e56]: no target ad set
          - generic [ref=e57]: Target ad set
          - button "— use default ad set —" [ref=e59] [cursor=pointer]
          - generic [ref=e60]: Button (CTA)
          - combobox [ref=e61]:
            - option "Shop Now" [selected]
            - option "Learn More"
            - option "Sign Up"
            - option "Subscribe"
            - option "Get Offer"
            - option "Get Quote"
            - option "Order Now"
            - option "Book Now"
            - option "Contact Us"
            - option "Download"
            - option "Visit Store"
            - option "See Menu"
            - option "Watch More"
            - option "Apply Now"
          - generic [ref=e62]:
            - generic [ref=e63]: Drive Auto-Resolution
            - generic [ref=e64] [cursor=pointer]:
              - checkbox "1:1 image.jpg (1 KB)" [checked] [ref=e65]
              - generic [ref=e66]: 1:1
              - text: image.jpg
              - generic [ref=e67]: (1 KB)
          - generic [ref=e68]: Or attach manually (JPG/PNG or MP4/MOV)
          - button "Choose File" [ref=e69]
    - generic [ref=e70]:
      - button "Preview" [ref=e71] [cursor=pointer]
      - button "Create 1 PAUSED draft" [active] [ref=e72] [cursor=pointer]
      - generic [ref=e73]: 🛡 enhancements off · audit logged
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Successful create request transitions to Results and preserves state', async ({ page }) => {
  4  |   // Mock the /whoami endpoint to simulate login
  5  |   await page.route('/whoami', async route => {
  6  |     await route.fulfill({ json: { authed: true, email: 'test@example.com' } });
  7  |   });
  8  | 
  9  |   // Mock the /api/clients endpoint
  10 |   await page.route('/api/clients', async route => {
  11 |     await route.fulfill({ json: { clients: [{ slug: 'test-client', name: 'Test Client' }] } });
  12 |   });
  13 | 
  14 |   // Mock the /api/bible endpoint
  15 |   await page.route('/api/bible?client=test-client', async route => {
  16 |     await route.fulfill({ json: { rows: [{ id: 'row1', concept: 'Test Ad', uploaded: false, type: 'image', num_creatives: 1 }] } });
  17 |   });
  18 | 
  19 |   // Mock the /api/adsets endpoint
  20 |   await page.route('/api/adsets?client=test-client', async route => {
  21 |     await route.fulfill({ json: { adsets: [{ id: 'adset1', name: 'Test Adset' }] } });
  22 |   });
  23 | 
  24 |   // Mock the /api/preview endpoint
  25 |   await page.route('/api/preview', async route => {
  26 |     await route.fulfill({ json: { plans: [{
  27 |       row_id: 'row1',
  28 |       ready: true,
  29 |       ad_name: 'Test Ad',
  30 |       drive_files: [{
  31 |         download_url: 'http://example.com/image.jpg',
  32 |         mime: 'image/jpeg',
  33 |         name: 'image.jpg',
  34 |         format: '1:1',
  35 |         isDirectFile: true,
  36 |         size: 1024
  37 |       }]
  38 |     }] } });
  39 |   });
  40 | 
  41 |   // Mock the /api/create-drafts endpoint to return success
  42 |   await page.route('/api/create-drafts', async route => {
  43 |     // Assert the payload contains the selected asset
  44 |     const postData = JSON.parse(route.request().postData());
  45 |     expect(postData.items[0].assets[0].url).toBe('http://example.com/image.jpg');
  46 |     
  47 |     await route.fulfill({ status: 200, json: { ok: true, created: 1, requested: 1, drafted_rows: ['row1'] } });
  48 |   });
  49 | 
  50 |   await page.goto('http://localhost:8787/');
  51 | 
  52 |   // Select client
  53 |   await page.locator('#client').selectOption('test-client');
  54 | 
  55 |   // Wait for bible rows to load
  56 |   await page.waitForSelector('.rowcb');
  57 |   
  58 |   // Select a row
  59 |   await page.locator('.rowcb').check();
  60 | 
  61 |   // Click preview
  62 |   await page.locator('#preview').click();
  63 | 
  64 |   // Wait for preview card
  65 |   await page.waitForSelector('.pcard');
  66 | 
  67 |   // Click create
  68 |   await page.locator('#create').click();
  69 | 
  70 |   // Handle batch modal
> 71 |   await page.locator('#batch-confirm').click();
     |                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  72 | 
  73 |   // Wait for success screen
  74 |   await page.waitForSelector('text=Results — 1 of 1 created PAUSED');
  75 |   const successText = await page.locator('.section-h h2').textContent();
  76 |   expect(successText).toContain('Results — 1 of 1 created PAUSED');
  77 | });
  78 | 
```