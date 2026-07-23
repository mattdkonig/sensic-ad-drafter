const clients = [
  "therapy-lights",
  "xero-shoes",
  "mypause",
  "shredded",
  "reignite",
  "chief-aus",
  "chief-usa",
  "aussie-pharma",
  "double-roasters",
  "koa-kids"
];

async function run() {
  const loginRes = await fetch('https://sensic-ad-drafter.matt-0c3.workers.dev/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'matt@sensicdigital.com', password: 'DrafterPass2026!' }),
    headers: { 'Content-Type': 'application/json' }
  });
  const cookie = loginRes.headers.get('set-cookie');
  if (!cookie) {
    console.error("Login failed:", await loginRes.text());
    return;
  }

  const results = {};
  for (const client of clients) {
    console.log(`Syncing ${client}...`);
    try {
      const res = await fetch(`https://sensic-ad-drafter.matt-0c3.workers.dev/api/sync?client=${client}`, { 
        method: 'POST',
        headers: { 'Cookie': cookie }
      });
      const data = await res.json();
      results[client] = data;
    } catch (e) {
      results[client] = { error: e.message };
    }
  }
  
  // Clean up the output to just show the summary stats per client
  const summary = {};
  for (const [client, result] of Object.entries(results)) {
    if (result.ok && result.results && result.results[client]) {
      summary[client] = result.results[client].stats;
    } else {
      summary[client] = result;
    }
  }
  console.log(JSON.stringify(summary, null, 2));
}

run();
