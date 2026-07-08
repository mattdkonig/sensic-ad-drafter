import fs from "fs";
import { GoogleAuth } from 'google-auth-library';

const CONFIG_PATH = './sync/config.json';
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

async function fixGids() {
  console.log("Initializing Google Auth...");
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  let updated = false;

  for (const [slug, sheet] of Object.entries(CONFIG)) {
    if (!sheet.id) continue;

    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.error) {
        console.log(`[${slug}] Error: ${data.error.message}`);
        continue;
      }

      const tabs = data.sheets || [];
      if (tabs.length > 0) {
        // Find if the current GID exists
        const currentGidExists = tabs.some(t => String(t.properties.sheetId) === String(sheet.gid));
        
        if (!currentGidExists) {
          // It's a placeholder or invalid. Let's pick the first tab, or one that looks like the main one.
          // Usually the first tab (index 0) is the main one.
          const mainTab = tabs[0];
          const newGid = String(mainTab.properties.sheetId);
          
          console.log(`[${slug}] Updating GID from ${sheet.gid} to ${newGid} ("${mainTab.properties.title}")`);
          CONFIG[slug].gid = newGid;
          updated = true;
        } else {
          const tabName = tabs.find(t => String(t.properties.sheetId) === String(sheet.gid)).properties.title;
          console.log(`[${slug}] GID ${sheet.gid} is valid ("${tabName}")`);
        }
      }
    } catch (e) {
      console.log(`[${slug}] Failed to fetch: ${e.message}`);
    }
  }

  if (updated) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2));
    console.log("Updated config.json with correct GIDs!");
  } else {
    console.log("No GIDs needed updating.");
  }
}

fixGids();