import fs from "fs";

let code = fs.readFileSync("drive.mjs", "utf-8");

code = code.replace(
  /export async function resolveDriveLink\(url, apiKey, adName = ""\) \{/,
  `export async function resolveDriveLink(url, token, adName = "") {`
);

code = code.replace(
  /if \(\!apiKey\) return \{ ok: false, error: "no_drive_api_key" \};/,
  `if (!token) return { ok: false, error: "no_drive_token" };`
);

code = code.replace(
  /const res = await fetch\(\`\$\{DRIVE_API\}\/files\?q=\$\{q\}&fields=\$\{fields\}&key=\$\{apiKey\}\`\);/g,
  `const res = await fetch(\`\${DRIVE_API}/files?q=\${q}&fields=\${fields}\`, { headers: { 'Authorization': \`Bearer \${token}\` } });`
);

code = code.replace(
  /const fileRes = await fetch\(\`\$\{DRIVE_API\}\/files\/\$\{driveInfo\.id\}\?fields=id,name,mimeType,size,webContentLink,imageMediaMetadata,videoMediaMetadata&key=\$\{apiKey\}\`\);/g,
  `const fileRes = await fetch(\`\${DRIVE_API}/files/\${driveInfo.id}?fields=id,name,mimeType,size,webContentLink,imageMediaMetadata,videoMediaMetadata\`, { headers: { 'Authorization': \`Bearer \${token}\` } });`
);

code = code.replace(
  /download_url: \`\$\{DRIVE_API\}\/files\/\$\{file\.id\}\?alt=media&key=\$\{apiKey\}\`/g,
  `download_url: \`\${DRIVE_API}/files/\${file.id}?alt=media\``
);

fs.writeFileSync("drive.mjs", code);
console.log("Patched drive.mjs for OAuth");
