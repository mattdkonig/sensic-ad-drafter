import fs from "fs";

let code = fs.readFileSync("ui.mjs", "utf-8");

const oldCtrl = `ctrl='<div class="pc-match">'+mb+'</div><label class="pc-l">Target ad set</label><select class="creative-adset" data-row="'+esc(p.row_id)+'">'+adsetOptionsHtml(m?m.adset.id:'')+'</select>'`;
const newCtrl = `ctrl='<div class="pc-match">'+mb+'</div><label class="pc-l">Target ad set</label><input type="search" class="creative-adset-search" placeholder="Search ad sets..." style="margin-bottom:4px;height:30px;font-size:12px;padding:4px 8px;"><select class="creative-adset" data-row="'+esc(p.row_id)+'">'+adsetOptionsHtml(m?m.adset.id:'')+'</select>'`;

code = code.replace(oldCtrl, newCtrl);

// Add event listener for creative-adset-search
const oldRenderPreview = `$('#preview-out').innerHTML=bar+'<div class="pc-grid">'+html+'</div>';`;
const newRenderPreview = `$('#preview-out').innerHTML=bar+'<div class="pc-grid">'+html+'</div>';
  document.querySelectorAll('.creative-adset-search').forEach(inp => {
    inp.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const sel = e.target.nextElementSibling;
      Array.from(sel.options).forEach(opt => {
        if (opt.value === "") return; // keep the default option
        opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
      });
      // if currently selected is hidden, select the first visible
      if (sel.options[sel.selectedIndex].style.display === 'none') {
        const firstVis = Array.from(sel.options).find(o => o.style.display !== 'none');
        if (firstVis) sel.value = firstVis.value;
      }
    };
  });`;

code = code.replace(oldRenderPreview, newRenderPreview);

fs.writeFileSync("ui.mjs", code);
console.log("Patched ui.mjs for adset search in preview");
