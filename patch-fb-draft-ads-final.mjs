import fs from "fs";

let code = fs.readFileSync("lib/fb-draft-ads.mjs", "utf-8");

const oldGetPos = `  const getPos = (format) => {
    if (format === "9:16") {
      return {
        facebook_positions: ["story", "facebook_reels"],
        instagram_positions: ["story", "reels"],
        messenger_positions: ["story"]
      };
    } else if (format === "1:1" || format === "4:5") {
      return {
        facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
        instagram_positions: ["stream", "explore", "explore_home", "profile_feed"]
      };
    }
    // Fallback if format is unknown or 16:9
    return {
      facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
      instagram_positions: ["stream", "explore", "explore_home", "profile_feed"]
    };
  };`;

const newGetPos = `  const getPos = (format) => {
    if (format === "9:16") {
      return {
        facebook_positions: ["story", "facebook_reels"],
        instagram_positions: ["story", "reels"],
        publisher_platforms: ["facebook", "instagram"]
      };
    } else if (format === "1:1" || format === "4:5") {
      return {
        facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
        instagram_positions: ["stream", "explore", "explore_home", "profile_feed"],
        publisher_platforms: ["facebook", "instagram"]
      };
    }
    // Fallback if format is unknown or 16:9
    return {
      facebook_positions: ["feed", "video_feeds", "instream_video", "marketplace", "search", "profile_feed"],
      instagram_positions: ["stream", "explore", "explore_home", "profile_feed"],
      publisher_platforms: ["facebook", "instagram"]
    };
  };`;

code = code.replace(oldGetPos, newGetPos);

// Remove the global publisher_platforms assignment
code = code.replace(
  /spec\.publisher_platforms = \["facebook", "instagram", "messenger"\];/g,
  `// spec.publisher_platforms is set in getPos`
);

fs.writeFileSync("lib/fb-draft-ads.mjs", code);
console.log("Patched lib/fb-draft-ads.mjs");
