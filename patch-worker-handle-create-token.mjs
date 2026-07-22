import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldCreateHandler = `  const { rows } = await bibleRows(env, slug);
  const results = [];
  const seen = new Set();
  const delay = ms => new Promise(res => setTimeout(res, ms));

  for (const item of items) {`;

const newCreateHandler = `  const { rows } = await bibleRows(env, slug);
  const results = [];
  const seen = new Set();
  const delay = ms => new Promise(res => setTimeout(res, ms));

  // Get token once per request for downloading assets
  let driveToken = null;
  try {
    const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
    driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
  } catch (e) { console.error("Failed to get drive token for downloads", e); }

  for (const item of items) {`;

code = code.replace(oldCreateHandler, newCreateHandler);

const oldFetchOpts = `          const fetchOpts = {};
          if (asset.url.includes("googleapis.com/drive")) {
            try {
              const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
              const driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
              fetchOpts.headers = { 'Authorization': \`Bearer \${driveToken}\` };
            } catch (e) { console.error("Failed to get drive token for download", e); }
          }`;

const newFetchOpts = `          const fetchOpts = {};
          if (asset.url.includes("googleapis.com/drive")) {
            if (driveToken) {
              fetchOpts.headers = { 'Authorization': \`Bearer \${driveToken}\` };
            } else {
              console.error("No drive token available for download");
            }
          }`;

code = code.replace(oldFetchOpts, newFetchOpts);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to get drive token once per request in handleCreateDrafts");
