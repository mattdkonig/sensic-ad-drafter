import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldPreviewHandler = `    if (p === "/api/preview" && request.method === "POST") {
      const a = await requireAuth(env, request); if (a) return a;
      try {
        const body = await request.json();
        const { rows, client } = body;
        if (!rows || !Array.isArray(rows)) return json({ ok: false, error: "invalid_payload" });

        const results = [];
        for (const row of rows) {
          const plan = {
            ad_name: \`\${row.concept} - \${row.type || 'Ad'}\`,
            campaign_hint: row.campaign,
            adset_hint: row.adset_hint,
            primary_text: row.primary_text,
            headline: row.headline,
            cta: row.cta,
            landing_url: row.landing_url
          };

          let allFiles = [];
          let allSkipped = [];
          let allErrors = [];

          if (row.creatives_folder) {
            const urls = extractMultipleDriveUrls(row.creatives_folder);
            for (const url of urls) {
              let driveToken = null;
              try {
                const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
                driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
              } catch (e) { console.error("Failed to get drive token", e); }
              const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);
              if (driveData.ok) {
                allFiles.push(...driveData.files);
                allSkipped.push(...driveData.skipped);
              } else {
                allErrors.push(driveData.error);
              }
            }
          }`;

const newPreviewHandler = `    if (p === "/api/preview" && request.method === "POST") {
      const a = await requireAuth(env, request); if (a) return a;
      try {
        const body = await request.json();
        const { rows, client } = body;
        if (!rows || !Array.isArray(rows)) return json({ ok: false, error: "invalid_payload" });

        // Get token once per request
        let driveToken = null;
        try {
          const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
          driveToken = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
        } catch (e) { console.error("Failed to get drive token", e); }

        const results = [];
        for (const row of rows) {
          const plan = {
            ad_name: \`\${row.concept} - \${row.type || 'Ad'}\`,
            campaign_hint: row.campaign,
            adset_hint: row.adset_hint,
            primary_text: row.primary_text,
            headline: row.headline,
            cta: row.cta,
            landing_url: row.landing_url
          };

          let allFiles = [];
          let allSkipped = [];
          let allErrors = [];

          if (row.creatives_folder) {
            const urls = extractMultipleDriveUrls(row.creatives_folder);
            for (const url of urls) {
              const driveData = await resolveDriveLink(url, driveToken, plan.ad_name);
              if (driveData.ok) {
                allFiles.push(...driveData.files);
                allSkipped.push(...driveData.skipped);
              } else {
                allErrors.push(driveData.error);
              }
            }
          }`;

code = code.replace(oldPreviewHandler, newPreviewHandler);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to get drive token once per request");
