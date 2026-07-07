import fs from "fs";
import Papa from "papaparse";
import { GoogleAuth } from 'google-auth-library';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const sheet = CONFIG["mypause"];
  const url = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  const row = parsed.data.find(r => Object.values(r).some(v => v && v.includes("Slim Down Shake")));
  console.log("Raw row:", row);
}
run();
