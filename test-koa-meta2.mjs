import fs from "fs";
import { GoogleAuth } from 'google-auth-library';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const sheet = CONFIG["koa-kids"];
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${sheet.id}?fields=name,modifiedTime,mimeType`;
  const metaRes = await fetch(metaUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  const metaData = await metaRes.json();
  
  console.log("File metadata:", metaData);
}
run();
