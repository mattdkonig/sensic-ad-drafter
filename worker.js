import { syncBibles } from "./lib/sync-worker.mjs";
import { getGoogleToken } from "./lib/google-auth.mjs";
// sensic-ad-drafter/worker.js
// Team tool: turn the client bible into PAUSED draft ads in Meta, with a QA gate.
// Subdir Worker (sibling to creative-brief / sensic-dispatcher). Reuses the proven
// engine in ./lib/fb-draft-ads.mjs. M0 = scaffold + health + engine routes.

import { createDraftAd, createCleanDraft, uploadAdImage, uploadAdVideo, waitVideoReady, getVideoThumbnail, createCleanVideoDraft, createAssetCustomizationDraft, copyObject, configureNewObject, qaAd, XERO, accountCanonicalPage, accountCanonicalIdentities } from "./lib/fb-draft-ads.mjs";
import { notifySlack } from "./lib/slack.mjs";
import { activeClients, listAdsets, accountsForSlug, nameForSlug, bibleRows, markUploaded } from "./data.mjs";
import { assemblePlan, normalizeCta } from "./assembly.mjs";
import { UI_HTML } from "./ui.mjs";
import { issueSession, verifySession, readCookie, SESSION_COOKIE, setCookieHeader, clearCookieHeader } from "./auth.mjs";
import { resolveDriveLink, extractMultipleDriveUrls } from "./drive.mjs";

const BUILD_LABEL = "v0.9.1-loop";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...extra },
  });
}

function sessionSecret(env) { return env.SESSION_SECRET || env.BRAIN_API_TOKEN || ""; }

function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS } });
}

function normBearer(s) {
  return typeof s === "string" ? s.replace(/[\r\n]/g, "").trim() : "";
}

// Constant-time compare.
function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

// Auth. Preferred: Cloudflare Access SSO — when ACCESS_ENFORCED="true", CF has
// already restricted entry to the team (policy lists the 5 emails) and injects a
// verified Cf-Access-Authenticated-User-Email header (client copies are stripped),
// so its presence means authenticated. Interim/programmatic: Bearer BRAIN_API_TOKEN.
async function requireAuth(env, request) {
  // 1) Cloudflare Access (when enforced).
  if (env.ACCESS_ENFORCED === "true") {
    const email = request.headers.get("Cf-Access-Authenticated-User-Email");
    if (email) return null;
    return json({ ok: false, code: "unauthorized", message: "Cloudflare Access sign-in required" }, 401);
  }
  // 2) Session cookie (the login screen).
  const sess = await verifySession(sessionSecret(env), readCookie(request, SESSION_COOKIE));
  if (sess) return null;
  // 3) Bearer (programmatic / interim).
  const expected = env.BRAIN_API_TOKEN;
  if (expected) {
    const got = normBearer((request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
    if (got && safeEq(got, normBearer(expected))) return null;
  }
  return json({ ok: false, code: "unauthorized", message: "login required" }, 401);
}

async function currentEmail(env, request) {
  if (env.ACCESS_ENFORCED === "true") return request.headers.get("Cf-Access-Authenticated-User-Email") || "unknown";
  const sess = await verifySession(sessionSecret(env), readCookie(request, SESSION_COOKIE));
  return sess?.email || "unknown";
}

async function handleLogin(env, request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const pw = String(body.password || "");
  if (!env.LOGIN_PASSWORD) return json({ ok: false, code: "not_configured", message: "LOGIN_PASSWORD not set on the worker" }, 503);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, code: "bad_request", message: "valid email required" }, 400);
  if (!safeEq(pw, String(env.LOGIN_PASSWORD))) return json({ ok: false, code: "unauthorized", message: "incorrect password" }, 401);
  const token = await issueSession(sessionSecret(env), email);
  return json({ ok: true, email }, 200, { "Set-Cookie": setCookieHeader(token) });
}

async function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookieHeader() });
}

