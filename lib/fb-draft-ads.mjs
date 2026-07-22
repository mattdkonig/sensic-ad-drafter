// lib/fb-draft-ads.mjs
// Create Meta ads as PAUSED ("draft-equivalent") and QA them, from the Cloudflare
// Worker (which has internet + the FB_ACCESS_TOKEN secret). Pure Web-Crypto, no
// node deps, so it runs in Workers.
//
// Exposed:
//   createDraftAd({ token, secret, accountId, sourceAdId?, creativeId?, adsetId?, name? })
//   qaAd({ token, secret, adId, expectCatalog })
//
// Clone mode (sourceAdId): reads the source ad's creative + ad set and recreates
// it as a new PAUSED ad. No new creative uploaded — safest test of the write path.

const GRAPH = "https://graph.facebook.com/v21.0";

export const XERO = {
  accountId: "275188403088342",
  // Verified live ad Page (cloning an ACTIVE Xero ad yields this). The bible's
  // 100064146545163 was a stale organic-post link, NOT the page ads run from.
  pageId: "310300079413417",
  businessId: "1265423940983287",
};

// Derive the page and IG actor an account actually runs ads from (modal across its
// recent ads). Self-calibrating, so QA works for every client without a
// hardcoded page per account. Returns { pageId: "", instagramActorId: "", instagramUserId: "" } if it cannot be determined.
export async function accountCanonicalIdentities(token, secret, acct) {
  try {
    const r = await graphGet(
      token,
      secret,
      `act_${acct}/ads?fields=creative{object_story_spec{page_id,instagram_actor_id,instagram_user_id}}&limit=40`
    );
    const pCounts = {};
    const actorCounts = {};
    const userCounts = {};
    for (const ad of r.data || []) {
      const pid = ad?.creative?.object_story_spec?.page_id;
      if (pid) pCounts[pid] = (pCounts[pid] || 0) + 1;
      
      const actorId = ad?.creative?.object_story_spec?.instagram_actor_id;
      if (actorId) actorCounts[actorId] = (actorCounts[actorId] || 0) + 1;
      
      const userId = ad?.creative?.object_story_spec?.instagram_user_id;
      if (userId) userCounts[userId] = (userCounts[userId] || 0) + 1;
    }
    let bestP = "", nP = 0;
    for (const [pid, c] of Object.entries(pCounts)) if (c > nP) { bestP = pid; nP = c; }
    
    let bestActor = "", nActor = 0;
    for (const [iid, c] of Object.entries(actorCounts)) if (c > nActor) { bestActor = iid; nActor = c; }
    
    let bestUser = "", nUser = 0;
    for (const [iid, c] of Object.entries(userCounts)) if (c > nUser) { bestUser = iid; nUser = c; }
    
    return { pageId: bestP, instagramActorId: bestActor, instagramUserId: bestUser };
  } catch {
    return { pageId: "", instagramActorId: "", instagramUserId: "" };
  }
}

export async function accountCanonicalPage(token, secret, acct) {
  const { pageId } = await accountCanonicalIdentities(token, secret, acct);
  return pageId;
}

const enc = (s) => new TextEncoder().encode(s);

async function appsecretProof(token, secret) {
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc(token));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authParams(token, secret) {
  const p = new URLSearchParams();
  p.set("access_token", token);
  const proof = await appsecretProof(token, secret);
  if (proof) p.set("appsecret_proof", proof);
  return p;
}

function fbError(body) {
  const e = body?.error;
  if (!e) return null;
  let hint = "";
  if (e.code === 190) hint = " (token invalid/expired — regenerate FB_ACCESS_TOKEN)";
  else if (e.code === 200 || e.code === 10 || e.code === 803) hint = " (token needs ads_management + access to this account & Page)";
  // Surface which field Meta is unhappy about — invaluable for "Invalid parameter".
  let extra = "";
  const blame = e.error_data && e.error_data.blame_field_specs;
  if (blame) { try { extra = " [field: " + JSON.stringify(blame) + "]"; } catch { /* ignore */ } }
  else if (e.error_user_msg) extra = " — " + e.error_user_msg;
  return `FB ${e.code}${e.error_subcode ? "/" + e.error_subcode : ""}: ${e.message}${extra}${hint}`;
}

