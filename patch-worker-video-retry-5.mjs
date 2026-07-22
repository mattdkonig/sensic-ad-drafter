import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldHasError = `      if (hasError) {
        if (!results.some(r => r.row_id === rowId && r.video_id)) {
          results.push({ row_id: rowId, ok: false, error: errorMsg });
          await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: targetAdset, row_id: rowId, error: errorMsg });
        }
        continue;
      }`;

const newHasError = `      if (hasError) {
        // Only push a failure if we haven't pushed a retry message
        if (!results.some(r => r.row_id === rowId && r.message && r.message.includes("processing"))) {
          results.push({ row_id: rowId, ok: false, error: errorMsg });
          await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: targetAdset, row_id: rowId, error: errorMsg });
        }
        continue;
      }`;

code = code.replace(oldHasError, newHasError);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to handle video retry messages properly");
