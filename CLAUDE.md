# Weekly Report Dashboard

A client-side PWA for tracking weekly status updates across multiple projects (Current/Closed), with per-project reports. No backend, no build step, no package.json — plain HTML/CSS/JS.

## Files

- `index.html` — app shell/markup
- `app.js` — all app logic and state management (DOM-driven, no framework)
- `styles.css` — styling
- `sw.js` — service worker; lists cached assets in `ASSETS` — keep in sync if files are added/renamed
- `manifest.webmanifest` — PWA install metadata
- `icon.svg` — app icon
- `week-templates.json` — editable master task plan, generated from the team's Google Sheet
  and organised into 5 phases (Kickoff, Staging Deployment, Production Deployment, Training
  and Use-Cases, Go Live). Each task carries `offsetByCycle` — its completion day offset from
  kickoff per cycle length. See "Master plan and cycle length" below.
- `demo-data/` — optional demo datasets; `index.json` lists what Settings offers
- `roles-config.json` — who may sign in, their role and password hash; see `README-auth.md`
- `tools/hash-password.py` — prints the SHA-256 hash to put in `roles-config.json`
- `supabase-config.json` — Supabase URL + anon key; unused while sign-in is the local demo gate
- `supabase/schema.sql` — run once in the Supabase SQL editor to create tables, RLS and stats
- `tools/import-sheet.py` — re-import the master plan from the Google Sheet, with an alignment guard
- `plan-engine.js` — the shared scheduling engine (offsets, interpolation, week bucketing)
- `tools/generate-weekly-report.js` — plan generator and validator; `--artifacts` writes `artifacts/`
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

## Master plan and cycle length

`week-templates.json` carries a `version`, mirrored by `WEEK_TEMPLATE_VERSION` in `app.js`.
**Bump both whenever the plan changes**: a browser stores the plan it first loaded, and without
a version change it keeps that copy for ever — after the move to the sheet, a stale copy had no
offsets, so every task resolved to N+0 and piled into week 1. `templatesAreCurrent()` re-seeds
on a version change, or when a stored task is missing offsets.

`week-templates.json` is generated from the team's Google Sheet (its URL is in `source`), which
has one tab per planned cycle length — **Week 4, Week 6, Week 12** — holding the *same* 95 tasks
with different timings. Each task carries `offsetByCycle`, the completion date as a day offset
from kickoff per cycle: `{"4": 5, "6": 5, "12": 5}` for SDK setup (fixed) versus
`{"4": 10, "6": 15, "12": 30}` for event tracking (elastic). Elasticity is therefore data, not
a rule the code applies — `elastic` on a task is just "this offset varies", derived on edit.

**Re-importing the sheet:** `python3 tools/import-sheet.py` checks it and reports drift without
writing; `--write` rewrites `week-templates.json` and `app.js`'s `WEEK_TEMPLATE_SEED`. Then bump
`version` and `WEEK_TEMPLATE_VERSION` so browsers re-seed, and re-run `build-standalone.py`.

Rows are matched across tabs **by position**, not by title, because the tabs have drifted apart
on wording. The importer refuses to run if the positions stop agreeing — a row inserted into one
tab alone would otherwise pair every task below it with another task's offsets, silently. Wording
drift is only a warning; `Week 4`'s wording wins.

The scheduling rules live in **`plan-engine.js`**, loaded as a plain script by the browser and
required as a module by `tools/`, so the dashboard and the generated artifacts cannot drift
apart. `tools/generate-weekly-report.js` builds a plan for any cycle and validates it;
`--artifacts` writes `artifacts/task_registry.json`, `interpolation_test.json` and
`sample_5_week_report.json`. Re-run it after changing the master plan.

`resolveTaskOffset()` returns the offset for the project's cycle: exact when a tab exists,
linearly interpolated between the two nearest when not (8 weeks sits between the 6- and
12-week plans), scaled from the nearest outside the range. A new cycle length needs no edit.

`generateWeeklyPlan()` files each task into the week containing kickoff + offset, so **every
task appears at every cycle length** and the dates are the sheet's own. Week 1 is the week the
kickoff falls in (`mondayOnOrBefore`), so an N+0 task lands in it whatever weekday the project
starts. A week with nothing due shows as empty — that reflects a real gap in the plan rather
than a bug (the Week 12 tab has no task due in days 21-27 or 42-48).

Tasks are filtered to the project twice: by `platforms` (domain) and by `channels`. Channel
filtering only applies once the project has chosen channels, so an early draft still gets the
full plan.

