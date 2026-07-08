import fs from "fs";

let code = fs.readFileSync("lib/sync-worker.mjs", "utf-8");

code = code.replace(
  /export async function syncBibles\(env\) \{/,
  `export async function syncBibles(env, targetSlug = null) {`
);

code = code.replace(
  /for \(const \[slug, sheet\] of Object\.entries\(CONFIG\)\) \{/,
  `for (const [slug, sheet] of Object.entries(CONFIG)) {
    if (targetSlug && slug !== targetSlug) continue;`
);

fs.writeFileSync("lib/sync-worker.mjs", code);
console.log("Patched lib/sync-worker.mjs");
