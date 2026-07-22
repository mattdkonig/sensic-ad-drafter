import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldVideoUpload = `          if (asset.format === "video") {
            const up = await createCleanVideoDraft({ token: fbArgs(env).token, secret: fbArgs(env).secret, accountId, adsetId: targetAdset, plan, videoUrl: asset.url, format: asset.format, instagramActorId, instagramUserId });
            if (!up.ok) {
              results.push({ row_id: rowId, ok: false, error: \`Video upload failed for \${asset.format}: \${up.error}\` });
              continue;
            }
            if (up.processing) {
              results.push({ row_id: rowId, ok: true, message: "Video uploaded but still processing on Meta. Please click 'Create' again in 30 seconds to finish building the ad." });
              continue; // Skip creating the ad for now, wait for retry
            }
            asset.video_id = up.id;
          }`;

const newVideoUpload = `          if (asset.format === "video") {
            // Check if we already have a video_id for this asset from a previous attempt
            if (asset.video_id) {
              // We just need to check if it's done processing
              const check = await fetch(\`https://graph.facebook.com/v19.0/\${asset.video_id}?fields=status&access_token=\${fbArgs(env).token}\`);
              if (check.ok) {
                const data = await check.json();
                if (data.status && data.status.video_status !== "ready") {
                  results.push({ row_id: rowId, ok: true, message: \`Video \${asset.video_id} is still processing on Meta (status: \${data.status.video_status}). Please click 'Create' again in 30 seconds to finish building the ad.\`, video_id: asset.video_id });
                  continue;
                }
              }
            } else {
              const up = await createCleanVideoDraft({ token: fbArgs(env).token, secret: fbArgs(env).secret, accountId, adsetId: targetAdset, plan, videoUrl: asset.url, format: asset.format, instagramActorId, instagramUserId });
              if (!up.ok) {
                results.push({ row_id: rowId, ok: false, error: \`Video upload failed for \${asset.format}: \${up.error}\` });
                continue;
              }
              if (up.processing) {
                results.push({ row_id: rowId, ok: true, message: "Video uploaded but still processing on Meta. Please click 'Create' again in 30 seconds to finish building the ad.", video_id: up.id });
                continue; // Skip creating the ad for now, wait for retry
              }
              asset.video_id = up.id;
            }
          }`;

code = code.replace(oldVideoUpload, newVideoUpload);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to persist video_id for retries");
