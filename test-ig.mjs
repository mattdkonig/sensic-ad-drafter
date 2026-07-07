import { graphGet } from "./lib/fb-draft-ads.mjs";
import fs from "fs";
import dotenv from "dotenv";

const env = dotenv.parse(fs.readFileSync(".env.local"));

async function run() {
  const accountId = "9222122767901187"; // MyPause
  try {
    const res = await graphGet(env.FB_ACCESS_TOKEN, env.FB_APP_SECRET, `act_${accountId}/instagram_accounts?fields=id,username`);
    console.log("IG Accounts:", JSON.stringify(res, null, 2));
    
    const ads = await graphGet(env.FB_ACCESS_TOKEN, env.FB_APP_SECRET, `act_${accountId}/ads?fields=creative{object_story_spec}&limit=5`);
    console.log("Recent ads OSS:", JSON.stringify(ads.data.map(a => a.creative?.object_story_spec), null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
