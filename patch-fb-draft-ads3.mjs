import fs from "fs";

let code = fs.readFileSync("lib/fb-draft-ads.mjs", "utf-8");

const oldGetPosSpecs = `  const getPosSpecs = (format) => {
    const specs = [];
    if (format === "9:16") {
      specs.push({ facebook_positions: ["story"] });
      specs.push({ facebook_positions: ["facebook_reels"] });
      specs.push({ instagram_positions: ["story"] });
      specs.push({ instagram_positions: ["reels"] });
      specs.push({ messenger_positions: ["story"] });
    } else if (format === "1:1" || format === "4:5" || format === "16:9" || format === "unknown") {
      const fbPos = ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"];
      const igPos = ["stream", "explore", "explore_home", "profile_feed"];
      fbPos.forEach(p => specs.push({ facebook_positions: [p] }));
      igPos.forEach(p => specs.push({ instagram_positions: [p] }));
    }
    return specs;
  };`;

const newGetPosSpecs = `  const getPosSpecs = (format) => {
    const specs = [];
    if (format === "9:16") {
      specs.push({ facebook_positions: ["story"], publisher_platforms: ["facebook"] });
      specs.push({ facebook_positions: ["facebook_reels"], publisher_platforms: ["facebook"] });
      specs.push({ instagram_positions: ["story"], publisher_platforms: ["instagram"] });
      specs.push({ instagram_positions: ["reels"], publisher_platforms: ["instagram"] });
      specs.push({ messenger_positions: ["story"], publisher_platforms: ["messenger"] });
    } else if (format === "1:1" || format === "4:5" || format === "16:9" || format === "unknown") {
      const fbPos = ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"];
      const igPos = ["stream", "explore", "explore_home", "profile_feed"];
      fbPos.forEach(p => specs.push({ facebook_positions: [p], publisher_platforms: ["facebook"] }));
      igPos.forEach(p => specs.push({ instagram_positions: [p], publisher_platforms: ["instagram"] }));
    }
    return specs;
  };`;

code = code.replace(oldGetPosSpecs, newGetPosSpecs);

fs.writeFileSync("lib/fb-draft-ads.mjs", code);
console.log("Patched lib/fb-draft-ads.mjs with publisher_platforms");
