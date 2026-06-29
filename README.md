# Sensic Ad Drafter

Team tool: turn a client's bible (Ad Tracker) into **PAUSED draft ads** in Meta
Ads Manager, with a QA gate. Subdir Worker (sibling to `creative-brief/`,
`sensic-dispatcher/`). Full scope: `../sensic-ad-drafter/PRD.md`.

Worker: `sensic-ad-drafter` → `https://sensic-ad-drafter.matt-0c3.workers.dev`
Engine: `../lib/fb-draft-ads.mjs` (createDraftAd + qaAd, shared with creative-brain).

## Deploy
```bash
cd sensic-ad-drafter
wrangler deploy
# secrets (reuse creative-brain values):
wrangler secret put FB_ACCESS_TOKEN
wrangler secret put FB_APP_SECRET
wrangler secret put BRAIN_API_TOKEN
```

## Routes (M0)
- `GET /` — landing (UI ships M4)
- `GET /health` — bindings + build label (public; used by deploy signal)
- `GET /api/version` — build label (public)
- `GET /api/clients` — account allowlist (Bearer)
- `POST /api/create-draft-ad` — `{sourceAdId}` or `{creativeId,adsetId}` → PAUSED draft (Bearer)
- `GET /api/qa-ad?ad_id=` — QA a draft (Bearer)

## Roadmap (milestones in PRD)
M0 scaffold · M1 read APIs + Basecamp filter · M2 preview/dry-run · M3 create
drafts (clean creative, enhancements OFF) + audit · M4 UI · M5 hardening.
Auth: interim Bearer (`BRAIN_API_TOKEN`); Cloudflare Access SSO in M0.5.
