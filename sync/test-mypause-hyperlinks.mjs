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
  
  const workbook = xlsx.read(buffer, { type: 'buffer', cellNF: true, cellHTML: true, cellFormula: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Find the row with "Slim Down Shake"
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  const rowIndex = data.findIndex(r => Object.values(r).some(v => typeof v === 'string' && v.includes("Slim Down Shake")));
  
  if (rowIndex !== -1) {
    console.log(`Found at row ${rowIndex + 1}`);
    // Check column F (index 5)
    const cellRef = xlsx.utils.encode_cell({ r: rowIndex, c: 5 });
    const cell = worksheet[cellRef];
    console.log("Cell F data:", cell);
    if (cell && cell.l) {
      console.log("Hyperlink:", cell.l.Target);
    }
  }
}
run();
