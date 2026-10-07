# Weekly Report Dashboard — complete project dump

Everything built to date, written to be read without access to the code. It reflects what is
**live**, not what is planned.

| | |
|---|---|
| **As of** | 16 September 2026, commit `e56553e` (56 commits since 10 July 2026) |
| **Live** | https://weekly-report-dashboard-one.vercel.app/ |
| **Repo** | https://github.com/Stutikhare4/weekly-report-dashboard |
| **Owner** | Stuti Khare (stuti.khare@webengage.com) |
| **Cache / plan versions** | service worker `weekly-dashboard-v132` · master plan `2026-09-07-fixed-weeks` |

---

## Contents

1. What it is
2. How it is built
3. Files
4. Data model
5. The master plan
6. How a project becomes weekly reports
7. Screens, one by one
8. Carryover, Pending and Move
9. The report
10. Access control
11. Design system
12. Tooling and maintenance
13. History — what was built, in order
14. Decisions already taken
15. Things deliberately not built
16. Things that were changed and then changed back
17. Open questions and known issues
18. Deferred backlog
19. Notes for anyone writing a change request

---

## 1. What it is

An internal tool for WebEngage onboarding managers (OBMs) and project owners to run client
integration projects week by week and send the client a weekly status report.

A project is created once, with a kickoff date, a cycle length (how many weeks), and the domains
and channels in scope. The tool then generates the whole week-by-week task plan from a master
plan. The team updates tasks each week and generates a client-facing report from them.

Status: working and in use for demo and internal purposes.

---

## 2. How it is built

Plain HTML, CSS and JavaScript. **No framework, no build step, no backend, no dependencies.**
About 5,300 lines of JavaScript, 3,800 of CSS and 770 of HTML, served as static files on Vercel.
Pushing to `main` on GitHub deploys it, typically within 15 seconds. It is also an installable
PWA with a service worker.

**All data lives in the browser's `localStorage`**, under one key:
`multi-project-dashboard-state`. That has real consequences worth knowing before proposing
anything:

- Each person's dashboard is entirely their own. **Projects cannot be shared between users.**
- Clearing browser data loses everything. There is no server copy — only manual JSON export.
- Two people cannot work on the same project.
- Data belongs to one web address: the live site, a local copy and the standalone file each hold
  separate data.

A single-file build (`weekly-report-dashboard.html`, about 380 KB) inlines everything and runs by
double-clicking, offline. A Supabase backend — real accounts, cloud storage, row-level security —
is **written but not switched on**.

---

## 3. Files

| File | Purpose |
|---|---|
| `index.html` | The page shell and all screens' markup |
| `app.js` | All app logic and state (about 5,300 lines) |
| `plan-engine.js` | The scheduling rules, shared by the app and the tools |
| `styles.css` | All styling, dark-first with light overrides |
| `sw.js` | Service worker; `CACHE_NAME` must be bumped on every release |
| `manifest.webmanifest`, `icon.svg` | PWA install metadata and icon |
| `week-templates.json` | The master plan, generated from the Google Sheet |
| `roles-config.json` | Who may sign in, their role, their password hash |
| `demo-data/` | An optional demo project (Salad Days) loadable from Settings |
| `build-standalone.py` | Builds the single-file version |
| `weekly-report-dashboard.html` | The generated single-file version (never edited by hand) |
| `tools/import-sheet.py` | Re-imports the master plan from the Google Sheet, with safety checks |
| `tools/generate-weekly-report.js` | Generates and validates a plan for any cycle; writes `artifacts/` |
| `tools/hash-password.py` | Prints the hash to put in `roles-config.json` |
| `artifacts/` | Task registry, the cycle 2–12 test matrix, a sample 5-week plan |
| `supabase/schema.sql`, `supabase-config.json` | The unused cloud backend |
| `README.md`, `README-auth.md`, `README-supabase.md` | Running locally, adding users, the backend |
| `CLAUDE.md` | Developer notes — how the pieces work and why |
| `BACKLOG.md` | Deferred work, with reasons |
| `INTEGRATION_GUIDE.md` | How the scheduling engine fits together |
| `PRODUCT-CONTEXT.md` | This document |

---

## 4. Data model

The stored state holds `projects` and `updates` as **separate top-level arrays**. A weekly report
("update") points at its project by `projectId`; weeks are not nested inside projects. The state
also holds `weekTemplates` (the editable copy of the master plan) and settings.

**Project** — `id`, `name`, `status` (`"current"` or `"closed"` only), `kickoffDate`,
`cycleWeeks`, `goLiveDate`, `platforms`, `channels`, `techTeam`, `vendorName`, `csm`,
`implementationOwner`, `salesOwner`, `clientPocs`, `team`, `notes`, `platformLink`,
`dataRequirements` (`historicalMigration`, `userIdentifier`), `additionalComments`, `isDraft`,
`createdAt`, `updatedAt`.

