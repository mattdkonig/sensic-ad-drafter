import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

const oldResolveDriveLink = `        const formatFromName = detectFormatFromName(file.name);
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
    }

    // Sort by match score descending
    validFiles.sort((a, b) => b.matchScore - a.matchScore);

    return {
      ok: true,
      type: driveInfo.type,
      files: validFiles,
      skipped: skippedFiles
    };`;

const newResolveDriveLink = `        const formatFromName = detectFormatFromName(file.name);
        const finalFormat = actualFormat !== "unknown" ? actualFormat : formatFromName;

        // If filesToProcess is exactly 1 and we were explicitly given a file ID, it's a direct file
        const isDirectFile = filesToProcess.length === 1 && driveInfo.type !== "folder";
        
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
    }

    // Sort by match score descending
    validFiles.sort((a, b) => b.matchScore - a.matchScore);

    return {
      ok: true,
      type: driveInfo.type,
      files: validFiles,
      skipped: skippedFiles
    };`;

code = code.replace(oldResolveDriveLink, newResolveDriveLink);
fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs to handle direct file links properly");