function fbReady(env) {
  return !!(env.FB_ACCESS_TOKEN && String(env.FB_ACCESS_TOKEN).trim());
}
function fbArgs(env) {
  return {
    token: String(env.FB_ACCESS_TOKEN).trim(),
    secret: env.FB_APP_SECRET ? String(env.FB_APP_SECRET).trim() : "",
  };
}

async function handleAdsets(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const slug = url.searchParams.get("client");
  if (!slug) return json({ ok: false, code: "bad_request", message: "client query param required" }, 400);
  const accountIds = accountsForSlug(slug);
  if (!accountIds.length) return json({ ok: false, code: "unknown_client", message: `no account for client ${slug}` }, 404);
  try {
    const adsets = await listAdsets({ ...fbArgs(env), accountId: accountIds[0] });
    return json({ ok: true, client: slug, name: nameForSlug(slug), account_id: accountIds[0], adsets });
  } catch (e) {
    return json({ ok: false, code: "fb_error", message: String(e?.message || e) }, 502);
  }
}

async function handleBible(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  const slug = url.searchParams.get("client");
  if (!slug) return json({ ok: false, code: "bad_request", message: "client query param required" }, 400);
  const r = await bibleRows(env, slug);
  return json({ client: slug, ...r });
}

// Dry-run: assemble the ad plan(s) + QA, create NOTHING.
async function handlePreview(env, request) {
  const a = await requireAuth(env, request); if (a) return a;
  const body = await request.json().catch(() => ({}));
  const slug = body.client;
  if (!slug) return json({ ok: false, code: "bad_request", message: "client required" }, 400);
  const accountIds = accountsForSlug(slug);
  if (!accountIds.length) return json({ ok: false, code: "unknown_client", message: `no account for client ${slug}` }, 404);
  const accountId = accountIds[0];

  let pageId = null;
  if (fbReady(env)) { try { pageId = await accountCanonicalPage(fbArgs(env).token, fbArgs(env).secret, accountId); } catch { pageId = null; } }

  const { rows } = await bibleRows(env, slug);
  const selected = Array.isArray(body.row_ids) && body.row_ids.length ? rows.filter((r) => body.row_ids.includes(r.id)) : rows;
  
  const plans = [];
  for (const r of selected) {
    const plan = assemblePlan(r, { pageId });
    if (env.WORKFLOW_MODE !== "manual" && r.creatives_folder && env.GOOGLE_DRIVE_API_KEY) {
      const urls = extractMultipleDriveUrls(r.creatives_folder);
      
      let allFiles = [];
      let allSkipped = [];
      let allErrors = [];
      
      for (const url of urls) {
        let driveToken = null;
        try {
          const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
          driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
        } catch (e) { console.error("Failed to get drive token", e); }
        const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);
        if (driveData.ok) {
          allFiles.push(...driveData.files);
          allSkipped.push(...driveData.skipped);
        } else {
          allErrors.push(driveData.error);
        }
      }
      
      // Deduplicate files by ID
      const seenIds = new Set();
      plan.drive_files = allFiles.filter(f => {
        if (seenIds.has(f.id)) return false;
        seenIds.add(f.id);
        return true;
      });
      plan.drive_skipped = allSkipped;
      
      if (allErrors.length > 0) {
        plan.issues.push({ level: "WARN", msg: `Drive resolution had errors: ${allErrors.join(", ")}` });
      }
      
      if (urls.length > 0) {
        if (plan.drive_files.length === 0) {
          plan.issues.push({ level: "FAIL", msg: "Drive link(s) contain no Meta-acceptable finals (JPG/PNG/MP4)" });
          plan.ready = false;
        } else {
          plan.issues = plan.issues.filter(i => !i.msg.includes("no Drive creatives folder linked"));
          plan.issues.push({ level: "INFO", msg: `Resolved ${plan.drive_files.length} creative(s) from Drive` });
        }
      }
    }
    plans.push(plan);
  }

  return json({
    ok: true,
    client: slug,
    account_id: accountId,
    page_id: pageId,
    adset_id: body.adset_id || null,
    count: plans.length,
    ready: plans.length > 0 && plans.every((p) => p.ready),
    plans,
  });
}

