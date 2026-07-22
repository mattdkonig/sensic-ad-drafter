import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

const oldResolveDriveLink = `        const nameFormat = detectFormatFromName(file.name);
        const format = actualFormat !== "unknown" ? actualFormat : nameFormat;
        
        const match = scoreMatch(file.name, adName);

        validFiles.push({
          id: file.id,
          name: file.name,
          mime: file.mimeType,
          size: file.size,
          format: format,
          nameFormat: nameFormat,
          actualFormat: actualFormat,
          matchScore: match.score,
          matchReason: match.reason,
          download_url: \`\${DRIVE_API}/files/\${file.id}?alt=media\`
        });`;

const newResolveDriveLink = `        const nameFormat = detectFormatFromName(file.name);
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
          download_url: \`\${DRIVE_API}/files/\${file.id}?alt=media\`
        });`;

code = code.replace(oldResolveDriveLink, newResolveDriveLink);
fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs to handle direct file links properly");
