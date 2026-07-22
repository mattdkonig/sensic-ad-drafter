import fs from "fs";

let code = fs.readFileSync("lib/sync-worker.mjs", "utf-8");

const oldParser = `        let headerRow = null;
        let headerIdxFound = -1;
        for (let i = 0; i < Math.min(10, dataToProcess.length); i++) {
          const row = dataToProcess[i];
          if (row.some(cell => String(cell).toLowerCase().includes("creative description") || String(cell).toLowerCase().includes("link to creative") || String(cell).toLowerCase() === "format_variants" || String(cell).toLowerCase() === "image_url")) {
            headerRow = row;
            headerIdxFound = i;
            break;
          }
        }

        if (!headerRow) continue; // Skip tabs without the required headers

        let rowIndex = headerIdxFound + 2; 
        
        for (let i = headerIdxFound + 1; i < dataToProcess.length; i++) {
          const rowArray = dataToProcess[i];
          const currentRow = rowIndex++;
          
          const getCol = (possibleNames) => {
            const colIdx = headerRow.findIndex(h => {
              const normH = String(h).toLowerCase().replace(/_/g, " ");
              return possibleNames.some(n => normH.includes(n.toLowerCase().replace(/_/g, " ")));
            });
            if (colIdx === -1) return null;
            
            const isLinkCol = possibleNames.some(n => ["link", "url", "drive"].includes(n.toLowerCase()));
            
            if (isLinkCol && hyperlinks[currentRow - 1] && hyperlinks[currentRow - 1][colIdx]) {
              return hyperlinks[currentRow - 1][colIdx];
            }
            
            return rowArray[colIdx];
          };

          const uploadedStr = getCol(["uploaded", "status"]);
          if (!uploadedStr || String(uploadedStr).trim().toLowerCase() === "date" || String(uploadedStr).trim() === "") continue;
          
          const val = String(uploadedStr).trim().toLowerCase();
          if (val === "ready_for_client" || val === "in_review" || val === "draft" || val === "changes_requested") {
            continue; // Skip these entirely so they don't show up in the Drafter UI
          }
          
          const uploaded = val === "true" || val === "yes" || val === "uploaded" || val === "live" || val === "in_market";
          
          const concept = getCol(["creative description", "description", "name"]);
          if (!concept || String(concept).includes("e.g.")) continue;

          // Make the ID unique across tabs by appending tabName if it's not the main tab
          const id = String(tabId) === String(sheet.gid) 
            ? \`\${slug}-\${slugify(String(concept))}\`
            : \`\${slug}-\${slugify(tabName)}-\${slugify(String(concept))}\`;

          allRows.push({
            id,
            sheet_row: currentRow,
            tab: tabName,
            tab_id: tabId,
            uploaded,
            concept,
            objective: getCol(["objective"]),
            type: getCol(["type"]),
            num_creatives: parseInt(getCol(["# of creatives", "number of creatives"]), 10) || null,
            primary_text: getCol(["primary text", "body copy"]),
            headline: getCol(["headline"]),
            cta: getCol(["cta", "call to action"]),
            landing_url: getCol(["landing page", "landing_page_url", "destination link", "website url", "landing_url", "final url"]),
            campaign: getCol(["campaign name", "campaign"]),
            adset_hint: getCol(["ad set name", "ad set", "adset"]),
            creatives_folder: getCol(["link to creatives", "link to creative", "gdrive", "drive", "format_variants", "image_url"])
          });
        }`;

const newParser = `        // Exclude history/archive tabs explicitly
        const normTabName = tabName.toLowerCase().trim();
        if (normTabName.includes("ads uploaded") || normTabName.includes("old |") || normTabName.includes("archive")) {
          continue;
        }

        let headerRow = null;
        let headerIdxFound = -1;
        let tabType = "unknown"; // "feedback" or "tracker"

        for (let i = 0; i < Math.min(10, dataToProcess.length); i++) {
          const row = dataToProcess[i];
          const normRow = row.map(c => String(c).toLowerCase().trim());
          
          if (normRow.includes("status") && normRow.includes("image_url") && normRow.includes("primary_text")) {
            headerRow = row;
            headerIdxFound = i;
            tabType = "feedback";
            break;
          } else if (normRow.includes("uploaded?") && (normRow.includes("creative description") || normRow.includes("link to creatives"))) {
            headerRow = row;
            headerIdxFound = i;
            tabType = "tracker";
            break;
          }
        }

        if (!headerRow) continue; // Skip tabs without recognized schemas

        let rowIndex = headerIdxFound + 2; 
        
        for (let i = headerIdxFound + 1; i < dataToProcess.length; i++) {
          const rowArray = dataToProcess[i];
          const currentRow = rowIndex++;
          
          const getExactCol = (exactName) => {
            const colIdx = headerRow.findIndex(h => String(h).toLowerCase().trim() === exactName.toLowerCase().trim());
            if (colIdx === -1) return null;
            
            const isLinkCol = ["link to creatives", "link to creative", "image_url", "format_variants", "landing page url", "landing_page_url"].includes(exactName.toLowerCase().trim());
            
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
            if (status !== "client_approved") continue; // Explicit allowlist
            
            uploaded = false; // Feedback rows are by definition not uploaded yet if they are in the queue
            concept = getExactCol("name");
            objective = getExactCol("objective"); // Might not exist in feedback
            type = getExactCol("format");
            num_creatives = 1;
            primary_text = getExactCol("primary_text");
            headline = getExactCol("headline");
            cta = getExactCol("cta");
            landing_url = getExactCol("landing_page_url");
            campaign = getExactCol("campaign");
            adset_hint = getExactCol("adset");
            creatives_folder = getExactCol("image_url") || getExactCol("format_variants");

            if (!concept || !creatives_folder) continue; // Reject missing required fields

          } else if (tabType === "tracker") {
            const uploadedStr = String(getExactCol("uploaded?") || "").trim().toLowerCase();
            if (uploadedStr === "date" || uploadedStr === "date we want it to be uploaded" || uploadedStr === "") continue;
            
            uploaded = uploadedStr === "true" || uploadedStr === "yes" || uploadedStr === "uploaded" || uploadedStr === "client_approved";
            
            concept = getExactCol("creative description") || getExactCol("description");
            if (!concept || String(concept).includes("e.g.")) continue;

            objective = getExactCol("objective");
            type = getExactCol("type");
            num_creatives = parseInt(getExactCol("# of creatives") || getExactCol("number of creatives"), 10) || null;
            primary_text = getExactCol("primary text") || getExactCol("body copy");
            headline = getExactCol("headline");
            cta = getExactCol("cta") || getExactCol("call to action");
            landing_url = getExactCol("landing page url") || getExactCol("landing page") || getExactCol("url") || getExactCol("destination link");
            campaign = getExactCol("campaign name") || getExactCol("campaign");
            adset_hint = getExactCol("ad set name") || getExactCol("ad set") || getExactCol("adset");
            creatives_folder = getExactCol("link to creatives") || getExactCol("link to creative") || getExactCol("gdrive") || getExactCol("drive");
          }

          const id = String(tabId) === String(sheet.gid) 
            ? \`\${slug}-\${slugify(String(concept))}\`
            : \`\${slug}-\${slugify(tabName)}-\${slugify(String(concept))}\`;

          allRows.push({
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
        }`;

code = code.replace(oldParser, newParser);
fs.writeFileSync("lib/sync-worker.mjs", code);
console.log("Patched lib/sync-worker.mjs with explicit schemas");
