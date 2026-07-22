import fs from "fs";

let code = fs.readFileSync("lib/sync-worker.mjs", "utf-8");

const oldParser = `      for (const tab of tabsToProcess) {
        const tabId = tab.properties.sheetId;
        const tabName = tab.properties.title;`;

const newParser = `      for (const tab of tabsToProcess) {
        const tabId = tab.properties.sheetId;
        const tabName = tab.properties.title;
        
        // Exclude history/archive tabs explicitly
        const normTabName = tabName.toLowerCase().trim();
        if (normTabName.includes("ads uploaded") || normTabName.includes("old |") || normTabName.includes("archive") || normTabName.includes("history") || normTabName.includes("2026")) {
          console.log("Skipping history tab:", tabName);
          continue;
        }`;

code = code.replace(oldParser, newParser);
fs.writeFileSync("lib/sync-worker.mjs", code);
console.log("Patched lib/sync-worker.mjs to skip history tabs early");
