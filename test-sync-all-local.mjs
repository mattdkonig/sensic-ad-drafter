import { syncBibles } from "./lib/sync-worker.mjs";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const env = {
  GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT,
  DRAFTER_KV: {
    put: async () => {}
  }
};

const clients = [
  "therapy-lights",
  "xero-shoes",
  "mypause",
  "shredded",
  "reignite",
  "chief-aus",
  "chief-usa",
  "aussie-pharma",
  "double-roasters",
  "koa-kids"
];

async function run() {
  const results = {};
  for (const client of clients) {
    console.log(`Syncing ${client}...`);
    try {
      const res = await syncBibles(env, client);
      results[client] = res;
    } catch (e) {
      results[client] = { error: e.message };
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

run();
