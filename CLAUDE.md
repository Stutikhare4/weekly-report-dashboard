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
has one tab per planned cycle length — **Week 4, Week 6, Week 12** — holding the *same* 86 tasks
with different timings. Each task carries `offsetByCycle`, the completion date as a day offset
from kickoff per cycle: `{"4": 10, "6": 15, "12": 35}` for Android event tracking (elastic)
versus `{"4": 5, "6": 5, "12": 5}` for SDK setup (fixed — and pinned, see below). Elasticity is therefore data, not
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
starts. A week with nothing due would show as empty, which would reflect a real gap in the plan
rather than a bug; with the current sheet no cycle from 2 to 12 weeks has an empty week.

Tasks are filtered to the project twice: by `platforms` (domain) and by `channels`. Channel
filtering only applies once the project has chosen channels, so an early draft still gets the
full plan.

The 14 **Web App** tasks are not in the sheet — they mirror the Website tasks with Android/iOS
timing, per the team's instruction. Regenerate them if the sheet gains a Web App domain.

Known data slip in the sheet, imported as written rather than silently corrected: the five
*Production* channel-setup rows (Email/SMS/WhatsApp/RCS/IVR) are due at N+10 in the Week 6 tab
and N+21 in Week 12 — before Create Production Dashboard (N+21 and N+42), so they schedule
ahead of the dashboard they configure. The Week 4 tab has them after it (N+22/23 vs N+21).

## Fixed foundational weeks

SDK Set Up and User Tracking are pinned: `fixedWeek: 1` and `fixedWeek: 2` on the task, with
offsets flattened to 5 and 10 across every cycle. `PlanEngine.placementFor()` puts a pinned task
in its named week directly rather than deriving one from its offset — offset alone only holds
for a Monday or Tuesday kickoff, since `lead` slides an N+5 task into week 2 for a project
starting Wednesday or later.

Nothing was added to do this; the tasks already existed in Staging Deployment and were moved
rather than copied. There is no CRM SDK Set Up, by decision. Domain filtering still applies — a
website-only project gets the Website one only.

The pin is applied by **`tools/import-sheet.py`** (`PINNED_WEEKS`), not by hand, so a re-import
cannot hand these tasks back their elastic offsets. It is carried through `toTemplateWeeks`,
`ensureDefaults` and the seed writer; that whitelist rebuilds each task field by field, so a new
field not named in all three is silently dropped.

In the week editor a pinned task shows a lock and cannot be moved. Marking it pending or in
progress does copy it into the next week, as an unpinned continuation. Its status stays editable — the point is that the work happens first, not that nobody may
record it.

## Create-project wizard

Three steps — Basic Details, Platform Integration, Review & Summary — inside one screen as
`.wizard-panel` elements, not separate screens. `WIZARD_LAST_STEP` is 3; step 3's button reads
"Create Project" and creates the project, then opens it. There is no confirmation step: a screen
whose only job was to say "done" and offer a button to where the person was already going. What
it usefully said — how many weeks were pre-created — survives as a self-clearing banner.

## Projects list (folder screen)

Dashboard → Ongoing / Completed opens the folder screen as a stacked list: one full-width row
per project, the name and Active/Idle status on the first line, the domains, cycle length,
go-live and last-touched time sharing the second. The whole row opens the project.

Both folder buttons call `openCategory()`. They used to jump straight to the first project by
name whenever the folder had one, so the list only appeared when a folder was empty. That jump
was removed, restored on request, and removed again — if it comes back, it is the two listeners
next to `openCurrent` / `openClosed`.

Activity has no field of its own on a project, so `projectLastActivity()` takes the newest of
`updatedAt`, `createdAt` and the project's weekly reports' `createdAt` — older projects predate
the stamp and fall back to the other two. `updatedAt` is stamped when details, scope or a week
are saved. Active means activity inside `ACTIVE_WINDOW_DAYS` (7).

