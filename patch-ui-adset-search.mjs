import fs from "fs";

let code = fs.readFileSync("ui.mjs", "utf-8");

// Remove the old buggy search bar HTML
code = code.replace(/<input type=\\"search\\" class=\\"creative-adset-search\\" placeholder=\\"Search ad sets\.\.\.\\" style=\\"margin-bottom:4px;height:30px;font-size:12px;padding:4px 8px;\\">/g, "");

// Add the global combobox approach
const oldAdsetOptionsHtml = `function adsetOptionsHtml(selectedId) {
    let html = '<option value="">-- Select an Ad Set --</option>';
    
    // Sort campaigns by L7D spend descending
    const sortedCampaigns = Object.values(CAMPAIGNS).sort((a, b) => (b.spend_l7d || 0) - (a.spend_l7d || 0));
    
    for (const c of sortedCampaigns) {
        const spendStr = c.spend_l7d ? \` ($\${c.spend_l7d.toFixed(2)} L7D)\` : '';
        html += \`<optgroup label="[\${c.status}] \${esc(c.name)}\${spendStr}">\`;
        
        // Sort ad sets within campaign by L7D spend descending
        const sortedAdsets = c.adsets.sort((a, b) => (b.spend_l7d || 0) - (a.spend_l7d || 0));
        
        for (const a of sortedAdsets) {
            const adsetSpendStr = a.spend_l7d ? \` ($\${a.spend_l7d.toFixed(2)} L7D)\` : '';
            const sel = a.id === selectedId ? ' selected' : '';
            html += \`<option value="\${esc(a.id)}"\${sel}>[\${a.status}] \${esc(a.name)}\${adsetSpendStr}</option>\`;
        }
        html += '</optgroup>';
    }
    return html;
}`;

const newAdsetOptionsHtml = `function adsetOptionsHtml(selectedId) {
    let html = '<option value="">-- Select an Ad Set --</option>';
    
    // Sort campaigns by L7D spend descending
    const sortedCampaigns = Object.values(CAMPAIGNS).sort((a, b) => (b.spend_l7d || 0) - (a.spend_l7d || 0));
    
    for (const c of sortedCampaigns) {
        const spendStr = c.spend_l7d ? \` ($\${c.spend_l7d.toFixed(2)} L7D)\` : '';
        html += \`<optgroup label="[\${c.status}] \${esc(c.name)}\${spendStr}">\`;
        
        // Sort ad sets within campaign by L7D spend descending
        const sortedAdsets = c.adsets.sort((a, b) => (b.spend_l7d || 0) - (a.spend_l7d || 0));
        
        for (const a of sortedAdsets) {
            const adsetSpendStr = a.spend_l7d ? \` ($\${a.spend_l7d.toFixed(2)} L7D)\` : '';
            const sel = a.id === selectedId ? ' selected' : '';
            // Store searchable text in data-search attribute
            const searchText = \`\${c.name} \${a.name}\`.toLowerCase();
            html += \`<option value="\${esc(a.id)}"\${sel} data-search="\${esc(searchText)}">[\${a.status}] \${esc(a.name)}\${adsetSpendStr}</option>\`;
        }
        html += '</optgroup>';
    }
    return html;
}`;

code = code.replace(oldAdsetOptionsHtml, newAdsetOptionsHtml);

// Add global search bar to UI
const oldPreviewHtml = `function renderPreview() {
    const out = $('#preview-out');`;

const newPreviewHtml = `function renderPreview() {
    const out = $('#preview-out');
    
    // Add global adset search if not exists
    if (!$('#global-adset-search')) {
        const searchDiv = document.createElement('div');
        searchDiv.innerHTML = \`
            <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 6px; border: 1px solid #ddd;">
                <label style="display:block; margin-bottom: 8px; font-weight: bold;">Global Ad Set Search</label>
                <input type="search" id="global-adset-search" placeholder="Search campaigns and ad sets..." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
                <div style="font-size: 11px; color: #666; margin-top: 4px;">Filters all ad set dropdowns below.</div>
            </div>
        \`;
        out.parentNode.insertBefore(searchDiv, out);
        
        $('#global-adset-search').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.creative-adset').forEach(sel => {
                let hasVisibleOptions = false;
                Array.from(sel.options).forEach(opt => {
                    if (opt.value === "") return; // keep default
                    const searchText = opt.getAttribute('data-search') || '';
                    const isVisible = searchText.includes(q);
                    opt.style.display = isVisible ? '' : 'none';
                    if (isVisible) hasVisibleOptions = true;
                });
                
                // Hide optgroups that have no visible options
                Array.from(sel.querySelectorAll('optgroup')).forEach(group => {
                    const visibleInGroup = Array.from(group.options).some(opt => opt.style.display !== 'none');
                    group.style.display = visibleInGroup ? '' : 'none';
                });
                
                // If currently selected is hidden, select the first visible
                if (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].style.display === 'none') {
                    const firstVis = Array.from(sel.options).find(o => o.style.display !== 'none' && o.value !== "");
                    if (firstVis) sel.value = firstVis.value;
                }
            });
        };
    }`;

code = code.replace(oldPreviewHtml, newPreviewHtml);

fs.writeFileSync("ui.mjs", code);
console.log("Patched ui.mjs with global adset search");