**Weekly report (update)** — `id`, `projectId`, `projectName`, `weekStart`, `weekRange` (a
pre-formatted label such as "7th September to 13th September"), `statusTag`, `templateLabel`
(the phases that week covers), `templateWeek`, `fromTemplate`, `tasks`, `createdAt`.

**Task** — `id`, `title`, `phase`, `domain`, `owner`, `status`, `date` (Completed On),
`dueDate` (planned), `startDate`, `days`, `comments`, `priority`, `blocker`, `subtasks`,
`fixedWeek` (set when pinned), `carriedFrom` (set when moved in by Pending).

**Statuses**
- Task: not started, in progress, delayed, blocked, completed, **pending**
- Week: not started, on track, needs attention, blocked, completed

**Vocabulary**
- Platforms (domains): Website, Android, iOS, Web App, REST API — the last is **shown as "CRM"**
- Channels: Push, Email, SMS, WhatsApp, RCS, IVR, In-App, Web Push, On-site Notification
- Cycle length: 2–12 weeks. The wizard offers 6 by default; a missing value falls back to 5.

---

## 5. The master plan

Everything a project generates comes from the master plan in `week-templates.json`, imported
from the team's Google Sheet:

https://docs.google.com/spreadsheets/d/1szgspVwOpiUgsS3DKoybF_UKB8t6LXRNXBAnr_pmO7E/edit

The sheet has **three tabs — Week 4, Week 6 and Week 12.** Each holds the same 86 tasks in the
same order, with different timings. The tabs' task wording was aligned in September; the
importer now reports no differences, and the app's copy matches the sheet exactly.

### 100 tasks across 5 phases

| Phase | Tasks |
|---|---|
| Kickoff | 6 |
| Staging Deployment | 50 |
| Production Deployment | 37 |
| Training and Use-Cases | 6 |
| Go Live | 1 |

86 come from the sheet. The other 14 are a **Web App** domain the sheet does not have: they copy
the Website tasks but use Android/iOS timing, by decision.

### Which tasks a project gets

Tasks are filtered twice.

- **By domain.** Website 14, Web App 14, Android 19, iOS 20, CRM (REST API) 9. A task with an
  **empty** platforms list is not tied to a domain — there is no "General" domain.
- **By channel.** Channel-specific work (Email setup, Push credentials, WebPush audit…) only
  appears when the project uses that channel. This only applies once a project has chosen at
  least one channel.

Of the 24 tasks with no domain: **12 run on every project** (the 6 Kickoff tasks, Create
Production Dashboard, Training Sessions I–III, Send Dashboard Recording, and Go Live), and **12
are Communication Channels tasks** filtered by channel alone. The two historical-data uploads
are CRM tasks.

A project with every domain and channel gets all 100. A Website-only project using just Web Push
gets 24.

Owners come from the sheet as roles: Webengage OBM (43 tasks), Client tech team (42),
Cpaas / Client team (10), Client team (3), Webengage team + Client team (2).

### Timing

Every task carries its completion date as **days after kickoff, per cycle length**:

| Task | 4 weeks | 6 weeks | 12 weeks |
|---|---|---|---|
| SDK Set Up (any domain) | N+5 | N+5 | N+5 — pinned to week 1 |
| User Tracking (any domain) | N+10 | N+10 | N+10 — pinned to week 2 |
| Event Tracking (Website) | N+10 | N+15 | N+21 |
| Event Tracking (Android / iOS) | N+10 | N+15 | N+35 |
| Create Production Dashboard | N+21 | N+21 | N+42 |
| Go Live | N+27 | N+40 | N+82 |

**89 tasks are elastic** (their date moves with the cycle length) and **11 are fixed**: Kick-off
Meeting, Discovery, the 4 SDK Set Up tasks and the 5 User Tracking tasks. Whether a task is
elastic is read from its data, not configured.

### Pinned foundational weeks

SDK Set Up (Website, Web App, Android, iOS) is always in **week 1**, and User Tracking (Website,
Web App, Android, iOS, CRM) is always in **week 2**, whatever the cycle length or kickoff weekday.
They are placed by week number rather than by date: placing them by date only works for a Monday
or Tuesday kickoff. CRM has no SDK setup, by decision. They still follow the project's domains —
a Website-only project gets only the Website ones. In the week editor they show a 🔒 and cannot be
moved.

### Editing the plan

The plan is fully editable in the app (Templates screen) without touching the sheet or the code.
Edits apply to projects created afterwards; existing projects keep their tasks. Settings can also
push corrected **wording** into existing projects, for tasks nobody has touched yet.

