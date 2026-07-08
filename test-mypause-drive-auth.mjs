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
  const orig = m.resolveDriveLink;
  
  try {
    const result = await orig(url, "Listicle with Featured Image - Hormone Balance Plus", {});
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
