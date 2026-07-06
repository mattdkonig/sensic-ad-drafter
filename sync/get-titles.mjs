import { GoogleAuth } from 'google-auth-library';

async function getTitles() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const ids = [
    "1TJpnK1Snc4dU0xZOPoTDT-8gn541s77lkqnqfQF5xvY",
    "1B3R7nKYuYab3qpv4vVG9upDIBHod0mqE0wb3GOUdGOI",
    "1BKgi4QYzbfkyQxIYvCAY9zHYFplJkAdW"
  ];

  for (const id of ids) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`${id}: ${data.properties?.title || data.error?.message}`);
  }
}

getTitles();