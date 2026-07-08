import { createAssetCustomizationDraft } from "./lib/fb-draft-ads.mjs";

async function run() {
  // Mock graphPost
  const mockGraphPost = async (token, secret, path, payload) => {
    console.log("POST", path);
    console.log(JSON.stringify(payload, null, 2));
    return { id: "mock_id" };
  };

  // Override graphPost in the module
  const m = await import("./lib/fb-draft-ads.mjs");
  m.setGraphPostForTest(mockGraphPost);

  const plan = {
    page_id: "123",
    link: "https://example.com",
    message: "Test message",
    headline: "Test headline",
    ad_name: "Test ad"
  };

  const images = [
    { url: "http://example.com/1x1.png", format: "1:1" },
    { url: "http://example.com/9x16.png", format: "9:16" }
  ];

  try {
    await m.createAssetCustomizationDraft({
      token: "mock", secret: "mock", accountId: "act_123", adsetId: "123",
      plan, images, videos: [], instagramActorId: "123"
    });
  } catch (e) {
    console.error(e);
  }
}
run();