---

## 6. How a project becomes weekly reports

At creation the tool:

1. filters the 100 tasks to the project's domains and channels;
2. looks up each task's completion day for this cycle length;
3. files each task into the week containing kickoff + that many days (pinned tasks go straight
   to their week);
4. creates one weekly report per week.

**Week 1 starts on the kickoff date itself** — not the Monday of that calendar week. A project
starting Wednesday 30 September runs 30 Sep–6 Oct, 7–13 Oct, 14–20 Oct, 21–27 Oct, 28 Oct–3 Nov,
with go-live on 3 November. This holds for every starting weekday, and projects created under the
old Monday-aligned rule are re-dated once, with a banner saying so.

**A cycle length the sheet doesn't cover is interpolated** between the two nearest tabs — 8 weeks
sits between the 6- and 12-week plans — so new cycle lengths need no edits. **Every task appears
at every cycle length**, and Go Live is never dropped. Verified for every cycle from 2 to 12
weeks: all 100 tasks placed, no empty weeks, phases in order.

The **target go-live** is calculated, never typed. It is whichever is later: kickoff plus the
cycle length, or the last task's due date. Changing the kickoff or the cycle length re-dates every
weekly report. A task whose planned date moves into another week is re-filed into that week.

`plan-engine.js` holds these rules and is used by both the browser and the Node tools, so the app
and any generated artifact cannot disagree.

---

## 7. Screens, one by one

### Sign-in
A theme-aware sign-in card, light by default. It accepts `@webengage.com` addresses only, and
only people listed in `roles-config.json`. The password rule is at least 10 characters with
upper case, lower case, a number and a symbol. The card says plainly that this is a demo gate,
not a security control.

### Top bar and sidebar
The top bar shows the "Weekly Report" wordmark (the old "S" logo square is hidden), a project
search, the light/dark toggle, a notifications bell listing blocked and delayed items, and the
user menu (Settings, Sign out).

The sidebar holds Dashboard, Project Reports, Templates, Calendar, Team and Settings, with a
**+ New Project** button at the bottom.

### Dashboard
- **Five tiles:** Total Projects, Ongoing, Completed, Weekly Updates, Blocked/Delayed.
- **Two folders:** Ongoing projects and Completed projects.
- **Recent updates:** one row per project showing its latest week, ordered by date, up to 10.

### Projects folder (Ongoing / Completed)
Both dashboard folders open this list.

- One full-width row per project: name, and an **Active** (green) or **Idle** (grey) dot.
- A second line with domains, duration, go-live and "Updated today / N days ago".
- **Active** means something happened within 7 days: a save, the project's creation, or a new
  weekly report.
- Sorted by most recent activity, 12 at a time with **Load more**. Your place in the list is kept
  when you come back from a project.
- There is an empty state for a folder with no projects.

### Project page — details view
Opening a project always lands here.

- **Overview** (read-only): status, notes, number of weekly reports, latest range, latest status,
  and the latest tasks (the first 4, then "…and N more").
- **Integration Scope** (editable in place): platforms, channels, technical team and vendor,
  historical migration, user identifier. Changing scope does **not** regenerate existing weeks —
  that would wipe entered status. Use "Add week from template" for newly added domains.
- **Project Details** (editable form): name, CSM, project owner, sales owner, kickoff, cycle
  length, technical team, vendor and notes. Target go-live is read-only, with a line saying how
  many weeks were generated and the go-live date.
- **Timeline:** kickoff, go-live and cycle length; its Edit button opens the Project Details form.
- **Project Phases:** a strip of the 5 phases, worked out from the project's own tasks.
  - **Done** (green ✓): every task in the phase is complete.
  - **Active** (blue, numbered): the phase has this week's work or anything already started.
  - **Pending** (grey, numbered): everything else.
  - Each phase shows done/total. Its Edit button goes to Templates.
- **Actions:** + Add week from template · 📊 View Report · Edit weekly reports.
- **Delete project** sits in the header, for admins.

### Project page — report view
Opened by View Report. It shows "Project Name — Weekly Report", a Back button, the generated
report, **Generate report (PDF)** (the browser print dialog) and **Copy HTML for email**.

### Create project wizard (3 steps)
1. **Basic Details:** project name (required), CSM, project owner, sales owner, kickoff date,
   target go-live (calculated, read-only), cycle length, technical team and vendor, client points
   of contact, notes.
2. **Platform Integration:** platform cards (Website, Android, iOS, Web App, CRM), platform links,
   the nine channels, historical data migration (yes/no), user identifier (Email / Phone / User
   ID / Custom), and additional comments.
