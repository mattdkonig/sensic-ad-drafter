import fs from "fs";
import { GoogleAuth } from 'google-auth-library';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const spreadsheetId = CONFIG['xero-shoes'].id;
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meta = await metaRes.json();
  console.log(JSON.stringify(meta.sheets.map(s => s.properties.title), null, 2));
}

run();
