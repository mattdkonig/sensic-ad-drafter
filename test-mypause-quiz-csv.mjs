import fs from "fs";
import { GoogleAuth } from 'google-auth-library';
import Papa from "papaparse";

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const sheet = CONFIG["mypause"];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
  const csvRes = await fetch(csvUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  const csvText = await csvRes.text();
  
  const lines = csvText.split('\n');
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('uploaded') || l.toLowerCase().includes('status'));
  const newText = lines.slice(headerIdx).join('\n');
  const parsed = Papa.parse(newText, { header: true, skipEmptyLines: true });
  
  const targetRow = parsed.data.find(r => Object.values(r).some(v => typeof v === 'string' && v.includes("Quiz Ads")));
  console.log("Quiz Ads row from CSV:", targetRow);
}
run();