export async function graphGet(token, secret, pathAndQuery) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const auth = (await authParams(token, secret)).toString();
  const res = await fetch(`${GRAPH}/${pathAndQuery}${sep}${auth}`);
  const body = await res.json().catch(() => ({}));
  const err = fbError(body);
  if (err) throw new Error(err);
  return body;
}

async function graphPost(token, secret, path, fields) {
  const form = await authParams(token, secret);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  const err = fbError(body);
  if (err) throw new Error(err);
  return body;
}

export async function createDraftAd({ token, secret, accountId, sourceAdId, creativeId, adsetId, name }) {
  const acct = (accountId || XERO.accountId).replace(/^act_/, "");
  let resolvedAdset = adsetId;
  let resolvedCreativeId = creativeId;
  let baseName = name;

  if (sourceAdId) {
    const src = await graphGet(token, secret, `${sourceAdId}?fields=name,adset_id,account_id,creative{id}`);
    const srcAcct = String(src.account_id || "").replace(/^act_/, "");
    if (srcAcct && srcAcct !== acct) {
      throw new Error(`Source ad ${sourceAdId} is in account ${srcAcct}, not ${acct}. Refusing.`);
    }
    resolvedAdset = resolvedAdset || src.adset_id;
    resolvedCreativeId = resolvedCreativeId || src?.creative?.id;
    baseName = baseName || src.name;
  }

  if (!resolvedAdset) throw new Error("No adset_id (pass adset_id or a sourceAdId that has one).");
  if (!resolvedCreativeId) throw new Error("No creative (pass creativeId or a sourceAdId with a resolvable creative).");

  const tag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const adName = `[DRAFT ${tag}] ${baseName || resolvedCreativeId}`.slice(0, 400);

  const created = await graphPost(token, secret, `act_${acct}/ads`, {
    name: adName,
    adset_id: resolvedAdset,
    creative: { creative_id: resolvedCreativeId },
    status: "PAUSED",
  });

  return {
    ok: true,
    ad_id: created.id,
    name: adName,
    adset_id: resolvedAdset,
    creative_id: resolvedCreativeId,
    status: "PAUSED",
    ads_manager_url: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${acct}&selected_ad_ids=${created.id}`,
  };
}

// Build a CLEAN creative from an assembled plan and create the ad PAUSED.
// Unlike createDraftAd (which clones an existing creative and inherits its
// settings), this builds object_story_spec from scratch with the correct page,
// link, CTA, and degrees_of_freedom_spec = all enhancements OPT_OUT.
// Provide the creative image as imageHash (from /adimages) OR a public imageUrl.
export async function createCleanDraft({ token, secret, accountId, adsetId, plan, imageHash, imageUrl, instagramActorId, instagramUserId }) {
  const acct = String(accountId || "").replace(/^act_/, "");
  if (!acct) throw new Error("accountId required");
  if (!adsetId) throw new Error("adsetId required");
  if (!plan?.page_id) throw new Error("plan.page_id required");
  if (!plan?.link) throw new Error("plan.link required");
  if (!imageHash && !imageUrl) throw new Error("imageHash or imageUrl required");

  const link_data = {
    message: plan.message || "",
    link: plan.link,
    name: plan.headline || "",
    call_to_action: { type: plan?.cta?.enum || "LEARN_MORE", value: { link: plan.link } },
  };
  if (imageHash) link_data.image_hash = imageHash;
  else link_data.picture = imageUrl;

  const object_story_spec = { page_id: String(plan.page_id), link_data };
  if (instagramActorId) object_story_spec.instagram_actor_id = String(instagramActorId);
  else if (instagramUserId) object_story_spec.instagram_user_id = String(instagramUserId);

  // Create the creative with enhancements explicitly OFF.
  const creativePayload = {
    name: (plan.ad_name || "draft").slice(0, 380) + " — creative",
    object_story_spec,
    ...(plan.enhancements_spec || {}),
  };
  const creative = await graphPost(token, secret, `act_${acct}/adcreatives`, creativePayload);
  if (!creative?.id) throw new Error("adcreative create returned no id");

  const tag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const adName = `[DRAFT ${tag}] ${plan.ad_name || creative.id}`.slice(0, 400);
  const ad = await graphPost(token, secret, `act_${acct}/ads`, {
    name: adName,
    adset_id: adsetId,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  return {
    ok: true,
    ad_id: ad.id,
    creative_id: creative.id,
    name: adName,
    status: "PAUSED",
    ads_manager_url: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${acct}&selected_ad_ids=${ad.id}`,
  };
}

