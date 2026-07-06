import { extractDriveId, extractMultipleDriveUrls, detectFormatFromName, scoreMatch } from "./drive.mjs";

console.log("--- Drive URL Parsing ---");
const urls = [
  "https://drive.google.com/drive/folders/1A2B3C4D5E6F",
  "https://drive.google.com/open?id=1A2B3C4D5E6F",
  "https://drive.google.com/file/d/1A2B3C4D5E6F/view",
  "https://drive.google.com/uc?id=1A2B3C4D5E6F"
];
for (const u of urls) console.log(u, "->", extractDriveId(u));

console.log("\n--- Multiple URL Extraction ---");
console.log(extractMultipleDriveUrls("https://drive.google.com/file/d/123/view \n https://drive.google.com/open?id=456"));

console.log("\n--- Format Detection ---");
console.log("Winter Sale - 1x1.mp4 ->", detectFormatFromName("Winter Sale - 1x1.mp4"));
console.log("Summer Promo 9:16 final.jpg ->", detectFormatFromName("Summer Promo 9:16 final.jpg"));
console.log("Spring 4x5 draft.mov ->", detectFormatFromName("Spring 4x5 draft.mov"));

console.log("\n--- Matching Logic ---");
const adName = "Winter Sale - UGC Hook 3";
console.log("Ad Name:", adName);
console.log("File 1:", scoreMatch("Winter Sale - UGC Hook 3 - 1x1 - approved.mp4", adName));
console.log("File 2:", scoreMatch("Winter Sale - UGC Hook 3 - 4x5 - approved.mp4", adName));
console.log("File 3:", scoreMatch("Summer Promo - 1x1.mp4", adName));
console.log("File 4:", scoreMatch("Winter Sale - UGC Hook 3 - 1x1 - draft.mp4", adName));