async function audit(env, rec) {
  rec.ts = new Date().toISOString();
  if (env.DRAFTER_KV) { try { await env.DRAFTER_KV.put(`audit:${rec.ts}:${rec.ad_id || "x"}`, JSON.stringify(rec)); } catch { /* best effort */ } }
  console.log("[audit]", JSON.stringify(rec));
}

// Start a new ad set / campaign (copied PAUSED from an existing ad set).
async function handleNewAdset(env, request) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const body = await request.json().catch(() => ({}));
  if (!accountsForSlug(body.client).length) return json({ ok: false, code: "unknown_client", message: "unknown client" }, 404);
  if (!body.from_adset_id) return json({ ok: false, code: "bad_request", message: "from_adset_id required (copy source)" }, 400);
  const kind = body.kind === "campaign" ? "campaign" : "adset";
  const adsetName = String(body.adset_name || body.name || "").trim() || null;
  const campaignName = String(body.campaign_name || "").trim() || null;
  if (kind === "adset" && !adsetName) return json({ ok: false, code: "bad_request", message: "ad set name required" }, 400);
  if (kind === "campaign" && (!campaignName || !adsetName)) return json({ ok: false, code: "bad_request", message: "campaign name and ad set name both required for a new campaign" }, 400);

  const amount = Number(body.budget_amount);
  let budget = null;
  if (body.budget_amount != null && body.budget_amount !== "") {
    if (!(amount > 0)) return json({ ok: false, code: "bad_request", message: "budget must be a positive number" }, 400);
    const btype = body.budget_type === "lifetime" ? "lifetime" : "daily";
    budget = { amount, type: btype, level: body.budget_level === "cbo" ? "cbo" : "abo", endTime: btype === "lifetime" && body.end_time ? String(body.end_time) : null };
  }
  const removeChildAds = body.copy_ads === false || body.copy_ads === "false";

  // copyObject renames the copied object: the campaign (campaign kind) or the ad set (adset kind).
  const renameTo = kind === "campaign" ? campaignName : adsetName;
  const accountId = accountsForSlug(body.client)[0];
  try {
    const r = await copyObject({ ...fbArgs(env), kind, accountId, fromAdsetId: body.from_adset_id, name: renameTo });
    const newId = r?.id || null;
    if (!newId) return json({ ok: false, code: "fb_copy_shape", message: "Meta copy succeeded but returned no id — refresh ad sets and check Ads Manager.", raw: r }, 502);
    let extra = { warnings: [], applied: {}, child_adset_id: kind === "adset" ? newId : (r.child_adset_id || null) };
    try { extra = await configureNewObject({ ...fbArgs(env), kind, newId, childAdsetId: r.child_adset_id, adsetName: kind === "campaign" ? adsetName : null, budget, removeChildAds }); }
    catch (e) { extra.warnings = [String(e?.message || e)]; }
    if (r.copy_warning) extra.warnings = [r.copy_warning, ...(extra.warnings || [])];
    await audit(env, { user: await currentEmail(env, request), client: body.client, action: "new_" + kind, new_id: newId, name: renameTo, applied: extra.applied });
    return json({ ok: true, kind, id: newId, campaign_id: kind === "campaign" ? newId : null, adset_id: kind === "adset" ? newId : (extra.child_adset_id || null), name: renameTo, applied: extra.applied || {}, warnings: extra.warnings || [] });
  } catch (e) {
    const raw = String(e?.message || e);
    let message = raw;
    if (/1870090|Custom audience terms/i.test(raw)) message = "Almost there — this ad account just needs to accept Meta's Custom Audience terms once. An admin can do it in Meta Business Settings → Audiences (accept the terms), then copying will work. Nothing was changed.";
    else if (/instagram_positions|2490392/.test(raw)) message = "Meta wouldn't copy this particular ad set — it didn't accept the placement settings (this tends to happen with older or specially-targeted ad sets, and it's a Meta limitation, not a Sensic bug). Easiest fix: pick a different ad set to copy from — most copy fine — or duplicate this one directly in Ads Manager. Nothing was changed.";
    else if (/1885194/.test(raw)) message = "Meta wouldn't deep-copy this whole campaign. Try 'New ad set — in the same campaign' from a clean source ad set instead. Nothing was changed.";
    else message = "Meta couldn't complete that: " + raw + ". Nothing was changed — try a different source ad set.";
    return json({ ok: false, code: "fb_error", message, raw }, 502);
  }
}

