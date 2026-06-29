# Sensic Ad Drafter — Project Scope / PRD

**One-liner:** A team web app that turns a client's bible (Ad Tracker tab) into
**PAUSED draft ads** in Meta Ads Manager, with a QA gate, so the team uploads ads
without hand-building each one in Ads Manager.

**Slug:** `sensic-ad-drafter` · **Worker:** `ad-drafter.matt-0c3.workers.dev`
**Status:** scoping. Engine already proven in `creative-brain` (`lib/fb-draft-ads.mjs`).
Name alternatives if preferred: *Ad Launcher*, *Launchpad*, *Draft Deck*.

---

## 1. Goals / Non-goals

**Goals**
- Non-technical team members create draft ads from the bible in a few clicks.
- Everything lands as **PAUSED** (draft-equivalent) — never live. A human flips
  it on in Ads Manager after review.
- Hard QA gate: correct page, account, link, CTA, **AI enhancements OFF**, right
  catalogue (or none), before anything is created.
- Pull the right creative files in the right formats from the Sensic Drive.
- Full audit: who created what, in which account, from which bible row.

**Non-goals (v1)**
- Publishing/activating ads (drafts only).
- Creating campaigns/ad sets (ads attach to an existing ad set the user picks).
- Budget/targeting editing (out of scope; lives in Ads Manager).
- Multi-platform (Meta only, matching the rest of the stack).

---

## 2. Users & access
Allowed: **Ness, Edward, Justin, Salumi** (+ Matt as admin). Per-user identity so
the audit log is attributable. Auth via Cloudflare Access (Google SSO) in front
of the Worker — no shared token pasted around. Roles:
- **admin** (Matt): all accounts, manage allowlist.
- **operator** (the 4): create drafts within allowed accounts.

## 3. Architecture
- **Separate repo + Worker** (`sensic-ad-drafter`) — deliberately isolated from
  `creative-brain` to avoid the concurrent-git contention on its strategic lane,
  and to give a write-to-client-accounts tool its own deploy cadence + blast radius.
- **Engine reuse:** publish `lib/fb-draft-ads.mjs` as a shared module (copy into
  the new repo, or a small internal package). It already does createDraftAd + qaAd.
- **Cloudflare Worker** serves the UI (static HTML/JS) + JSON API.
- **Storage:** D1 (or KV) for the audit log + per-run state; R2 for staged Drive
  assets during upload.
- **Secrets:** `FB_ACCESS_TOKEN`, `FB_APP_SECRET` (Worker secrets, never in code).
- **Auth:** Cloudflare Access policy restricting to the 4 emails + Matt.

