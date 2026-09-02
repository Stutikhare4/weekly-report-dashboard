# Weekly Report Dashboard

A client-side PWA for tracking weekly status updates across multiple projects (Current/Closed), with per-project reports. No backend, no build step, no package.json — plain HTML/CSS/JS.

## Files

- `index.html` — app shell/markup
- `app.js` — all app logic and state management (DOM-driven, no framework)
- `styles.css` — styling
- `sw.js` — service worker; lists cached assets in `ASSETS` — keep in sync if files are added/renamed
- `manifest.webmanifest` — PWA install metadata
- `icon.svg` — app icon
- `week-templates.json` — editable master week-wise task plan (seeds new projects)
- `demo-data/` — optional demo datasets; `index.json` lists what Settings offers
- `supabase-config.json` — Supabase URL + anon key; empty means local-only, no login
- `supabase/schema.sql` — run once in the Supabase SQL editor to create tables, RLS and stats
- `build-standalone.py` — bundles everything into `weekly-report-dashboard.html`
- `weekly-report-dashboard.html` — generated single-file build (do not edit by hand)

## Accounts (optional)

With `supabase-config.json` filled in, the app gets email/password accounts and syncs each
user's whole `state` object to one JSONB row in `public.user_state`, protected by row-level
security — every person sees only their own dashboard. Settings → Account shows who is signed
in and a usage count from the `usage_stats()` function. Leave the config empty and the app
behaves exactly as before: no login, local only. Setup steps are in `README-supabase.md`.

## State

All data lives in the browser's `localStorage` (see `STATE_KEY` / `USER_DATA_PREFIX` in `app.js`). There is no server-side persistence — data is scoped per-origin, so serving from a different host/port shows empty state.

## Running locally

See `README.md` for start/stop commands (`python3 -m http.server 8000`). Any static file server works — no build tooling required. A `weekly-report-dashboard:serve` skill (workspace-level, at `../.claude/skills/serve/SKILL.md`) automates start/stop/restart on port 8000 — use it instead of ad-hoc commands when asked to run/serve/preview this app.

## Standalone build

`python3 build-standalone.py` inlines `styles.css`, `app.js`, `week-templates.json` and every
demo dataset into a single portable `weekly-report-dashboard.html` that runs by double-clicking
— no server, and no `fetch` (which `file://` blocks). Re-run it after changing any of those
files. The three data loaders in `app.js` read `window.__BUNDLED_DATA__` when present and fall
back to fetching the files when served normally.

Note `app.js` contains `</head>` and `</body>` inside `buildReportPrintHtml`'s template
literal — anything rewriting the bundled HTML must target the first/last occurrence, not
replace all.

## Conventions

- Keep this a dependency-free static app unless the user explicitly asks to add a framework/build step or backend.
- If you add/rename a top-level asset file, update the `ASSETS` array in `sw.js` and bump `CACHE_NAME`, or the service worker will serve stale/missing files.

RTK usage instructions live in the workspace-level `CLAUDE.md` (`../CLAUDE.md`) — always prefix shell commands with `rtk` per those instructions.
