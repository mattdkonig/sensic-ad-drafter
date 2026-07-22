import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldPreviewHandler = `  const plans = [];
  for (const r of selected) {
    const plan = assemblePlan(r, { pageId });
    if (env.WORKFLOW_MODE !== "manual" && r.creatives_folder && env.GOOGLE_DRIVE_API_KEY) {
      const urls = extractMultipleDriveUrls(r.creatives_folder);
      
      let allFiles = [];
      let allSkipped = [];
      let allErrors = [];
      
      for (const url of urls) {
        let driveToken = null;
        try {
          const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
          driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
        } catch (e) { console.error("Failed to get drive token", e); }
        const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);`;

const newPreviewHandler = `  const plans = [];
  
  // Get token once per request
  let driveToken = null;
  try {
    const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
    driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
  } catch (e) { console.error("Failed to get drive token", e); }

  for (const r of selected) {
    const plan = assemblePlan(r, { pageId });
    if (env.WORKFLOW_MODE !== "manual" && r.creatives_folder) { // Removed GOOGLE_DRIVE_API_KEY dependency
      const urls = extractMultipleDriveUrls(r.creatives_folder);
      
      let allFiles = [];
      let allSkipped = [];
      let allErrors = [];
      
      for (const url of urls) {
        const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);`;

code = code.replace(oldPreviewHandler, newPreviewHandler);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to get drive token once per request in handlePreview");
