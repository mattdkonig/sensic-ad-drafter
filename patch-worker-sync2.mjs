import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

code = code.replace(
  /const results = await syncBibles\(env\);/,
  `const urlObj = new URL(request.url);
          const targetSlug = urlObj.searchParams.get("client");
          const results = await syncBibles(env, targetSlug);`
);

fs.writeFileSync("worker.js", code);
console.log("Patched worker.js with targetSlug");
