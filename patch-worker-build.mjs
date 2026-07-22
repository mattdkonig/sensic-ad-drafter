import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");
code = code.replace(/const BUILD_LABEL = "v0\.9\.1-loop";/, `const BUILD_LABEL = "v1.0.0-qa-fixes";`);
fs.writeFileSync("worker.js", code);
console.log("Bumped build label");