3. **Review & Summary:** **Create Project** creates the project and opens it directly. A banner
   says how many weekly reports were pre-created and clears itself after 10 seconds.

A side panel shows a running summary and a **Save as Draft** button. There is no confirmation
step any more.

### Project Reports (the weeks list)
A project picker and **+ New report**, which adds the week after the project's last and opens it.

The weeks form an **accordion**, numbered by position, with **any number of weeks open at
once**. Each row shows:
- the dates and the phase(s) the week covers;
- "4 tasks **+ 2 carried** · 0 completed", with the carried part in amber;
- the week's status;
- the buttons **Edit** and **Delete**.

The **week containing today** has a green left border, a tint and a "This week" badge.

**Edit** — and the chevron, which does the same thing — folds the week open or shut in place.
There is no separate window: the open week *is* the editor, and it holds everything that used to
need one.

- A header with Week status, Week starting, an amber **"M carried"** badge when earlier weeks
  have late work, a **Saved** indicator and **+ Add task**. The indicator is always disabled: it
  rests grey reading "Saved" and flashes green "Saved ✓" as each change is written.
- **Work carried from earlier weeks** appears at the top of the table as amber rows, each
  labelled "⬅ Carried from Week N". They are editable in place, and an edit is written to the
  week that actually owns the task, not to the week being viewed.
- A table: **Phase | Domain | Task | Owner | Completed On | Status | Comments**, then **Move…**,
  **+ Sub** (add a sub-task) and **×** (remove) on each row. Sub-tasks nest under their task.
- **Move…** lists every other week, nearest ahead first, and moves the task there, re-dating it.
  It is disabled for pinned tasks (which show 🔒 and the week they are fixed to) and for Pending
  ones.
- Setting a status to **completed** fills Completed On with today if it is blank. A carried task
  completed here stays in the table struck through rather than disappearing mid-click.
- Setting a task to **Pending** or **In Progress** copies it into the next week, **at the top of
  that week's list**, so work running past this week is the first thing seen there.
- Work **already** marked pending or in progress when its week ends is carried forward
  automatically, without anyone touching it again: on load and on opening Project Reports, every
  ended week hands its unfinished pending/in-progress work to the week after it. A task stranded
  several weeks back steps forward through each week and arrives in the current one. Only ended
  weeks forward, so the work advances one week per real week rather than filling the whole
  remaining plan at once, and a notice says how many tasks moved. The copy is a separate record and its row reads
  "⬅ Copied from Week N". Completed, delayed and blocked do not forward.
- **Everything saves as you type.** Owner fields suggest the project's team and client contacts.
- A **💾 Save Changes** button sits in the expanded week's footer. It confirms rather than
  commits — the week is already saved, so clicking it writes state again and turns green reading
  "✓ Saved". There is no unsaved-changes prompt: with several weeks open at once there is no
  single draft for one to describe, and nothing is ever lost by navigating away.
- **On a narrow screen** the accordion rows stack and the task table scrolls sideways inside its
  own box; the page itself never scrolls horizontally at any width.

There used to be a second editor — a **week modal** opened by "Open week" — which worked on a
copy of the project's weeks and saved on request. It has been removed and its functionality
folded into the accordion. Two editors over the same weeks were two places a count could
disagree, and a draft-based editor cannot allow two weeks open at once: two drafts over the same
task would clobber each other silently.

### Templates
The master plan by phase ("Phase 1 Kickoff"…). For each task you can edit:
- the scope and title;
- the platform chips;
- the priority;
- the per-cycle days, written like `4:5, 6:5, 12:5`.

Each task also shows an automatic Elastic/Fixed label and a Remove button.

Screen actions: + Add week, Reload from file, Reset to built-in, plus a warning that edits are
stored in this browser only.

### Team
A project picker, + Add member, the project's members (used for owner suggestions), and a
workload summary.

### Calendar
A month grid with previous/next buttons, and the weekly reports covering whichever date is
selected.

### Settings
- **Profile:** display name and a role label.
- **Account.**
- **Change password:** checks the current password and gives you the new hash to paste into
  `roles-config.json` — there is no server to save it.
- **Users & Roles** (admins only).
- **Update existing projects from the template:** preview, then apply, for untouched tasks only.
- **Data & Backup:** load the demo project, export or import a JSON backup, clear all test data,
  and data statistics. A clear warning explains that everything lives in this browser.

---

## 8. Carryover, Pending and Move

**Carryover is display-only.** A task stays in the week it was planned in. Later weeks *show* it
if it is late — from a week that has already ended — and still not done. The task is not copied
or moved.

Moving it automatically would rewrite history: a week that held 12 tasks would quietly hold 9,
and the record of what happened that week would change every time someone opened a later week.

