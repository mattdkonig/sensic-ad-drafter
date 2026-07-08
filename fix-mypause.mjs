import fs from "fs";

const CONFIG_PATH = './sync/config.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

config["mypause"].id = "1k0jmrhKVtXKwwqF9DPOdhJ-RB0V97bxPSDf0rMDftDA";
// Let's reset gid to 0 or leave it, we can use fix-gids.mjs to find the right one
config["mypause"].gid = "0"; 

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log("Updated config.json");
