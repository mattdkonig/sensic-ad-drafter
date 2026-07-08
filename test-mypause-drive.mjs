import { resolveDriveLink } from "./drive.mjs";
import fs from "fs";

const env = {
  GOOGLE_DRIVE_API_KEY: fs.readFileSync(".env.local", "utf-8").match(/GOOGLE_DRIVE_API_KEY=(.*)/)[1]
};

async function run() {
  const url = "https://drive.google.com/drive/folders/126NOi9r3XSmpcLiKYVgmfRAXE_ejuvZ_?usp=drive_link";
  const result = await resolveDriveLink(url, "Listicle with Featured Image - Hormone Balance Plus", env);
  console.log(JSON.stringify(result, null, 2));
}
run();