12 per page with Load more. `uiState.categoryShown` only resets when the folder changes, so
coming back from a project leaves the page where it was.

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
(overview, integration scope, editable project details, and a View Report button) and
**report** (the generated weekly report on its own, with its own Back button and heading).
Opening a project always lands on details. They are two views of one screen rather than two
screens, so the project stays loaded and Back is instant.

The old "Weekly updates" list on the project page is gone — it was a third rendering of the
same weeks, after the report itself and the reports accordion. Adding and editing weeks all
happens on the Project Reports screen, reachable from the details view.

## Weekly reports screen: weeks edited in place

Weeks are an accordion: collapsed to a summary line (week number, dates, phase, task count,
carried count, completed count, status). **The open week is the editor**, and **any number of
weeks may be open at once** — "Edit" and the chevron both fold a week open or shut, and
`uiState.openReportRows` is a Set, not a single id. "+ New report" appends a week and opens it
alone, since that is the week the person just asked for.

There was also a **week modal** ("Open week"), a second editor over a deep copy of the project's
weeks with its own Save Changes and unsaved-work prompts. It is gone: `#weekModalOverlay`, the
15 `weekDraft`/`weekModal*` functions, `let weekDraft` and the beforeunload/Escape draft guards
were all removed, and everything they did now happens in the accordion. Two editors over the
same weeks meant two places a count could disagree.

**Nothing is held in a draft.** Every field writes straight to state on change, which is what
lets several weeks be open together: two drafts over the same task would silently clobber each
other, and the one saved last would win.

The footer's **💾 Save Changes** button therefore confirms rather than commits — it calls
`saveState()`, flashes the header indicator and turns green reading "✓ Saved" for 1.8s. It can
never have anything outstanding to save. It exists because it was asked for by name, twice,
after the conflict was explained; the alternative offered was a permanently disabled button,
which reads as broken, so it is enabled and reports success. **There is no unsaved-changes
prompt and no dirty state anywhere** — with several weeks open there is nothing coherent for one
to describe. The header's **Save state** reports likewise: grey "Saved", flashing green
"Saved ✓" as each write lands. A blue "click to save" would be a lie.

If a real draft is ever wanted here, it costs multi-open: one week at a time, a snapshot taken
on open, `weekDraftDirty()`-style comparison, and leave prompts on Back/Escape/reload. That is a
behaviour change, not a button.

Columns run **Phase | Domain | Task | Owner | Completed On | Status | Comments**, plus an actions
cell (Move… / + Sub / ×), in the editor and in every report output, so what is edited and what is
sent read the same way. `table-layout: fixed` sizes them, so the actions cell needs a pixel width
— a percentage clips its three controls, since fixed layout never grows a column to fit content.
`.week-task-actions` is a plain cell: `display: flex` on a `<td>` takes it out of the table's
column flow and the row spills into an anonymous cell beside it. The eight widths must sum to
exactly 100% — mixing a pixel column in among percentages made them total more than the table,
so the last column overflowed even on a wide screen.

The table is wider than a phone, so it scrolls inside `.week-editor-scroll`. That only works
because **`.content` and `.report-row` carry `min-width: 0`**: a grid item defaults to
`min-width: auto` and grows to its widest child, which handed the overflow to the page — the
whole app scrolled sideways at every width, `.shell`'s `minmax(0, 1fr)` notwithstanding, since
that sizes the track and not the item in it. Anything wide added to a screen needs the same
check: the page must not scroll horizontally, only the wide thing's own box.

**Completed On** is `task.date` — what actually happened, and what the report prints. Setting a
task's status to completed fills it with today if it is still blank. `task.dueDate` is still the
planned date from the master plan and still decides which week a task sits in, but it is no
longer editable: it is set at generation and adjusted when the project is re-dated.

