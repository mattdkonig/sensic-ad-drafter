import { resolveDriveLink } from "./drive.mjs";
import { GoogleAuth } from 'google-auth-library';
import fs from "fs";

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
  
  // Download the first 1x1 and 9x16 images to inspect them
  for (const f of result.files) {
    if (f.name.includes("Var 2")) continue; // just get the first ones
    console.log("Downloading", f.name);
    const res = await fetch(f.download_url);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(f.name.replace(/[^a-zA-Z0-9.]/g, "_"), Buffer.from(buffer));
  }
}
run();
