import { resolveDriveLink } from "./drive.mjs";
import { GoogleAuth } from 'google-auth-library';

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const url = "https://drive.google.com/drive/folders/126NOi9r3XSmpcLiKYVgmfRAXE_ejuvZ_?usp=drive_link";
  
  const originalFetch = global.fetch;
  global.fetch = async (reqUrl, options = {}) => {
    if (reqUrl.includes("googleapis.com/drive")) {
      options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    }
    return originalFetch(reqUrl, options);
  };

  const m = await import("./drive.mjs");
  const result = await m.resolveDriveLink(url, "Listicle with Featured Image - Hormone Balance Plus", {});
  
  for (const f of result.files) {
    // Fetch the file metadata to see imageMediaMetadata
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?fields=imageMediaMetadata`;
    const res = await fetch(metaUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const meta = await res.json();
    console.log(f.name, meta.imageMediaMetadata ? `${meta.imageMediaMetadata.width}x${meta.imageMediaMetadata.height}` : "no metadata");
  }
}
run();
