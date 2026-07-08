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
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
  const csvRes = await fetch(csvUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  const csvText = await csvRes.text();
  
  console.log(csvText);
}
run();
