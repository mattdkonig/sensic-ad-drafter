import { GoogleAuth } from 'google-auth-library';

async function getTabs() {
  const auth = new GoogleAuth({
    keyFile: './sync/service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const id = "1LDbTkKB41pU5wMQjJdu-_EeayWq9eFHWgaFG_IoM2AI"; // Chief sheet

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (data.sheets) {
    data.sheets.forEach(sheet => {
      console.log(`Title: ${sheet.properties.title}, GID: ${sheet.properties.sheetId}`);
    });
  } else {
    console.log(data);
  }
}

getTabs();