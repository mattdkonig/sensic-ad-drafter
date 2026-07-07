const rowId = "row1";
const item1 = { drive_file_url: "url1" };
const item2 = { drive_file_url: "url2" };
const seen = new Set();

const dedupeKey1 = rowId + "|" + (item1.image_hash || item1.image_url || "");
seen.add(dedupeKey1);
console.log("key1:", dedupeKey1);

const dedupeKey2 = rowId + "|" + (item2.image_hash || item2.image_url || "");
console.log("key2:", dedupeKey2);
console.log("seen has key2?", seen.has(dedupeKey2));
