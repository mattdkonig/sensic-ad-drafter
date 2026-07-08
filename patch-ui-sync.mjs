import fs from "fs";

let code = fs.readFileSync("ui.mjs", "utf-8");

code = code.replace(
  /<div><label>1 · Client<\/label><select id="client"><option>Loading…<\/option><\/select><\/div>/,
  `<div><label>1 · Client <button class="linkbtn hide" id="sync-client" style="float:right">↻ Sync from Google Sheet</button></label><select id="client"><option>Loading…</option></select></div>`
);

const oldClientChange = `$('#client').onchange=async e=>{
 const slug=e.target.value;$('#adset').innerHTML='<option>Loading…</option>';$('#bible').innerHTML='<div class="empty">Loading…</div>';
 $('#adset-search').classList.add('hide');
 $('#adset-search').value='';
 if(!slug){$('#adset').innerHTML='<option>Select a client first</option>';$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Select a client.</div>';$('#bible-count').textContent='';return}
 SELECTED.clear();$('#bible-search').value='';
 
 try{const[a,b]=await Promise.all([api('/api/adsets?client='+encodeURIComponent(slug)),api('/api/bible?client='+encodeURIComponent(slug))]);
 ADSETS=a.adsets||[];BIBLE=b.rows||[];BIBLE_SOURCE=b.source||'';
 renderAdsets();renderBible();
 }catch(_){$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Could not load this client\\'s ad sets / bible. <a id="bible-retry">Retry</a></div>';const rt=$('#bible-retry');if(rt)rt.onclick=()=>$('#client').dispatchEvent(new Event('change'));}
};`;

const newClientChange = `$('#client').onchange=async e=>{
 const slug=e.target.value;$('#adset').innerHTML='<option>Loading…</option>';$('#bible').innerHTML='<div class="empty">Loading…</div>';
 $('#adset-search').classList.add('hide');
 $('#adset-search').value='';
 if(!slug){
   $('#sync-client').classList.add('hide');
   $('#adset').innerHTML='<option>Select a client first</option>';$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Select a client.</div>';$('#bible-count').textContent='';return
 }
 $('#sync-client').classList.remove('hide');
 SELECTED.clear();$('#bible-search').value='';
 
 try{const[a,b]=await Promise.all([api('/api/adsets?client='+encodeURIComponent(slug)),api('/api/bible?client='+encodeURIComponent(slug))]);
 ADSETS=a.adsets||[];BIBLE=b.rows||[];BIBLE_SOURCE=b.source||'';
 renderAdsets();renderBible();
 }catch(_){$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Could not load this client\\'s ad sets / bible. <a id="bible-retry">Retry</a></div>';const rt=$('#bible-retry');if(rt)rt.onclick=()=>$('#client').dispatchEvent(new Event('change'));}
};

$('#sync-client').onclick=async()=>{
  const slug=$('#client').value;
  if(!slug)return;
  const btn=$('#sync-client');
  const orig=btn.innerHTML;
  btn.innerHTML='↻ Syncing...';
  btn.disabled=true;
  try{
    await api('/api/sync?client='+encodeURIComponent(slug),{method:'POST'});
    // Reload bible
    const b=await api('/api/bible?client='+encodeURIComponent(slug));
    BIBLE=b.rows||[];BIBLE_SOURCE=b.source||'';
    renderBible();
    btn.innerHTML='✓ Synced';
    setTimeout(()=>btn.innerHTML=orig, 2000);
  }catch(e){
    alert('Sync failed: '+e.message);
    btn.innerHTML=orig;
  }
  btn.disabled=false;
};`;

code = code.replace(oldClientChange, newClientChange);

fs.writeFileSync("ui.mjs", code);
console.log("Patched ui.mjs with Sync button");