The week containing today is marked with a left rule, a tinted row and a "This week" badge.
Membership comes from `isDateInUpdateWeek`, which compares ISO date strings — parsing
`YYYY-MM-DD` with `new Date` reads it as UTC while `new Date()` is local, which would put the
boundary a day out for anyone behind UTC. Nothing is marked when today falls outside the cycle.

Structural changes (add/remove a task or sub-task, Move, a pending move) re-render the list and
restore every open row; field edits patch the summary line by hand instead, since re-rendering
would blur the input mid-edit. Editing any week stamps `updatedAt` on its project
(`stampProjectActivity`), so a week worked on today does not leave the project reading Idle.

### Carried work

**Carried means late**, not merely unfinished: `carriedTasksFor()` collects tasks from earlier
weeks that have **ended** and are still not completed. Counting everything incomplete instead
put "+14 carried" on week 6 of a project where nothing had started — work that is not due yet,
not slippage. The accordion summary shows it as "4 tasks + 2 carried" and the open editor as a
badge in its header, both from the same function as the rows themselves, so a count never
disagrees with what it stands for. The generated report shows none of it.

Carryover is **display only**. A task stays owned by the week it was planned in; earlier weeks'
unfinished work appears in later editors as amber rows labelled "⬅ Carried from Week N", so
opening a later week never rewrites what an earlier one contained.

That makes the row's owner and the panel it appears in two different weeks, which every handler
has to respect: `rowOwnerWeek()` reads `data-owner-week` off the row and edits are written to
*that* week. Writing to the panel's week instead would fork the task into a copy under the later
week — the original still late, the copy holding the edit. `applyWeekStructureChange` uses it
too, so × and + Sub on a carried row act on the task rather than on a lookalike.

Carried work ticked off here keeps its row, struck through (`.is-resolved`), instead of vanishing
from under the pointer; it leaves the carried list the next time the list is rebuilt.

### Move

Moving a task between weeks is the explicit **Move…** control on its row — a native select rather
than a floating menu, because the editor scrolls and would clip an absolutely positioned one. It
lists every other week, nearest ahead first, **moves** the task rather than copying it, and
re-dates it into the target. Only **pinned** tasks are barred: a forwarded copy is an ordinary
task and moving one instance out of its week is a stated part of auto-forwarding.

A pinned task (see "Fixed foundational weeks") shows a lock and cannot be moved, though it *is*
copied forward when marked pending or in progress. Its status stays editable — the point is that the work happens first, not that nobody
may record it.

### Auto-forwarding: Pending and In Progress copy into the next week

Marking a task **pending** or **in progress** (`FORWARDING_STATUSES`) copies it into the week
after the one being edited, so work that runs past this week is already on next week's list.
`forwardTaskToNextWeek()` does it; **completed, delayed and blocked do not forward** — the work
is either done or not moving.

