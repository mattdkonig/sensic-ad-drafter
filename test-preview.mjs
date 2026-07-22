async function run() {
  const res = await fetch("https://sensic-ad-drafter.matt-0c3.workers.dev/api/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": "brain_session=275374bfa3a8ea7e0fa83d5f98acad13d03c147ab96a7d59373fa88e3decafff"
    },
    body: JSON.stringify({
      client: "xero-shoes",
      row_ids: ["xero-shoes-feedback-x1-pillar-3-brand-philosophy-cutdown"]
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
