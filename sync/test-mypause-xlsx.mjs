import fs from "fs";
import { GoogleAuth } from 'google-auth-library';
import * as xlsx from 'xlsx';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const sheet = CONFIG["mypause"];
  
  // Download the XLSX file from Drive
  const url = `https://www.googleapis.com/drive/v3/files/${sheet.id}?alt=media`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const buffer = await res.arrayBuffer();
  
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // Assuming first sheet or we can match GID if needed
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON to see raw data
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const row = data.find(r => Object.values(r).some(v => typeof v === 'string' && v.includes("Slim Down Shake")));
  console.log("Raw row from XLSX:", row);
}
run();
