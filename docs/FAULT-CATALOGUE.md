# Sensic Ad Drafter Fault Catalogue

This document serves as the canonical, sanitised incident catalogue for the Sensic Ad Drafter.

## Incidents

### INC-001: Missing runtime imports for job state
- **Date**: 23 July 2026
- **Affected client/tab/media type**: All
- **User-visible symptom**: Create request fails with a 500 Internal Server Error immediately upon reaching the `getJob` call.
- **Pipeline stage**: Worker Create Route
- **Root cause**: `worker.js` was patched to use `getJob`, `saveJob`, and `generateJobId` but the import statement from `./lib/jobs.mjs` was missing/overwritten.
- **Fix**: Restored the import statement. Added `test/create-route.test.js` to ensure `worker.js` loads without `ReferenceError`s.
- **Regression test**: `test/create-route.test.js`
- **Monitoring signal**: 500 errors on `/api/create-drafts` in Cloudflare logs.
- **Deployment/version**: v1.0.5
- **Status**: Mitigated

### INC-002: UI drops Drive assets and manual upload controls after failed create
- **Date**: 23 July 2026
- **Affected client/tab/media type**: All
- **User-visible symptom**: After a failed create request, the UI shows "Results — 0 of 1 created PAUSED", replacing the preview card. A second click on Create emits "Attach a JPG/PNG creative to a ready row first, then Create."
- **Pipeline stage**: Browser UI Rendering (Create Response)
- **Root cause**: `ui.mjs` did not validate the HTTP status or the `ok` field of the `/api/create-drafts` response. It treated the 500 error envelope as a success, rendering an empty results view which destroyed the DOM elements holding the selected assets.
- **Fix**: Added validation in `ui.mjs` to check `!r.ok || !j.ok` and display a safe error banner while preserving the preview DOM state.
- **Regression test**: `test/e2e-browser/create.spec.js` (Failed create request preserves UI state and shows error)
- **Monitoring signal**: Client-side error tracking for DOM mismatches.
- **Deployment/version**: v1.0.5
- **Status**: Mitigated

### INC-003: Drive ID extraction for ?id= URLs
- **Date**: 23 July 2026
- **Affected client/tab/media type**: Feedback tab (direct file links)
- **User-visible symptom**: "Creatives aren't linking" when uploading from the Feedback tab. Preview shows 0 creatives resolved.
- **Pipeline stage**: Drive Resolution
- **Root cause**: `extractDriveId` regex did not correctly parse `thumbnail?id=` or `uc?id=` URLs.
- **Fix**: Updated regex to `/[?&]id=([a-zA-Z0-9_-]+)/`.
- **Regression test**: `test/drive-capability.test.js`
- **Monitoring signal**: High rate of `NO_CREATIVE_LINK` or zero resolved assets for rows with Drive URLs.
- **Deployment/version**: v1.0.2-drive-links
- **Status**: Permanently covered

### INC-004: Fuzzy header matching imports history rows
- **Date**: 22 July 2026
- **Affected client/tab/media type**: Xero Shoes (Ads Uploaded 2026 tab)
- **User-visible symptom**: Old, already uploaded ads from history tabs appear in the Drafter queue.
- **Pipeline stage**: Google Sheets Sync
- **Root cause**: `sync-bibles.mjs` used broad `.includes("2026")` logic to exclude tabs, missing variations, and fuzzy matched "Date we want it to be uploaded" as the "Uploaded?" column.
- **Fix**: Refactored `lib/sync-worker.mjs` to use explicit schema-driven parsing, exact header matching, and strict tab exclusion logic.
- **Regression test**: `test/parser.test.js` (Ads Uploaded 2026 and old/archive tabs yield zero eligible rows)
- **Monitoring signal**: Unexpectedly high row counts during sync.
- **Deployment/version**: v1.0.1-p0-fix
- **Status**: Permanently covered
