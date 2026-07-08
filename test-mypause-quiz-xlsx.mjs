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
  
  // Find the right sheet
  let targetSheetName = workbook.SheetNames[0];
  for (const sName of workbook.SheetNames) {
    const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName], { header: 1 });
    if (sData.some(r => r && r.some(c => typeof c === 'string' && (c.toLowerCase().includes('uploaded') || c.toLowerCase().includes('status'))))) {
      targetSheetName = sName;
      break;
    }
  }
  
  const worksheet = workbook.Sheets[targetSheetName];
  const xlsxData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  let xlsxHeaderIdx = -1;
  for (let i = 0; i < Math.min(20, xlsxData.length); i++) {
    if (xlsxData[i] && xlsxData[i].some(c => typeof c === 'string' && (c.toLowerCase().includes('uploaded') || c.toLowerCase().includes('status')))) {
      xlsxHeaderIdx = i;
      break;
    }
  }
  
  console.log("Header index:", xlsxHeaderIdx);
  
  // Look for Quiz Ads
  const quizRowIdx = xlsxData.findIndex(r => Object.values(r).some(v => typeof v === 'string' && v.includes("Quiz Ads")));
  console.log("Quiz Ads row index:", quizRowIdx);
  
  if (quizRowIdx !== -1) {
    const row = xlsxData[quizRowIdx];
    console.log("Quiz Ads row data:", row);
    
    // Check hyperlinks for this row
    const xlsxHeaders = xlsxData[xlsxHeaderIdx].map(h => typeof h === 'string' ? h.toLowerCase() : '');
    for (let c = 0; c < xlsxHeaders.length; c++) {
      const cellRef = xlsx.utils.encode_cell({ r: quizRowIdx, c: c });
      const cell = worksheet[cellRef];
      if (cell && cell.l && cell.l.Target) {
        console.log(`Hyperlink at col ${c} (${xlsxHeaders[c]}):`, cell.l.Target);
      }
    }
  }
}
run();
