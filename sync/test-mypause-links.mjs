import fs from "fs";
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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}?ranges=A1:Z50&includeGridData=true`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  
  if (data.error) {
      console.error(data.error);
      return;
  }
  
  const sheetData = data.sheets.find(s => s.properties.sheetId.toString() === sheet.gid);
  if (!sheetData || !sheetData.data || !sheetData.data[0].rowData) {
      console.log("Could not find sheet data");
      return;
  }
  
  const gridData = sheetData.data[0].rowData;
  
  // Find the row with "Slim Down Shake"
  const targetRow = gridData.find(row => 
    row.values && row.values.some(cell => 
      cell.formattedValue && cell.formattedValue.includes("Slim Down Shake")
    )
  );
  
  if (targetRow) {
    console.log("Found row. Checking for hyperlinks...");
    targetRow.values.forEach((cell, idx) => {
      if (cell.formattedValue) {
        console.log(`Col ${idx}: ${cell.formattedValue.substring(0, 50)}...`);
        if (cell.hyperlink) console.log(`  -> Hyperlink: ${cell.hyperlink}`);
      }
    });
  } else {
    console.log("Row not found.");
  }
}
run();