// Start a NEW campaign or ad set by copying an existing ad set (or its campaign)
// as PAUSED — so it inherits valid targeting/budget/optimization and is safe.
// kind: "adset" copies the ad set; "campaign" copies the parent campaign (deep).
function digCopiedAdset(res) {
  let id = res.copied_adset_id || res.id || null;
  if (!id && Array.isArray(res.ad_object_ids)) {
    for (const o of res.ad_object_ids) { if (Array.isArray(o?.copied_ids) && o.copied_ids.length) { id = o.copied_ids[0]; break; } }
  }
  return id;
}

export async function copyObject({ token, secret, kind, accountId, fromAdsetId, name }) {
  if (!fromAdsetId) throw new Error("fromAdsetId required (the existing ad set to copy from)");

  // New AD SET: copy the source ad set within its existing campaign (proven path).
  if (kind !== "campaign") {
    const res = await graphPost(token, secret, `${fromAdsetId}/copies`, { status_option: "PAUSED" });
    const newId = digCopiedAdset(res);
    if (!newId) throw new Error("copy ok but new ad set id not found: " + JSON.stringify(res).slice(0, 160));
    if (name) { try { await graphPost(token, secret, `${newId}`, { name }); } catch { /* rename best-effort */ } }
    return { id: newId, kind, name: name || null };
  }

  // New CAMPAIGN: Meta rejects campaign /copies?deep_copy=true (FB 100/1885194), so
  // instead clone the source campaign's objective into a fresh PAUSED campaign, then
  // copy the ad set into it — inheriting targeting/budget, and far more controllable.
  const acct = String(accountId || "").replace(/^act_/, "");
  if (!acct) throw new Error("accountId required to create a new campaign");
  const info = await graphGet(token, secret, `${fromAdsetId}?fields=campaign{id,name,objective,special_ad_categories,buying_type}`);
  const sc = info?.campaign || {};
  if (!sc.id) throw new Error("could not resolve the source campaign for ad set " + fromAdsetId);
  const campFields = {
    name: name || (sc.name ? sc.name + " (copy)" : "New campaign"),
    objective: sc.objective || "OUTCOME_TRAFFIC",
    special_ad_categories: Array.isArray(sc.special_ad_categories) ? sc.special_ad_categories : [],
    buying_type: sc.buying_type || "AUCTION",
    status: "PAUSED",
    // Required by Meta when the campaign isn't using campaign budget (we create as
    // ABO and let the copied ad set carry its budget). False = no cross-ad-set sharing.
    is_adset_budget_sharing_enabled: false,
  };
  let camp;
  try { camp = await graphPost(token, secret, `act_${acct}/campaigns`, campFields); }
  catch (e) { throw new Error("[campaign-create] " + (e?.message || e)); }
  if (!camp?.id) throw new Error("campaign create returned no id");
  // Best-effort: copy the source ad set into the new campaign. Meta sometimes rejects
  // this on placement/targeting specs (e.g. instagram_positions) — if so, keep the
  // created campaign and report a warning rather than failing the whole operation.
  let childAdset = null, copyWarning = null;
  try {
    const res = await graphPost(token, secret, `${fromAdsetId}/copies`, { campaign_id: camp.id, status_option: "PAUSED" });
    childAdset = digCopiedAdset(res);
  } catch (e) {
    copyWarning = "campaign created, but the ad set couldn't be auto-copied (" + (e?.message || e) + "). Add an ad set to it in Ads Manager.";
  }
  return { id: camp.id, kind, name: campFields.name, child_adset_id: childAdset, copy_warning: copyWarning };
}