## 4. Account scope (allowlist)
Source of truth: `account-map.json` (the daily performance report set, 14 clients
/ 16 accounts) **intersected with clients that have a live active Basecamp
project**. Archived clients drop off the picker automatically. Page per account
is **derived dynamically** (modal page across the account's recent ads), not
hardcoded — already implemented in the QA engine.

## 5. Data model
**Bible (Ad Tracker tab) → ad fields** (per the mapping already extracted):
`Primary Text`→body, `Headline`→headline, `CTA`→call_to_action (validated to a
Meta enum), `Landing Page URL`→link (+UTMs), `Link to creatives `→Drive folder,
`Type`→format/ratios, `Creative Description`→ad name, `Campaign Name`/`Ad Set
Name/s`→display only (user picks the real ad set in the UI).

**Creative manifest** (resolved per row): list of `{drive_file_id, name,
mime, ratio, ok_for_meta}` after filtering the Drive folder to final JPG/PNG/MP4.

**Audit record:** `{ts, user_email, client_slug, account_id, adset_id,
bible_row_ref, created_ad_ids[], qa_result, status:"PAUSED"}`.

## 6. The bible → draft pipeline
1. **Resolve** the row's Drive folder via the Drive connector → list files.
2. **Filter/validate** to Meta-acceptable finals (JPG/PNG via `/adimages`,
   MP4/MOV via `/advideos`); skip PSD/PDF/webp/heic/working files; surface the
   exact file list for sign-off.
3. **Stage** approved bytes to R2 (so upload is retryable + auditable).
4. **Upload** creative to Meta (`/adimages` → image_hash, or `/advideos`).
5. **Build a CLEAN creative** via `object_story_spec`: correct page, link from
   bible, CTA enum, message/headline — and **`degrees_of_freedom_spec` with all
   creative_features OPT_OUT** (no Advantage+ / standard enhancements). This is
   the key difference from the clone test, which inherited enhancements.
6. **Create the ad** `status=PAUSED` in the user-selected ad set.
7. **QA gate** (below). If FAIL → don't surface as ready; show what's wrong.
8. **Audit** the result.

Clone mode (proven) stays available for "duplicate an existing ad as a draft."

## 7. QA gate (from `qaAd`, already built)
Account ✓ · PAUSED ✓ · Page matches account ✓ · link present ✓ · CTA present ·
UTM/url_tags · catalogue = expected (none default) · **AI enhancements OFF**
(fails on any OPT_IN) · single vs dynamic creative · objective. FAIL blocks the
"ready to publish" badge.

## 8. UI (web app)
Single-page, authenticated. Flow:

```
[ Sign in (Google SSO) ]
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  Sensic Ad Drafter                              user ▾     │
│  1. Client:  [ Xero Shoes ▾ ]  (allowlist ∩ live Basecamp) │
│  2. Ad set:  [ OPEN > EOFY > Batch One ▾ ] (live ad sets)  │
│  3. Bible rows (Ad Tracker, "Uploaded? = No"):             │
│     ┌───────────────────────────────────────────────────┐ │
│     │ ☑ EOFY SALE > Batch One   23 creatives  Static     │ │
│     │ ☐ Local Sydney Store      14 creatives  Static     │ │
│     └───────────────────────────────────────────────────┘ │
│  4. [ Preview ]                                            │
└──────────────────────────────────────────────────────────┘
        │  (Preview resolves Drive files + assembles ads)
        ▼
┌──────────────────────────────────────────────────────────┐
│  Preview — 23 ads will be created as PAUSED                │
│  ┌────────┬───────────────┬──────────┬───────┬──────────┐ │
│  │ thumb  │ primary text… │ headline │ CTA   │ QA       │ │
│  │ [img]  │ "This is the…"│ EOFY…    │ Shop  │ ✓ ready  │ │
│  │ [img]  │ …             │ …        │ Shop  │ ⚠ no UTM │ │
│  └────────┴───────────────┴──────────┴───────┴──────────┘ │
│  Files pulled: 23/23 valid (0 skipped)                     │
│  [ Create 23 PAUSED drafts ]   [ Cancel ]                  │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  Results — 23 created PAUSED · 23 passed QA                │
│  • ad 1203…0335  ✓   [open in Ads Manager]                 │
│  • ad 1203…0336  ✓   [open in Ads Manager]                 │
│  Audit logged. Bible "Uploaded?" can be flipped to Yes.    │
└──────────────────────────────────────────────────────────┘
```

States to design: loading, empty (no eligible rows), Drive-file-missing,
format-skipped, QA-fail, partial-failure (some ads created, some errored),
auth-denied. Reference the `creative-brief` design system tokens for visual
consistency.

## 9. API surface (Bearer/Access-gated, standard `{ok,code,message}` envelope)
- `GET  /api/clients` → allowlist ∩ live Basecamp.
- `GET  /api/adsets?client=` → live ad sets for the account.
- `GET  /api/bible?client=` → Ad Tracker rows where Uploaded?=No.
- `POST /api/preview` → resolve Drive + assemble ad specs + dry-run QA (creates nothing).
- `POST /api/create-drafts` → create PAUSED ads + QA + audit. Idempotent per row
  (dedupe key) so retries don't double-create.
- `GET  /api/qa-ad?ad_id=` → re-QA.
- `GET  /api/audit` → recent runs (admin).

## 10. Security & best practice
- Cloudflare Access (Google SSO) in front; per-user email in audit.
- Secrets only as Worker secrets; never logged (reuse `sanitiseSecrets`).
- `appsecret_proof` on every Graph call when `FB_APP_SECRET` present.
- All creates are PAUSED — structurally impossible to spend.
- Account allowlist enforced server-side (never trust the client).
- Idempotency keys on create to prevent double-uploads on retry/double-click.
- Rate-limit + timeout (AbortController ≤30s) on all external calls.
- Standard error envelope; graceful empty states; no 5xx propagation.

## 11. Testing strategy (build AND test the whole thing)
- **Unit:** bible parser, CTA→enum mapping, Drive file filter, creative builder
  (asserts enhancements OPT_OUT), QA logic (happy/empty/malformed/upstream-error).
- **Integration (sandbox-safe):** mocked Graph API responses for create + QA.
- **Dry-run mode:** `/api/preview` and a `--dry-run` create path that asserts the
  exact payload without calling Meta.
- **Live smoke (gated):** one PAUSED draft against the Xero account, then auto-QA,
  then optionally clean it up (archive) — guarded behind an explicit flag.
- **CI:** `node tests/run-tests.mjs` exit 0 required before deploy; post-deploy
  health + smoke signal (read-only) like the existing queue signals.
- **UI:** Playwright smoke for the 3 core screens + auth-denied.

## 12. Observability & audit
`/health` (binding flags), `/api/version` (build label), structured logs,
audit log queryable by admin. Optional Slack note on each batch create.

## 13. Build milestones (each → a Cursor spec with an automated acceptance signal)
- **M0 Scaffold** — new repo/Worker, CI, `/health`, Cloudflare Access on 5 emails.
  *Signal:* `/health` 200 + Access redirects anon.
- **M1 Engine + read APIs** — port `fb-draft-ads.mjs`; `/api/clients`, `/api/adsets`,
  `/api/bible`. *Signal:* `/api/clients` returns allowlist ∩ Basecamp.
- **M2 Preview (dry-run)** — Drive resolve + filter + assemble + dry QA, no writes.
  *Signal:* `/api/preview` returns N assembled ads + file validation, 0 created.
- **M3 Create drafts** — clean creative build (enhancements OFF) + PAUSED create +
  QA + audit + idempotency. *Signal:* live smoke creates 1 PAUSED draft that
  passes QA (page, link, CTA, enhancements-off).
- **M4 UI** — the 3 screens + states; Playwright smoke. *Signal:* UI smoke green.
- **M5 Hardening** — rate limits, partial-failure UX, audit view, docs. *Signal:*
  full test suite + conformance green.

Each milestone: commit → deploy → read-only acceptance signal → next.

## 14. Open decisions
- Cloudflare Access vs. a lightweight email-allowlist + magic link (Access is best-practice; needs the domain on CF).
- D1 vs KV for audit (D1 if we want queryable history; KV fine for v1).
- v1 supports static image ads first; video (`/advideos`) in M3.5 if bible rows need it.
