import { resolveDriveLink } from "./drive.mjs";

const apiKey = "AIzaSyBXcYIFLC56abh2Ij85z4zMtTfrgEEbtIE";
const folderUrl = "https://drive.google.com/drive/folders/1aZ0G3WLAuu3OjWfV-m1f8pxYmrzuFDqt?usp=drive_link";
const adName = "Listicle with Featured Image - Slim Down Shake";

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
}

run();