// After a copy, optionally rename the copied ad set (campaign case) and apply a
// budget. level "cbo" sets the budget on the campaign; "abo" sets it on the ad
// set. Every Meta write is best-effort and any failure is returned as a warning
// (never throws) so the copy itself is never rolled back by a follow-up tweak.
export async function configureNewObject({ token, secret, kind, newId, childAdsetId, adsetName, budget, removeChildAds = false }) {
  const out = { warnings: [], applied: {}, child_adset_id: kind === "adset" ? newId : (childAdsetId || null) };
  if (kind === "campaign") {
    if (!out.child_adset_id) {
      try {
        const r = await graphGet(token, secret, `${newId}/adsets?fields=id,name&limit=5`);
        out.child_adset_id = r?.data?.[0]?.id || null;
      } catch (e) { out.warnings.push("could not list the copied ad set: " + (e?.message || e)); }
    }
    if (adsetName && out.child_adset_id) {
      try { await graphPost(token, secret, `${out.child_adset_id}`, { name: adsetName }); out.applied.adset_name = adsetName; }
      catch (e) { out.warnings.push("ad set rename failed: " + (e?.message || e)); }
    }
  }
  if (budget && Number(budget.amount) > 0 && budget.type) {
    const cents = Math.round(Number(budget.amount) * 100);
    const field = budget.type === "lifetime" ? "lifetime_budget" : "daily_budget";
    const wantCbo = budget.level === "cbo" && kind === "campaign";
    const targetId = wantCbo ? newId : out.child_adset_id;
    if (!targetId) out.warnings.push("no target object to set the budget on");
    else {
      try {
        const patch = { [field]: cents };
        if (budget.type === "lifetime" && budget.endTime) patch.end_time = budget.endTime;
        await graphPost(token, secret, `${targetId}`, patch);
        out.applied.budget = { level: wantCbo ? "cbo" : "abo", type: budget.type, amount: Number(budget.amount), target: targetId };
      } catch (e) {
        out.warnings.push(`budget not applied (${field} $${budget.amount}${budget.type === "lifetime" && !budget.endTime ? " — lifetime budgets need an end date" : ""}): ` + (e?.message || e));
      }
    }
  }

  // "Start empty": Meta copies the source ad set's ads too. Remove them so the new
  // ad set is a clean shell. Best-effort; failures are surfaced, never thrown.
  if (removeChildAds && out.child_adset_id) {
    try {
      const ads = await graphGet(token, secret, `${out.child_adset_id}/ads?fields=id&limit=50`);
      let removed = 0;
      for (const ad of ads?.data || []) {
        try { await graphPost(token, secret, `${ad.id}`, { status: "DELETED" }); removed++; }
        catch (e) { out.warnings.push(`could not remove copied ad ${ad.id}: ` + (e?.message || e)); }
      }
      out.applied.removed_ads = removed;
    } catch (e) { out.warnings.push("could not list copied ads to remove: " + (e?.message || e)); }
  }
  return out;
}

