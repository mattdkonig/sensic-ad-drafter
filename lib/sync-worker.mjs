import Papa from "papaparse";
import { getGoogleToken } from "./google-auth.mjs";
import * as xlsx from "xlsx";

export async function syncBibles(env, targetSlug = null) {
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const token = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly']);
  
  const CONFIG = JSON.parse(env.SYNC_CONFIG);
  
  const results = [];

  for (const [slug, sheet] of Object.entries(CONFIG)) {
    if (targetSlug && slug !== targetSlug) continue;
    if (!sheet.id || !sheet.gid) continue;

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`;
      const csvRes = await fetch(csvUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const csvText = await csvRes.text();
      
      let hyperlinks = {};
      try {
        const xlsxUrl = `https://www.googleapis.com/drive/v3/files/${sheet.id}?alt=media`;
        const xlsxRes = await fetch(xlsxUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (xlsxRes.ok) {
          const buffer = await xlsxRes.arrayBuffer();
          const workbook = xlsx.read(buffer, { type: 'buffer' });
          const tabName = workbook.SheetNames.find(n => {
            const ws = workbook.Sheets[n];
            return ws && ws['!ref'];
          });
          
          if (tabName) {
            const worksheet = workbook.Sheets[tabName];
            const range = xlsx.utils.decode_range(worksheet['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = {c:C, r:R};
                const cellRef = xlsx.utils.encode_cell(cellAddress);
                const cell = worksheet[cellRef];
                if (cell && cell.l && cell.l.Target) {
                  if (!hyperlinks[R]) hyperlinks[R] = {};
                  hyperlinks[R][C] = cell.l.Target;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[${slug}] XLSX extraction failed:`, err.message);
      }

      const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
      const dataToProcess = parsed.data;
      
      let headerRow = null;
      let headerIdxFound = -1;
      for (let i = 0; i < Math.min(10, dataToProcess.length); i++) {
        const row = dataToProcess[i];
        if (row.some(cell => String(cell).toLowerCase().includes("creative description") || String(cell).toLowerCase().includes("link to creative"))) {
          headerRow = row;
          headerIdxFound = i;
          break;
        }
      }

      if (!headerRow) continue;

      const rows = [];
      const slugify = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      let rowIndex = headerIdxFound + 2; 
      
      for (let i = headerIdxFound + 1; i < dataToProcess.length; i++) {
        const rowArray = dataToProcess[i];
        const currentRow = rowIndex++;
        
        const getCol = (possibleNames) => {
          const colIdx = headerRow.findIndex(h => possibleNames.some(n => String(h).toLowerCase().includes(n.toLowerCase())));
          if (colIdx === -1) return null;
          
          const isLinkCol = possibleNames.some(n => ["link", "url", "drive"].includes(n.toLowerCase()));
          
          if (isLinkCol && hyperlinks[currentRow - 1] && hyperlinks[currentRow - 1][colIdx]) {
            return hyperlinks[currentRow - 1][colIdx];
          }
          
          return rowArray[colIdx];
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
          concept,
          objective: getCol(["objective"]),
          type: getCol(["type"]),
          num_creatives: parseInt(getCol(["# of creatives", "number of creatives"]), 10) || null,
          primary_text: getCol(["primary text", "body copy"]),
          headline: getCol(["headline"]),
          cta: getCol(["cta", "call to action"]),
          landing_url: getCol(["landing page", "url", "destination link", "website url"]),
          campaign: getCol(["campaign name", "campaign"]),
          adset_hint: getCol(["ad set name", "ad set", "adset"]),
          creatives_folder: getCol(["link to creatives", "link to creative", "gdrive", "drive"])
        });
      }
      
      if (rows.length > 0) {
        await env.DRAFTER_KV.put(`bible:${slug}`, JSON.stringify(rows));
        results.push({ slug, count: rows.length });
      }
    } catch (err) {
      console.error(`[${slug}] Error:`, err.message);
    }
  }

  return results;
}
