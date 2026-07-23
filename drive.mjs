// sensic-ad-drafter/drive.mjs
// M3.5 Drive Auto-Resolution

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export function extractDriveId(url) {
  if (!url) return null;
  const folderMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return { id: folderMatch[1], type: "folder" };
  const fileMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return { id: fileMatch[1], type: "file" };
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return { id: idMatch[1], type: "unknown" }; // Could be file or folder
  return null;
}

export function extractMultipleDriveUrls(text) {
  if (!text) return [];
  const urls = text.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s.startsWith('http'));
  return urls;
}

export function detectFormatFromName(name) {
  const n = name.toLowerCase();
  if (n.includes("1x1") || n.includes("1-1") || n.includes("1:1") || n.includes("square")) return "1:1";
  if (n.includes("4x5") || n.includes("4-5") || n.includes("4:5") || n.includes("portrait")) return "4:5";
  if (n.includes("9x16") || n.includes("9-16") || n.includes("9:16") || n.includes("story") || n.includes("stories") || n.includes("reel")) return "9:16";
  if (n.includes("16x9") || n.includes("16-9") || n.includes("16:9") || n.includes("landscape")) return "16:9";
  return "unknown";
}

export function normalizeName(name) {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreMatch(fileName, adName) {
  let score = 0;
  let reason = [];
  const normFile = normalizeName(fileName);
  const normAd = normalizeName(adName);

  if (normFile === normAd || normFile.startsWith(normAd)) {
    score += 1.0;
    reason.push("Exact ad name match");
  } else if (normFile.includes(normAd)) {
    score += 0.8;
    reason.push("Ad name match");
  } else {
    // Partial match
    const adWords = normAd.split(" ");
    let matches = 0;
    for (const w of adWords) {
      if (w.length > 2 && normFile.includes(w)) matches++;
    }
    if (matches > 0) {
      score += (matches / adWords.length) * 0.5;
      reason.push("Partial ad name match");
    }
  }

  const n = fileName.toLowerCase();
  if (n.includes("approved") || n.includes("final") || n.includes("v2") || n.includes("v3")) {
    score += 0.1;
    reason.push("Approved/Final version");
  }
  if (n.includes("draft") || n.includes("old") || n.includes("archive")) {
    score -= 0.5;
    reason.push("Draft/Old version penalty");
  }

  return { score, reason: reason.join(", ") };
}

export async function resolveDriveLink(url, token, adName = "") {
  const driveInfo = extractDriveId(url);
  if (!driveInfo) return { ok: false, error: "invalid_drive_url" };
  if (!token) return { ok: false, error: "no_drive_token" };

  try {
    let filesToProcess = [];
    const fields = encodeURIComponent("files(id,name,mimeType,size,webContentLink,imageMediaMetadata,videoMediaMetadata)");
    
    if (driveInfo.type === "folder" || driveInfo.type === "unknown") {
      // Try as folder first
      const q = encodeURIComponent(`'${driveInfo.id}' in parents and trashed = false`);
      const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=${fields}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      
      if (data.error || (driveInfo.type === "unknown" && (!data.files || data.files.length === 0))) {
        if (driveInfo.type === "unknown") {
          // Fallback to file
          const fileRes = await fetch(`${DRIVE_API}/files/${driveInfo.id}?fields=id,name,mimeType,size,webContentLink,imageMediaMetadata,videoMediaMetadata`, { headers: { 'Authorization': `Bearer ${token}` } });
          const fileData = await fileRes.json();
          if (fileData.error) {
             if (data.error) return { ok: false, error: data.error.message }; // Return original folder error if both fail
             return { ok: false, error: fileData.error.message };
          }
          filesToProcess = [fileData];
        } else {
          return { ok: false, error: data.error ? data.error.message : "Folder is empty" };
        }
      } else {
        filesToProcess = data.files || [];
      }
    } else {
      // It's a file
      const fileRes = await fetch(`${DRIVE_API}/files/${driveInfo.id}?fields=id,name,mimeType,size,webContentLink,imageMediaMetadata,videoMediaMetadata`, { headers: { 'Authorization': `Bearer ${token}` } });
      const fileData = await fileRes.json();
      if (fileData.error) return { ok: false, error: fileData.error.message };
      filesToProcess = [fileData];
    }

    const validFiles = [];
    const skippedFiles = [];

    for (const file of filesToProcess) {
      const isImage = file.mimeType === "image/jpeg" || file.mimeType === "image/png";
      const isVideo = file.mimeType === "video/mp4" || file.mimeType === "video/quicktime";
      
      if (isImage || isVideo) {
        let actualFormat = "unknown";
        if (file.imageMediaMetadata) {
          const w = file.imageMediaMetadata.width;
          const h = file.imageMediaMetadata.height;
          if (w && h) {
            const ratio = w / h;
            if (ratio > 0.9 && ratio < 1.1) actualFormat = "1:1";
            else if (ratio > 0.75 && ratio < 0.85) actualFormat = "4:5";
            else if (ratio > 0.5 && ratio < 0.6) actualFormat = "9:16";
            else if (ratio > 1.7 && ratio < 1.8) actualFormat = "16:9";
          }
        } else if (file.videoMediaMetadata) {
          const w = file.videoMediaMetadata.width;
          const h = file.videoMediaMetadata.height;
          if (w && h) {
            const ratio = w / h;
            if (ratio > 0.9 && ratio < 1.1) actualFormat = "1:1";
            else if (ratio > 0.75 && ratio < 0.85) actualFormat = "4:5";
            else if (ratio > 0.5 && ratio < 0.6) actualFormat = "9:16";
            else if (ratio > 1.7 && ratio < 1.8) actualFormat = "16:9";
          }
        }

        const nameFormat = detectFormatFromName(file.name);
        const format = actualFormat !== "unknown" ? actualFormat : nameFormat;
        
        // If filesToProcess is exactly 1 and we were explicitly given a file ID, it's a direct file
        const isDirectFile = filesToProcess.length === 1 && driveInfo.type !== "folder";
        
        let matchScore = 0;
        let matchReason = [];
        
        if (isDirectFile) {
          matchScore = 1.0;
          matchReason = ["Direct file link provided"];
        } else {
          const match = scoreMatch(file.name, adName);
          matchScore = match.score;
          matchReason = match.reason;
        }

        validFiles.push({
          id: file.id,
          name: file.name,
          mime: file.mimeType,
          size: file.size,
          format: format,
          nameFormat: nameFormat,
          actualFormat: actualFormat,
          matchScore: matchScore,
          matchReason: matchReason,
          isDirectFile: isDirectFile,
          download_url: `${DRIVE_API}/files/${file.id}?alt=media`
        });
      } else {
        skippedFiles.push({ name: file.name, reason: "unsupported format" });
      }
    }

    // Sort by match score descending
    validFiles.sort((a, b) => b.matchScore - a.matchScore);

    return {
      ok: true,
      drive_id: driveInfo.id,
      type: driveInfo.type,
      files: validFiles,
      skipped: skippedFiles
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
