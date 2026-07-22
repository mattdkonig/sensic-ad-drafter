import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

const oldResolveDriveLink = `export async function resolveDriveLink(url, token, adName = "") {
  if (!url || typeof url !== "string") return { ok: false, error: "no_url" };
  if (!token) return { ok: false, error: "no_drive_token" };

  const urls = extractMultipleDriveUrls(url);
  if (urls.length === 0) return { ok: false, error: "invalid_url" };

  let allFiles = [];
  let errors = [];

  for (const singleUrl of urls) {
    const id = extractDriveId(singleUrl);
    if (!id) {
      errors.push(\`Could not extract Drive ID from \${singleUrl}\`);
      continue;
    }

    const isFolder = singleUrl.includes("folders/") || singleUrl.includes("drive/folders");

    if (isFolder) {`;

const newResolveDriveLink = `export async function resolveDriveLink(url, token, adName = "") {
  if (!url || typeof url !== "string") return { ok: false, error: "no_url" };
  if (!token) return { ok: false, error: "no_drive_token" };

  const urls = extractMultipleDriveUrls(url);
  if (urls.length === 0) return { ok: false, error: "invalid_url" };

  let allFiles = [];
  let errors = [];

  for (const singleUrl of urls) {
    const id = extractDriveId(singleUrl);
    if (!id) {
      errors.push(\`Could not extract Drive ID from \${singleUrl}\`);
      continue;
    }

    const isFolder = singleUrl.includes("folders/") || singleUrl.includes("drive/folders");

    if (isFolder) {`;

// We also need to patch the file part to add isDirectFile
const oldFilePart = `    } else {
      // It's a single file
      try {
        const metaRes = await fetch(\`https://www.googleapis.com/drive/v3/files/\${id}?fields=id,name,mimeType,webContentLink\`, {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (!metaRes.ok) {
          errors.push(\`Failed to fetch file metadata for \${id}: \${metaRes.status} \${metaRes.statusText}\`);
          continue;
        }
        const file = await metaRes.json();
        
        let format = detectFormatFromName(file.name);
        let score = 1.0; // Single files are assumed to be a 100% match if explicitly linked
        let reason = "Direct file link provided";

        allFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          url: file.webContentLink || \`https://drive.google.com/uc?id=\${file.id}&export=download\`,
          format: format,
          matchScore: score,
          matchReason: reason
        });
      } catch (e) {
        errors.push(\`Error fetching file \${id}: \${e.message}\`);
      }
    }`;

const newFilePart = `    } else {
      // It's a single file
      try {
        const metaRes = await fetch(\`https://www.googleapis.com/drive/v3/files/\${id}?fields=id,name,mimeType,webContentLink\`, {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (!metaRes.ok) {
          errors.push(\`Failed to fetch file metadata for \${id}: \${metaRes.status} \${metaRes.statusText}\`);
          continue;
        }
        const file = await metaRes.json();
        
        let format = detectFormatFromName(file.name);
        let score = 1.0; // Single files are assumed to be a 100% match if explicitly linked
        let reason = "Direct file link provided";

        allFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          url: file.webContentLink || \`https://drive.google.com/uc?id=\${file.id}&export=download\`,
          format: format,
          matchScore: score,
          matchReason: reason,
          isDirectFile: true
        });
      } catch (e) {
        errors.push(\`Error fetching file \${id}: \${e.message}\`);
      }
    }`;

code = code.replace(oldFilePart, newFilePart);
fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs to add isDirectFile flag");
