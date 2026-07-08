import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

// Add import at the top
code = `import { syncBibles } from "./lib/sync-worker.mjs";\n` + code;

// Add route
code = code.replace(
  /if \(p === "\/api\/clients"/,
  `if (p === "/api/sync" && request.method === "POST") {
        const a = await requireAuth(env, request); if (a) return a;
        try {
          const results = await syncBibles(env);
          return json({ ok: true, results });
        } catch (e) {
          return json({ ok: false, error: String(e.message || e) }, 500);
        }
      }
      if (p === "/api/clients"`
);

fs.writeFileSync("worker.js", code);
console.log("Patched worker.js with /api/sync");
