import fs from "fs";
import Papa from "papaparse";
import { execSync } from "child_process";
import { GoogleAuth } from 'google-auth-library';

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
    const url = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const text = await res.text();
      
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      let rows = [];
      
      // Handle the case where the CSV has a title row or weird headers
      let dataToProcess = parsed.data;
      let headerIdxFound = 0;
      if (dataToProcess.length > 0 && !Object.keys(dataToProcess[0]).some(k => k.toLowerCase().includes('uploaded') || k.toLowerCase().includes('status'))) {
         // Try to find the real header row
         const lines = text.split('\n');
         const headerIdx = lines.findIndex(l => l.toLowerCase().includes('uploaded') || l.toLowerCase().includes('status'));
         if (headerIdx !== -1) {
            headerIdxFound = headerIdx;
            const newText = lines.slice(headerIdx).join('\n');
            const newParsed = Papa.parse(newText, { header: true, skipEmptyLines: true });
            dataToProcess = newParsed.data;
         }
      }

      let rowIndex = headerIdxFound + 2; // PapaParse with header:true means data starts at row 2
      for (const row of dataToProcess) {
        const currentRow = rowIndex++;
        const keys = Object.keys(row);
        const getCol = (possibleNames) => {
          const key = keys.find(k => possibleNames.some(n => k.toLowerCase().includes(n.toLowerCase())));
          return key ? row[key] : null;
        };

        const uploadedStr = getCol(["uploaded", "status"]);
        if (!uploadedStr || uploadedStr.trim().toLowerCase() === "date" || uploadedStr.trim() === "") continue;
        
        const uploaded = uploadedStr.trim().toLowerCase() === "true" || uploadedStr.trim().toLowerCase() === "yes" || uploadedStr.trim().toLowerCase() === "uploaded" || uploadedStr.trim().toLowerCase() === "client_approved";
        
        const concept = getCol(["creative description", "description", "name"]);
        if (!concept || concept.includes("e.g.")) continue;

        const id = `${slug}-${slugify(concept)}`;

        rows.push({
          id,
          sheet_row: currentRow,
          uploaded,
          concept,
          objective: getCol(["objective"]),
          type: getCol(["type"]),
          num_creatives: parseInt(getCol(["# of creatives", "number of creatives"]), 10) || null,
          primary_text: getCol(["primary text", "body copy"]),
          headline: getCol(["headline"]),
          cta: getCol(["cta", "call to action"]),
          landing_url: getCol(["landing page url", "landing page"]),
          campaign: getCol(["campaign name"]),
          adset_hint: getCol(["ad set name"]),
          creatives_folder: getCol(["link to creatives", "gdrive", "drive"])
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