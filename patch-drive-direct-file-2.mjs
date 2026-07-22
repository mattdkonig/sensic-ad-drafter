import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

const oldResolveDriveLink = `    for (const file of filesToProcess) {
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
            else if (ratio > 0.7 && ratio < 0.9) actualFormat = "4:5";
            else if (ratio < 0.6) actualFormat = "9:16";
          }
        } else if (file.videoMediaMetadata) {
          const w = file.videoMediaMetadata.width;
          const h = file.videoMediaMetadata.height;
          if (w && h) {
            const ratio = w / h;
            if (ratio > 0.9 && ratio < 1.1) actualFormat = "1:1";
            else if (ratio > 0.7 && ratio < 0.9) actualFormat = "4:5";
            else if (ratio < 0.6) actualFormat = "9:16";
          }
        }

        const formatFromName = detectFormatFromName(file.name);
        const finalFormat = actualFormat !== "unknown" ? actualFormat : formatFromName;

        const match = scoreMatch(file.name, adName);
        
        validFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          url: file.webContentLink || \`https://drive.google.com/uc?id=\${file.id}&export=download\`,
          format: finalFormat,
          matchScore: match.score,
          matchReason: match.reason.join(", ")
        });
      } else {
        skippedFiles.push({ name: file.name, reason: "Unsupported file type" });
      }
    }`;

const newResolveDriveLink = `    for (const file of filesToProcess) {
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
            else if (ratio > 0.7 && ratio < 0.9) actualFormat = "4:5";
            else if (ratio < 0.6) actualFormat = "9:16";
          }
        } else if (file.videoMediaMetadata) {
          const w = file.videoMediaMetadata.width;
          const h = file.videoMediaMetadata.height;
          if (w && h) {
            const ratio = w / h;
            if (ratio > 0.9 && ratio < 1.1) actualFormat = "1:1";
            else if (ratio > 0.7 && ratio < 0.9) actualFormat = "4:5";
            else if (ratio < 0.6) actualFormat = "9:16";
          }
        }

        const formatFromName = detectFormatFromName(file.name);
        const finalFormat = actualFormat !== "unknown" ? actualFormat : formatFromName;

        // If filesToProcess is exactly 1 and we were explicitly given a file ID, it's a direct file
        const isDirectFile = filesToProcess.length === 1 && driveInfo.type === "file";
        
        let matchScore = 0;
        let matchReason = "";
        
        if (isDirectFile) {
          matchScore = 1.0;
          matchReason = "Direct file link provided";
        } else {
          const match = scoreMatch(file.name, adName);
          matchScore = match.score;
          matchReason = match.reason.join(", ");
        }
        
        validFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          url: file.webContentLink || \`https://drive.google.com/uc?id=\${file.id}&export=download\`,
          format: finalFormat,
          matchScore: matchScore,
          matchReason: matchReason,
          isDirectFile: isDirectFile
        });
      } else {
        skippedFiles.push({ name: file.name, reason: "Unsupported file type" });
      }
    }`;

code = code.replace(oldResolveDriveLink, newResolveDriveLink);
fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs to handle direct file links properly");
