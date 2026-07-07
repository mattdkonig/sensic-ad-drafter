import fs from "fs";
import Papa from "papaparse";
import { execSync } from "child_process";
import { GoogleAuth } from 'google-auth-library';
import * as xlsx from 'xlsx';

const CONFIG = JSON.parse(fs.readFileSync('./sync/config.json', 'utf-8'));

function slugify(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function sync() {
  console.log("Initializing Google Auth...");
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  for (const [slug, sheet] of Object.entries(CONFIG)) {
    if (!sheet.id || !sheet.gid) {
      console.log(`Skipping ${slug} (missing URL/GID)...`);
      continue;
    }
    console.log(`Processing ${slug}...`);
    
    try {
      // 1. Fetch the CSV export to get the data reliably (handles all sheet types, GIDs, etc)
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
      const csvRes = await fetch(csvUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const csvText = await csvRes.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      
      let dataToProcess = parsed.data;
      let headerIdxFound = 0;
      if (dataToProcess.length > 0 && !Object.keys(dataToProcess[0]).some(k => k.toLowerCase().includes('uploaded') || k.toLowerCase().includes('status'))) {
         const lines = csvText.split('\n');
         const headerIdx = lines.findIndex(l => l.toLowerCase().includes('uploaded') || l.toLowerCase().includes('status'));
         if (headerIdx !== -1) {
            headerIdxFound = headerIdx;
            const newText = lines.slice(headerIdx).join('\n');
            const newParsed = Papa.parse(newText, { header: true, skipEmptyLines: true });
            dataToProcess = newParsed.data;
         }
      }

      // 2. Try to fetch the XLSX to extract hyperlinks (best effort)
      let hyperlinkMap = {}; // { "rowIdx_colName": "url" }
      try {
        const xlsxUrl = `https://www.googleapis.com/drive/v3/files/${sheet.id}?alt=media`;
        const xlsxRes = await fetch(xlsxUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (xlsxRes.ok) {
          const buffer = await xlsxRes.arrayBuffer();
          const workbook = xlsx.read(buffer, { type: 'buffer', cellNF: true, cellHTML: true, cellFormula: true });
          
          // Try to find the right sheet by looking for the headers
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
          
          if (xlsxHeaderIdx !== -1) {
            const xlsxHeaders = xlsxData[xlsxHeaderIdx].map(h => typeof h === 'string' ? h.toLowerCase() : '');
            
            for (let i = xlsxHeaderIdx + 1; i < xlsxData.length; i++) {
              const row = xlsxData[i];
              if (!row || row.length === 0) continue;
              
              // We map the XLSX row index (relative to header) to the CSV row index
              const logicalRowIdx = i - xlsxHeaderIdx - 1;
              
              for (let c = 0; c < xlsxHeaders.length; c++) {
                const cellRef = xlsx.utils.encode_cell({ r: i, c: c });
                const cell = worksheet[cellRef];
                if (cell && cell.l && cell.l.Target) {
                  hyperlinkMap[`${logicalRowIdx}_${xlsxHeaders[c]}`] = cell.l.Target;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log(`  [!] Could not extract hyperlinks for ${slug}: ${e.message}`);
      }

      let rows = [];
      let rowIndex = headerIdxFound + 2; 
      
      for (let i = 0; i < dataToProcess.length; i++) {
        const row = dataToProcess[i];
        const currentRow = rowIndex++;
        const keys = Object.keys(row);
        
        const getCol = (possibleNames) => {
          const key = keys.find(k => possibleNames.some(n => k.toLowerCase().includes(n.toLowerCase())));
          if (!key) return null;
          
          // Check if we extracted a hyperlink for this cell
          const hLinkKey = `${i}_${key.toLowerCase()}`;
          if (hyperlinkMap[hLinkKey]) {
            return hyperlinkMap[hLinkKey];
          }
          
          return row[key];
        };

        const uploadedStr = getCol(["uploaded", "status"]);
        if (!uploadedStr || String(uploadedStr).trim().toLowerCase() === "date" || String(uploadedStr).trim() === "") continue;
        
        const uploaded = String(uploadedStr).trim().toLowerCase() === "true" || String(uploadedStr).trim().toLowerCase() === "yes" || String(uploadedStr).trim().toLowerCase() === "uploaded" || String(uploadedStr).trim().toLowerCase() === "client_approved";
        
        const concept = getCol(["creative description", "description", "name"]);
        if (!concept || String(concept).includes("e.g.")) continue;

        const id = `${slug}-${slugify(String(concept))}`;

        rows.push({
          id,
          sheet_row: currentRow,
          uploaded,
          concept: String(concept),
          objective: getCol(["objective"]) ? String(getCol(["objective"])) : null,
          type: getCol(["type"]) ? String(getCol(["type"])) : null,
          num_creatives: parseInt(getCol(["# of creatives", "number of creatives"]), 10) || null,
          primary_text: getCol(["primary text", "body copy"]) ? String(getCol(["primary text", "body copy"])) : null,
          headline: getCol(["headline"]) ? String(getCol(["headline"])) : null,
          cta: getCol(["cta", "call to action"]) ? String(getCol(["cta", "call to action"])) : null,
          landing_url: getCol(["landing page url", "landing page", "destination link", "destination url"]) ? String(getCol(["landing page url", "landing page", "destination link", "destination url"])) : null,
          campaign: getCol(["campaign name", "campaign"]) ? String(getCol(["campaign name", "campaign"])) : null,
          adset_hint: getCol(["ad set name", "ad set", "adset"]) ? String(getCol(["ad set name", "ad set", "adset"])) : null,
          creatives_folder: getCol(["link to creative", "link to creatives", "gdrive", "drive", "creative link"]) ? String(getCol(["link to creative", "link to creatives", "gdrive", "drive", "creative link"])) : null
        });
      }
      
      console.log(`  -> Found ${rows.length} valid rows for ${slug}. Uploading to KV...`);
      
      // Write to temp file
      const tmpPath = `/tmp/bible_${slug}.json`;
      fs.writeFileSync(tmpPath, JSON.stringify(rows));
      
      // Upload to KV
      execSync(`npx wrangler kv key put "bible:${slug}" --path "${tmpPath}" --binding=DRAFTER_KV --remote`, { stdio: "inherit" });
      
      console.log(`  -> Successfully synced ${slug}!`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`  [!] Error processing ${slug}:`, err.message);
    }
  }
}

sync();