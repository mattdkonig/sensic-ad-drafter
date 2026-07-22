import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldVideoUpload = `            if (isVideo) {
              const vid = await uploadAdVideo({ ...fbArgs(env), accountId, bytes, filename: asset.name || "video.mp4" });
              finalVideos.push({ id: vid, format: asset.format });
            }`;

const newVideoUpload = `            if (isVideo) {
              // Check if we already have a video_id for this asset from a previous attempt
              let vid = asset.video_id;
              if (!vid) {
                vid = await uploadAdVideo({ ...fbArgs(env), accountId, bytes, filename: asset.name || "video.mp4" });
              }
              finalVideos.push({ id: vid, format: asset.format });
            }`;

code = code.replace(oldVideoUpload, newVideoUpload);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to persist video_id for retries in Drive download logic");
