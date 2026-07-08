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
  
  const workbook = xlsx.read(buffer, { type: 'buffer', cellNF: true, cellHTML: true, cellFormula: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Let's look at row 9 (index 8)
  console.log("Row 9:", data[8]);
  
  // Find "Quiz Ads"
  const rowIndex = data.findIndex(r => Object.values(r).some(v => typeof v === 'string' && v.includes("Quiz Ads")));
  
  if (rowIndex !== -1) {
    console.log(`Found "Quiz Ads" at row ${rowIndex + 1}`);
    console.log("Data:", data[rowIndex]);
  } else {
    console.log("Could not find 'Quiz Ads' in the sheet data.");
  }
}
run();
