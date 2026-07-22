import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldCreateAdError = `          if (!created || !created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created ? created.error : 'unknown error'}\` });
            continue;
          }`;

const newCreateAdError = `          if (!created || !created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created ? created.error : 'unknown error'}\` });
            await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, error: \`Ad creation failed: \${created ? created.error : 'unknown error'}\` });
            continue;
          }`;

code = code.replace(oldCreateAdError, newCreateAdError);

// Wait, let's check how it's actually written
const oldCreateAdErrorReal = `          if (!created || !created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created?.error || "unknown"}\` });
            continue;
          }`;

const newCreateAdErrorReal = `          if (!created || !created.ok) {
            results.push({ row_id: rowId, ok: false, error: \`Ad creation failed: \${created?.error || "unknown"}\` });
            await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, error: \`Ad creation failed: \${created?.error || "unknown"}\` });
            continue;
          }`;

code = code.replace(oldCreateAdErrorReal, newCreateAdErrorReal);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to audit create failures");