// Upload an image to /adimages and return its hash. bytes = ArrayBuffer/Uint8Array.
export async function uploadAdImage({ token, secret, accountId, bytes, filename = "creative.jpg" }) {
  const acct = String(accountId || "").replace(/^act_/, "");
  const form = new FormData();
  form.set("access_token", token);
  if (secret) {
    const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc(token));
    form.set("appsecret_proof", [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  }
  const mime = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  form.set("filename", new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${GRAPH}/act_${acct}/adimages`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  const err = fbError(body);
  if (err) throw new Error(err);
  const images = body.images || {};
  const first = Object.values(images)[0];
  if (!first?.hash) throw new Error("adimages returned no hash");
  return first.hash;
}

// Upload a video to /advvideos and return its video id. bytes = ArrayBuffer/Uint8Array.
// Meta processes the video asynchronously — use waitVideoReady before building the ad.
export async function uploadAdVideo({ token, secret, accountId, bytes, filename = "creative.mp4" }) {
  const acct = String(accountId || "").replace(/^act_/, "");
  const form = new FormData();
  form.set("access_token", token);
  if (secret) {
    const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc(token));
    form.set("appsecret_proof", [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  }
  form.set("source", new Blob([bytes]), filename);
  const res = await fetch(`${GRAPH}/act_${acct}/advideos`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  const err = fbError(body);
  if (err) throw new Error(err);
  if (!body.id) throw new Error("advideos returned no id");
  return body.id;
}

// Poll a video until Meta finishes processing. Returns "ready" | "processing" | "error".
// Capped so it never blocks a Worker request too long; caller decides what to do if not ready.
export async function waitVideoReady({ token, secret, videoId, attempts = 8, delayMs = 3000 }) {
  for (let i = 0; i < attempts; i++) {
    const r = await graphGet(token, secret, `${videoId}?fields=status`);
    const st = r?.status?.video_status || r?.status;
    if (st === "ready") return "ready";
    if (st === "error") return "error";
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, delayMs));
  }
  return "processing";
}

// Meta auto-generates thumbnails once a video is processed. Return the preferred uri.
export async function getVideoThumbnail({ token, secret, videoId }) {
  try {
    const r = await graphGet(token, secret, `${videoId}/thumbnails?fields=uri,is_preferred`);
    const thumbs = r?.data || [];
    const pref = thumbs.find((t) => t.is_preferred) || thumbs[0];
    return pref?.uri || null;
  } catch { return null; }
}

// Build a CLEAN VIDEO creative from an assembled plan and create the ad PAUSED.
// Mirrors createCleanDraft but uses object_story_spec.video_data. thumbnailUrl is
// Meta's auto-generated thumbnail (image_url); enhancements stay OPT_OUT.
export async function createCleanVideoDraft({ token, secret, accountId, adsetId, plan, videoId, thumbnailUrl, instagramActorId, instagramUserId }) {
  const acct = String(accountId || "").replace(/^act_/, "");
  if (!acct) throw new Error("accountId required");
  if (!adsetId) throw new Error("adsetId required");
  if (!plan?.page_id) throw new Error("plan.page_id required");
  if (!videoId) throw new Error("videoId required");

  const video_data = {
    video_id: String(videoId),
    message: plan.message || "",
    title: plan.headline || "",
  };
  if (plan.link) video_data.call_to_action = { type: plan?.cta?.enum || "LEARN_MORE", value: { link: plan.link } };
  if (thumbnailUrl) video_data.image_url = thumbnailUrl;

  const object_story_spec = { page_id: String(plan.page_id), video_data };
  if (instagramActorId) object_story_spec.instagram_actor_id = String(instagramActorId);
  else if (instagramUserId) object_story_spec.instagram_user_id = String(instagramUserId);

  const creative = await graphPost(token, secret, `act_${acct}/adcreatives`, {
    name: (plan.ad_name || "draft").slice(0, 380) + " — video creative",
    object_story_spec,
    ...(plan.enhancements_spec || {}),
  });
  if (!creative?.id) throw new Error("adcreative (video) create returned no id");

  const tag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const adName = `[DRAFT ${tag}] ${plan.ad_name || creative.id}`.slice(0, 400);
  const ad = await graphPost(token, secret, `act_${acct}/ads`, {
    name: adName, adset_id: adsetId, creative: { creative_id: creative.id }, status: "PAUSED",
  });
  return {
    ok: true,
    ad_id: ad.id, creative_id: creative.id, name: adName, status: "PAUSED", media: "video",
    ads_manager_url: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${acct}&selected_ad_ids=${ad.id}`,
  };
}

const deepFindOptIns = (node, path = "", out = []) => {
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k;
    if (v && typeof v === "object" && typeof v.enroll_status === "string") {
      if (v.enroll_status.toUpperCase() === "OPT_IN") out.push(p);
    } else if (v && typeof v === "object") {
      deepFindOptIns(v, p, out);
    }
  }
  return out;
};