The 14 **Web App** tasks are not in the sheet — they mirror the Website tasks with Android/iOS
timing, per the team's instruction. Regenerate them if the sheet gains a Web App domain.

Known data slips in the sheet, imported as written rather than silently corrected: in the Week
6 and Week 12 tabs the five *Production* channel-setup rows (Email/SMS/WhatsApp/RCS/IVR) still
carry the staging value N+10, so they schedule before the production dashboard exists.

## Project page: two views

The details view is a card grid: Overview and Integration Scope side by side, Project Details
and Timeline below them, a full-width phase strip, then the action buttons. Card accents come
from `--card-accent` / `--card-done` tokens rather than fixed hex, so the page keeps its look in
dark mode.

The phase strip is derived, not drawn: phases come from the master plan, and each is done when
every one of its tasks is, active when it holds this week's work or anything already started,
pending otherwise. Editing phases means editing the plan, so its Edit button goes to Templates.

Integration Scope is editable in place — platforms, channels, technical team, historical
migration and user identifier. Changing them does **not** regenerate existing weeks, which would
discard entered status; new domains need "Add week from template".


The project page holds two views of one project, toggled by `setProjectView()`: **details**
(overview, integration scope, editable project details, and a Generate Report button) and
**report** (the generated weekly report on its own, with its own Back button and heading).
Opening a project always lands on details. They are two views of one screen rather than two
screens, so the project stays loaded and Back is instant.

The old "Weekly updates" list on the project page is gone — it was a third rendering of the
same weeks, after the report itself and the reports accordion. Adding and editing weeks now
happens on the Project Reports screen, reachable from the details view.

## Week modal

"Open week" on a row in the reports list opens a focused view of that week: what is still
outstanding from earlier weeks, what is planned for this one, tick-to-complete, shift-to-next-
week, and add-a-task.

Carryover is **display only**. A task stays owned by the week it was planned in; earlier weeks'
unfinished work is shown here labelled with its source, so opening a later week never rewrites
what an earlier one contained. Moving a task between weeks is the explicit "Shift to next week"
action, which re-dates it into the following week.

Each row carries a status dropdown over the six statuses. **Pending** means the work is
deliberately being carried in the week it now sits in, rather than merely unfinished: choosing
it moves the task into the week being triaged and disables Shift, since the task has just been
pinned there. It is a first-class status, so the report and the accordion show it too.

The modal edits a deep copy of the project's weeks, so "Save Changes" is a real commit and
"Back" genuinely discards. A carried task ticked here stays visible and struck through until the
modal closes, rather than vanishing out of the list mid-click.

## Weekly reports screen

Weeks are an accordion: collapsed to a summary line (week number, dates, phase, task count,
completed count, status), one open at a time. The open week **is** the editor — task, domain,
owner, due date, status and comments, with sub-tasks nested underneath, all writing straight to
state on change. There is no separate form below the list, so a week's tasks are never rendered
twice. "Edit" opens a week in place; "+ New report" appends a week and opens it.

Columns run **Phase | Domain | Task | Owner | Completed On | Status | Comments** in the editor
and in every report output, so what is edited and what is sent read the same way.

**Completed On** is `task.date` — what actually happened, and what the report prints. Setting a
task's status to completed fills it with today if it is still blank. `task.dueDate` is still the
planned date from the master plan and still decides which week a task sits in, but it is no
longer editable: it is set at generation and adjusted when the project is re-dated.

The week containing today is marked with a left rule, a tinted row and a "This week" badge.
Membership comes from `isDateInUpdateWeek`, which compares ISO date strings — parsing
`YYYY-MM-DD` with `new Date` reads it as UTC while `new Date()` is local, which would put the
boundary a day out for anyone behind UTC. Nothing is marked when today falls outside the cycle.

Structural changes (add/remove a task or sub-task) re-render the list and restore the open row;
field edits patch the summary line by hand instead, since re-rendering would blur the input
mid-edit.

## Phase and domain on a task

A task carries both: `phase` is the stage it belongs to (Kickoff, Staging Deployment, ...) and
`domain` is what it is done against (Website, Android, Communication Channels, ...). The report
shows them as the first two columns, each merged vertically over its run of rows — domain groups
*within* a phase, so a domain appearing under two phases does not merge across the boundary.

A task whose master-plan `scope` merely repeats its phase applies to the whole project, so its
domain reads "All" rather than echoing the phase. An empty scope stays empty.

Tasks saved before this split kept the domain in `phase`; `ensureDefaults` moves it to `domain`
and recovers the phase from the master plan, preferring whichever phase the week is labelled
with when a title appears in more than one (staging and production both run audits).

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
