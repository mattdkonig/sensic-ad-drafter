import fs from "fs";

let code = fs.readFileSync("ui.mjs", "utf-8");

// Fix the Drive file selection logic
const oldDriveFileHtml = `            let dfHtml = '';
            if (p.driveFiles && p.driveFiles.length > 0) {
                dfHtml = '<div class="drive-files-list" style="margin-top:8px;border-top:1px solid #eee;padding-top:8px;">' +
                    '<div style="font-size:11px;font-weight:bold;color:#666;margin-bottom:4px;">Drive Creatives Found:</div>' +
                    p.driveFiles.map(f => {
                        const isChecked = f.matchScore >= 0.4 ? 'checked' : '';
                        const formatBadge = f.format ? \`<span style="background:#e0e0e0;padding:2px 4px;border-radius:3px;margin-left:4px;font-size:10px;">\${f.format}</span>\` : '';
                        return \`<label style="display:flex;align-items:center;font-size:12px;margin-bottom:4px;cursor:pointer;">
                            <input type="checkbox" class="drive-file-cb" data-row="\${esc(p.row_id)}" data-url="\${esc(f.url)}" data-format="\${esc(f.format || '')}" \${isChecked} style="margin-right:6px;">
                            <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="\${esc(f.name)}">\${esc(f.name)}</span>
                            \${formatBadge}
                            <span style="color:#999;margin-left:6px;" title="\${esc(f.matchReason || '')}">(\${Math.round(f.matchScore * 100)}%)</span>
                        </label>\`;
                    }).join('') +
                '</div>';
            }`;

const newDriveFileHtml = `            let dfHtml = '';
            if (p.driveFiles && p.driveFiles.length > 0) {
                dfHtml = '<div class="drive-files-list" style="margin-top:8px;border-top:1px solid #eee;padding-top:8px;">' +
                    '<div style="font-size:11px;font-weight:bold;color:#666;margin-bottom:4px;">Drive Creatives Found:</div>' +
                    p.driveFiles.map(f => {
                        // If it's a direct file link (not from a folder), it should have matchScore 1.0 and be checked
                        // If it's from a folder, use the score threshold
                        const isChecked = (f.isDirectFile || f.matchScore >= 0.4) ? 'checked' : '';
                        const formatBadge = f.format ? \`<span style="background:#e0e0e0;padding:2px 4px;border-radius:3px;margin-left:4px;font-size:10px;">\${f.format}</span>\` : '';
                        return \`<label style="display:flex;align-items:center;font-size:12px;margin-bottom:4px;cursor:pointer;">
                            <input type="checkbox" class="drive-file-cb" data-row="\${esc(p.row_id)}" data-url="\${esc(f.url)}" data-format="\${esc(f.format || '')}" \${isChecked} style="margin-right:6px;">
                            <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="\${esc(f.name)}">\${esc(f.name)}</span>
                            \${formatBadge}
                            <span style="color:#999;margin-left:6px;" title="\${esc(f.matchReason || '')}">(\${Math.round(f.matchScore * 100)}%)</span>
                        </label>\`;
                    }).join('') +
                '</div>';
            }`;

code = code.replace(oldDriveFileHtml, newDriveFileHtml);
fs.writeFileSync("ui.mjs", code);
console.log("Patched ui.mjs with direct file selection logic");
