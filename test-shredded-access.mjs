import fs from "fs";
import { GoogleAuth } from 'google-auth-library';

async function run() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const url = "https://sheets.googleapis.com/v4/spreadsheets/1ibbeurzDIvfGLu96h0hy6z0ISB0zWjsKudbQ7kxVbKU";
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  console.log(data.error ? "Error: " + data.error.message : "Success: " + data.properties.title);
}
run();
