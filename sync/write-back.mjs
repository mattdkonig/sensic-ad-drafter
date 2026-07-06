import fs from "fs";
import { GoogleAuth } from 'google-auth-library';
import { execSync } from "child_process";

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

async function writeBack() {
  console.log("Initializing Google Auth for Write-Back...");
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  // 1. Fetch recent audit logs from KV
  console.log("Fetching recent audit logs from KV...");
  let auditLogs = [];
  try {
    const listOutput = execSync(`npx wrangler kv key list --binding=DRAFTER_KV --prefix="audit:" --remote`, { encoding: 'utf-8' });
    const keys = JSON.parse(listOutput).map(k => k.name);
    
    // Check the last 100 audits
    for (const key of keys.slice(-100)) {
      const valOutput = execSync(`npx wrangler kv key get "${key}" --binding=DRAFTER_KV --remote`, { encoding: 'utf-8' });
      auditLogs.push(JSON.parse(valOutput));
    }
  } catch (err) {
    console.error("Failed to read KV:", err.message);
    return;
  }

  // 2. Group successful uploads by client and row
  const successfulUploads = {};
  for (const log of auditLogs) {
    if (log.ad_id && log.row_id && log.client) {
      if (!successfulUploads[log.client]) successfulUploads[log.client] = [];
      successfulUploads[log.client].push({ row_id: log.row_id, ad_id: log.ad_id });
    }
  }

  // 3. For each client, find the sheet_row from the bible KV and update the Google Sheet
  for (const [slug, uploads] of Object.entries(successfulUploads)) {
    if (!CONFIG[slug]) continue;
    console.log(`Processing write-backs for ${slug}...`);
    
    let bible = [];
    try {
      const bibleOutput = execSync(`npx wrangler kv key get "bible:${slug}" --binding=DRAFTER_KV --remote`, { encoding: 'utf-8' });
      bible = JSON.parse(bibleOutput);
    } catch (err) {
      console.error(`Failed to read bible for ${slug}`);
      continue;
    }

    const spreadsheetId = CONFIG[slug].id;
    const gid = CONFIG[slug].gid;
    
    let sheetName = "Sheet1"; // fallback
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const meta = await metaRes.json();
      if (meta.error && meta.error.message.includes("Office file")) {
        // It's an Excel file hosted on Drive. We can't use the standard Sheets API to get the tab name easily,
        // but often the default tab name for Excel files converted/accessed this way is just the first tab name.
        // Usually we can just write to "Sheet1" or we can skip writing back to Excel files if it fails.
        console.log(`[${slug}] is an Excel file. Will attempt to write to default Sheet1.`);
      } else {
        const sheetObj = meta.sheets?.find(s => String(s.properties.sheetId) === gid);
        if (sheetObj) {
          sheetName = sheetObj.properties.title;
        } else {
          console.log(`Could not find sheet tab for ${slug}`);
          continue;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch metadata for ${slug}: ${e.message}`);
    }

    // Deduplicate uploads by row_id (in case of multiple ads per row, we'll just write the last one or combine)
    const uniqueUploads = {};
    for (const u of uploads) {
      if (!uniqueUploads[u.row_id]) uniqueUploads[u.row_id] = [];
      uniqueUploads[u.row_id].push(u.ad_id);
    }

    for (const [rowId, adIds] of Object.entries(uniqueUploads)) {
      const bibleRow = bible.find(r => r.id === rowId);
      if (bibleRow && bibleRow.sheet_row && !bibleRow.uploaded) {
        const rowIndex = bibleRow.sheet_row;
        // Assuming column A is the "Uploaded" column.
        const range = `'${sheetName}'!A${rowIndex}`; 
        const val = `UPLOADED - ${adIds.join(", ")}`;
        
        console.log(`Writing "${val}" to ${slug} at ${range}`);
        
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: range,
            majorDimension: "ROWS",
            values: [[val]]
          })
        });
      }
    }
  }
  console.log("Write-back complete.");
}

writeBack();