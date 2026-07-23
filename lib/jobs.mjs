export async function getJob(env, jobId) {
  if (!env.DRAFTER_KV) return null;
  try {
    return await env.DRAFTER_KV.get(`job:${jobId}`, "json");
  } catch {
    return null;
  }
}

export async function saveJob(env, job) {
  if (!env.DRAFTER_KV) return;
  try {
    // Expire jobs after 7 days
    await env.DRAFTER_KV.put(`job:${job.jobId}`, JSON.stringify(job), { expirationTtl: 604800 });
  } catch (e) {
    console.error("Failed to save job state", e);
  }
}

export function generateJobId(client, rowId, adsetId, assets) {
  // Create a fingerprint of the assets to ensure idempotency is tied to the specific creatives
  const assetFingerprint = assets ? assets.map(a => a.hash || a.id || a.url).sort().join(',') : '';
  // Basic hash of the fingerprint
  let hash = 0;
  for (let i = 0; i < assetFingerprint.length; i++) {
    const char = assetFingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${client}:${rowId}:${adsetId}:${Math.abs(hash)}`;
}
