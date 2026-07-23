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

export function generateJobId(client, rowId, adsetId) {
  return `${client}:${rowId}:${adsetId}`;
}
