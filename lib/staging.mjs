// Durable Asset Access (Layer 2) - Sensic-owned staging
// This module provides functions to copy externally owned assets into a Sensic-owned
// staging folder so the Drafter service account can access them reliably.

import { extractDriveId } from "../drive.mjs";

const SENSIC_STAGING_FOLDER_ID = "1_sensic_staging_folder_placeholder_id"; // Replace with actual ID

export async function stageAsset(env, sourceUrl, token) {
  const driveInfo = extractDriveId(sourceUrl);
  if (!driveInfo || !driveInfo.id) return { ok: false, error: "invalid_drive_url" };
  if (!token) return { ok: false, error: "no_drive_token" };

  // 1. Check if already staged (idempotency)
  let stagedRecord = await getStagedRecord(env, driveInfo.id);
  if (stagedRecord && stagedRecord.stagedId) {
    return { ok: true, stagedId: stagedRecord.stagedId, url: `https://drive.google.com/file/d/${stagedRecord.stagedId}/view` };
  }

  // 2. We need a token that has READ access to the source file AND WRITE access to the staging folder.
  // If the Drafter service account doesn't have READ access, this will fail.
  // In a full implementation, this might trigger a request to a higher-privileged identity (e.g., Domain-Wide Delegation).
  // For now, we attempt the copy using the provided token.

  try {
    // Attempt to copy the file
    const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveInfo.id}/copy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parents: [SENSIC_STAGING_FOLDER_ID],
        name: `[STAGED] ${driveInfo.id}` // Keep original ID in name for tracking
      })
    });

    const copyData = await copyRes.json();
    
    if (copyData.error) {
      return { ok: false, error: copyData.error.message, rawError: copyData.error };
    }

    // 3. Record the staging
    await saveStagedRecord(env, driveInfo.id, copyData.id);

    return { ok: true, stagedId: copyData.id, url: `https://drive.google.com/file/d/${copyData.id}/view` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function getStagedRecord(env, sourceId) {
  if (!env.DRAFTER_KV) return null;
  try {
    return await env.DRAFTER_KV.get(`staged:${sourceId}`, "json");
  } catch {
    return null;
  }
}

async function saveStagedRecord(env, sourceId, stagedId) {
  if (!env.DRAFTER_KV) return;
  try {
    await env.DRAFTER_KV.put(`staged:${sourceId}`, JSON.stringify({ sourceId, stagedId, timestamp: Date.now() }));
  } catch (e) {
    console.error("Failed to save staged record", e);
  }
}