**"Carried" means late, not just unfinished.** Counting every unfinished task in every earlier
week put "+14 carried" on week 6 of a brand-new project — work that simply wasn't due yet. Now:
- a project entirely in the future shows no carried work;
- the count levels off instead of growing with the plan's length;
- the accordion's count, the open editor's badge and its carried rows all use the same rule,
  so they always agree;
- the generated report shows none of it.

**Move is deliberate; forwarding is automatic on marking.**
- **Move…** sends a task to any other week and re-dates it. It is a move, never a copy. Only
  pinned tasks cannot be moved.
- **Pending or In Progress** copies the task into the next week. Marking it again does nothing
  (one copy per task per week), the last week does not forward, and nothing is ever deleted —
  completing a task stops further copies but keeps the ones made. Pinned work (SDK Set Up, User
  Tracking) forwards like anything else; the copy is not pinned, since the pin only says where
  the plan *places* the task, not that the work must finish there.
- A task already continued into a later week is not also counted as carried; its copy stands
  for it, or one job would read as two pieces of late work and then three.
- **Pending no longer moves a task.** It did until 21 September; one status cannot both move a
  task and copy it.

---

## 9. The report

**Columns**, the same in the editor and every output:

**Phase | Domain | Tasks | Owner | Completed On | Status | Comments**

Phase and Domain cells merge over consecutive rows; Domain only merges within a phase. A task
that applies to the whole project shows "All" as its domain.

**Two different dates.**
- `dueDate` is the plan. It comes from the master plan, decides which week a task belongs to, and
  can't be edited by hand.
- **Completed On** is what actually happened, and it is what the report prints.

**Removed columns.** Priority, Blockers/Risk and Planned were dropped. Neither Priority nor
Blockers/Risk had an input any more, and every task was "medium", so both printed the same value
on every row. (The demo dataset does have real priorities and blockers, so it loses those
columns.)

**Coverage.** The report covers **only the current week and the next one** — a deliberate earlier
decision (see open questions). It starts with a project summary card: project name, project
owner, client POC, status, kickoff and target go-live.

**Outputs:**
- the on-screen report view;
- **PDF** via the browser print dialog;
- **email HTML**, with all styles inline so email clients keep them. Copying puts the HTML on
  the clipboard.

The code also assembles a plain-text version, but nothing uses it — it is never shown or copied.

The printed and emailed versions keep **serif headings**, deliberately: they go to clients as a
document, while the app itself uses one sans-serif font.

---

## 10. Access control

- **Who can sign in:** email and password, `@webengage.com` only. There are currently two users:
  stuti.khare@webengage.com (**Admin**) and ajwanda.shrivastav@webengage.com (**Viewer**).
- **Roles:** Admin can do everything. Viewer is read-only across all ten capabilities: create,
  edit and delete projects; create, edit and delete reports; edit the template; manage the team;
  manage data; manage users.
- **Passwords** are SHA-256 hashes in `roles-config.json`. Adding a user or resetting a password
  means editing that file and pushing — `README-auth.md` has the steps.

**This is a gate, not security.**
- `roles-config.json` is publicly downloadable from the live site, so both email addresses and
  both password hashes can be read by anyone with the URL.
- The check runs in the browser, so it can be bypassed with developer tools.

This is fine for an internal demo, but not for real client data on a public URL. The
documentation files (this one included) are also publicly readable on the live site.

---

## 11. Design system

- **One font:** the system sans-serif stack (-apple-system, BlinkMacSystemFont, Segoe UI,
  Roboto…). The old Georgia serif headings are gone from the app.
- **Type scale:**

  | Element | Size / weight |
  |---|---|
  | Top-bar title | 18px / 600 |
  | Page and section headings | 14px / 600 |
  | Overview card titles | 15px / 700 |
  | Body | 13px |
  | Labels and small text | 12px |
  | Buttons and inputs | 13px |

- **WebEngage palette** (light theme):

  | Role | Colour |
  |---|---|
  | Accent blue | `#0066cc` |
  | Primary action orange | `#ff8c3d` (`#ff7a1f` on hover) |
  | Done green | `#52c41a` |
  | Borders | `#dce5f0` |
  | Labels | `#7b8fa3` |
  | Values | `#1a202c` |
  | Body copy | `#4a5f7f` |
  | Hover tint | `#f0f6ff` |
  | Warning amber | `#b45309` / `#fffbe6` |

- **Themes:** light is the default, and dark is fully supported through the toggle. Colours are
  theme tokens, never fixed hex. The CSS is dark-first, with `data-theme="light"` overrides.
- **Project overview cards:** white, 8px corners, a subtle shadow, and a 3px blue top rule (a
  left rule on Project Details). Buttons have 6px corners and 10px × 24px padding.
