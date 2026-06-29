// sensic-ad-drafter/ui.mjs — polished team web app (served at /).
// Login screen (session cookie) -> drafter. Ad sets grouped by campaign; supports
// creating a new campaign / ad set (copied PAUSED from an existing one). Create
// uploads attached creatives to Meta and builds clean PAUSED draft ads.
export const UI_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sensic Ad Drafter</title>
<style>
:root{--bg:#0f1011;--panel:#17181a;--panel2:#1d1f22;--line:#2a2d31;--ink:#f3f4f6;--mut:#9aa0a8;--accent:#3b82f6;--accent2:#2563eb;--ok:#34d399;--okbg:#0f2e25;--warn:#fbbf24;--warnbg:#332813;--bad:#f87171;--badbg:#3a1d1d}
*{box-sizing:border-box}html{color-scheme:dark}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
header{display:flex;align-items:center;gap:12px;padding:18px 28px;border-bottom:1px solid var(--line)}
header .logo{font-size:20px}header b{font-weight:600;font-size:19px}header .sub{color:var(--mut);font-size:13px}
header .who{margin-left:auto;color:var(--mut);font-size:13px;display:flex;gap:14px;align-items:center}
main{max-width:1000px;margin:28px auto;padding:0 28px}
label{display:block;font-size:13px;color:var(--mut);margin-bottom:7px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px}
select,input,button{font:inherit;color:var(--ink)}
select,input{width:100%;height:42px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);appearance:none}
select:focus,input:focus{outline:none;border-color:var(--accent)}
button{height:42px;padding:0 18px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;transition:.12s}
button:hover{border-color:var(--mut)}button.primary{background:var(--accent2);border-color:var(--accent2)}button.primary:hover{background:var(--accent)}
button:disabled{opacity:.45;cursor:not-allowed}.linkbtn{background:none;border:none;color:var(--accent);height:auto;padding:0;cursor:pointer;font-size:13px}
.pill{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--mut);font-size:14px}
.section-h{display:flex;align-items:baseline;justify-content:space-between;margin:26px 0 10px}.section-h h2{font-size:15px;font-weight:600;margin:0}.section-h .meta{color:var(--mut);font-size:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:6px 18px}
.brow{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}.brow:last-child{border-bottom:0}
.brow input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;width:18px;min-width:18px;height:18px;margin-top:2px;padding:0;border:0;border-radius:0;background:none;accent-color:var(--accent);cursor:pointer}
.brow .t{font-weight:500}.brow .meta{font-size:12px;color:var(--mut);margin-top:2px}.brow .cta{margin-left:auto;color:var(--mut);font-size:13px}
.muted{color:var(--mut);font-size:13px}.empty{padding:22px;color:var(--mut)}
.badge{font-size:12px;padding:3px 9px;border-radius:8px;display:inline-block;margin:2px 4px 0 0}
.b-ok{background:var(--okbg);color:var(--ok)}.b-warn{background:var(--warnbg);color:var(--warn)}.b-bad{background:var(--badbg);color:var(--bad)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.pcard{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pcard .thumb{height:88px;background:var(--panel2);display:flex;align-items:center;justify-content:center;color:var(--mut)}
.pcard .pc-b{padding:12px 14px}.pcard .pc-t{font-weight:500;margin-bottom:3px}.pcard .pc-m{font-size:12px;color:var(--mut);line-height:1.5;margin-bottom:8px;min-height:34px}
.pcard input[type=file]{font-size:12px;width:100%;margin-top:8px}
.actions{display:flex;gap:12px;align-items:center;margin-top:22px}
.banner{padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:14px}.banner.err{background:var(--badbg);color:var(--bad)}.banner.ok{background:var(--okbg);color:var(--ok)}.banner.info{background:#11233f;color:#93c5fd}
.foot{margin-left:auto;color:var(--mut);font-size:12px;display:flex;gap:6px;align-items:center}
.hide{display:none!important}
.bible-bar{display:flex;gap:12px;align-items:center;margin:0 0 14px}
.bible-bar input{height:38px}.bible-bar .linkbtn{white-space:nowrap}
.brow .meta .tag{display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:1px 7px;margin-right:6px;color:var(--mut)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px}
.modal{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow:auto}
.modal h3{margin:0 0 6px;font-size:17px}.modal p{margin:0 0 16px}
.modal label{margin-top:12px}.modal .m-err{color:var(--bad);font-size:13px;min-height:18px;margin-top:8px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.m-budget{display:flex;gap:8px}.m-budget>*{flex:1;min-width:0}
.pc-l{display:block;font-size:11px;color:var(--mut);margin-top:10px;margin-bottom:3px}
.pcard select.creative-cta,.pcard select.creative-adset{height:34px;font-size:12px;padding:0 8px;width:100%}
.pc-match{margin:6px 0 2px}.more-toggle{cursor:pointer}
.m-src-info{font-size:12px;color:var(--mut);margin-top:6px;min-height:16px}
.pcard input[type=file]{appearance:auto;-webkit-appearance:auto;height:auto;border:0;border-radius:0;background:none;padding:0;font-size:12px;width:100%;margin-top:2px}
.login{max-width:400px;margin:11vh auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:32px}
.login .logo{font-size:26px}.login h1{font-size:21px;margin:10px 0 4px}.login p{color:var(--mut);font-size:13px;margin:0 0 22px}
.login .fld{margin-bottom:15px}.login button{width:100%}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
</style></head><body>

<div id="app-shell" class="hide">
<header><span class="logo" aria-hidden="true">🚀</span><div><b>Sensic Ad Drafter</b> <span class="sub">client bible → PAUSED draft ads</span></div>
<span class="who"><span id="who"></span><button class="linkbtn" id="logout">Sign out</button></span></header>
<main>
<div id="banner"></div>
<div class="grid">
  <div><label>1 · Client</label><select id="client"><option>Loading…</option></select></div>
  <div><label>2 · Ad set <span class="muted">— default for rows that don't auto-match</span> <button class="linkbtn" id="new-adset" style="float:right">+ New ad set / campaign</button></label><select id="adset"><option>Select a client first</option></select></div>
</div>
<div class="grid"><div><label>Status of new ads</label><div class="pill">⏸&nbsp; PAUSED (draft) — never goes live automatically</div></div><div></div></div>
<div class="section-h"><h2>3 · Bible rows — Ad Tracker, not yet uploaded</h2><span class="meta" id="bible-count"></span></div>
<div class="bible-bar hide" id="bible-bar"><input id="bible-search" type="search" placeholder="Filter rows by name…" autocomplete="off"><button class="linkbtn" id="select-all">Select all</button><button class="linkbtn" id="clear-all">Clear</button></div>
<div class="card" id="bible"><div class="empty">Select a client.</div></div>
<div class="actions"><button class="primary" id="preview" disabled>Preview</button><button id="create" class="hide">Create PAUSED drafts</button><span class="muted" id="status"></span>
<span class="foot">🛡 enhancements off · audit logged</span></div>
<div id="preview-out" style="margin-top:24px"></div>
</main>
<div id="modal" class="modal-bg hide">
 <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
  <h3 id="m-title">New ad set or campaign</h3>
  <p class="muted">Copies an existing ad set (with its targeting, budget &amp; optimisation) as a <b>PAUSED</b> draft. Nothing goes live, and the source is never changed.</p>
  <label for="m-kind">What to create</label>
  <select id="m-kind"><option value="adset">New ad set — in the same campaign</option><option value="campaign">New campaign — copies the whole campaign</option></select>
  <label for="m-source-filter" style="margin-top:12px">Copy settings from this ad set</label>
  <input id="m-source-filter" type="search" placeholder="Filter ad sets…" autocomplete="off" style="margin-bottom:8px">
  <select id="m-source"></select>
  <div class="m-src-info" id="m-src-info"></div>
  <div id="m-camp-row" class="hide"><label for="m-campaign-name" style="margin-top:12px">New campaign name</label><input id="m-campaign-name" autocomplete="off" placeholder="e.g. SENSIC | EOFY SALE 2026"></div>
  <label for="m-name" style="margin-top:12px">New ad set name</label>
  <input id="m-name" placeholder="e.g. TOF &gt; Value &gt; Beef Liver &gt; 23rd June" autocomplete="off">
  <label style="margin-top:12px">Budget <span class="muted">— optional, leave blank to keep the copied budget</span></label>
  <div class="m-budget">
   <div id="m-level-row" class="hide"><select id="m-budget-level"><option value="abo">Ad set budget (ABO)</option><option value="cbo">Campaign budget (CBO)</option></select></div>
   <select id="m-budget-type"><option value="daily">Daily</option><option value="lifetime">Lifetime</option></select>
   <input id="m-budget-amount" type="number" min="1" step="1" inputmode="decimal" placeholder="Amount $" autocomplete="off">
  </div>
  <div id="m-end-row" class="hide"><label for="m-end-time" style="margin-top:12px">Lifetime budget end date</label><input id="m-end-time" type="datetime-local"></div>
  <label style="margin-top:14px;display:flex;align-items:center;gap:9px;color:var(--ink);font-size:14px"><input type="checkbox" id="m-copy-ads" checked style="width:18px;height:18px;min-width:18px;accent-color:var(--accent)"> Also copy the existing ads (PAUSED) — uncheck to start with an empty ad set</label>
  <div class="muted" style="font-size:12px;margin-top:12px;line-height:1.5">Most ad sets copy in one click. If Meta refuses a particular one, just pick another — your original ad sets are never touched, and nothing ever goes live.</div>
  <div class="m-err" id="m-err"></div>
  <div class="modal-actions"><button id="m-cancel">Cancel</button><button class="primary" id="m-create">Create PAUSED</button></div>
 </div>
</div>
</div>

<div id="login-shell">
<div class="login"><div class="logo" aria-hidden="true">🚀</div><h1>Sensic Ad Drafter</h1><p>Sign in to create PAUSED draft ads from a client bible.</p>
<div id="login-banner"></div>
<form id="login-form">
<div class="fld"><label for="email">Work email</label><input id="email" type="email" autocomplete="username" placeholder="you@sensicdigital.com" required></div>
<div class="fld"><label for="password">Team password</label><input id="password" type="password" autocomplete="current-password" required></div>
<button class="primary" type="submit" id="login-btn">Sign in</button></form></div>
</div>

<script>
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const api=async(p,o={})=>{const r=await fetch(p,{credentials:'include',headers:{'content-type':'application/json'},...o});let j={};try{j=await r.json()}catch{}; if(r.status===401){showLogin('Your session expired — please sign in again.');throw new Error('401')} return j};
const banner=(m,k)=>{$('#banner').innerHTML=m?'<div class="banner '+(k||'')+'">'+m+'</div>':''};
function showLogin(msg){$('#app-shell').classList.add('hide');$('#login-shell').classList.remove('hide');$('#login-banner').innerHTML=msg?'<div class="banner err">'+esc(msg)+'</div>':'';}
function showApp(email){$('#login-shell').classList.add('hide');$('#app-shell').classList.remove('hide');$('#who').textContent=email||'';initApp();}

$('#login-form').onsubmit=async e=>{e.preventDefault();const btn=$('#login-btn');btn.disabled=true;btn.textContent='Signing in…';
 try{const r=await fetch('/api/login',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});
  const j=await r.json().catch(()=>({}));
  if(j.ok){showApp(j.email)}else{$('#login-banner').innerHTML='<div class="banner err">'+esc(j.message||'Sign in failed')+'</div>'}
 }catch(_){$('#login-banner').innerHTML='<div class="banner err">Network error — try again.</div>'}finally{btn.disabled=false;btn.textContent='Sign in'}};
$('#logout').onclick=async()=>{await fetch('/api/logout',{method:'POST',credentials:'include'}).catch(()=>{});showLogin('Signed out.');};

let BIBLE=[],ADSETS=[],BIBLE_SOURCE='';
const SELECTED=new Set();
const CTA_OPTS=[{t:'Shop Now',v:'SHOP_NOW'},{t:'Learn More',v:'LEARN_MORE'},{t:'Sign Up',v:'SIGN_UP'},{t:'Subscribe',v:'SUBSCRIBE'},{t:'Get Offer',v:'GET_OFFER'},{t:'Get Quote',v:'GET_QUOTE'},{t:'Order Now',v:'ORDER_NOW'},{t:'Book Now',v:'BOOK_TRAVEL'},{t:'Contact Us',v:'CONTACT_US'},{t:'Download',v:'DOWNLOAD'},{t:'Visit Store',v:'GET_DIRECTIONS'},{t:'See Menu',v:'SEE_MENU'},{t:'Watch More',v:'WATCH_MORE'},{t:'Apply Now',v:'APPLY_NOW'}];
const adsetById=id=>ADSETS.find(a=>a.id===id)||null;
const nrm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Match a bible row to the live ad set it names (adset_hint / campaign). The bible
// already encodes intent — this turns the 200-item dropdown into a fallback.
function adsetMatch(row){
 if(!ADSETS.length)return null;
 const hint=nrm(row.adset_hint),camp=nrm(row.campaign);
 if(!hint&&!camp)return null;
 let best=null,bs=0;
 for(const a of ADSETS){const an=nrm(a.name),cn=nrm(a.campaign);let s=0;
  if(hint){if(an===hint)s=100;else if(an.includes(hint)||hint.includes(an))s=72;else{const ht=hint.split(' ').filter(Boolean),bt=new Set(an.split(' '));let n=0;ht.forEach(t=>{if(bt.has(t))n++});s=ht.length?Math.round(60*n/ht.length):0;}}
  if(camp&&cn){if(cn===camp)s+=20;else if(cn.includes(camp)||camp.includes(cn))s+=10;}
  if(a.status==='ACTIVE')s+=2;
  if(s>bs){bs=s;best=a;}}
 return bs>=45?{adset:best,score:Math.min(bs,100)}:null;
}
function adsetOptionsHtml(sel){
 const byCamp={};ADSETS.forEach(s=>{const c=s.campaign||'(no campaign)';(byCamp[c]=byCamp[c]||[]).push(s)});
 return '<option value="">— use the ad set selected above —</option>'+Object.keys(byCamp).sort().map(c=>'<optgroup label="'+esc(c)+'">'+byCamp[c].map(s=>'<option value="'+esc(s.id)+'"'+(s.id===sel?' selected':'')+'>'+esc(s.name)+' ('+esc(s.status)+')</option>').join('')+'</optgroup>').join('');
}
function adsetSummary(a){if(!a)return'';const bits=[];if(a.objective)bits.push(a.objective.replace(/^OUTCOME_/,''));if(a.optimization_goal)bits.push(a.optimization_goal);if(a.budget_level==='cbo'&&a.campaign_budget)bits.push('CBO $'+a.campaign_budget);else if(a.daily_budget)bits.push('$'+a.daily_budget+'/day');else if(a.lifetime_budget)bits.push('$'+a.lifetime_budget+' lifetime');return bits.join(' · ');}
async function initApp(){
 try{const d=await api('/api/clients');$('#client').innerHTML='<option value="">Select…</option>'+(d.clients||[]).map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.name)+'</option>').join('');
  let last='';try{last=localStorage.getItem('drafter:lastClient')||''}catch(_){}
  if(last&&[...$('#client').options].some(o=>o.value===last)){$('#client').value=last;$('#client').dispatchEvent(new Event('change'));}
 }catch(_){}}

function renderAdsets(){
 // group by campaign
 const byCamp={};ADSETS.forEach(s=>{const c=s.campaign||'(no campaign)';(byCamp[c]=byCamp[c]||[]).push(s)});
 let html='<option value="">Select an ad set…</option>';
 for(const camp of Object.keys(byCamp).sort()){html+='<optgroup label="'+esc(camp)+'">'+byCamp[camp].map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+esc(s.status)+')</option>').join('')+'</optgroup>';}
 $('#adset').innerHTML=html;
}
$('#client').onchange=async e=>{
 const slug=e.target.value;$('#adset').innerHTML='<option>Loading…</option>';$('#bible').innerHTML='<div class="empty">Loading…</div>';
 $('#preview-out').innerHTML='';$('#create').classList.add('hide');$('#preview').disabled=true;banner('');
 if(!slug){$('#adset').innerHTML='<option>Select a client first</option>';$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Select a client.</div>';$('#bible-count').textContent='';return}
 SELECTED.clear();$('#bible-search').value='';
 try{localStorage.setItem('drafter:lastClient',slug)}catch(_){}
 try{const[a,b]=await Promise.all([api('/api/adsets?client='+encodeURIComponent(slug)),api('/api/bible?client='+encodeURIComponent(slug))]);
  ADSETS=a.adsets||[];renderAdsets();
  BIBLE=b.rows||[];BIBLE_SOURCE=b.source||'';renderBible();refresh();
 }catch(_){$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">Could not load this client\\'s ad sets / bible. <a id="bible-retry">Retry</a></div>';const rt=$('#bible-retry');if(rt)rt.onclick=()=>$('#client').dispatchEvent(new Event('change'));}
};
function rowMeta(r){
 const parts=[];
 if(r.type)parts.push('<span class="tag">'+esc(r.type)+'</span>');
 const n=Number(r.num_creatives);if(n>0)parts.push(esc(n)+' creative'+(n===1?'':'s'));
 if(r.objective)parts.push(esc(r.objective));
 return parts.join(' · ');
}
function updateCount(){const n=SELECTED.size;const q=($('#bible-search').value||'').trim().toLowerCase();const shown=q?BIBLE.filter(r=>String(r.concept||'').toLowerCase().includes(q)).length:BIBLE.length;const base=BIBLE.length?((q&&shown!==BIBLE.length)?(shown+' of '+BIBLE.length+' shown'):(BIBLE.length+' eligible')):'';$('#bible-count').textContent=base+(n?' · '+n+' selected':'');}
function renderBible(){
 if(!BIBLE.length){$('#bible-bar').classList.add('hide');$('#bible').innerHTML='<div class="empty">No eligible bible rows for this client'+(BIBLE_SOURCE==='none'?' — bible not synced yet':' (all rows already marked uploaded)')+'.</div>';updateCount();return}
 $('#bible-bar').classList.remove('hide');
 const q=($('#bible-search').value||'').trim().toLowerCase();
 const rows=q?BIBLE.filter(r=>String(r.concept||'').toLowerCase().includes(q)):BIBLE;
 if(!rows.length){$('#bible').innerHTML='<div class="empty">No rows match “'+esc(q)+'”.</div>';updateCount();return}
 $('#bible').innerHTML=rows.map(r=>{const m=rowMeta(r);return '<label class="brow"><input type="checkbox" class="rowcb" value="'+esc(r.id)+'"'+(SELECTED.has(r.id)?' checked':'')+'><div><div class="t">'+esc(r.concept||'(untitled)')+'</div>'+(m?'<div class="meta">'+m+'</div>':'')+'</div>'+(r.cta?'<div class="cta">'+esc(r.cta)+'</div>':'')+'</label>'}).join('');
 updateCount();
}
$('#bible-search').oninput=()=>renderBible();
$('#select-all').onclick=()=>{const q=($('#bible-search').value||'').trim().toLowerCase();(q?BIBLE.filter(r=>String(r.concept||'').toLowerCase().includes(q)):BIBLE).forEach(r=>SELECTED.add(r.id));renderBible();refresh();};
$('#clear-all').onclick=()=>{SELECTED.clear();renderBible();refresh();};

const modal=$('#modal');
function closeModal(){modal.classList.add('hide')}
function mPopulateSources(filter){
 const q=(filter||'').trim().toLowerCase();
 const byCamp={};ADSETS.forEach(s=>{const c=s.campaign||'(no campaign)';if(q&&!((s.name||'')+' '+c).toLowerCase().includes(q))return;(byCamp[c]=byCamp[c]||[]).push(s)});
 const camps=Object.keys(byCamp).sort();
 $('#m-source').innerHTML=camps.length?camps.map(c=>'<optgroup label="'+esc(c)+'">'+byCamp[c].map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+esc(s.status)+')</option>').join('')+'</optgroup>').join(''):'<option value="">No ad sets match</option>';
}
function mSyncKind(){const camp=$('#m-kind').value==='campaign';$('#m-camp-row').classList.toggle('hide',!camp);$('#m-level-row').classList.toggle('hide',!camp);if(!camp)$('#m-budget-level').value='abo';}
function mSrcInfo(){const a=adsetById($('#m-source').value);const s=a?adsetSummary(a):'';$('#m-src-info').textContent=s?('Inherits: '+s):(a?'':'');}
function mSyncBudgetType(){$('#m-end-row').classList.toggle('hide',$('#m-budget-type').value!=='lifetime');}
$('#new-adset').onclick=()=>{
 if(!$('#client').value){banner('Pick a client first.','err');return}
 if(!ADSETS.length){banner('No ad sets are loaded for this client yet.','err');return}
 $('#m-err').textContent='';$('#m-name').value='';$('#m-campaign-name').value='';$('#m-budget-amount').value='';$('#m-source-filter').value='';$('#m-kind').value='adset';$('#m-budget-type').value='daily';$('#m-budget-level').value='abo';$('#m-end-time').value='';$('#m-copy-ads').checked=true;
 mPopulateSources('');mSyncKind();mSyncBudgetType();
 const pageSel=$('#adset').value;if(pageSel)$('#m-source').value=pageSel;
 mSrcInfo();
 modal.classList.remove('hide');setTimeout(()=>$('#m-name').focus(),30);
};
$('#m-kind').onchange=mSyncKind;
$('#m-budget-type').onchange=mSyncBudgetType;
$('#m-source').onchange=mSrcInfo;
$('#m-source-filter').oninput=e=>{mPopulateSources(e.target.value);mSrcInfo();};
$('#m-cancel').onclick=closeModal;
modal.onclick=e=>{if(e.target===modal)closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hide'))closeModal()});
$('#m-create').onclick=async()=>{
 const slug=$('#client').value,kind=$('#m-kind').value,src=$('#m-source').value;
 const adsetName=$('#m-name').value.trim(),campaignName=$('#m-campaign-name').value.trim(),amt=$('#m-budget-amount').value.trim();
 if(!src){$('#m-err').textContent='Pick an ad set to copy settings from.';return}
 if(!adsetName){$('#m-err').textContent='Give the new ad set a name.';return}
 if(kind==='campaign'&&!campaignName){$('#m-err').textContent='Give the new campaign a name.';return}
 if(amt&&!(Number(amt)>0)){$('#m-err').textContent='Budget must be a positive number, or left blank.';return}
 const btype=$('#m-budget-type').value;
 if(amt&&btype==='lifetime'&&!$('#m-end-time').value){$('#m-err').textContent='Lifetime budgets need an end date.';return}
 // Duplicate-name guard.
 const dupAdset=ADSETS.some(a=>nrm(a.name)===nrm(adsetName));
 const dupCamp=kind==='campaign'&&ADSETS.some(a=>nrm(a.campaign)===nrm(campaignName));
 if((dupAdset||dupCamp)&&!confirm('A '+(dupCamp?'campaign':'ad set')+' with that name already exists. Create another with the same name?'))return;
 const payload={client:slug,from_adset_id:src,kind,adset_name:adsetName,copy_ads:$('#m-copy-ads').checked};
 if(kind==='campaign')payload.campaign_name=campaignName;
 if(amt){payload.budget_amount=Number(amt);payload.budget_type=btype;payload.budget_level=$('#m-budget-level').value;if(btype==='lifetime')payload.end_time=$('#m-end-time').value;}
 const btn=$('#m-create');btn.disabled=true;btn.textContent='Creating…';$('#m-err').textContent='';
 try{const d=await api('/api/new-adset',{method:'POST',body:JSON.stringify(payload)});
  if(d.ok){closeModal();
   let msg='Created PAUSED '+(kind==='campaign'?'campaign':'ad set')+': '+esc(d.name||d.id)+'.';
   if(d.applied&&d.applied.budget)msg+=' Budget: '+esc(d.applied.budget.type)+' $'+esc(d.applied.budget.amount)+' '+esc((d.applied.budget.level||'').toUpperCase())+'.';
   if(d.applied&&d.applied.removed_ads!=null)msg+=' Started empty ('+esc(d.applied.removed_ads)+' copied ad(s) removed).';
   const warn=(d.warnings||[]).length;
   banner(msg+(warn?' Note: '+esc(d.warnings.join('; ')):' Ad sets refreshed.'),warn?'info':'ok');
   const a=await api('/api/adsets?client='+encodeURIComponent(slug));ADSETS=a.adsets||[];renderAdsets();if(d.adset_id)$('#adset').value=d.adset_id;refresh();}
  else $('#m-err').textContent=d.message||'Could not create — try again.';
 }catch(_){$('#m-err').textContent='Create failed — check your connection and try again.';}
 finally{btn.disabled=false;btn.textContent='Create PAUSED';}
};
const selectedIds=()=>[...SELECTED];
const refresh=()=>{$('#preview').disabled=!SELECTED.size;if(window.__plans){window.__plans=null;$('#create').classList.add('hide');$('#preview-out').innerHTML='<div class="muted" style="margin-top:12px">Selection changed — click Preview to refresh.</div>';}};
document.addEventListener('change',e=>{
 if(e.target.classList.contains('rowcb')){if(e.target.checked)SELECTED.add(e.target.value);else SELECTED.delete(e.target.value);updateCount();refresh();}
 else if(e.target.id==='adset')refresh();
});
$('#preview').onclick=async()=>{
 $('#status').textContent='Assembling…';$('#create').classList.add('hide');banner('');
 try{const d=await api('/api/preview',{method:'POST',body:JSON.stringify({client:$('#client').value,row_ids:selectedIds(),adset_id:$('#adset').value})});
  $('#status').textContent='';
  const plans=d.plans||[];const readyN=plans.filter(p=>p.ready).length;
  const matchedN=plans.filter(p=>p.ready&&adsetMatch(BIBLE.find(r=>r.id===p.row_id)||{})).length;
  const bar=readyN?'<div class="bible-bar"><span class="muted">'+matchedN+' of '+readyN+' auto-matched to an ad set'+(matchedN<readyN?' — unmatched rows use the ad set selected above':'')+'.</span><span class="muted" style="margin-left:auto">Set all CTAs:</span><select id="cta-all" style="width:auto;height:34px">'+CTA_OPTS.map(o=>'<option value="'+o.t+'">'+o.t+'</option>').join('')+'</select></div>':'';
  $('#preview-out').innerHTML='<div class="section-h"><h2>Preview — '+d.count+' will be created PAUSED</h2><span class="meta">Page '+esc(d.page_id||'not resolved')+' · UTMs auto-added · enhancements OFF</span></div>'+bar+'<div class="cards">'+
   plans.map(p=>{const row=BIBLE.find(r=>r.id===p.row_id)||{};const m=p.ready?adsetMatch(row):null;
    const b=p.ready?'<span class="badge b-ok">✓ ready</span>':'<span class="badge b-bad">blocked</span>';
    const lvl=i=>i.level==='FAIL'?'b-bad':(i.level==='INFO'?'b-ok':'b-warn');
    const iss=(p.issues||[]).map(i=>'<span class="badge '+lvl(i)+'">'+esc(i.msg)+'</span>').join('');
    const msg=String(p.message||'');const mhtml=msg.length>90?('<span class="m-short">'+esc(msg.slice(0,90))+'… <a class="more-toggle">more</a></span><span class="m-full hide">'+esc(msg)+' <a class="more-toggle">less</a></span>'):esc(msg);
    let ctrl='';
    if(p.ready){
     const mb=m?'<span class="badge b-ok">→ '+esc(m.adset.name)+' · '+m.score+'%</span>':'<span class="badge b-warn">no ad set match — using the one selected above</span>';
     let driveHtml='';
     const mode='__WORKFLOW_MODE__';
     if(mode!=='manual'&&p.drive_files&&p.drive_files.length){
       driveHtml='<div style="margin-top:12px;padding:8px;background:var(--panel);border-radius:6px;border:1px solid var(--line)"><div class="pc-l" style="margin:0 0 8px 0;font-weight:600">Drive Auto-Resolution</div>'+
       p.drive_files.map(f=>'<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer"><input type="checkbox" class="drive-file-cb" data-row="'+esc(p.row_id)+'" data-url="'+esc(f.download_url)+'" data-mime="'+esc(f.mime)+'" data-name="'+esc(f.name)+'" checked> '+esc(f.name)+' <span class="muted">('+Math.round(f.size/1024)+' KB)</span></label>').join('')+
       (p.drive_skipped&&p.drive_skipped.length?'<div class="muted" style="font-size:12px;margin-top:8px">Skipped '+p.drive_skipped.length+' unsupported file(s)</div>':'')+'</div>';
     }
     ctrl='<div class="pc-match">'+mb+'</div><label class="pc-l">Target ad set</label><select class="creative-adset" data-row="'+esc(p.row_id)+'">'+adsetOptionsHtml(m?m.adset.id:'')+'</select>'
      +'<label class="pc-l">Button (CTA)</label><select class="creative-cta" data-row="'+esc(p.row_id)+'">'+CTA_OPTS.map(o=>'<option value="'+o.t+'"'+(o.v===(p.cta&&p.cta.enum)?' selected':'')+'>'+o.t+'</option>').join('')+'</select>'
      +driveHtml
      +'<label class="pc-l" style="margin-top:12px">'+(driveHtml?'Or attach manually':'Creative')+' (JPG/PNG or MP4/MOV)</label><input type="file" accept="image/png,image/jpeg,video/mp4,video/quicktime" multiple class="creative-file" data-row="'+esc(p.row_id)+'">'
      +(row.creatives_folder?'<a class="pc-l" style="display:block;color:var(--accent);margin-top:8px" href="'+esc(row.creatives_folder)+'" target="_blank" rel="noopener">📁 Open creative folder ↗</a>':'');
    }
    return '<div class="pcard"><div class="thumb">🖼</div><div class="pc-b"><div class="pc-t">'+esc(p.ad_name)+'</div><div class="pc-m">'+mhtml+'</div>'+b+' '+iss+ctrl+'</div></div>'}).join('')+'</div>';
  const ctaAll=$('#cta-all');if(ctaAll)ctaAll.onchange=()=>{document.querySelectorAll('.creative-cta').forEach(s=>{s.value=ctaAll.value})};
  window.__plans=plans;
  if(plans.some(p=>p.ready))$('#create').classList.remove('hide');
  $('#preview-out').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(_){$('#status').textContent='';banner('Could not build the preview — try again.','err');}
};
// Read-more toggle for long primary text (delegated).
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('more-toggle')){const pm=e.target.closest('.pc-m');if(pm){pm.querySelector('.m-short').classList.toggle('hide');pm.querySelector('.m-full').classList.toggle('hide');}}});
$('#create').onclick=async()=>{
 const client=$('#client').value,adset=$('#adset').value;banner('');
 const ctaByRow={},adsetByRow={};
 document.querySelectorAll('.creative-cta').forEach(s=>{ctaByRow[s.dataset.row]=s.value});
 document.querySelectorAll('.creative-adset').forEach(s=>{adsetByRow[s.dataset.row]=s.value||''});
 const files=[];document.querySelectorAll('.creative-file').forEach(inp=>[...inp.files].forEach(f=>files.push({row:inp.dataset.row,file:f})));
 const driveFiles=[];document.querySelectorAll('.drive-file-cb:checked').forEach(cb=>driveFiles.push({row:cb.dataset.row,url:cb.dataset.url,mime:cb.dataset.mime,name:cb.dataset.name}));
 if(!files.length&&!driveFiles.length){$('#status').innerHTML='<span style="color:var(--bad)">Attach a JPG/PNG creative to a ready row first, then Create.</span>';banner('Attach at least one JPG/PNG creative to a ready row first.','err');$('#status').scrollIntoView({behavior:'smooth',block:'center'});return}
 // Resolve each row's target ad set (per-row match/override, else the global selection).
 const targets={};let missing=0;
 files.forEach(({row})=>{const t=adsetByRow[row]||adset;targets[row]=t;if(!t)missing++;});
 driveFiles.forEach(({row})=>{const t=adsetByRow[row]||adset;targets[row]=t;if(!t)missing++;});
 if(missing){banner('Some rows have no target ad set. Pick a default ad set above, or choose one per card.','err');return}
 const tids=[...new Set(Object.values(targets))];
 const tnames=tids.map(id=>{const a=adsetById(id);return a?a.name:id;});
 const active=tids.map(adsetById).filter(a=>a&&a.status==='ACTIVE');
 const totalCount=files.length+driveFiles.length;
 let msg='Create '+totalCount+' PAUSED draft ad(s) across '+tids.length+' ad set'+(tids.length===1?'':'s')+':\\n\\n• '+tnames.join('\\n• ')+'\\n\\nThe ads are created PAUSED — they will NOT go live; you review and publish in Ads Manager.';
 if(active.length)msg+='\\n\\nNote: '+active.length+' target ad set'+(active.length===1?' is':'s are')+' ACTIVE, but the new ads stay PAUSED regardless.';
 if(!confirm(msg))return;
 $('#create').disabled=true;const items=[],upErr=[];let done=0;
 for(const {row,file} of files){done++;$('#status').textContent='Uploading attached creative '+done+' of '+files.length+'…';
  try{const fd=new FormData();fd.set('file',file);
   const isVid=(file.type||'').indexOf('video/')===0||/\\.(mp4|mov|m4v)$/i.test(file.name);
   if(isVid)$('#status').textContent='Uploading video '+done+' of '+files.length+' (Meta will process it)…';
   const ep=(isVid?'/api/upload-video?client=':'/api/upload-image?client=')+encodeURIComponent(client);
   const r=await fetch(ep,{method:'POST',credentials:'include',body:fd});const j=await r.json().catch(()=>({}));
   if(j.ok&&j.image_hash)items.push({row_id:row,image_hash:j.image_hash,cta:ctaByRow[row]||undefined,adset_id:targets[row]||undefined});
   else if(j.ok&&j.video_id)items.push({row_id:row,video_id:j.video_id,cta:ctaByRow[row]||undefined,adset_id:targets[row]||undefined});
   else upErr.push(file.name+': '+(j.message||'upload rejected'));
  }catch(_){upErr.push(file.name+': network error')}}
 for(const {row,url,mime,name} of driveFiles){
  items.push({row_id:row,drive_file_url:url,drive_file_mime:mime,drive_file_name:name,cta:ctaByRow[row]||undefined,adset_id:targets[row]||undefined});
 }
 if(upErr.length)banner((items.length?'Some creatives failed to upload ('+upErr.length+' of '+files.length+'): ':'All uploads failed: ')+esc(upErr.join('; ')),'err');
 if(!items.length){$('#status').textContent='';$('#create').disabled=false;return}
 $('#status').textContent='Creating '+items.length+' PAUSED draft(s)…';
 try{const r=await fetch('/api/create-drafts',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({client,adset_id:adset||undefined,items})});
  const j=await r.json().catch(()=>({}));$('#status').textContent='';
  const rows=(j.results||[]).map(x=>x.ok?'<div class="brow"><div><span class="badge b-ok">created PAUSED</span> '+esc(x.name||x.ad_id)+(x.qa?' <span class="badge '+(x.qa.pass?'b-ok':'b-warn')+'">QA '+(x.qa.pass?'pass':x.qa.fails+' fail')+'</span>':'')+'</div>'+(x.ads_manager_url?'<a class="cta" href="'+esc(x.ads_manager_url)+'" target="_blank">open in Ads Manager ↗</a>':'')+'</div>':'<div class="brow"><div><span class="badge b-bad">failed</span> '+esc(x.row_id)+' — '+esc(x.error||'')+'</div></div>').join('');
  $('#preview-out').innerHTML='<div class="section-h"><h2>Results — '+(j.created||0)+' of '+(j.requested||items.length)+' created PAUSED</h2></div><div class="card">'+rows+'</div><div class="muted" style="margin-top:10px">Drafted rows are removed from the queue. Review each draft in Ads Manager, then publish there. Nothing is live.</div>';
  // Write-back removed the drafted rows — refresh the bible list so they disappear.
  if((j.drafted_rows||[]).length){try{const b=await api('/api/bible?client='+encodeURIComponent(client));BIBLE=b.rows||[];BIBLE_SOURCE=b.source||'';(j.drafted_rows||[]).forEach(id=>SELECTED.delete(id));renderBible();}catch(_){}}
 }catch(_){$('#status').textContent='';banner('Create request failed — try again.','err')}
 $('#create').disabled=false;
};
fetch('/whoami',{credentials:'include'}).then(r=>r.json()).then(d=>{if(d&&d.authed){showApp(d.email)}else{showLogin('')}}).catch(()=>showLogin(''));
</script></body></html>`;
