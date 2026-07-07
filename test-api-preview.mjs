import { issueSession, SESSION_COOKIE } from "./auth.mjs";
import fs from "fs";

// Parse .env.local
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(line => line.includes("="))
    .map(line => {
      const idx = line.indexOf("=");
      return [line.substring(0, idx), line.substring(idx + 1).replace(/"/g, "")];
    })
);

async function run() {
  const secret = env.SESSION_SECRET || env.BRAIN_API_TOKEN || "";
  const token = await issueSession(secret, "test@example.com");
  const cookie = `${SESSION_COOKIE}=${token}`;

  console.log("Fetching /api/preview...");
  const res = await fetch("http://localhost:8788/api/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({
      client: "chief-aus",
      row_ids: ["chief-aus-beef-liver-iron-effectiveness"]
    })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
