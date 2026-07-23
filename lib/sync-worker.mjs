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
      // 1. Fetch metadata to get all tabs
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`;
      const metaRes = await fetch(metaUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      const metaData = await metaRes.json();
      
      let tabsToProcess = metaData.sheets;
      if (!tabsToProcess) {
        tabsToProcess = [{ properties: { sheetId: sheet.gid, title: "Main Tab" } }];
      }

      // 2. Fetch XLSX once for hyperlinks
      let workbook = null;
      try {
        const xlsxUrl = `https://www.googleapis.com/drive/v3/files/${sheet.id}?alt=media`;
        const xlsxRes = await fetch(xlsxUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (xlsxRes.ok) {
          const buffer = await xlsxRes.arrayBuffer();
          workbook = xlsx.read(buffer, { type: 'buffer' });
        }
      } catch (err) {
        console.error(`[${slug}] XLSX extraction failed:`, err.message);
      }

      const allRows = [];
      const slugify = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      let stats = { discovered: 0, included: 0, skippedStatus: 0, invalid: 0, historyExcluded: 0 };

      // 3. Process each tab
      for (const tab of tabsToProcess) {
        const tabId = tab.properties.sheetId;
        const tabName = tab.properties.title;
        
        // Exclude history/archive tabs explicitly
        const normTabName = tabName.toLowerCase().trim();
        if (normTabName === "ads uploaded 2026" || normTabName === "uploaded" || normTabName === "old | ad tracker" || normTabName.includes("archive")) {
          console.log("Skipping history tab:", tabName);
          stats.historyExcluded++;
          continue;
        }
        
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${tabId}`;
        const csvRes = await fetch(csvUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!csvRes.ok) continue;
        const csvText = await csvRes.text();
        
        let hyperlinks = {};
        if (workbook && workbook.Sheets[tabName]) {
          const worksheet = workbook.Sheets[tabName];
          if (worksheet['!ref']) {
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

        const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
        const dataToProcess = parsed.data;
        
        let headerRow = null;
        let headerIdxFound = -1;
        let tabType = "unknown";

        for (let i = 0; i < Math.min(10, dataToProcess.length); i++) {
          const row = dataToProcess[i];
          const normRow = row.map(c => String(c).toLowerCase().trim());
          
          if (normRow.includes("status") && (normRow.includes("image_url") || normRow.includes("format_variants")) && normRow.includes("primary_text")) {
            headerRow = row;
            headerIdxFound = i;
            tabType = "feedback";
            break;
          } else if (normRow.includes("uploaded?") && (normRow.includes("creative description") || normRow.includes("link to creatives") || normRow.includes("description"))) {
            headerRow = row;
            headerIdxFound = i;
            tabType = "tracker";
            break;
          }
        }

        if (!headerRow) continue;

        let rowIndex = headerIdxFound + 2; 
        
        for (let i = headerIdxFound + 1; i < dataToProcess.length; i++) {
          const rowArray = dataToProcess[i];
          const currentRow = rowIndex++;
          stats.discovered++;
          
          const getExactCol = (exactNames) => {
            const names = Array.isArray(exactNames) ? exactNames : [exactNames];
            let colIdx = -1;
            for (const name of names) {
              colIdx = headerRow.findIndex(h => String(h).toLowerCase().trim() === name);
              if (colIdx !== -1) break;
            }
            if (colIdx === -1) return null;
            
            const isLinkCol = names.some(n => ["link to creatives", "link to creative", "image_url", "format_variants", "landing page url", "landing_page_url"].includes(n));
            
            if (isLinkCol && hyperlinks[currentRow - 1] && hyperlinks[currentRow - 1][colIdx]) {
              return hyperlinks[currentRow - 1][colIdx];
            }
            
            return rowArray[colIdx];
          };

          let uploaded = false;
          let concept = null;
          let objective = null;
          let type = null;
          let num_creatives = null;
          let primary_text = null;
          let headline = null;
          let cta = null;
          let landing_url = null;
          let campaign = null;
          let adset_hint = null;
          let creatives_folder = null;

          if (tabType === "feedback") {
            const status = String(getExactCol("status") || "").trim().toLowerCase();
            if (status !== "client_approved") {
              stats.skippedStatus++;
              continue;
            }
            
            uploaded = false;
            concept = getExactCol("name");
            objective = getExactCol("objective");
            type = getExactCol("format");
            num_creatives = 1;
            primary_text = getExactCol("primary_text");
            headline = getExactCol("headline");
            cta = getExactCol("cta");
            landing_url = getExactCol("landing_page_url");
            campaign = getExactCol("campaign");
            adset_hint = getExactCol("adset");
            
            // Robust creative parsing
            const formatVariantsRaw = getExactCol("format_variants");
            const imageUrlRaw = getExactCol("image_url");
            
            let creativeSources = [];
            
            if (formatVariantsRaw) {
              try {
                // It might be JSON
                const parsed = JSON.parse(formatVariantsRaw);
                if (Array.isArray(parsed)) {
                  parsed.forEach(v => {
                    if (v.file_url) creativeSources.push({ type: 'drive', url: v.file_url, format: v.format });
                    else if (v.video_url) creativeSources.push({ type: 'drive', url: v.video_url, format: v.format });
                    else if (v.url) creativeSources.push({ type: 'drive', url: v.url, format: v.format });
                  });
                } else if (typeof parsed === 'object' && parsed !== null) {
                  if (parsed.file_url) creativeSources.push({ type: 'drive', url: parsed.file_url, format: parsed.format });
                  else if (parsed.video_url) creativeSources.push({ type: 'drive', url: parsed.video_url, format: parsed.format });
                  else if (parsed.url) creativeSources.push({ type: 'drive', url: parsed.url, format: parsed.format });
                }
              } catch (e) {
                // Not JSON, treat as a regular URL if it looks like one
                if (formatVariantsRaw.includes("http")) {
                  creativeSources.push({ type: 'drive', url: formatVariantsRaw });
                }
              }
            }
            
            // Fallback to image_url if format_variants didn't yield anything
            if (creativeSources.length === 0 && imageUrlRaw) {
              creativeSources.push({ type: 'drive', url: imageUrlRaw });
            }
            
            creatives_folder = creativeSources.length > 0 ? creativeSources[0].url : null;

            if (!concept || creativeSources.length === 0) {
              stats.invalid++;
              continue;
            }

          } else if (tabType === "tracker") {
            const uploadedStr = String(getExactCol("uploaded?") || "").trim().toLowerCase();
            if (uploadedStr === "date" || uploadedStr === "date we want it to be uploaded" || uploadedStr === "") {
              stats.skippedStatus++;
              continue;
            }
            
            uploaded = uploadedStr === "true" || uploadedStr === "yes" || uploadedStr === "uploaded" || uploadedStr === "client_approved";
            if (!uploaded && ["ready_for_client", "in_review", "draft", "changes_requested"].includes(uploadedStr)) {
              stats.skippedStatus++;
              continue;
            }
            
            concept = getExactCol(["creative description", "description", "name"]);
            if (!concept || String(concept).includes("e.g.")) {
              stats.invalid++;
              continue;
            }

            objective = getExactCol("objective");
            type = getExactCol("type");
            num_creatives = parseInt(getExactCol(["# of creatives", "number of creatives"]), 10) || null;
            primary_text = getExactCol(["primary text", "body copy"]);
            headline = getExactCol("headline");
            cta = getExactCol(["cta", "call to action"]);
            landing_url = getExactCol(["landing page url", "landing page", "url", "destination link"]);
            campaign = getExactCol(["campaign name", "campaign"]);
            adset_hint = getExactCol(["ad set name", "ad set", "adset"]);
            creatives_folder = getExactCol(["link to creatives", "link to creative", "gdrive", "drive"]);
          }

          const id = String(tabId) === String(sheet.gid) 
            ? `${slug}-${slugify(String(concept))}`
            : `${slug}-${slugify(tabName)}-${slugify(String(concept))}`;

          allRows.push({
            schemaVersion: 'v1',
            rowId: id,
            client: slug,
            source: {
              sheetId: sheet.gid,
              tabName: tabName,
              sheetRow: currentRow,
              schemaVersion: 'v1'
            },
            eligibility: {
              state: uploaded ? "not_ready" : "ready",
            },
            ad: {
              name: concept,
              primaryText: primary_text,
              headline: headline,
              landingPageUrl: landing_url,
              cta: cta,
              objective: objective
            },
            creativeSources: tabType === "feedback" && typeof creativeSources !== 'undefined' ? creativeSources : (creatives_folder ? [{ type: 'drive', url: creatives_folder }] : []),
            routing: {
              campaignHint: campaign,
              adsetHint: adset_hint
            },
            // Legacy fields for backward compatibility during transition
            id,
            sheet_row: currentRow,
            tab: tabName,
            tab_id: tabId,
            uploaded,
            concept,
            objective,
            type,
            num_creatives,
            primary_text,
            headline,
            cta,
            landing_url,
            campaign,
            adset_hint,
            creatives_folder
          });
          stats.included++;
        }
      }
      
      if (allRows.length > 0) {
        await env.DRAFTER_KV.put(`bible:${slug}`, JSON.stringify(allRows));
        results.push({ slug, count: allRows.length, stats });
      } else if (stats.included === 0 && stats.discovered > 0) {
        // If we discovered rows but included 0, don't overwrite valid KV data with empty array
        console.warn(`[${slug}] Sync found 0 eligible rows. Skipping KV overwrite to protect data.`);
        results.push({ slug, count: 0, stats, warning: "skipped_overwrite" });
      } else {
        await env.DRAFTER_KV.put(`bible:${slug}`, JSON.stringify([]));
        results.push({ slug, count: 0, stats });
      }
    } catch (err) {
      console.error(`[${slug}] Error:`, err.message);
      results.push({ slug, error: err.message });
    }
  }

  return results;
}
