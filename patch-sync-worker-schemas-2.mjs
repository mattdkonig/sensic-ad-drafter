import fs from "fs";

let code = fs.readFileSync("lib/sync-worker.mjs", "utf-8");

const oldParser = `        // Exclude history/archive tabs explicitly
        const normTabName = tabName.toLowerCase().trim();
        if (normTabName.includes("ads uploaded") || normTabName.includes("old |") || normTabName.includes("archive")) {
          continue;
        }`;

const newParser = `        // Exclude history/archive tabs explicitly
        const normTabName = tabName.toLowerCase().trim();
        if (normTabName.includes("ads uploaded") || normTabName.includes("old |") || normTabName.includes("archive") || normTabName.includes("history")) {
          continue;
        }`;

code = code.replace(oldParser, newParser);
fs.writeFileSync("lib/sync-worker.mjs", code);
console.log("Patched lib/sync-worker.mjs to exclude history tabs completely");
