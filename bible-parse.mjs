// sensic-ad-drafter/bible-parse.mjs
// Schema-aware parser that turns a client "bible" sheet (exported per-tab as CSV)
// into drafter bible rows. Handles TWO real-world schemas discovered in QA:
//   (A) standard "Ad Tracker" template — one tab, columns vary in ORDER between
//       clients, status column is "Uploaded?" (FALSE=pending) or "READY FOR
//       UPLOAD" (TRUE=pending); a filled "Date Uploaded" always means done.
//   (B) Chief — tab-based ("READY FOR UPLOAD AU"/"…US"); status col "UPLOADED"
//       (FALSE=pending); bespoke column names; no CTA/Date Uploaded columns.
// Columns are matched BY HEADER NAME (never by fixed index) so order changes
// don't break it. This is the durable replacement for hand-parsing each sheet.
import { slugify } from "./assembly.mjs";

// --- CSV -> 2D array (handles quoted fields, embedded commas/newlines, CRLF) ---
export function csvToRows(text) {
  const rows = []; let row = [], field = "", q = false;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (s) => String(s ?? "").trim();
const lc = (s) => norm(s).toLowerCase();
const toInt = (v) => { const n = parseInt(String(v).replace(/[^0-9.]/g, ""), 10); return Number.isFinite(n) ? n : null; };

const STATUS_HEADERS = ["uploaded?", "ready for upload", "ad tracker uploaded?", "uploaded"];
// header alias -> canonical field
const COLS = {
  concept: ["creative description"],
  objective: ["objective"],
  type: ["type"],
  num_creatives: ["# of creatives", "number of creatives"],
  primary_text: ["primary text"],
  headline: ["headline", "headline text"],
  cta: ["cta"],
  landing_url: ["landing page url", "destination link"],
  creatives_folder: ["link to creatives", "link to creative"],
  campaign: ["campaign name"],
  adset_hint: ["ad set name/s", "ad set name", "naming convention"],
  date_uploaded: ["date uploaded"],
};

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (rows[i].some((c) => lc(c) === "creative description")) return i;
  }
  return -1;
}

function colMap(headerRow) {
  const pos = {};
  headerRow.forEach((h, j) => { const k = lc(h); if (k && !(k in pos)) pos[k] = j; });
  const map = {};
  for (const [field, aliases] of Object.entries(COLS)) {
    for (const a of aliases) if (a in pos) { map[field] = pos[a]; break; }
  }
  let statusCol = null;
  for (const h of STATUS_HEADERS) if (h in pos) { statusCol = { idx: pos[h], name: h }; break; }
  return { map, statusCol };
}

function isPending(statusName, statusVal, dateUploaded) {
  if (norm(dateUploaded)) return false;                 // done guard: a real upload date wins
  const v = lc(statusVal);
  if (!statusName) return true;                         // no status column -> treat tab as the queue
  if (statusName.includes("ready")) return ["true", "yes", "ready", "1"].includes(v);
  return !["true", "uploaded", "yes", "done", "1"].includes(v);   // "Uploaded?" family
}

// Parse one tab's grid (2D array incl. header) into bible rows for `slug`.
export function parseBibleGrid(rows, slug) {
  const hr = findHeaderRow(rows);
  if (hr < 0) return { rows: [], reason: "no_header" };
  const { map, statusCol } = colMap(rows[hr]);
  if (map.concept == null) return { rows: [], reason: "no_concept_col" };
  const get = (r, f) => (map[f] != null ? norm(r[map[f]]) : "");
  const out = [], seen = {};
  for (let i = hr + 2; i < rows.length; i++) {          // skip header + the "e.g." example row
    const r = rows[i] || [];
    const concept = get(r, "concept");
    if (!concept || lc(concept).startsWith("e.g")) continue;
    const sVal = statusCol ? r[statusCol.idx] : "";
    if (!isPending(statusCol && statusCol.name, sVal, get(r, "date_uploaded"))) continue;
    let id = `${slug}-${slugify(concept)}`;
    if (seen[id]) { seen[id]++; id = `${id}-${seen[id]}`; } else seen[id] = 1;
    const land = get(r, "landing_url"), folder = get(r, "creatives_folder");
    out.push({
      id, uploaded: false, concept,
      objective: get(r, "objective") || null,
      type: get(r, "type") || null,
      num_creatives: map.num_creatives != null ? toInt(r[map.num_creatives]) : null,
      primary_text: get(r, "primary_text") || null,
      headline: get(r, "headline") || null,
      cta: get(r, "cta") || null,
      landing_url: /^https?:\/\//i.test(land) ? land : null,
      campaign: get(r, "campaign") || null,
      adset_hint: get(r, "adset_hint") || null,
      creatives_folder: /^https?:\/\//i.test(folder) ? folder : null,
    });
  }
  return { rows: out, reason: "ok", headerRow: hr };
}

// Multi-tab: tabs = { tabName: grid }. mapping = { slug: [tabNames...] } (Chief),
// or a single { slug: [theOnlyTab] } for the standard template.
export function parseBibleTabs(tabs, mapping) {
  const result = {};
  for (const [slug, tabNames] of Object.entries(mapping)) {
    const rows = [];
    for (const t of tabNames) if (tabs[t]) rows.push(...parseBibleGrid(tabs[t], slug).rows);
    result[slug] = rows;
  }
  return result;
}
