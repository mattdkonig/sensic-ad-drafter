import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldQa = `          let qa = null;
          try { const q = await qaAd({ ...fbArgs(env), adId: created.ad_id, expectedPage: pageId || "", expectedAccount: accountId }); qa = { pass: q.pass, fails: q.fails, warns: q.warns }; } catch { qa = null; }
          await audit(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, ad_id: created.ad_id, qa });
          results.push({ row_id: rowId, ok: true, adset_id: adsetId, ...created, qa });`;

const newQa = `          if (!created || !created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created?.error || "unknown error"}\` });
            await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, error: \`Ad creation failed: \${created?.error || "unknown error"}\` });
            continue;
          }

          let qa = null;
          try { const q = await qaAd({ ...fbArgs(env), adId: created.ad_id, expectedPage: pageId || "", expectedAccount: accountId }); qa = { pass: q.pass, fails: q.fails, warns: q.warns }; } catch { qa = null; }
          await audit(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, ad_id: created.ad_id, qa });
          results.push({ row_id: rowId, ok: true, adset_id: adsetId, ...created, qa });`;

code = code.replace(oldQa, newQa);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to audit create failures properly");
