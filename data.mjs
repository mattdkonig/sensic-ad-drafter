// sensic-ad-drafter/data.mjs
// Read-layer for the drafter UI: which clients are eligible, their live ad sets,
// and bible rows. Keeps the Worker credential-light:
//   - clients: bundled Basecamp-matched seed, overridable live via DRAFTER_KV.
//   - ad sets: live from Meta (Worker already holds FB_ACCESS_TOKEN).
//   - bible rows: from DRAFTER_KV (synced in M2); empty-state until then.

import accountMap from "../lib/account-map.json" with { type: "json" };
import { graphGet } from "../lib/fb-draft-ads.mjs";
import activeSeed from "./seed/active-clients.json" with { type: "json" };
import bibles from "./seed/bibles.json" with { type: "json" };

// Bundled bible seeds, keyed by client slug (synced from each client's Drive
// Ad Tracker by sync/sync-bibles.mjs). DRAFTER_KV bible:{slug} overrides when present.
const BIBLE_SEED = bibles;

// All accounts for a client slug (some clients have >1 ad account).
export function accountsForSlug(slug) {
  const ids = [];
  for (const [id, v] of Object.entries(accountMap)) {
    if (id.startsWith("_")) continue;
    if (v.slug === slug) ids.push(id);
  }
  return ids;
}

export function nameForSlug(slug) {
  for (const [id, v] of Object.entries(accountMap)) {
    if (id.startsWith("_")) continue;
    if (v.slug === slug) return v.name;
  }
  return slug;
}

// Eligible clients = account-map ∩ active Basecamp projects.
// DRAFTER_KV "clients:active" (shape {active:{slug:project}}) overrides the seed
// so the list can be refreshed live without a redeploy.
export async function activeClients(env) {
  let active = activeSeed.active;
  let source = "seed";
  if (env.DRAFTER_KV) {
    try {
      const kv = await env.DRAFTER_KV.get("clients:active", "json");
      if (kv && kv.active && Object.keys(kv.active).length) { active = kv.active; source = "kv"; }
    } catch { /* fall back to seed */ }
  }
  const seen = new Set();
  const out = [];
  for (const [id, v] of Object.entries(accountMap)) {
    if (id.startsWith("_")) continue;
    if (!(v.slug in active)) continue;
    let row = out.find((c) => c.slug === v.slug);
    if (!row) { row = { slug: v.slug, name: v.name, account_ids: [], basecamp_project: active[v.slug] }; out.push(row); seen.add(v.slug); }
    row.account_ids.push(id);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return { source, clients: out };
}

// Live ad sets for a client (first/only account). Excludes archived/deleted.
// Includes the parent campaign objective + the ad set's optimization/budget so the
// "new ad set / campaign" modal can show staff exactly what a copy will inherit.
export async function listAdsets({ token, secret, accountId }) {
  const money = (cents) => (cents == null || cents === "" ? null : Math.round(Number(cents)) / 100);
  const fields = "id,name,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,campaign{id,name,objective,daily_budget,lifetime_budget}";
  // Page through ALL ad sets — Meta returns 200 per page; follow the cursor so
  // accounts with >200 ad sets aren't silently truncated. Hard cap (25 pages =
  // 5000 ad sets) guards against a runaway loop if Meta returns a stuck cursor.
  const raw = [];
  let after = null;
  for (let page = 0; page < 25; page++) {
    const q = `act_${accountId}/adsets?fields=${fields}&limit=200${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const r = await graphGet(token, secret, q);
    const data = r.data || [];
    raw.push(...data);
    after = r?.paging?.cursors?.after || null;
    if (!after || !data.length) break;
  }
  return raw
    .map((a) => {
      const camp = a?.campaign || {};
      const cbo = money(camp.daily_budget) || money(camp.lifetime_budget) || null;
      return {
        id: a.id,
        name: a.name,
        status: a.effective_status,
        campaign: camp.name || null,
        campaign_id: camp.id || null,
        objective: camp.objective || null,
        optimization_goal: a.optimization_goal || null,
        billing_event: a.billing_event || null,
        bid_strategy: a.bid_strategy || null,
        budget_level: cbo ? "cbo" : (money(a.daily_budget) || money(a.lifetime_budget) ? "abo" : null),
        daily_budget: money(a.daily_budget),
        lifetime_budget: money(a.lifetime_budget),
        campaign_budget: cbo,
      };
    })
    .filter((a) => a.status !== "ARCHIVED" && a.status !== "DELETED");
}

// Rows the team has already drafted this/previous sessions — written back by
// markUploaded after a successful create, so a row leaves the queue and is never
// double-drafted. Survives redeploys (lives in KV, keyed per client).
async function uploadedSet(env, slug) {
  if (!env.DRAFTER_KV) return new Set();
  try { const a = await env.DRAFTER_KV.get(`uploaded:${slug}`, "json"); return new Set(Array.isArray(a) ? a : []); }
  catch { return new Set(); }
}

export async function markUploaded(env, slug, ids) {
  if (!env.DRAFTER_KV || !Array.isArray(ids) || !ids.length) return;
  try {
    const a = await env.DRAFTER_KV.get(`uploaded:${slug}`, "json");
    const set = new Set(Array.isArray(a) ? a : []);
    ids.forEach((i) => set.add(i));
    await env.DRAFTER_KV.put(`uploaded:${slug}`, JSON.stringify([...set]));
  } catch { /* best effort */ }
}

// Bible rows for a client (Ad Tracker, Uploaded?=No).
// KV (live sync) takes precedence; bundled seed is the fallback. Rows already
// drafted (uploaded:{slug} write-back) are filtered out in both cases.
export async function bibleRows(env, slug) {
  const done = await uploadedSet(env, slug);
  if (env.DRAFTER_KV) {
    try {
      const rows = await env.DRAFTER_KV.get(`bible:${slug}`, "json");
      if (Array.isArray(rows)) return { ok: true, rows: rows.filter((r) => !r.uploaded && !done.has(r.id)), source: "kv", drafted: done.size };
    } catch { /* fall through */ }
  }
  if (BIBLE_SEED[slug]) return { ok: true, rows: BIBLE_SEED[slug].filter((r) => !r.uploaded && !done.has(r.id)), source: "seed", drafted: done.size };
  return { ok: true, rows: [], reason: "bible_sync_pending", source: "none" };
}
