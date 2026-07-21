import fs from "fs";
import { syncBibles } from "../lib/sync-worker.mjs";
import { execSync } from "child_process";

async function run() {
  const env = {
    GOOGLE_SERVICE_ACCOUNT: fs.readFileSync("./sync/service-account.json", "utf-8"),
    SYNC_CONFIG: fs.readFileSync("./sync/config.json", "utf-8"),
    DRAFTER_KV: {
      put: async (key, value) => {
        const file = `/tmp/${key.replace(':', '_')}.json`;
        fs.writeFileSync(file, value);
        console.log(`\n ⛅️ wrangler\n────────────────────\nResource location: remote \n\nWriting the contents of ${file} to the key "${key}" on namespace binding: "DRAFTER_KV"`);
        execSync(`npx wrangler kv key put "${key}" --path="${file}" --binding DRAFTER_KV --remote`, { stdio: 'inherit' });
      }
    }
  };
  
  console.log("Starting sync of all tabs...");
  const results = await syncBibles(env);
  console.log("Sync complete:", results);
}
run();