The copy is **its own record**: a new `id`, `startDate`/`dueDate` re-dated into the target week,
sub-tasks re-idded, and a **blank Completed On** — that date is per week, so inheriting it would
claim the work finished in a week it did not. It carries `copiedFromTaskId` (lineage) and
`copiedFrom` (the source week's start), and its row reads "⬅ Copied from Week N" in the same
amber as a carried row: two badge colours for "this is late" and "this was forwarded" would be a
distinction the reader cannot act on.

Rules that keep it from running away:

- **One copy per source task per week.** Re-marking the same status does nothing, because the
  target week is checked for an existing task whose `copiedFromTaskId` matches.
- **Two triggers.** Marking the status copies the task forward immediately. A sweep,
  `carryForwardOverdueTasks()`, then catches work *already* marked when its week runs out, so a
  task set to pending weeks ago does not sit stranded in a week nobody is looking at any more.
  It runs at app start and when the reports screen opens — before the render, not during it,
  since `renderAll()` calls back into the index and writing state from inside a render would
  re-enter it.
- **Only weeks that have ENDED forward.** That is the whole safeguard against fanning out: a
  task advances one week per real week, instead of one click filling weeks 3–12 at once. Weeks
  are walked in order, so work stranded several weeks back steps through each of them in a
  single pass and arrives in the current week, with every week it was open in keeping a record.
  The chain stops at the current week, which has not ended.
- **The sweep never undoes a decision.** `forwardedToWeek` is stamped on the source when a hop
  is made, and the sweep skips a stamped hop — so a copy someone deleted stays deleted instead
  of reappearing on the next load. Marking the status by hand again re-creates it, which is the
  way back.
- **It says what it did.** `announceCarriedForward()` shows a self-clearing notice; creating task
  rows on someone's behalf should not be silent.
- **The last week does not forward.** Creating a week past the end of the cycle would silently
  extend the project and move a go-live date that is calculated, not entered.
- **Pinned work does forward, and the copy is not pinned.** `fixedWeek` decides where the
  *master plan places* a task when a project is generated; it says nothing about whether the
  work finishes there. Refusing to forward it was wrong — Android User Tracking marked in
  progress in week 2 simply vanished from week 3 — and it contradicted the app's own carryover,
  which has always shown incomplete pinned tasks in later weeks. The copy clears `fixedWeek`:
  keeping it would have the copy claim to be fixed to week 2 while sitting in week 3, wear a
  lock in the wrong week, and refuse to be moved. The original keeps its pin and its lock.
- **Arrivals go to the top of the week.** A forwarded copy, a task moved in by hand and a task
  re-dated into the week by `refileTasksIntoWeeks` are all `unshift`ed rather than pushed: work
  arriving from the week before is what someone opening this week needs to see first. The report
  reads the same array, so the editor and the document agree on the order. `+ Add task` still
  appends, since a row a person just created belongs where they clicked.
- **Nothing is ever auto-deleted.** Completing a task stops *further* copies but leaves the ones
  already made, because someone may have typed into them. The brief asked for completion to
  "remove it from future weeks"; that cannot hold alongside copies being independently editable
  records, and it would throw away entered work without warning.

`taskWasForwarded()` keeps the carried count honest: a task already continued into a later week
is **not** also listed as carried, because its copy stands for it. Without that, one job would
show as two pieces of late work, then three, and "+5 carried" would stop meaning anything.

**Pending no longer moves a task.** It used to move a carried task into the week being triaged,
recording `carriedFrom`; one status cannot both move a task and copy it. `carriedFrom` is still
written by Move and still rendered, so weeks moved by hand before this change still read right.

**Known consequence:** each week's report table prints that week's own tasks, so a task forwarded
across six weeks prints six times in the client report — once per week, each with that week's own
status. That is the cost of copies over one record with a status per week.

(Headless Chrome's virtual clock does not advance CSS transitions, so a test that reads a
button's `background` straight after a change sees the start colour. Disable the transition in
tests; `cursor`, which does not animate, flips immediately.)

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

## Typography

One font for the whole app — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …` — and one
scale: h1 18px/600, h2 and h3 14px/600, body 13px, muted and small 12px, buttons and inputs 13px.
The Georgia serif that used to carry every heading is gone from `styles.css`; heading colours use
`--card-value` / `--card-label` rather than fixed hex, so they still adapt in dark mode.

Two deliberate exceptions. The printed and emailed report keeps its serif headings — those styles
live in `app.js` (`buildReportPrintHtml`, `EMAIL_STYLE`) and go to clients as a document, not as
app chrome. And the `.brand-mark` square in the header is hidden, so the header is the wordmark
alone.

## Conventions

- Keep this a dependency-free static app unless the user explicitly asks to add a framework/build step or backend.
- If you add/rename a top-level asset file, update the `ASSETS` array in `sw.js` and bump `CACHE_NAME`, or the service worker will serve stale/missing files.

RTK usage instructions live in the workspace-level `CLAUDE.md` (`../CLAUDE.md`) — always prefix shell commands with `rtk` per those instructions.
