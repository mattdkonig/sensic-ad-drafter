import fs from "fs";

let code = fs.readFileSync("sync/fix-gids.mjs", "utf-8");
code = code.replace(
  /if \(\!currentGidExists \|\| sheet\.gid \=\=\= \"1355660925\"\)/,
  `if (!currentGidExists)`
);
fs.writeFileSync("sync/fix-gids.mjs", code);
console.log("Patched fix-gids.mjs");
