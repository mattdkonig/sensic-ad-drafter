import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldDoneRows = `  const doneRowIds = [...new Set(results.filter((r) => r.ok).map((r) => r.row_id))];`;

const newDoneRows = `  // Only mark a row as done if ALL variants for that row succeeded and none are still processing
  const rowStatus = {};
  for (const r of results) {
    if (!rowStatus[r.row_id]) rowStatus[r.row_id] = { hasSuccess: false, hasFailure: false, isProcessing: false };
    if (r.ok && !r.message) rowStatus[r.row_id].hasSuccess = true;
    if (r.ok && r.message) rowStatus[r.row_id].isProcessing = true;
    if (!r.ok) rowStatus[r.row_id].hasFailure = true;
  }
  
  const doneRowIds = Object.keys(rowStatus).filter(id => rowStatus[id].hasSuccess && !rowStatus[id].hasFailure && !rowStatus[id].isProcessing);`;

code = code.replace(oldDoneRows, newDoneRows);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to handle partial success correctly");
