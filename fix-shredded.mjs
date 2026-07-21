import fs from "fs";

const CONFIG_PATH = './sync/config.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

config["shredded"].id = "1ibbeurzDIvfGLu96h0hy6z0ISB0zWjsKudbQ7kxVbKU";
config["shredded"].gid = "1355660925";

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log("Updated config.json");
