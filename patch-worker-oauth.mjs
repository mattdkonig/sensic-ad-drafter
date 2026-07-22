import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

// Add getGoogleToken import
code = code.replace(
  /import \{ syncBibles \} from "\.\/lib\/sync-worker\.mjs";/,
  `import { syncBibles } from "./lib/sync-worker.mjs";\nimport { getGoogleToken } from "./lib/google-auth.mjs";`
);

// Update handlePreview to get token and pass to resolveDriveLink
const oldPreviewDrive = `        const driveData = await resolveDriveLink(url, env.GOOGLE_DRIVE_API_KEY, plan.ad_name);`;
const newPreviewDrive = `        let driveToken = null;
        try {
          const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
          driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
        } catch (e) { console.error("Failed to get drive token", e); }
        const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);`;
code = code.replace(oldPreviewDrive, newPreviewDrive);

// Update handleCreateDrafts to pass token to fetch
const oldFetchDrive = `            const res = await fetch(asset.url);`;
const newFetchDrive = `            const fetchOpts = {};
            if (asset.url.includes("googleapis.com/drive")) {
              try {
                const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
                const driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
                fetchOpts.headers = { 'Authorization': \`Bearer \${driveToken}\` };
              } catch (e) { console.error("Failed to get drive token for download", e); }
            }
            const res = await fetch(asset.url, fetchOpts);`;
code = code.replace(oldFetchDrive, newFetchDrive);

fs.writeFileSync("worker.js", code);
console.log("Patched worker.js for OAuth");
