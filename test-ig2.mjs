import { graphGet } from "./lib/fb-draft-ads.mjs";
import fs from "fs";
import dotenv from "dotenv";

const env = dotenv.parse(fs.readFileSync(".env.local"));

async function run() {
  const accountId = "9222122767901187"; // MyPause
  try {
    const pageId = "498366560038034";
    // Get IG accounts linked to page
    const pageRes = await graphGet(env.FB_ACCESS_TOKEN, env.FB_APP_SECRET, `${pageId}?fields=instagram_accounts`);
    console.log("Page IG Accounts:", JSON.stringify(pageRes, null, 2));
    
    // Get IG accounts linked to ad account
    const acctRes = await graphGet(env.FB_ACCESS_TOKEN, env.FB_APP_SECRET, `act_${accountId}/instagram_accounts?fields=id,username`);
    console.log("Ad Account IG Accounts:", JSON.stringify(acctRes, null, 2));

  } catch (e) {
    console.error(e);
  }
}
run();
