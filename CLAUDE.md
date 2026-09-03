# Weekly Report Dashboard

A client-side PWA for tracking weekly status updates across multiple projects (Current/Closed), with per-project reports. No backend, no build step, no package.json — plain HTML/CSS/JS.

## Files

- `index.html` — app shell/markup
- `app.js` — all app logic and state management (DOM-driven, no framework)
- `styles.css` — styling
- `sw.js` — service worker; lists cached assets in `ASSETS` — keep in sync if files are added/renamed
- `manifest.webmanifest` — PWA install metadata
- `icon.svg` — app icon
- `week-templates.json` — editable master week-wise task plan (seeds new projects). Each task
  may carry `days` (duration in the `baseCycleWeeks` cycle) and `daysByCycle` overrides such as
  `{"7": 10, "8": 14}`; an unlisted cycle is scaled from `days` pro rata for elastic tasks
  only, so new cycle lengths need no edits. Missing `days` falls back to `defaultTaskDays`
  (currently every task, so all durations are 7 days until real ones are entered). A stage or
  task may carry `elastic: true` — see "Fitting the master plan" below.
- `demo-data/` — optional demo datasets; `index.json` lists what Settings offers
- `roles-config.json` — who may sign in, their role and password hash; see `README-auth.md`
- `tools/hash-password.py` — prints the SHA-256 hash to put in `roles-config.json`
- `supabase-config.json` — Supabase URL + anon key; unused while sign-in is the local demo gate
- `supabase/schema.sql` — run once in the Supabase SQL editor to create tables, RLS and stats
- `build-standalone.py` — bundles everything into `weekly-report-dashboard.html`
- `weekly-report-dashboard.html` — generated single-file build (do not edit by hand)

## Sign-in and roles

Demo sign-in checked in the browser against `roles-config.json`: `@webengage.com` addresses
only, listed users only, passwords stored as SHA-256 hashes, two roles (Admin / Viewer).
Adding a user or resetting a password means editing that file and pushing — the browser
cannot write to it. Full procedure in `README-auth.md`. This is a gate, not security.

## Accounts via Supabase (not currently wired up)

With `supabase-config.json` filled in, the app gets email/password accounts and syncs each
user's whole `state` object to one JSONB row in `public.user_state`, protected by row-level
security — every person sees only their own dashboard. Settings → Account shows who is signed
in and a usage count from the `usage_stats()` function. Leave the config empty and the app
behaves exactly as before: no login, local only. Setup steps are in `README-supabase.md`.

## Fitting the master plan to a project's cycle

The master plan is an ordered list of *stages*, not a fixed number of weeks — `week: 3` is
stage 3, not "project week 3". `stageSpans()` decides how many project weeks each stage gets,
so **every stage and every task appears at every cycle length**: a 3-week project merges
stages into a week, a 12-week project spreads them out. Nothing is ever dropped — Go-Live
survives a short project — and no week is left empty.

Stages flagged `elastic` absorb the slack (in practice "Event Tracking & Channels"); every
other stage keeps one week, because SDK setup, channel setup and the like take a fixed amount
of effort however long the project runs. With no elastic stage the whole plan scales pro rata.

`dealTasksAcrossWeeks()` spreads a stretched stage's tasks over its weeks in template order,
breaking only between domains so one domain's work never straddles a week boundary; domains
are split further only when there are fewer of them than weeks to fill.

The same `elastic` flag on a *task* controls duration: elastic tasks scale with the cycle
(`resolveTaskDays`), fixed tasks keep their `days`. Both flags are editable per stage and per
task on the Templates screen.

## Task timeline

Tasks run in parallel within their week: each starts on its week's Monday and ends
`days - 1` later, so a task longer than a week simply overruns. A project's go-live is
whichever is later — the nominal end of the cycle, or the last task to finish — which means
the cycle length is a plan, not a ceiling. Durations and planned dates stay editable per task
in the report editor. A task whose start date moves outside its week is re-filed into the week
that now contains it (`refileTasksIntoWeeks`).

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
