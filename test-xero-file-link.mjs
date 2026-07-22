import { resolveDriveLink } from "./drive.mjs";
import { getGoogleToken } from "./lib/google-auth.mjs";
import fs from "fs";

async function run() {
  const sa = JSON.parse(fs.readFileSync("sync/service-account.json", "utf-8"));
  const token = await getGoogleToken(sa.client_email, sa.private_key, ['https://www.googleapis.com/auth/drive.readonly']);
  const url = "https://drive.google.com/file/d/1hBabK1TfYr4yQLW5tQCzA_AJDQGX8Z4Z/view?usp=drivesdk";
  try {
    const result = await resolveDriveLink(url, token, "X1 Pillar 3 — Brand Philosophy Cutdown");
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
