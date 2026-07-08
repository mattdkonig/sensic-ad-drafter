import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

// Fix normalizeName
code = code.replace(
  /export function normalizeName\(name\) \{[\s\S]*?\}/,
  `export function normalizeName(name) {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}`
);

// Restore the catch block
code = code.replace(
  /throw err;/g,
  `return { ok: false, error: String(err.message || err) };`
);

fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs");