// Upload a creative image (multipart "file") to Meta /adimages -> image_hash.
// Lets the team attach approved creatives in the UI without any Drive credential.
async function handleUploadImage(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const slug = url.searchParams.get("client");
  const accountIds = accountsForSlug(slug);
  if (!accountIds.length) return json({ ok: false, code: "unknown_client", message: `no account for ${slug}` }, 404);
  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, code: "bad_request", message: "expected multipart form-data" }, 400); }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ ok: false, code: "bad_request", message: "file field required" }, 400);
  const name = file.name || "creative.jpg";
  if (!/\.(jpe?g|png)$/i.test(name)) return json({ ok: false, code: "bad_format", message: "only JPG/PNG images are accepted" }, 400);
  if (file.size > 30 * 1024 * 1024) return json({ ok: false, code: "too_large", message: "image exceeds 30MB" }, 400);
  try {
    const bytes = await file.arrayBuffer();
    const hash = await uploadAdImage({ ...fbArgs(env), accountId: accountIds[0], bytes, filename: name });
    return json({ ok: true, image_hash: hash, filename: name });
  } catch (e) {
    return json({ ok: false, code: "fb_error", message: String(e?.message || e) }, 502);
  }
}

// Upload a video (multipart "file") to Meta /advideos -> video_id. Meta then
// processes it asynchronously; create-drafts waits for "ready" before building the ad.
async function handleUploadVideo(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const slug = url.searchParams.get("client");
  const accountIds = accountsForSlug(slug);
  if (!accountIds.length) return json({ ok: false, code: "unknown_client", message: `no account for ${slug}` }, 404);
  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, code: "bad_request", message: "expected multipart form-data" }, 400); }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ ok: false, code: "bad_request", message: "file field required" }, 400);
  const name = file.name || "creative.mp4";
  if (!/\.(mp4|mov|m4v)$/i.test(name)) return json({ ok: false, code: "bad_format", message: "only MP4/MOV videos are accepted" }, 400);
  if (file.size > 200 * 1024 * 1024) return json({ ok: false, code: "too_large", message: "video exceeds 200MB" }, 400);
  try {
    const bytes = await file.arrayBuffer();
    const videoId = await uploadAdVideo({ ...fbArgs(env), accountId: accountIds[0], bytes, filename: name });
    return json({ ok: true, video_id: videoId, filename: name });
  } catch (e) {
    return json({ ok: false, code: "fb_error", message: String(e?.message || e) }, 502);
  }
}

