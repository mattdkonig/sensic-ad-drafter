import { describe, it, expect } from 'vitest';
import { extractDriveId } from '../drive.mjs';

describe('Drive Capabilities', () => {
  it('Extracts IDs from multiple URL formats', () => {
    expect(extractDriveId('https://drive.google.com/file/d/123/view')).toEqual({ id: '123', type: 'file' });
    expect(extractDriveId('https://drive.google.com/drive/folders/456')).toEqual({ id: '456', type: 'folder' });
    expect(extractDriveId('https://drive.google.com/open?id=789')).toEqual({ id: '789', type: 'unknown' });
    expect(extractDriveId('https://drive.google.com/uc?id=abc')).toEqual({ id: 'abc', type: 'unknown' });
    expect(extractDriveId('https://drive.google.com/thumbnail?id=def')).toEqual({ id: 'def', type: 'unknown' });
  });
});