export async function qaAd({ token, secret, adId, expectCatalog = "none", expectedPage = "", expectedAccount = "" }) {
  const FIELDS = [
    "id", "name", "status", "effective_status", "account_id",
    "adset{id,name,campaign{id,name,objective}}",
    "creative{id,name,object_story_spec,degrees_of_freedom_spec,asset_feed_spec,product_set_id,call_to_action_type,url_tags}",
  ].join(",");
  const ad = await graphGet(token, secret, `${adId}?fields=${FIELDS}`);
  const creative = ad.creative || {};
  const oss = creative.object_story_spec || {};
  const linkData = oss.link_data || {};
  const videoData = oss.video_data || {};
  const afs = creative.asset_feed_spec || {};   // flexible / Advantage+ creatives carry link, cta, copy here
  const checks = [];
  const add = (level, label, detail) => checks.push({ level, label, detail });

  const acct = String(ad.account_id || "").replace(/^act_/, "");
  // Multi-client: only PASS/FAIL when the caller says which account to expect
  // (the drafter passes the client's account). Otherwise just report it (INFO) —
  // previously this hard-coded the Xero account and falsely failed every other client.
  if (expectedAccount) { const exp = String(expectedAccount).replace(/^act_/, ""); add(acct === exp ? "PASS" : "FAIL", "Ad account", `${acct} (expected ${exp})`); }
  else add("INFO", "Ad account", acct);
  add(ad.status === "PAUSED" ? "PASS" : "FAIL", "Status", `${ad.status} / effective=${ad.effective_status} (want PAUSED)`);

  // Page: compare to the page this account actually runs ads from (or an explicit
  // expectedPage). Hardcoded guesses caused false fails, so derive it.
  const pageId = String(oss.page_id || "");
  const wantPage = expectedPage || (await accountCanonicalPage(token, secret, acct)) || "";
  if (wantPage) add(pageId === wantPage ? "PASS" : "FAIL", "Facebook Page", `${pageId || "none"} (account page ${wantPage})`);
  else add(pageId ? "INFO" : "FAIL", "Facebook Page", `${pageId || "none"} (no reference page resolved)`);

  const ig = oss.instagram_actor_id || oss.instagram_user_id;
  add(ig ? "PASS" : "WARN", "Instagram account", ig ? String(ig) : "none linked (IG placements may skip)");

  // Read link / CTA from object_story_spec OR asset_feed_spec (flexible creatives).
  const link =
    linkData.link ||
    videoData?.call_to_action?.value?.link ||
    linkData?.call_to_action?.value?.link ||
    afs?.link_urls?.[0]?.website_url ||
    afs?.link_urls?.[0]?.display_url;
  add(link ? "PASS" : "FAIL", "Destination URL", link || "MISSING");
  const cta =
    creative.call_to_action_type ||
    linkData?.call_to_action?.type ||
    videoData?.call_to_action?.type ||
    afs?.call_to_action_types?.[0];
  add(cta ? "PASS" : "WARN", "Call-to-action", cta || "none");
  const utm = creative.url_tags || (link && /utm_/i.test(link) ? "in-url" : "");
  add(utm ? "PASS" : "WARN", "Tracking (UTM/url_tags)", utm ? String(utm) : "none");
  const ps = creative.product_set_id || "";
  if (expectCatalog === "none") add(ps ? "FAIL" : "PASS", "Catalogue / product set", ps ? `product_set_id=${ps} but expected NONE` : "none (correct)");
  else add(ps === expectCatalog ? "PASS" : "FAIL", "Catalogue / product set", `${ps || "none"} (expected ${expectCatalog})`);
  const optIns = deepFindOptIns(creative.degrees_of_freedom_spec || {});
  add(optIns.length ? "FAIL" : "PASS", "AI enhancements OFF", optIns.length ? `OPT_IN: ${optIns.join(", ")}` : "none opted in");
  add(creative.asset_feed_spec ? "WARN" : "PASS", "Single (non-dynamic) creative", creative.asset_feed_spec ? "asset_feed_spec present — dynamic ad" : "standard single creative");
  add("INFO", "Campaign objective", ad?.adset?.campaign?.objective || "unknown");

  const fails = checks.filter((c) => c.level === "FAIL").length;
  const warns = checks.filter((c) => c.level === "WARN").length;
  return {
    ad_id: adId,
    name: ad.name,
    adset: ad?.adset?.name || ad?.adset?.id,
    campaign: ad?.adset?.campaign?.name,
    pass: fails === 0,
    fails,
    warns,
    checks,
  };
}