// Create clean PAUSED drafts from bible rows. Each item supplies its creative as
// image_hash (already uploaded) or image_url (public). Drive auto-resolution =
// M3.5 sync. Creates one ad per item; QAs and audits each.
async function handleCreateDrafts(env, request) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const body = await request.json().catch(() => ({}));
  const slug = body.client;
  const defaultAdset = body.adset_id || null;
  const items = Array.isArray(body.items) ? body.items : [];
  if (!slug || !items.length) return json({ ok: false, code: "bad_request", message: "client and items[] required" }, 400);
  if (!defaultAdset && !items.every((it) => it.adset_id)) return json({ ok: false, code: "bad_request", message: "each item needs an adset_id, or pass a default adset_id" }, 400);
  const accountIds = accountsForSlug(slug);
  if (!accountIds.length) return json({ ok: false, code: "unknown_client", message: `no account for ${slug}` }, 404);
  const accountId = accountIds[0];
  const who = await currentEmail(env, request);

  let pageId = null;
  let instagramActorId = null;
  let instagramUserId = null;
  try { 
    const ids = await accountCanonicalIdentities(fbArgs(env).token, fbArgs(env).secret, accountId); 
    pageId = ids.pageId;
    instagramActorId = ids.instagramActorId;
    instagramUserId = ids.instagramUserId;
  } catch { pageId = null; instagramActorId = null; instagramUserId = null; }

  const { rows } = await bibleRows(env, slug);
  const results = [];
  const seen = new Set();
  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (const item of items) {
    if (results.length > 0) await delay(500); // Rate limit: 500ms between Meta API calls

    const rowId = item.row_id;
    // Idempotency within a request: same row + same creative = skip (allows
    // multiple distinct creatives per bible row -> multiple ads).
    const dedupeKey = rowId + "|" + (item.image_hash || item.image_url || item.drive_file_url || "");
    if (seen.has(dedupeKey)) { results.push({ row_id: rowId, ok: false, error: "duplicate creative in request" }); continue; }
    seen.add(dedupeKey);
    const row = rows.find((r) => r.id === rowId);
    if (!row) { results.push({ row_id: rowId, ok: false, error: "row not found in bible" }); continue; }
    if (row.uploaded) { results.push({ row_id: rowId, ok: false, error: "duplicate prevention: row is already marked as uploaded" }); continue; }
    const plan = assemblePlan(row, { pageId });
    if (item.drive_file_format && item.drive_file_format !== "unknown") {
      plan.ad_name = `${plan.ad_name} - ${item.drive_file_format}`;
    }
    // Per-row CTA override from the UI dropdown (lets staff fix a blank/invalid bible CTA).
    if (item.cta) { plan.cta = normalizeCta(item.cta); plan.issues = (plan.issues || []).filter((i) => !/^CTA /.test(i.msg)); plan.ready = (plan.issues || []).filter((i) => i.level === "FAIL").length === 0; }
    if (!plan.ready) { results.push({ row_id: rowId, ok: false, error: "plan not ready", issues: plan.issues }); continue; }
    
    const assets = item.assets || [];
    if (assets.length === 0 && !item.image_hash && !item.image_url && !item.video_id && !item.drive_file_url) { 
      results.push({ row_id: rowId, ok: false, error: "no creative (attach an image or a video, or provide a drive_file_url)" }); 
      continue; 
    }

    // Backward compatibility for old UI payloads
    if (assets.length === 0) {
      if (item.drive_file_url) assets.push({ type: 'drive', url: item.drive_file_url, mime: item.drive_file_mime, name: item.drive_file_name, format: item.drive_file_format });
      else if (item.image_hash) assets.push({ type: 'image', hash: item.image_hash, format: 'unknown' });
      else if (item.video_id) assets.push({ type: 'video', id: item.video_id, format: 'unknown' });
      else if (item.image_url) assets.push({ type: 'image_url', url: item.image_url, format: 'unknown' });
    }

    const adsetId = item.adset_id || defaultAdset;
    if (!adsetId) { results.push({ row_id: rowId, ok: false, error: "no ad set for this row (no match and no default selected)" }); continue; }
    
    try {
      let created;
      const finalImages = [];
      const finalVideos = [];
      let hasError = false;
      let errorMsg = "";

      for (const asset of assets) {
        if (asset.type === 'drive') {
          try {
            const fetchOpts = {};
            if (asset.url.includes("googleapis.com/drive")) {
              try {
                const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
                const driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
                fetchOpts.headers = { 'Authorization': `Bearer ${driveToken}` };
              } catch (e) { console.error("Failed to get drive token for download", e); }
            }
            const res = await fetch(asset.url, fetchOpts);
            if (!res.ok) throw new Error(`Failed to download from Drive: ${res.status}`);
            const bytes = await res.arrayBuffer();
            const isVideo = asset.mime === "video/mp4" || asset.mime === "video/quicktime";
            if (isVideo) {
              const vid = await uploadAdVideo({ ...fbArgs(env), accountId, bytes, filename: asset.name || "video.mp4" });
              finalVideos.push({ id: vid, format: asset.format });
            } else {
              const hash = await uploadAdImage({ ...fbArgs(env), accountId, bytes, filename: asset.name || "image.jpg" });
              finalImages.push({ hash, format: asset.format });
            }
          } catch (err) {
            hasError = true;
            errorMsg = `Drive download/upload failed: ${err.message}`;
            break;
          }
        } else if (asset.type === 'image') {
          finalImages.push({ hash: asset.hash, format: asset.format });
        } else if (asset.type === 'video') {
          finalVideos.push({ id: asset.id, format: asset.format });
        } else if (asset.type === 'image_url') {
          finalImages.push({ url: asset.url, format: asset.format });
        }
      }

      if (hasError) {
        results.push({ row_id: rowId, ok: false, error: errorMsg });
        continue;
      }

      for (const v of finalVideos) {
        const ready = await waitVideoReady({ ...fbArgs(env), videoId: v.id });
        if (ready === "error") { hasError = true; errorMsg = "Meta could not process a video"; break; }
        if (ready !== "ready") { hasError = true; errorMsg = "Video uploaded but still processing on Meta. Please click 'Create' again in 30 seconds."; break; }
        v.thumb = await getVideoThumbnail({ ...fbArgs(env), videoId: v.id });
      }

      if (hasError) {
        results.push({ row_id: rowId, ok: false, error: errorMsg });
        continue;
      }

      // Group assets by format to determine if we need to create multiple ads (variants)
      const formatGroups = {};
      finalImages.forEach(img => {
        const f = img.format || 'unknown';
        if (!formatGroups[f]) formatGroups[f] = { images: [], videos: [] };
        formatGroups[f].images.push(img);
      });
      finalVideos.forEach(vid => {
        const f = vid.format || 'unknown';
        if (!formatGroups[f]) formatGroups[f] = { images: [], videos: [] };
        formatGroups[f].videos.push(vid);
      });

      let numAds = 1;
      for (const group of Object.values(formatGroups)) {
        numAds = Math.max(numAds, group.images.length, group.videos.length);
      }

      const originalAdName = plan.ad_name;

      for (let i = 0; i < numAds; i++) {
        const adImages = [];
        const adVideos = [];

        for (const group of Object.values(formatGroups)) {
          if (group.images.length > 0) {
            adImages.push(group.images[Math.min(i, group.images.length - 1)]);
          }
          if (group.videos.length > 0) {
            adVideos.push(group.videos[Math.min(i, group.videos.length - 1)]);
          }
        }

        // If creating multiple ads, append a variant suffix
        if (numAds > 1) {
          plan.ad_name = `${originalAdName} - Var ${i + 1}`;
        }

        try {
          if (adImages.length + adVideos.length > 1) {
            // Use Placement Asset Customization (PAC) for multiple creatives
            created = await createAssetCustomizationDraft({ 
              ...fbArgs(env), accountId, adsetId, plan, 
              images: adImages, videos: adVideos, 
              instagramActorId: item.instagram_actor_id || instagramActorId,
              instagramUserId: item.instagram_user_id || instagramUserId
            });
          } else if (adVideos.length === 1) {
            created = await createCleanVideoDraft({ 
              ...fbArgs(env), accountId, adsetId, plan, 
              videoId: adVideos[0].id, thumbnailUrl: adVideos[0].thumb, 
              instagramActorId: item.instagram_actor_id || instagramActorId,
              instagramUserId: item.instagram_user_id || instagramUserId
            });
          } else if (adImages.length === 1) {
            created = await createCleanDraft({ 
              ...fbArgs(env), accountId, adsetId, plan, 
              imageHash: adImages[0].hash, imageUrl: adImages[0].url, 
              instagramActorId: item.instagram_actor_id || instagramActorId,
              instagramUserId: item.instagram_user_id || instagramUserId
            });
          }

          let qa = null;
          try { const q = await qaAd({ ...fbArgs(env), adId: created.ad_id, expectedPage: pageId || "", expectedAccount: accountId }); qa = { pass: q.pass, fails: q.fails, warns: q.warns }; } catch { qa = null; }
          await audit(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, ad_id: created.ad_id, qa });
          results.push({ row_id: rowId, ok: true, adset_id: adsetId, ...created, qa });
        } catch (e) {
          results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
        }
      }
    } catch (e) {
      results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
    }
  }
  const created = results.filter((r) => r.ok).length;
  // Write-back: any row with ≥1 successful ad leaves the queue (cross-session dedupe).
  const doneRowIds = [...new Set(results.filter((r) => r.ok).map((r) => r.row_id))];
  await markUploaded(env, slug, doneRowIds);
  
  // Slack notifications
  if (created > 0) {
    const webhookEnvKey = `SLACK_WEBHOOK_${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const webhookUrl = env[webhookEnvKey] || env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const successAds = results.filter(r => r.ok);
      const blocks = [
        {
          type: "header",
          text: { type: "plain_text", text: `🚀 New PAUSED Drafts Created for ${slug}` }
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*${created}* new ad(s) were just drafted to Meta by ${who}.` }
        }
      ];
      
      successAds.slice(0, 10).forEach(ad => {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `• *${ad.name}*\n<${ad.ads_manager_url}|View in Ads Manager>` }
        });
      });
      
      if (successAds.length > 10) {
        blocks.push({
          type: "context",
          elements: [{ type: "mrkdwn", text: `...and ${successAds.length - 10} more.` }]
        });
      }
      
      // Fire and forget
      request.ctx?.waitUntil?.(notifySlack(webhookUrl, { blocks })) || notifySlack(webhookUrl, { blocks });
    }
  }

  return json({ ok: true, client: slug, requested: items.length, created, drafted_rows: doneRowIds, results });
}

