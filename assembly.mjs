// sensic-ad-drafter/assembly.mjs
// Pure (network-free) logic that turns a bible row into a clean Meta ad plan and
// validates it (dry-run QA), BEFORE anything is created. M3 uses assemblePlan to
// build the real creative; M2 /api/preview uses it to show the team what will be
// created and surface any issues.

// Valid Meta call_to_action enums we map the bible's free-text CTA to.
const CTA_MAP = {
  "shop now": "SHOP_NOW",
  "learn more": "LEARN_MORE",
  "sign up": "SIGN_UP",
  "subscribe": "SUBSCRIBE",
  "get offer": "GET_OFFER",
  "get quote": "GET_QUOTE",
  "order now": "ORDER_NOW",
  "book now": "BOOK_TRAVEL",
  "contact us": "CONTACT_US",
  "download": "DOWNLOAD",
  "visit store": "GET_DIRECTIONS",
  "get directions": "GET_DIRECTIONS",
  "see menu": "SEE_MENU",
  "watch more": "WATCH_MORE",
  "apply now": "APPLY_NOW",
};

export function normalizeCta(text) {
  const key = String(text || "").trim().toLowerCase();
  if (!key) return { enum: "LEARN_MORE", matched: false, input: text || "" };
  if (CTA_MAP[key]) return { enum: CTA_MAP[key], matched: true, input: text };
  // "Now Open" and other non-CTA copy fall back to LEARN_MORE and get flagged.
  return { enum: "LEARN_MORE", matched: false, input: text };
}

// Meta image endpoint accepts JPG/PNG; video accepts MP4/MOV. Everything else is
// skipped (PSD/AI/PDF/webp/heic/working files).
const IMG_OK = /\.(jpe?g|png)$/i;
const VID_OK = /\.(mp4|mov)$/i;
export function classifyFile(name, mime = "") {
  const m = String(mime).toLowerCase();
  if (IMG_OK.test(name) || m === "image/jpeg" || m === "image/png") return { ok: true, kind: "image" };
  if (VID_OK.test(name) || m === "video/mp4" || m === "video/quicktime") return { ok: true, kind: "video" };
  return { ok: false, kind: "skip", reason: `unsupported format for Meta (${name || mime || "unknown"})` };
}

// The degrees_of_freedom_spec we attach to every creative — all Advantage+ /
// standard enhancements explicitly OPT_OUT. This is the structural guarantee that
// the QA "AI enhancements OFF" check passes for ads we build (vs. cloned ones).
export function enhancementsOffSpec() {
  return {
    degrees_of_freedom_spec: {
      creative_features_spec: {
        // NOTE: Meta deprecated the umbrella `standard_enhancements` field
        // (error 3858504) — opt out of individual features instead.
        image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
        image_templates: { enroll_status: "OPT_OUT" },
        text_optimizations: { enroll_status: "OPT_OUT" },
        inline_comment: { enroll_status: "OPT_OUT" },
      },
    },
  };
}

export function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Append Meta tracking UTMs to a landing URL when none are present. Enforces
// tracking hygiene from the bible's own campaign/concept instead of nagging about
// it forever. Returns { url, added }.
export function withUtms(link, { campaign, concept, source = "facebook", medium = "paid_social" } = {}) {
  if (!link || /[?&]utm_/i.test(link)) return { url: link, added: false };
  try {
    const u = new URL(link);
    u.searchParams.set("utm_source", source);
    u.searchParams.set("utm_medium", medium);
    if (campaign) u.searchParams.set("utm_campaign", slugify(campaign));
    if (concept) u.searchParams.set("utm_content", slugify(concept));
    return { url: u.toString(), added: true };
  } catch {
    return { url: link, added: false };
  }
}

// Assemble the plan for ONE bible row. Returns the validated ad plan + issues.
// (Per-file fan-out into N ads happens in M3 once the Drive manifest is resolved;
// at preview we validate the row-level copy/link/CTA and the folder presence.)
export function assemblePlan(row, opts = {}) {
  const pageId = opts.pageId || null;
  const issues = [];
  const cta = normalizeCta(row.cta);
  if (!cta.matched) issues.push({ level: "WARN", msg: `CTA "${cta.input}" is not a valid Meta button — defaulting to LEARN_MORE. Use a dropdown value.` });

  const rawLink = String(row.landing_url || "").trim();
  let link = rawLink;
  let utmAdded = false;
  if (!rawLink) issues.push({ level: "FAIL", msg: "no landing_url" });
  else if (!/^https?:\/\//i.test(rawLink)) issues.push({ level: "FAIL", msg: `landing_url not a URL: ${rawLink}` });
  else if (opts.autoUtm !== false) {
    const u = withUtms(rawLink, { campaign: row.campaign, concept: row.concept });
    link = u.url; utmAdded = u.added;
    if (utmAdded) issues.push({ level: "INFO", msg: "UTMs added automatically (utm_source/medium/campaign/content)" });
  } else if (!/utm_/i.test(rawLink)) issues.push({ level: "WARN", msg: "no UTM params on landing_url" });

  if (!String(row.primary_text || "").trim()) issues.push({ level: "FAIL", msg: "no primary_text" });
  if (!String(row.headline || "").trim()) issues.push({ level: "WARN", msg: "no headline" });
  if (!pageId) issues.push({ level: "FAIL", msg: "no page id resolved for account" });
  if (!row.creatives_folder) issues.push({ level: "WARN", msg: "no Drive creatives folder linked — files cannot be resolved yet (manifest pending)" });

  const fails = issues.filter((i) => i.level === "FAIL").length;
  return {
    row_id: row.id,
    ad_name: row.concept || row.id,
    page_id: pageId,
    message: row.primary_text || "",
    headline: row.headline || "",
    link,
    link_utm_added: utmAdded,
    cta,
    num_creatives: row.num_creatives || 0,
    creatives_folder: row.creatives_folder || null,
    status: "PAUSED",
    enhancements: "OFF",
    enhancements_spec: enhancementsOffSpec(),
    issues,
    ready: fails === 0,
  };
}