// Build a Placement Asset Customization (PAC) creative from multiple assets.
export async function createAssetCustomizationDraft({ token, secret, accountId, adsetId, plan, images, videos, instagramActorId, instagramUserId }) {
  const acct = String(accountId || "").replace(/^act_/, "");
  if (!acct) throw new Error("accountId required");
  if (!adsetId) throw new Error("adsetId required");
  if (!plan?.page_id) throw new Error("plan.page_id required");
  if (!plan?.link) throw new Error("plan.link required");

  const asset_feed_spec = {
    images: [],
    videos: [],
    bodies: [{ text: plan.message || "" }],
    titles: [{ text: plan.headline || "" }],
    call_to_action_types: [plan?.cta?.enum || "LEARN_MORE"],
    link_urls: [{ website_url: plan.link }],
    ad_formats: [],
    optimization_type: "PLACEMENT",
    asset_customization_rules: []
  };

  let hasImage = false;
  let hasVideo = false;

  const getPos = (format) => {
    if (format === "9:16") {
      return {
        facebook_positions: ["story", "facebook_reels"],
        instagram_positions: ["story", "reels"],
        publisher_platforms: ["facebook", "instagram"]
      };
    } else if (format === "1:1" || format === "4:5") {
      return {
        facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
        instagram_positions: ["stream", "explore", "explore_home", "profile_feed"],
        publisher_platforms: ["facebook", "instagram"]
      };
    }
    // Fallback if format is unknown or 16:9
    return {
      facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
      instagram_positions: ["stream", "explore", "explore_home", "profile_feed"],
      publisher_platforms: ["facebook", "instagram"]
    };
  };

  const formatGroups = {};
  
  images.forEach(img => {
    const f = img.format || 'unknown';
    if (!formatGroups[f]) formatGroups[f] = { images: [], videos: [] };
    formatGroups[f].images.push(img);
  });
  videos.forEach(vid => {
    const f = vid.format || 'unknown';
    if (!formatGroups[f]) formatGroups[f] = { images: [], videos: [] };
    formatGroups[f].videos.push(vid);
  });

  let rulePriority = 1;
  let defaultLabel = null;
  let defaultIsVideo = false;

  for (const [format, group] of Object.entries(formatGroups)) {
    const label = `fmt_${format.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (!defaultLabel) {
      defaultLabel = label;
      defaultIsVideo = group.images.length === 0;
    }
    
    group.images.forEach(img => {
      hasImage = true;
      if (img.hash) asset_feed_spec.images.push({ hash: img.hash, adlabels: [{ name: label }] });
      else if (img.url) asset_feed_spec.images.push({ url: img.url, adlabels: [{ name: label }] });
    });
    
    group.videos.forEach(vid => {
      hasVideo = true;
      asset_feed_spec.videos.push({ video_id: vid.id, adlabels: [{ name: label }] });
    });

    const spec = getPos(format);
    // spec.publisher_platforms is set in getPos
    
    if (group.images.length > 0) {
      asset_feed_spec.asset_customization_rules.push({
        customization_spec: spec,
        image_label: { name: label },
        priority: rulePriority++
      });
    }
    if (group.videos.length > 0) {
      asset_feed_spec.asset_customization_rules.push({
        customization_spec: spec,
        video_label: { name: label },
        priority: rulePriority++
      });
    }
  }

  // Add a default rule (required by Meta)
  if (defaultLabel) {
    const defaultRule = {
      customization_spec: {},
      priority: rulePriority++
    };
    if (defaultIsVideo) defaultRule.video_label = { name: defaultLabel };
    else defaultRule.image_label = { name: defaultLabel };
    
    asset_feed_spec.asset_customization_rules.push(defaultRule);
  }

  if (hasImage && hasVideo) {
    asset_feed_spec.ad_formats = ["AUTOMATIC_FORMAT"];
  } else if (hasImage) {
    asset_feed_spec.ad_formats = ["SINGLE_IMAGE"];
  } else if (hasVideo) {
    asset_feed_spec.ad_formats = ["SINGLE_VIDEO"];
  }

  const object_story_spec = { page_id: String(plan.page_id) };
  if (instagramActorId) object_story_spec.instagram_actor_id = String(instagramActorId);
  else if (instagramUserId) object_story_spec.instagram_user_id = String(instagramUserId);

  const creativePayload = {
    name: (plan.ad_name || "draft").slice(0, 380) + " — PAC creative",
    object_story_spec,
    asset_feed_spec,
    ...(plan.enhancements_spec || {}),
  };

  const creative = await graphPost(token, secret, `act_${acct}/adcreatives`, creativePayload);
  if (!creative?.id) throw new Error("adcreative (PAC) create returned no id");

  const tag = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const adName = `[DRAFT ${tag}] ${plan.ad_name || creative.id}`.slice(0, 400);
  const ad = await graphPost(token, secret, `act_${acct}/ads`, {
    name: adName,
    adset_id: adsetId,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  return {
    ok: true,
    ad_id: ad.id,
    creative_id: creative.id,
    name: adName,
    status: "PAUSED",
    media: "pac",
    ads_manager_url: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${acct}&selected_ad_ids=${ad.id}`,
  };
}
