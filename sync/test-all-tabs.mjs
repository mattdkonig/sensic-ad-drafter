import fs from "fs";
import { GoogleAuth } from 'google-auth-library';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const sheet = CONFIG["koa-kids"];
  
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`;
  const metaRes = await fetch(metaUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  const metaData = await metaRes.json();
  
  if (metaData.sheets) {
    console.log("Available tabs:");
    metaData.sheets.forEach(s => {
      console.log(`- ${s.properties.title} (gid: ${s.properties.sheetId})`);
    });
  } else {
    console.log("Could not fetch metadata:", metaData);
  }
}
run();
