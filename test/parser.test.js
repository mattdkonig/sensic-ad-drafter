import { describe, it, expect, vi } from 'vitest';
import { syncBibles } from '../lib/sync-worker.mjs';

// Mock getGoogleToken
vi.mock('../lib/google-auth.mjs', () => ({
  getGoogleToken: vi.fn().mockResolvedValue('fake-token')
}));

// Mock xlsx
vi.mock('xlsx', () => ({
  read: vi.fn().mockReturnValue({ Sheets: {} }),
  utils: {
    decode_range: vi.fn(),
    encode_cell: vi.fn()
  }
}));

describe('Parser Requirements', () => {
  const mockEnv = {
    GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'test@test.com', private_key: 'key' }),
    SYNC_CONFIG: JSON.stringify({ 'test-client': { id: 'sheet-123', gid: 'gid-123' } }),
    DRAFTER_KV: {
      put: vi.fn().mockResolvedValue(true)
    }
  };

  const setupMockFetch = (tabs, csvData) => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('spreadsheets/sheet-123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sheets: tabs })
        });
      }
      if (url.includes('export?format=csv')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(csvData)
        });
      }
      if (url.includes('alt=media')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        });
      }
      return Promise.resolve({ ok: false });
    });
  };

  it('Feedback includes only client_approved', async () => {
    const tabs = [{ properties: { sheetId: 'gid-123', title: 'Feedback' } }];
    const csvData = `status,image_url,primary_text,headline,cta,landing_page_url,name,format
client_approved,http://img1,text1,head1,cta1,http://url1,ad1,1:1
ready_for_client,http://img2,text2,head2,cta2,http://url2,ad2,1:1
in_review,http://img3,text3,head3,cta3,http://url3,ad3,1:1
unknown_status,http://img4,text4,head4,cta4,http://url4,ad4,1:1
`;
    setupMockFetch(tabs, csvData);
    
    const results = await syncBibles(mockEnv);
    expect(results[0].count).toBe(1);
    expect(results[0].stats.included).toBe(1);
    expect(results[0].stats.skippedStatus).toBe(3);
    
    const putCall = mockEnv.DRAFTER_KV.put.mock.calls[0];
    const rows = JSON.parse(putCall[1]);
    expect(rows[0].concept).toBe('ad1');
  });

  it('Ads Uploaded 2026 and old/archive tabs yield zero eligible rows', async () => {
    const tabs = [
      { properties: { sheetId: 'gid-1', title: 'Ads Uploaded 2026' } },
      { properties: { sheetId: 'gid-2', title: 'OLD | Ad Tracker' } },
      { properties: { sheetId: 'gid-3', title: 'Archive 2025' } },
      { properties: { sheetId: 'gid-4', title: 'Valid Tab 2026' } }
    ];
    const csvData = `status,image_url,primary_text,headline,cta,landing_page_url,name,format
client_approved,http://img1,text1,head1,cta1,http://url1,ad1,1:1`;
    setupMockFetch(tabs, csvData);
    
    const results = await syncBibles(mockEnv);
    expect(results[0].stats.historyExcluded).toBe(3);
    expect(results[0].stats.included).toBe(1); // Only Valid Tab 2026
  });

  it('Date we want it to be uploaded can never be selected as Uploaded?', async () => {
    const tabs = [{ properties: { sheetId: 'gid-123', title: 'Ad Tracker' } }];
    const csvData = `Uploaded?,Date we want it to be uploaded,creative description,objective,type
date,10/10/2026,ad1,obj,type
,11/10/2026,ad2,obj,type
yes,,ad3,obj,type
`;
    setupMockFetch(tabs, csvData);
    
    const results = await syncBibles(mockEnv);
    expect(results[0].stats.included).toBe(1); // Only ad3
    expect(results[0].stats.skippedStatus).toBe(2); // ad1 and ad2
  });
});
