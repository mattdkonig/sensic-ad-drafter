import fs from "fs";
import { GoogleAuth } from 'google-auth-library';
import { execSync } from "child_process";

const CONFIG = JSON.parse(fs.readFileSync('./config/client-bibles.json', 'utf-8'));

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
    // Use Cloudflare API directly instead of wrangler to avoid hanging
    const accountId = "0c3"; // Or whatever the account ID is, but let's try to get it from wrangler if needed, or just use the local wrangler if it's fast
    console.log("Running wrangler kv key list...");
    const listOutput = execSync(`npx wrangler kv key list --binding=DRAFTER_KV --prefix="audit:" --remote`, { encoding: 'utf-8' });
    const keys = JSON.parse(listOutput).map(k => k.name);
    
    // Check the last 10 audits to be faster
    console.log(`Found ${keys.length} keys, fetching last 10...`);
    for (const key of keys.slice(-10)) {
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
    let sheetObj = null;
    let meta = null;
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      meta = await metaRes.json();
      if (meta.error && meta.error.message.includes("Office file")) {
        // It's an Excel file hosted on Drive. We can't use the standard Sheets API to get the tab name easily,
        // but often the default tab name for Excel files converted/accessed this way is just the first tab name.
        // Usually we can just write to "Sheet1" or we can skip writing back to Excel files if it fails.
        console.log(`[${slug}] is an Excel file. Will attempt to write to default Sheet1.`);
      } else {
        sheetObj = meta.sheets?.find(s => String(s.properties.sheetId) === gid);
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
        
        // Fetch the header row to find the correct columns
        const headerRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!1:2`)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const headerData = await headerRes.json();
        
        let uploadedColIdx = -1;
        let adIdsColIdx = -1;
        
        if (headerData.values && headerData.values.length > 0) {
          // Check first two rows for headers
          for (let i = 0; i < Math.min(2, headerData.values.length); i++) {
            const row = headerData.values[i];
            for (let j = 0; j < row.length; j++) {
              const val = String(row[j] || "").toLowerCase().trim();
              if (val.includes("uploaded") || val === "status") {
                uploadedColIdx = j;
              } else if (val.includes("ad id") || val.includes("meta id") || val.includes("ad_id")) {
                adIdsColIdx = j;
              }
            }
            if (uploadedColIdx !== -1) break;
          }
        }
        
        // Default to column A if not found
        const getColLetter = (idx) => {
          let temp, letter = '';
          while (idx >= 0) {
            temp = idx % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            idx = (idx - temp - 1) / 26;
          }
          return letter;
        };
        const colLetter = uploadedColIdx !== -1 ? getColLetter(uploadedColIdx) : 'A';
        const adIdsColLetter = adIdsColIdx !== -1 ? getColLetter(adIdsColIdx) : null;
        
        const statusRange = `'${sheetName}'!${colLetter}${rowIndex}`; 
        const statusVal = `UPLOADED`;
        
        console.log(`Writing "${statusVal}" to ${slug} at ${statusRange}`);
        
        const updateData = [
          {
            range: statusRange,
            values: [[statusVal]]
          }
        ];
        
        if (adIdsColLetter) {
          updateData.push({
            range: `'${sheetName}'!${adIdsColLetter}${rowIndex}`,
            values: [[adIds.join(", ")]]
          });
        }
        
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updateData
          })
        });
        
        // If it's a feedback tab, we move the row to an "Uploaded" tab.
        // If the tab doesn't exist, we create it.
        const isFeedbackTab = true; // For now, we want to move all uploaded rows to the Uploaded tab, not just feedback
        
        if (isFeedbackTab && sheetObj) {
          let uploadedTab = meta.sheets?.find(s => s.properties.title.toLowerCase().includes("uploaded"));
          
          // Create the "Uploaded" tab if it doesn't exist
          if (!uploadedTab) {
            console.log(`Creating "Uploaded" tab for ${slug}...`);
            const createTabRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: "Uploaded"
                      }
                    }
                  }
                ]
              })
            });
            const createTabResult = await createTabRes.json();
            if (createTabResult.replies && createTabResult.replies[0] && createTabResult.replies[0].addSheet) {
              uploadedTab = createTabResult.replies[0].addSheet;
            }
          }
          
          if (uploadedTab) {
            console.log(`Moving row ${rowIndex} from ${sheetName} to ${uploadedTab.properties.title}...`);
            
            // 1. Fetch the row data
            const rowDataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${sheetName}'!${rowIndex}:${rowIndex}`)}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const rowData = await rowDataRes.json();
            
            if (rowData.values && rowData.values[0]) {
              const rowValues = rowData.values[0];
              
              // Append ad IDs, campaign, etc. to the row data if needed
              if (uploadedColIdx !== -1) {
                rowValues[uploadedColIdx] = statusVal;
              } else {
                rowValues[0] = statusVal;
              }
              
              // Add Ad IDs, Campaign, Ad Set, Ad Name to the end of the row
              // We'll just append them as new columns if they don't exist
              const extraInfo = [
                `Ad IDs: ${adIds.join(", ")}`,
                bibleRow.campaign ? `Campaign: ${bibleRow.campaign}` : "",
                bibleRow.adset_hint ? `Ad Set: ${bibleRow.adset_hint}` : "",
                bibleRow.concept ? `Ad Name: ${bibleRow.concept}` : ""
              ];
              
              // Extend the row with the extra info
              // Ensure the row has enough columns before pushing
              while (rowValues.length < 15) rowValues.push("");
              rowValues.push(...extraInfo.filter(Boolean));
              
              // 2. Append the row to the Uploaded tab
              await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`'${uploadedTab.properties.title}'!A:A`)}:append?valueInputOption=USER_ENTERED`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  range: `'${uploadedTab.properties.title}'!A:A`,
                  majorDimension: "ROWS",
                  values: [rowValues]
                })
              });
              
              // 3. Delete the original row
              await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  requests: [
                    {
                      deleteDimension: {
                        range: {
                          sheetId: sheetObj.properties.sheetId,
                          dimension: "ROWS",
                          startIndex: rowIndex - 1,
                          endIndex: rowIndex
                        }
                      }
                    }
                  ]
                })
              });
              console.log(`Successfully moved row ${rowIndex} to ${uploadedTab.properties.title}`);
            }
          }
        }
      }
    }
  }
  console.log("Write-back complete.");
}

writeBack();