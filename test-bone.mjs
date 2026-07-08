import { resolveDriveLink } from "./drive.mjs";
const apiKey = "AIzaSyBXcYIFLC56abh2Ij85z4zMtTfrgEEbtIE";
const folderUrl = "https://drive.google.com/drive/folders/1bXXxFd_5hZCDFeKGSfwYR_QdzjuoPtPb?usp=drive_link";
const adName = "Listicle with Featured Image - Bone Support";

async function run() {
  const result = await resolveDriveLink(folderUrl, apiKey, adName);
  console.log(JSON.stringify(result.files, null, 2));
}
run();
