# Release Evidence Ledger

| Requirement | Implementation | Test | Result | Production evidence | Status |
|---|---|---|---|---|---|
| P0: Missing imports | Restored `import { getJob... }` in `worker.js` | `test/create-route.test.js` | PASS | Deployed | PASS |
| P0: UI state destruction on 500 | Added `!r.ok || !j.ok` check in `ui.mjs` | `test/e2e-browser/create.spec.js` | PASS | Deployed | PASS |
| Idempotency / Job state | Added `lib/jobs.mjs` and KV persistence in `worker.js` | `test/concurrency.test.js` | PASS | Deployed | PASS |
| Custom batch modal | Replaced `confirm()` with custom HTML modal in `ui.mjs` | `test/e2e-browser/create-success.spec.js` | PASS | Deployed | PASS |
| Unified schema | Added `schemaVersion: 'v1'` and full NormalizedAdRow shape to `lib/sync-worker.mjs` | `test/schema-adapter.test.js` | PASS | Deployed | PASS |
| Fault catalogue | Created `docs/FAULT-CATALOGUE.md` with known incidents | N/A | PASS | N/A | PASS |
| Drive capability matrix | Created `test/drive-capability.test.js` | `test/drive-capability.test.js` | PASS | N/A | PASS |
| Audit/monitoring | Updated `handleAudit` to merge `audit:` and `audit_fail:` | Manual inspection | PASS | Deployed | PASS |
