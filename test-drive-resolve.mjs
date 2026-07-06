import { extractMultipleDriveUrls, detectFormatFromName, scoreMatch } from "./drive.mjs";

console.log("URLs:", extractMultipleDriveUrls("https://drive.google.com/file/d/123/view \n https://drive.google.com/open?id=456"));
console.log("Format 1:", detectFormatFromName("Winter Sale - 1x1.mp4"));
console.log("Format 2:", detectFormatFromName("Summer Promo 9:16 final.jpg"));

const adName = "Winter Sale - UGC Hook 3";
console.log("Score 1:", scoreMatch("Winter Sale - UGC Hook 3 - 1x1 - approved.mp4", adName));
console.log("Score 2:", scoreMatch("Winter Sale - UGC Hook 3 - 4x5 - approved.mp4", adName));
console.log("Score 3:", scoreMatch("Winter Sale - UGC Hook 3 - 9x16 - approved.mp4", adName));
console.log("Score 4:", scoreMatch("Summer Promo - 1x1.mp4", adName));
console.log("Score 5:", scoreMatch("Winter Sale - UGC Hook 3 - 1x1 - draft.mp4", adName));
