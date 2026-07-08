import fs from "fs";

let code = fs.readFileSync("lib/fb-draft-ads.mjs", "utf-8");

const oldGetPos = `  const getPos = (format) => {
    if (format === "9:16") {
      return {
        facebook_positions: ["story", "facebook_reels"],
        instagram_positions: ["story", "reels"],
        // messenger_positions removed
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

const newGetPos = `  const getPosSpecs = (format) => {
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

code = code.replace(oldGetPos, newGetPos);

const oldRuleLoop = `    const spec = getPos(format);
    // spec.publisher_platforms removed
    
    if (group.images.length > 0) {
      asset_feed_spec.asset_customization_rules.push({
        customization_spec: spec,
        image_label: { name: label },
        priority: rulePriority++
      });
    }
    if (group.videos.length > 0) {
      asset_feed_spec.asset_customization_rules.push({
        customization_spec: spec,
        video_label: { name: label },
        priority: rulePriority++
      });
    }`;

const newRuleLoop = `    const specs = getPosSpecs(format);
    
    for (const spec of specs) {
      if (group.images.length > 0) {
        asset_feed_spec.asset_customization_rules.push({
          customization_spec: spec,
          image_label: { name: label },
          priority: rulePriority++
        });
      }
      if (group.videos.length > 0) {
        asset_feed_spec.asset_customization_rules.push({
          customization_spec: spec,
          video_label: { name: label },
          priority: rulePriority++
        });
      }
    }`;

code = code.replace(oldRuleLoop, newRuleLoop);

fs.writeFileSync("lib/fb-draft-ads.mjs", code);
console.log("Patched lib/fb-draft-ads.mjs with individual placement rules");