const LANDING = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sensic Ad Drafter</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:64px auto;padding:0 20px;color:#1a1a1a}
h1{font-weight:600}code{background:#f1efe8;padding:2px 6px;border-radius:6px}.muted{color:#666}</style>
<h1>Sensic Ad Drafter</h1>
<p class="muted">Client bible &rarr; Meta PAUSED draft ads, with a QA gate. Scaffold (M0). UI ships in M4.</p>
<p>Health: <code>/health</code> &middot; Version: <code>/api/version</code></p>`;

async function handleCreateDraft(env, request) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const body = await request.json().catch(() => ({}));
  if (!body.sourceAdId && !(body.creativeId && body.adsetId)) {
    return json({ ok: false, code: "bad_request", message: "Provide sourceAdId, or creativeId + adsetId." }, 400);
  }
  try {
    const r = await createDraftAd({ ...fbArgs(env), accountId: body.accountId || XERO.accountId, sourceAdId: body.sourceAdId, creativeId: body.creativeId, adsetId: body.adsetId, name: body.name });
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: false, code: "fb_error", message: String(e?.message || e) }, 502);
  }
}

// Recent create activity (from the KV audit log) — powers the in-app "Recent" view.
async function handleAudit(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!env.DRAFTER_KV) return json({ ok: true, entries: [], note: "no audit store" });
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);
  try {
    const list = await env.DRAFTER_KV.list({ prefix: "audit:", limit: 200 });
    const keys = (list.keys || []).map((k) => k.name).sort().reverse().slice(0, limit);
    const entries = [];
    for (const k of keys) { try { const v = await env.DRAFTER_KV.get(k, "json"); if (v) entries.push(v); } catch { /* skip */ } }
    return json({ ok: true, entries });
  } catch (e) {
    return json({ ok: false, code: "kv_error", message: String(e?.message || e) }, 502);
  }
}

async function handleQa(env, request, url) {
  const a = await requireAuth(env, request); if (a) return a;
  if (!fbReady(env)) return json({ ok: false, code: "no_fb_token", message: "FB_ACCESS_TOKEN not configured" }, 503);
  const adId = url.searchParams.get("ad_id");
  if (!adId) return json({ ok: false, code: "bad_request", message: "ad_id required" }, 400);
  try {
    const r = await qaAd({ ...fbArgs(env), adId, expectCatalog: url.searchParams.get("expect_catalog") || "none", expectedPage: url.searchParams.get("expect_page") || "" });
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: false, code: "fb_error", message: String(e?.message || e) }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === "/" ) return html(UI_HTML.replace('__WORKFLOW_MODE__', env.WORKFLOW_MODE || 'auto'));
      if (p === "/api/login" && request.method === "POST") return await handleLogin(env, request);
      if (p === "/api/logout" && request.method === "POST") return await handleLogout();
      if (p === "/whoami") { const email = await currentEmail(env, request); return json({ ok: true, authed: email !== "unknown", email: email === "unknown" ? null : email }); }
      if (p === "/health") return json({ ok: true, service: "sensic-ad-drafter", build: BUILD_LABEL, hasFbToken: fbReady(env), hasFbSecret: !!(env.FB_APP_SECRET && String(env.FB_APP_SECRET).trim()), hasAuthToken: !!env.BRAIN_API_TOKEN, accessEnforced: env.ACCESS_ENFORCED === "true", hasKv: !!env.DRAFTER_KV });
      if (p === "/api/version") return json({ ok: true, service: "sensic-ad-drafter", build: BUILD_LABEL });
      if (p === "/api/sync" && request.method === "POST") {
        const a = await requireAuth(env, request); if (a) return a;
        try {
          const urlObj = new URL(request.url);
          const targetSlug = urlObj.searchParams.get("client");
          const results = await syncBibles(env, targetSlug);
          return json({ ok: true, results });
        } catch (e) {
          return json({ ok: false, error: String(e.message || e) }, 500);
        }
      }
      if (p === "/api/clients" && request.method === "GET") { const a = await requireAuth(env, request); if (a) return a; const r = await activeClients(env); return json({ ok: true, ...r }); }
      if (p === "/api/adsets" && request.method === "GET") return await handleAdsets(env, request, url);
      if (p === "/api/bible" && request.method === "GET") return await handleBible(env, request, url);
      if (p === "/api/preview" && request.method === "POST") return await handlePreview(env, request);
      if (p === "/api/upload-image" && request.method === "POST") return await handleUploadImage(env, request, url);
      if (p === "/api/upload-video" && request.method === "POST") return await handleUploadVideo(env, request, url);
      if (p === "/api/new-adset" && request.method === "POST") return await handleNewAdset(env, request);
      if (p === "/api/create-drafts" && request.method === "POST") return await handleCreateDrafts(env, request);
      if (p === "/api/create-draft-ad" && request.method === "POST") return await handleCreateDraft(env, request);
      if (p === "/api/audit" && request.method === "GET") return await handleAudit(env, request, url);
      if (p === "/api/qa-ad" && request.method === "GET") return await handleQa(env, request, url);
      return json({ ok: false, code: "not_found", message: `no route for ${p}` }, 404);
    } catch (e) {
      return json({ ok: false, code: "internal_error", message: String(e?.message || e) }, 500);
    }
  },
};
