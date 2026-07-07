import { scoreMatch } from "./drive.mjs";

const adName = "Five Reasons For Beef Liver | Static | Image & Text | Beef Liver | Chief";
const files = [
  "Fiver Benefits Of Beef Liver | Static | Image & Text | Beef Liver | Chief.png",
  "Five Reasons For Beef Liver | Static | Image & Text | Beef Liver | Chief.png",
  "Fiver Benefits Of Collagen Protein | Static | Image & Text | Beef Liver | Chief.png",
  "Been Taking Iron Supplements | Static | Testimonial | Beef Liver | Chief.png"
];

for (const f of files) {
  console.log(`\nFile: ${f}`);
  console.log(`Score:`, scoreMatch(f, adName));
}
