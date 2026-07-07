import { resolveDriveLink } from "./drive.mjs";
import fs from "fs";

const apiKey = "AIzaSyBXcYIFLC56abh2Ij85z4zMtTfrgEEbtIE";
const folderUrl = "https://drive.google.com/drive/folders/13LmG2HMTCZoZsHhdNXl74mbpEPkS68VA?usp=drive_link";
const adName = "Beef Liver Iron Effectiveness"; // We'll see what files are actually in there

async function run() {
  console.log(`Resolving: ${folderUrl}`);
  const result = await resolveDriveLink(folderUrl, apiKey, adName);
  
  if (!result.ok) {
    console.error("Error:", result.error);
    return;
  }
  
  console.log(`\nFound ${result.files.length} valid files and ${result.skipped.length} skipped files.`);
  
  console.log("\n--- Valid Files ---");
  result.files.forEach(f => {
    console.log(`- [${f.format}] ${f.name} (${Math.round(f.size/1024)} KB)`);
    console.log(`  Score: ${f.matchScore} | Reason: ${f.matchReason}`);
  });
  
  console.log("\n--- Skipped Files ---");
  result.skipped.forEach(f => {
    console.log(`- ${f.name} (Reason: ${f.reason})`);
  });
}

run();
