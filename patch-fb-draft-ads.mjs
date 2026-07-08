import fs from "fs";

let code = fs.readFileSync("lib/fb-draft-ads.mjs", "utf-8");

// Remove messenger_positions
code = code.replace(
  /messenger_positions:\s*\["story"\]/g,
  `// messenger_positions removed`
);

// Remove publisher_platforms
code = code.replace(
  /spec\.publisher_platforms\s*=\s*\["facebook",\s*"instagram",\s*"messenger"\];/g,
  `// spec.publisher_platforms removed`
);

fs.writeFileSync("lib/fb-draft-ads.mjs", code);
console.log("Patched lib/fb-draft-ads.mjs");
