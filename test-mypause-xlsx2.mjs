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
  const url = `https://www.googleapis.com/drive/v3/files/${sheet.id}?alt=media`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const buffer = await res.arrayBuffer();
  
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  console.log("Sheet names:", workbook.SheetNames);
  
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(`Row ${i+1}:`, data[i].slice(0, 5));
  }
}
run();
