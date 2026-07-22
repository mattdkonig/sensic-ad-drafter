import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldAudit = `async function audit(env, rec) {
  rec.ts = new Date().toISOString();
  if (env.DRAFTER_KV) { try { await env.DRAFTER_KV.put(\`audit:\${rec.ts}:\${rec.ad_id || "x"}\`, JSON.stringify(rec)); } catch { /* best effort */ } }
  console.log("[audit]", JSON.stringify(rec));
}`;

const newAudit = `async function audit(env, rec) {
  rec.ts = new Date().toISOString();
  if (env.DRAFTER_KV) { try { await env.DRAFTER_KV.put(\`audit:\${rec.ts}:\${rec.ad_id || "x"}\`, JSON.stringify(rec)); } catch { /* best effort */ } }
  console.log("[audit]", JSON.stringify(rec));
}

async function auditFailure(env, rec) {
  rec.ts = new Date().toISOString();
  rec.status = "failed";
  if (env.DRAFTER_KV) { try { await env.DRAFTER_KV.put(\`audit_fail:\${rec.ts}:\${rec.row_id || "x"}\`, JSON.stringify(rec)); } catch { /* best effort */ } }
  console.log("[audit_fail]", JSON.stringify(rec));
}`;

code = code.replace(oldAudit, newAudit);

const oldHasError = `      if (hasError) {
        if (!results.some(r => r.row_id === rowId && r.video_id)) {
          results.push({ row_id: rowId, ok: false, error: errorMsg });
        }
        continue;
      }`;

const newHasError = `      if (hasError) {
        if (!results.some(r => r.row_id === rowId && r.video_id)) {
          results.push({ row_id: rowId, ok: false, error: errorMsg });
          await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: targetAdset, row_id: rowId, error: errorMsg });
        }
        continue;
      }`;

code = code.replace(oldHasError, newHasError);

const oldCreateAdError = `          if (!created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created.error}\` });
            continue;
          }`;

const newCreateAdError = `          if (!created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created.error}\` });
            await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: targetAdset, row_id: rowId, error: \`Ad creation failed: \${created.error}\` });
            continue;
          }`;

code = code.replace(oldCreateAdError, newCreateAdError);

fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to audit failures");
