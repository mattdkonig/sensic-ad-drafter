import { GoogleAuth } from 'google-auth-library';

async function testExport(id, gid) {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const text = await res.text();
  console.log(`--- ${id} / ${gid} ---`);
  console.log(text.substring(0, 500));
}

testExport("1LDbTkKB41pU5wMQjJdu-_EeayWq9eFHWgaFG_IoM2AI", "1830017544"); // AU
testExport("1LDbTkKB41pU5wMQjJdu-_EeayWq9eFHWgaFG_IoM2AI", "1507244475"); // US
testExport("1BKgi4QYzbfkyQxIYvCAY9zHYFplJkAdW", "1355660925"); // Double Roasters (Excel file?)