- **Phase dots:** 40px circles.

---

## 12. Tooling and maintenance

**Running locally:** `python3 -m http.server 8000` in the project folder, then open
http://localhost:8000. A `serve` skill in the workspace starts, stops and restarts it. Data is
separate per address, so localhost shows its own data.

**Releasing:**
1. Bump `CACHE_NAME` in `sw.js`.
2. Run `python3 build-standalone.py`.
3. Commit and push to `main`. Vercel deploys within about 15 seconds.
4. Users hard-refresh (⇧⌘R) to get it.

**When the Google Sheet changes:**
1. `python3 tools/import-sheet.py` — checks the sheet and reports differences; writes nothing.
2. `python3 tools/import-sheet.py --write` — updates `week-templates.json` and the built-in copy
   in `app.js`.
3. Bump `version` in `week-templates.json` **and** `WEEK_TEMPLATE_VERSION` in `app.js`.
   Otherwise browsers keep the old plan — this once made every task pile into week 1.
4. Bump the cache, rebuild, push.

The importer matches rows across the three tabs **by position**. It **refuses to write** if the
tabs disagree on length, phase or domain for any row, or if a day offset can't be read — a row
inserted into one tab alone would otherwise silently give every task below it the wrong dates.
Wording differences are only warnings. It also applies the week 1/2 pins and generates the 14
Web App tasks.

**Other tools:**
- `node tools/generate-weekly-report.js <kickoff> <cycle>` prints a plan.
- `--artifacts` rewrites the registry, the test matrix and the sample plan.
- `python3 tools/hash-password.py` prints a password hash.

**Git identity:** set for this repository only, to "Stuti Khare" and the hostname address the
earlier commits used.

---

## 13. History — what was built, in order

**10 July — start**
- The app imported from an earlier Antigravity-generated project, with a README and agent
  instructions.

**2 September — the big rebuild**
- The multi-step project wizard.
- Editable week-wise templates seeded from the old Salad Days workbook.
- Reports: tabular, oldest week first, HTML, with a project summary card.
- Project-level teams and client contacts.
- Sign-in with Admin/Viewer roles and the `@webengage.com` rule.
- Light theme by default.
- Info banners that are no longer red and dismiss themselves after 10 seconds.
- Fixes for the table overflowing sideways and a start-up error.

**3 September**
- Client Name dropped; go-live calculated; project details made editable.
- RCS and IVR channels added; Additional Information cut down to comments.
- Template wording can be pushed to existing projects.
- Day-based durations that drive the timeline.
- The wizard fitted onto one screen.
- Tasks re-filed when their date moves.
- The whole plan fitted to any cycle length — before this, short cycles dropped Go Live.

**4 September**
- The master plan replaced with the team's Google Sheet: per-cycle days, phases, owners, the Web
  App domain, channel filtering.
- Browsers re-load the plan when its version changes.
- Weeks numbered by position; the expanded week became the editor and the separate form below
  it was deleted.
- Planned date and Completed On separated.
- First version of this document.

**6 September**
- The updated sheet re-imported (86 tasks); the shared `plan-engine.js` created.
- The safe, repeatable sheet importer.
- The integration guide.
- The report's scope column split into Phase and Domain.
- The current week highlighted.

**7 September**
- Report columns reordered; Priority and Blockers dropped; "Task / Milestone" renamed "Tasks".
- The project page split into details and report views, then rebuilt as a card grid with the
  WebEngage palette and the phase strip.
- The week editor: carryover, the per-task status dropdown, the Pending status, and the
  carried-from label that survives saving.

**8 September**
- SDK setup pinned to week 1 and user tracking to week 2.
- The projects folder rebuilt with activity and paging, then stacked one project per row.
- The folder buttons changed to open the list, then reverted.
- The wizard's confirmation step removed.

**9 September**
- Recent updates show one row per project.
- The folder buttons open the list again.

**10 September**
- One font and type scale for the whole app; the logo square hidden.

**11 September**
- Shift-to-next-week replaced by Move-to-any-week.
- Carried counts in the accordion and the week editor's header.
- The accordion now refreshes when data changes elsewhere.
- The "Saved" indicator in the inline editor.

**16 September**
- A Save button added to the week modal's header, then removed on request; change detection and
  the leave prompts were kept.

**7 October**
- **Weeks now start on the project's kickoff date** rather than the Monday of that week, for new
  projects, re-dates and (once, on load) existing ones.
- **The report now covers last week then this week**, in that order — what was delivered before
  what is still in hand. It used to show the current week and the one after it.
- **Report week numbers fixed.** They came from `templateWeek`, which holds the master-plan
  phase a week's first task came from, so a report could print "Week 2" twice. They are now
  numbered by position in the project, as the accordion already did.

