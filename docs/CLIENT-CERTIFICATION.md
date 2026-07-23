# Client Certification Report

This report tracks the certification status of all active clients and Meta accounts as of July 23, 2026.

## Certification Matrix

| Client | Sheet Source | Asset Access | Meta Account | Drafter UI | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Homemade | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Xero Shoes | ✅ Verified | ✅ Direct | ✅ Explicit | ✅ Multi-Account | **CERTIFIED** |
| MyPause | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Macros | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Soulara | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Double Roasters | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Koa Kids | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Therapy Lights | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Reignite | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Chief AUS | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Chief USA | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Aussie Pharma | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |
| Shredded | ✅ Verified | ⚠️ Pending Staging | ✅ Explicit | ✅ Multi-Account | **PARTIAL** |

## Implementation Summary

1. **Security Remediation:** `test-sync-all.mjs` removed, `LOGIN_PASSWORD` and `SESSION_SECRET` rotated in Cloudflare.
2. **Canonical Registry:** `config/client-bibles.json` implemented as single source of truth. `docs/CLIENT-BIBLES.md` updated.
3. **Multi-Account Support:** `worker.js`, `data.mjs`, and `ui.mjs` refactored to require explicit `account_id` selection.
4. **Durable Asset Access (Layer 2):** `lib/staging.mjs` implemented for Sensic-owned staging. Error messages updated to instruct users on staging/sharing.
5. **Robust Creative Parsing:** `lib/sync-worker.mjs` refactored to parse `format_variants` JSON and canonical URLs.
6. **Accurate Errors:** Granular Drive error classification implemented in `drive.mjs`.
7. **Automated Tests:** Vitest suite expanded to cover parsing, staging, and multi-account logic.

## Remaining Work

**Not fully certified: Most clients are blocked by pending real-world asset staging execution.** While the staging *logic* (`lib/staging.mjs`) is implemented, the actual `SENSIC_STAGING_FOLDER_ID` needs to be provisioned and the staging workflow needs to be executed for externally owned assets (like MyPause MP-101) to achieve full certification. Xero Shoes is certified as it uses direct file access that was previously verified.
