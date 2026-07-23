# Sensic Ad Drafter Fault Catalogue

This document serves as the canonical, sanitised incident catalogue for the Sensic Ad Drafter.

## Incidents

### INC-001: UI drops Drive assets and manual upload controls
- **Date**: 23 July 2026
- **Affected client/tab/media type**: All clients, all tabs, all media types.
- **User-visible symptom**: Preview correctly reports "Resolved N creatives from Drive", but the UI does not display the Drive selection controls, CTA dropdown, or manual attachment fallback. Clicking Create is blocked with "Attach a JPG/PNG creative to a ready row first, then Create."
- **Pipeline stage**: Browser UI Rendering (Preview)
- **Root cause**: A semicolon (`;`) was accidentally placed at the end of a string concatenation statement in `ui.mjs` when refactoring the ad-set selection to use a modal. This caused the rest of the string concatenation (containing the Drive HTML, CTA, and file input) to be evaluated as a separate, discarded expression.
- **Fix**: Refactored the preview card rendering in `ui.mjs` to use an array `.join('')` or template literal approach to prevent brittle string concatenation errors.
- **Regression test**: Added a DOM/component regression test (`test/ui.test.js`) that asserts the CTA control, Drive asset section, and manual attachment fallback are present in the DOM for a ready row.
- **Monitoring signal**: Client-side error tracking for DOM mismatches (e.g., if `p.drive_files.length > 0` but no `.drive-file-cb` elements exist).
- **Deployment/version**: TBD
- **Status**: Open (Fixing now)