**5 October**
- **Automatic carry-forward:** pending and in-progress work is no longer only forwarded at the
  moment someone changes the status — a sweep moves anything still open when its week ends into
  the following week, chaining up to the current week. Deleting a forwarded copy keeps it
  deleted.

**21 September**
- **Auto-forwarding:** marking a task Pending or In Progress copies it into the next week as an
  independent record labelled "⬅ Copied from Week N". Pending stopped moving tasks. Trade-off
  accepted: a task forwarded across six weeks prints six times in the client report.
- **The week modal removed and all week editing consolidated into the Project Reports
  accordion.** "Edit" now folds a week open in place, several weeks can be open at once, and the
  open editor carries everything the modal did: carried rows, Move…, Pending, the status
  dropdown, Completed On, Comments and task/sub-task CRUD. Nothing is held in a draft, so the
  footer's Save Changes button confirms rather than commits and there is no unsaved-changes
  prompt. The page no longer scrolls sideways at any width; only the task table does.

---

## 14. Decisions already taken

- **No Google sign-in.** Demo and internal use only: basic login with a strong password rule.
- **Two roles only,** Admin and Viewer.
- **Go-live is calculated,** never entered. The cycle length is a plan, not a ceiling.
- **The Google Sheet is the source of truth** for timings; the tool never invents dates. Sheet
  mistakes are imported as written and reported, not silently fixed.
- **Every task appears at every cycle length.**
- **SDK Set Up and User Tracking are pinned** to weeks 1 and 2. No new tasks were added for this:
  the existing ones were moved, and CRM gets no SDK setup.
- **Web App is its own domain,** copying Website with Android/iOS timing.
- **Carryover is display-only;** carried means late.
- **Moving a task is always deliberate;** forwarding a task is automatic when it is marked
  Pending or In Progress, and copies rather than moves.
- **Only pinned tasks can't be moved.**
- **Copies are never auto-deleted.** Completing work stops further copies; it does not remove
  copies already made, which someone may have typed into.
- **Each copy's Completed On is its own** — inheriting it would claim work finished in a week it
  did not.
- **The week editor saves as you type.** There is one editor, in the accordion, and no draft:
  that is what allows several weeks to be open together, since two drafts over the same task
  would clobber each other. The footer's Save Changes button confirms rather than commits,
  chosen on 21 September over a permanently disabled one.
- **The report stays a truthful record** of each week: no carried rows. Its columns are Phase |
  Domain | Tasks | Owner | Completed On | Status | Comments.
- **Owners** come from the sheet's role names plus each project's team and client contacts.
- **Colours are theme tokens.** Light matches the WebEngage palette exactly, and dark still works.
- **One app font;** client documents keep serif headings.
- **The project wizard has three steps,** with no confirmation step.
- **Both dashboard folders open the projects list.**
- **The GitHub token feature was built, then removed** rather than keep a real credential in
  browser storage.
- **The old hard-coded onboarding checklist was deleted** — the sheet replaces it.

---

## 15. Things deliberately not built

These came up in requests and were declined or changed, with reasons.

- **Auto-shift that copies unfinished tasks into the next week.**
  - It would put the same task in two weeks, double-counting it.
  - Its loop would push one Pending task from week 1 into all twelve weeks.
  - Display-only carryover already covers the need.
- **A rewrite of every colour into a new token system.**
  - The theme system already works in light and dark mode.
  - The rewrite would touch 3,800 lines with no visible change.
- **Add-on script files that patch the page after it renders.** In practice they:
  - would have overwritten the "Week 2" label with a task count;
  - would have been wiped out on every keystroke.

  The same features were built into the app itself instead.
- **Standalone replacement HTML files** from the web app. They don't exist on this machine, and
  pasting one in would have replaced the working screens.
- **A six-phase strip with "Discovery".** Discovery is a task inside Kickoff, and phase states
  are calculated rather than hard-coded.
- **Clicking a single field to edit it** on the overview cards. Editing is per card, via the
  Edit buttons.
- **A blue "click to save" button in the inline editor.** It already saves as you type, so the
  button could never truthfully have unsaved work to save.
- **Colour rules that would break the app:**
  - making every button's text blue (it would turn the orange buttons' labels blue);
  - fixing the page background to light colours (it would break dark mode).
- **A full lock on weeks 1–2**, with disabled checkboxes and dropdowns and week 2 blocked until
  week 1 is done. The request contradicted itself: it also said opening week 2 marks week 1
  complete.

---

## 16. Things that were changed and then changed back

- **Dashboard folder buttons:** first made to open the list, then reverted to jump straight into
  the first project, then made to open the list again (current).
