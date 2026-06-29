// sensic-ad-drafter/drive.mjs
// M3.5 Drive Auto-Resolution

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// Extract folder ID from a Google Drive URL
export function extractFolderId(url) {
  if (!url) return null;
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return null;
}

// List files in a Drive folder, filtering for Meta-acceptable formats
export async function resolveDriveFolder(folderUrl, apiKey) {
  const folderId = extractFolderId(folderUrl);
  if (!folderId) return { ok: false, error: "invalid_folder_url" };
  if (!apiKey) return { ok: false, error: "no_drive_api_key" };

  try {
    // We only want images and videos. We can filter client-side or via query.
    // q: 'folderId' in parents and trashed = false
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent("files(id,name,mimeType,size,webContentLink)");
    const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=${fields}&key=${apiKey}`);
    const data = await res.json();

    if (data.error) {
      return { ok: false, error: data.error.message };
    }

    const files = data.files || [];
    const validFiles = [];
    const skippedFiles = [];

    for (const file of files) {
      const isImage = file.mimeType === "image/jpeg" || file.mimeType === "image/png";
      const isVideo = file.mimeType === "video/mp4" || file.mimeType === "video/quicktime";
      
      if (isImage || isVideo) {
        validFiles.push({
          id: file.id,
          name: file.name,
          mime: file.mimeType,
          size: file.size,
          download_url: `${DRIVE_API}/files/${file.id}?alt=media&key=${apiKey}`
        });
      } else {
        skippedFiles.push({ name: file.name, reason: "unsupported format" });
      }
    }

    return {
      ok: true,
      folder_id: folderId,
      files: validFiles,
      skipped: skippedFiles
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
