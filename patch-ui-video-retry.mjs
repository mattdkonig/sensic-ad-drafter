import fs from "fs";

let code = fs.readFileSync("ui.mjs", "utf-8");

const oldRowsHtml = `  const rows=(j.results||[]).map(x=>x.ok?'<div class="brow"><div><span class="badge b-ok">created PAUSED</span> '+esc(x.name||x.ad_id)+(x.qa?' <span class="badge '+(x.qa.pass?'b-ok':'b-warn')+'">QA '+(x.qa.pass?'pass':x.qa.fails+' fail')+'</span>':'')+'</div>'+(x.ads_manager_url?'<a class="cta" href="'+esc(x.ads_manager_url)+'" target="_blank">open in Ads Manager ↗</a>':'')+'</div>':'<div class="brow"><div><span class="badge b-bad">failed</span> '+esc(x.row_id)+' — '+esc(x.error||'')+'</div></div>').join('');`;

const newRowsHtml = `  // Persist video IDs for retries
  (j.results||[]).forEach(x => {
    if (x.ok && x.video_id) {
      getRow(x.row_id).assets.push({type:'video', id: x.video_id, format: 'unknown'});
    }
  });
  
  const rows=(j.results||[]).map(x=>x.ok?(x.message?'<div class="brow"><div><span class="badge b-warn">processing</span> '+esc(x.row_id)+' — '+esc(x.message)+'</div></div>':'<div class="brow"><div><span class="badge b-ok">created PAUSED</span> '+esc(x.name||x.ad_id)+(x.qa?' <span class="badge '+(x.qa.pass?'b-ok':'b-warn')+'">QA '+(x.qa.pass?'pass':x.qa.fails+' fail')+'</span>':'')+'</div>'+(x.ads_manager_url?'<a class="cta" href="'+esc(x.ads_manager_url)+'" target="_blank">open in Ads Manager ↗</a>':'')+'</div>'):'<div class="brow"><div><span class="badge b-bad">failed</span> '+esc(x.row_id)+' — '+esc(x.error||'')+'</div></div>').join('');`;

code = code.replace(oldRowsHtml, newRowsHtml);
fs.writeFileSync("ui.mjs", code);
console.log("Patched ui.mjs to handle video retry messages and persist video_id");
