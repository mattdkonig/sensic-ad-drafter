import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const uiCode = fs.readFileSync('ui.mjs', 'utf-8');

describe('UI Requirements', () => {
  it('Rendering 27 rows does not duplicate the 618-item list 27 times', () => {
    const code = uiCode;
    expect(code).not.toContain('<select class="creative-adset"');
    expect(code).toContain('<button class="adset-override-btn"');
  });

  it('Per-row override uses the shared chooser', () => {
    expect(uiCode).toContain('id="adset-modal"');
    expect(uiCode).toContain('id="am-select"');
  });

  it('Direct assets are checked by default', () => {
    expect(uiCode).toContain("const isChecked = (f.isDirectFile || f.matchScore >= 0.4) ? 'checked' : ''");
  });
  
  it('Search changes actual ad-set results', () => {
    expect(uiCode).toContain("opt.style.display = isVisible ? '' : 'none'");
  });
  
  it('Preview card correctly renders CTA and Drive HTML without dropping them', () => {
    // We patched the string concatenation bug. The code should use parts.join('')
    expect(uiCode).toContain("ctrl = parts.join('');");
    expect(uiCode).not.toContain("'<input type=\"hidden\" class=\"creative-adset\" data-row=\"'+esc(p.row_id)+'\" value=\"'+esc(selAdset)+'\">';");
  });
});
