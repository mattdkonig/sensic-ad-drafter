import { extractFolderId } from "./drive.mjs";
const urls = [
  "https://drive.google.com/drive/folders/1A2B3C4D5E6F",
  "https://drive.google.com/open?id=1A2B3C4D5E6F",
  "https://drive.google.com/file/d/1A2B3C4D5E6F/view",
  "https://drive.google.com/uc?id=1A2B3C4D5E6F"
];
for (const u of urls) console.log(u, "->", extractFolderId(u));
