import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldVideoCheck = `      for (const v of uploadedVideos) {
        const ready = await waitVideoReady({ ...fbArgs(env), videoId: v.id });
        if (ready === "error") { hasError = true; errorMsg = "Meta could not process a video"; break; }
        if (ready !== "ready") { hasError = true; errorMsg = "Video uploaded but still processing on Meta. Please click 'Create' again in 30 seconds."; break; }
        v.thumb = await getVideoThumbnail({ ...fbArgs(env), videoId: v.id });
      }`;

const newVideoCheck = `      for (const v of uploadedVideos) {
        const ready = await waitVideoReady({ ...fbArgs(env), videoId: v.id });
        if (ready === "error") { hasError = true; errorMsg = "Meta could not process a video"; break; }
        if (ready !== "ready") { 
          hasError = true; 
          errorMsg = "Video uploaded but still processing on Meta. Please click 'Create' again in 30 seconds."; 
          // Return the video ID so the UI can persist it for retry
          results.push({ row_id: rowId, ok: true, message: errorMsg, video_id: v.id });
          break; 
        }
        v.thumb = await getVideoThumbnail({ ...fbArgs(env), videoId: v.id });
      }`;

code = code.replace(oldVideoCheck, newVideoCheck);

const oldHasError = `      if (hasError) {
        results.push({ row_id: rowId, ok: false, error: errorMsg });
        continue;
      }`;

const newHasError = `      if (hasError) {
        // If we already pushed a retry message, don't push a failure
        if (!results.some(r => r.row_id === rowId && r.video_id)) {
          results.push({ row_id: rowId, ok: false, error: errorMsg });
        }
        continue;
      }`;

code = code.replace(oldHasError, newHasError);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to persist video_id for retries properly");