- **Week modal header Save:** added on 16 September, removed the same day. The footer button went
  from "Save & close" back to "Save Changes". The modal itself was removed on 21 September, so
  both are moot.
- **Shift to next week:** replaced by Move… to any week.
- **Scheduling:** first spread tasks across weeks by guesswork, then driven by the sheet's
  per-cycle days (current).

---

## 17. Open questions and known issues

**Need a decision**
1. **The week editor's "Saved" indicator:** keep it or remove it? It cannot ever report unsaved
   work, since the editor writes on every change.
2. **Page heading size:** page headings are 14px, smaller than the 18px top-bar title. A
   one-line change would make them 20px.
3. **Serif headings in the PDF and email:** match the app's sans-serif, or keep them?
4. **Recent updates** show each project's *final* week, which can be months ahead. Showing the
   week containing today may be more useful.
5. **Changing "Week starting"** renames the week but doesn't re-date its tasks.

**In the sheet, not the tool**

6. **Production channel setup is scheduled too early.** Email, SMS, WhatsApp, RCS and IVR setup
    in the *Production* phase are due at N+10 in the Week 6 tab and N+21 in Week 12. Create
    Production Dashboard is at N+21 and N+42, so the setup work lands before the dashboard it
    configures. The Week 4 tab has it right (N+22/23, after N+21).
7. **Five phases, not six:** designs have asked for a "Discovery" phase, but it is a task inside
    Kickoff.

**Security and exposure**

8. **The live site serves the docs and `roles-config.json` publicly**, including both email
    addresses and password hashes. A small `vercel.json` could block the `.md` files. The roles
    file must stay readable for sign-in to work.

---

## 18. Deferred backlog

1. **Raise a GitHub pull request for access changes** using a fine-grained access token. It was
   built once and removed: a token in the browser is a real credential somewhere it can't be
   protected. Decide who holds it and how first.
2. **Real accounts with roles enforced by a server,** via Supabase. The schema is written; this
   would also give password resets by email.
3. **Sharing projects between users.** This needs proper database tables rather than one saved
   blob per person.

---

## 19. Notes for anyone writing a change request

Change requests drafted outside the code have repeatedly guessed at names and structures that
don't exist here. The real ones:

- **Storage:** one key, `multi-project-dashboard-state`, with `projects` and `updates` as
  separate arrays — not `project_<id>` keys, and not weeks nested inside projects.
- **Project fields:**
  - status is `"current"` / `"closed"` (not `"active"`);
  - domains are `platforms` (not `domains`);
  - cycle length is `cycleWeeks` (not `cycleLength`);
  - activity comes from `updatedAt` / `createdAt` — there is no `lastUpdated` or `isOnline`.
- **Report data:** there is no `project.reports`. A week has `weekStart` and a pre-formatted
  `weekRange`, not `weekEnd`.
- **There is no "General" domain.** A task that applies to everyone has an empty `platforms`
  list. A filter on `domain === "General"` would drop all 12 always-on tasks, including Kickoff
  and Go Live.
- **Class names:**
  - projects list: `.project-card`, `.project-card-head`, `.project-card-rows`,
    `.project-card-row`, `.project-card-foot` — not `.project-card-content`;
  - accordion: `.report-row`, `.meta`, `.report-row-range`, `.template-week-badge`;
  - week editor: `.week-editor`, `.week-editor-head`, `.report-row-task-table`,
    `.week-task-row` (`.is-carried`, `.is-pinned`, `.is-pending`, `.is-resolved`),
    `.week-task-actions`, `.week-task-move`, `.week-task-source`. There is no longer any
    `#weekModal*` element or `weekDraft` state — the modal was removed.
- **Screens and views:**
  - the projects list is `#categoryScreen`;
  - the project page's two views are toggled together, not as separate screens;
  - the wizard's steps are panels inside one screen.
- **Showing and hiding:** there is a global `[hidden] { display: none !important }`, so toggling
  `style.display` won't work — use the `hidden` attribute.
- **Colours:** fixed hex values break dark mode.
- **Scheduling engine:** `plan-engine.js` exports `cyclesWithData`, `baseCycle`, `roundHalfDown`,
  `resolveTaskOffset`, `isElastic`, `weekIndexFor`, `placementFor` and `distribute`.
  `generateWeeklyReport(kickoff, cycle)` lives in `tools/generate-weekly-report.js` and takes
  plain arguments, not an options object.
- **Files from the web app don't reach this machine.** Paths like `/mnt/user-data/outputs/…` or
  `/tmp/…` created in the Claude web app never arrive here. Paste the content, or describe the
  change.
- **Check the date of this document** before relying on it, and regenerate it after further
  changes.
