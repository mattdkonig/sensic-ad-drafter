// sensic-ad-drafter/test.mjs — QA suite (network-free). Run: node sensic-ad-drafter/test.mjs
// Exercises auth/login/sessions, all read endpoints, preview assembly, and the
// create-drafts validation paths against the Worker's fetch handler with a mock env.
import { default as worker } from "./worker.js";
import { normalizeCta, classifyFile, assemblePlan, enhancementsOffSpec, withUtms, slugify } from "./assembly.mjs";
import { issueSession, verifySession } from "./auth.mjs";
import { csvToRows, parseBibleGrid, parseBibleTabs } from "./bible-parse.mjs";

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", name); } };

const ENV = { BRAIN_API_TOKEN: "brain-tok", FB_ACCESS_TOKEN: "fb", FB_APP_SECRET: "sec", LOGIN_PASSWORD: "team-pw" };
const req = (path, opts = {}) => new Request("https://x" + path, opts);
const call = async (path, opts, env = ENV) => { const r = await worker.fetch(req(path, opts), env); if (!r || typeof r.status !== "number") { console.log("  NO RESPONSE for", path, opts && opts.method || "GET"); return { status: 0, json: null, res: null }; } let j = null; try { j = await r.clone().json(); } catch {} return { status: r.status, json: j, res: r }; };
const jpost = (body, headers = {}) => ({ method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const run = async () => {
  console.log("== auth / login ==");
  // login: bad email, wrong pw, success
  ok((await call("/api/login", jpost({ email: "bad", password: "team-pw" }))).status === 400, "login rejects bad email");
  ok((await call("/api/login", jpost({ email: "a@b.com", password: "nope" }))).status === 401, "login rejects wrong password");
  const login = await call("/api/login", jpost({ email: "ness@sensicdigital.com", password: "team-pw" }));
  ok(login.status === 200 && login.json.ok, "login succeeds with correct password");
  const setCookie = login.res.headers.get("Set-Cookie") || "";
  ok(/sad_session=/.test(setCookie) && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie), "login sets HttpOnly Secure cookie");
  const cookie = setCookie.split(";")[0];
  // login not configured
  ok((await call("/api/login", jpost({ email: "a@b.com", password: "x" }), { BRAIN_API_TOKEN: "t" })).status === 503, "login 503 when LOGIN_PASSWORD unset");

  console.log("== session enforcement ==");
  ok((await call("/api/clients")).status === 401, "no auth -> 401");
  ok((await call("/api/clients", { headers: { Cookie: cookie } })).status === 200, "valid session cookie -> 200");
  ok((await call("/api/clients", { headers: { Cookie: "sad_session=tampered.deadbeef" } })).status === 401, "tampered cookie -> 401");
  ok((await call("/api/clients", { headers: { Authorization: "Bearer brain-tok" } })).status === 200, "bearer still works");
  const who = await call("/whoami", { headers: { Cookie: cookie } });
  ok(who.json.authed === true && who.json.email === "ness@sensicdigital.com", "whoami reflects session");
  ok((await call("/whoami")).json.authed === false, "whoami unauth -> authed:false");

  console.log("== session crypto ==");
  const t = await issueSession("secret", "x@y.com", 60);
  ok((await verifySession("secret", t))?.email === "x@y.com", "verifySession accepts valid");
  ok((await verifySession("wrong", t)) === null, "verifySession rejects wrong key");
  ok((await verifySession("secret", await issueSession("secret", "x@y.com", -1))) === null, "verifySession rejects expired");

  console.log("== read APIs ==");
  const clients = (await call("/api/clients", { headers: { Cookie: cookie } })).json.clients.map((c) => c.slug);
  ok(clients.includes("xero-shoes") && !clients.includes("fem21") && !clients.includes("wolki-fresh"), "clients filtered to active Basecamp");
  ok((await call("/api/bible?client=xero-shoes", { headers: { Cookie: cookie } })).json.rows.length >= 1, "bible returns Xero rows");
  ok(clients.includes("shredded"), "shredded client is active + mapped");
  ok((await call("/api/bible?client=shredded", { headers: { Cookie: cookie } })).json.rows.length >= 1, "shredded bible has rows");
  ok((await call("/api/bible?client=mypause", { headers: { Cookie: cookie } })).json.rows.length >= 2, "mypause bible re-synced (>1 row)");
  ok((await call("/api/adsets", { headers: { Cookie: cookie } })).status === 400, "adsets requires client param");

  console.log("== preview (dry-run) ==");
  const prev = await call("/api/preview", jpost({ client: "xero-shoes" }, { Cookie: cookie }));
  const plans = prev.json.plans || [];
  ok(prev.json.ok && plans.length >= 1, "preview returns plans");
  ok(plans.every((p) => p.status === "PAUSED" && p.enhancements === "OFF"), "all plans PAUSED + enhancements OFF");
  ok((await call("/api/preview", jpost({ client: "nope" }, { Cookie: cookie }))).status === 404, "preview unknown client -> 404");

  console.log("== create-drafts validation ==");
  ok((await call("/api/create-drafts", jpost({}, { Cookie: cookie }))).status === 400, "create-drafts requires fields");
  ok((await call("/api/create-drafts", jpost({ client: "nope", adset_id: "1", items: [{ row_id: "x" }] }, { Cookie: cookie }))).status === 404, "create-drafts unknown client -> 404");

  console.log("== upload-image route ==");
  ok((await call("/api/upload-image?client=xero-shoes", { method: "POST" })).status === 401, "upload requires auth");
  ok((await call("/api/upload-image?client=nope", { method: "POST", headers: { Cookie: cookie } })).status === 404, "upload unknown client -> 404");

  console.log("== new ad set / campaign ==");
  ok((await call("/api/new-adset", { method: "POST", body: "{}" })).status === 401, "new-adset requires auth");
  ok((await call("/api/new-adset", jpost({ client: "xero-shoes" }, { Cookie: cookie }))).status === 400, "new-adset needs from_adset_id");
  ok((await call("/api/new-adset", jpost({ client: "nope", from_adset_id: "1" }, { Cookie: cookie }))).status === 404, "new-adset unknown client -> 404");

  console.log("== adsets pagination ==");
  { const { listAdsets } = await import("./data.mjs");
    const origFetch = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++;
      const body = calls === 1
        ? { data: [{ id: "a1", name: "A1", effective_status: "ACTIVE", campaign: {} }], paging: { cursors: { after: "CUR2" } } }
        : { data: [{ id: "a2", name: "A2", effective_status: "ACTIVE", campaign: {} }], paging: { cursors: {} } };
      return { json: async () => body }; };
    const res = await listAdsets({ token: "t", secret: "", accountId: "123" });
    globalThis.fetch = origFetch;
    ok(calls === 2 && res.length === 2 && res.some((a) => a.id === "a2"), "listAdsets follows paging cursor across pages"); }

  console.log("== bible-parse (Drive sync core) ==");
  { const g = csvToRows('a,"b,c",d\n1,"line1\nline2",3'); ok(g.length === 2 && g[0][1] === "b,c" && g[1][1] === "line1\nline2", "csvToRows handles quotes/commas/newlines"); }
  { const grid = [
      ["Uploaded?","Creative Description","CTA","Landing Page URL","Date Uploaded","Primary Text","Headline"],
      ["","e.g. Example","Shop Now","https://x.com","","ex","ex"],
      ["FALSE","Concept A","Shop Now","https://a.com","","hi","H"],
      ["TRUE","Concept B done","Shop Now","https://b.com","","hi","H"],
      ["FALSE","Concept C dated","Shop Now","https://c.com","2026-06-01","hi","H"]];
    const r = parseBibleGrid(grid, "acme").rows;
    ok(r.length === 1 && r[0].concept === "Concept A" && r[0].id === "acme-concept-a", "AdTracker: only Uploaded?=FALSE & no Date Uploaded is pending"); }
  { const grid = [
      ["READY FOR UPLOAD","Creative Description","Date Uploaded"],
      ["","e.g. x",""],["TRUE","Ready One",""],["FALSE","Not Ready",""],["TRUE","Already Done","2026-06-01"]];
    const r = parseBibleGrid(grid, "mp").rows;
    ok(r.length === 1 && r[0].concept === "Ready One", "READY FOR UPLOAD polarity: TRUE & no date is pending"); }
  { const grid = [
      ["UPLOADED","Type","Creative Description","Link to Creative","Number of creatives","a","b","c","Primary Text","Headline","Destination Link"],
      ["x","x","x","x","x","","","","x","x","x"],
      ["False","Static","Beef Liver Statics","https://drive.google.com/abc","6","","","","Liver","Iron","https://wearechief.com/p"],
      ["True","Static","Already Up","https://drive.google.com/zzz","3","","","","t","h","https://wearechief.com/q"]];
    const r = parseBibleGrid(grid, "chief-aus").rows;
    ok(r.length === 1 && r[0].num_creatives === 6 && r[0].creatives_folder === "https://drive.google.com/abc" && r[0].landing_url === "https://wearechief.com/p", "Chief schema: column-by-name + Drive folder + destination link"); }
  { const tabs = { AU: [["UPLOADED","Creative Description"],["x","x"],["False","Dup"],["False","Dup"]] };
    const res = parseBibleTabs(tabs, { "chief-aus": ["AU"] });
    ok(res["chief-aus"].length === 2 && res["chief-aus"][1].id === "chief-aus-dup-2", "dedupe ids + multi-tab mapping"); }

  console.log("== public + misc ==");
  ok((await call("/health")).json.build === "v0.9.1-loop", "health build label");
  // Guard: the inline <script> in UI_HTML must be valid browser JS. node --check on
  // the module can't catch syntax errors inside the template-literal string (e.g. a
  // raw newline in a single-quoted string), so validate the extracted script here.
  { const { UI_HTML } = await import("./ui.mjs"); const js = UI_HTML.slice(UI_HTML.indexOf("<script>") + 8, UI_HTML.indexOf("</script>"));
    let scriptOk = true; try { new Function(js); } catch { scriptOk = false; } ok(scriptOk, "inline UI script is valid JS"); }
  const home = await worker.fetch(req("/"), ENV); const h = await home.text();
  ok(h.includes("login-form") && h.includes("Sensic Ad Drafter"), "/ serves UI with login form");

  console.log("== assembly units ==");
  ok(normalizeCta("Shop Now").enum === "SHOP_NOW" && normalizeCta("Shop Now").matched, "CTA Shop Now");
  ok(normalizeCta("Now Open").enum === "LEARN_MORE" && !normalizeCta("Now Open").matched, "CTA unknown flagged");
  ok(classifyFile("a.jpg").ok && !classifyFile("b.webp").ok && classifyFile("c.mp4").ok, "format filter");
  ok(Object.values(enhancementsOffSpec().degrees_of_freedom_spec.creative_features_spec).every((v) => v.enroll_status === "OPT_OUT"), "enhancements all OPT_OUT");

  // Auto-UTM
  const u1 = withUtms("https://x.com/sale", { campaign: "SENSIC | EOFY SALE", concept: "Beef Liver > Batch One" });
  ok(u1.added && /utm_source=facebook/.test(u1.url) && /utm_medium=paid_social/.test(u1.url) && /utm_campaign=sensic-eofy-sale/.test(u1.url) && /utm_content=beef-liver-batch-one/.test(u1.url), "UTMs auto-added + slugified");
  ok(!withUtms("https://x.com/p?utm_source=ig", {}).added, "existing UTMs left untouched");
  ok(!withUtms("not a url", {}).added, "bad URL left untouched");
  ok(slugify("A > B  C!") === "a-b-c", "slugify");
  const planU = assemblePlan({ id: "r1", concept: "C", cta: "Shop Now", landing_url: "https://x.com/p", primary_text: "hi", headline: "H" }, { pageId: "1" });
  ok(planU.link_utm_added && /utm_source=facebook/.test(planU.link) && !planU.issues.some((i) => /no UTM/.test(i.msg)), "assemblePlan auto-UTMs + no UTM warning");
  const planNo = assemblePlan({ id: "r2", concept: "C", cta: "Shop Now", landing_url: "https://x.com/p", primary_text: "hi" }, { pageId: "1", autoUtm: false });
  ok(planNo.issues.some((i) => /no UTM/.test(i.msg)), "autoUtm:false still warns");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};
run().catch((e) => { console.error("TEST CRASH:", e); process.exit(1); });
