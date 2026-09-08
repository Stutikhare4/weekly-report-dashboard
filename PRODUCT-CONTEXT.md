# Weekly Report Dashboard — product context

Context dump for discussing this product away from the codebase. Everything below reflects what
is actually built and live as of 7 September 2026 (commit `1c1ee28`), not what is planned.

---

## 1. What it is

An internal tool for WebEngage onboarding managers to track client integration projects week by
week and produce a weekly status report for the client.

- **Owner:** Stuti Khare (stuti.khare@webengage.com)
- **Audience:** her team — WebEngage OBMs and project owners
- **Live at:** https://weekly-report-dashboard-one.vercel.app/
- **Status:** working, in use for demo and internal purposes

A project is created once with a kickoff date, a cycle length and the domains and channels in
scope. The tool then generates the full week-by-week task plan from a master plan, and the team
works each week and generates a client-facing report.

---

## 2. How it is built (constraints worth knowing)

Plain HTML, CSS and JavaScript. **No framework, no build step, no backend, no dependencies.**
About 5,100 lines of JS, 3,600 of CSS, 770 of HTML. Deployed as static files on Vercel.

**All data lives in the browser's `localStorage`** under one key,
`multi-project-dashboard-state`, holding `projects` and `updates` as separate arrays. There is
no server, which drives real limits worth knowing before proposing features:

- Each person's dashboard is entirely their own. **Projects cannot be shared between users.**
- Clearing browser data loses everything. There is no backup or sync.
- Two people cannot collaborate on the same project.

`build-standalone.py` inlines everything into a single portable `weekly-report-dashboard.html`
that runs by double-clicking. A Supabase backend (real accounts, cloud storage, row-level
security) is **written but not switched on**.

---

## 3. The master plan — the core concept

Everything generated comes from one master plan in `week-templates.json`, imported from the
team's Google Sheet:

https://docs.google.com/spreadsheets/d/1szgspVwOpiUgsS3DKoybF_UKB8t6LXRNXBAnr_pmO7E/edit

The sheet has **three tabs — Week 4, Week 6, Week 12** — holding the same task list with
different timings. That structure is the heart of the scheduling model.

**100 tasks across 5 phases:** Kickoff (6), Staging Deployment (50), Production Deployment (37),
Training and Use-Cases (6), Go Live (1).

86 come from the sheet; 14 are a **Web App** domain that is not in the sheet — it mirrors the
Website tasks with Android/iOS timing, by decision.

**Domains** (tasks generate only if the project selected that domain): Website 14, Web App 14,
Android 19, iOS 20, Rest API / shown as "CRM" 9. A task is tied to no platform when its
`platforms` array is **empty** — there is no "General" domain. 24 tasks are like that: the 13
Communication Channels ones (filtered by channel instead), plus 12 that run on every project
regardless — Kickoff 6, Training 3, Create Production Dashboard, Go Live, and the historical
uploads.

**Channels** are a second filter (Email, SMS, WhatsApp, RCS, IVR, Push, Web Push, In-App,
On-site Notification). A website-only project using just Web Push gets 24 tasks, not 100.

**Every task carries its completion date as a day offset from kickoff, per cycle length:**

| Task | Week 4 | Week 6 | Week 12 |
|---|---|---|---|
| SDK Set Up (Website) | N+5 | N+5 | N+14 |
| Event Tracking (Website) | N+10 | N+15 | N+21 |
| Event Tracking (Android / iOS) | N+10 | N+15 | N+35 |
| Go Live | N+27 | N+40 | N+82 |

98 of the 100 tasks have an offset that varies by cycle; only Kick-off Meeting and Discovery are
fixed. Elasticity is therefore **data**, not a rule the code applies.

The plan is fully editable in the app (Templates screen) without touching the sheet or the code.

---

## 4. How a project becomes weekly reports

Cycle length is 2–12 weeks, default 5. At creation the tool:

1. Filters the 100 tasks to those matching the project's domains **and** channels
2. Looks up each task's completion offset for that cycle length
3. Files each task into the week containing kickoff + offset
4. Creates one weekly report per week

**A cycle the sheet does not plan for is interpolated** between the two nearest — 8 weeks sits
between the 6- and 12-week plans — so new cycle lengths need no edits. **Every task appears at
every cycle length**; Go Live is never dropped. Verified across cycles 2–12: all tasks placed,
no empty weeks, phases in order.

`plan-engine.js` holds the scheduling rules and is loaded by the browser *and* required by the
tooling, so the app and any generated artifact cannot disagree.

---

## 5. Screens

**Dashboard** — projects split into Current and Closed.

**Project page — two views.**
*Details*: a card grid — Overview and Integration Scope side by side, Project Details and
Timeline below, a full-width phase strip, then the actions. Integration Scope is editable in
place (platforms, channels, technical team, historical migration, user identifier); before this
it could only be set at creation. The phase strip is **derived**: each phase is done when all
its tasks are, active when it holds this week's work or anything started, pending otherwise.
*Report*: the generated weekly report on its own, with Generate report (PDF) and Copy HTML for
email.

**Project Reports** — the weeks as a collapsible accordion, one open at a time, with the week
containing today marked. Each row opens two ways:
- **Edit** expands an inline table — Phase, Domain, Task, Owner, Completed On, Status, Comments,
  with sub-tasks nested. Saves as you type.
- **Open week** opens a focused modal for triaging that week (below).

**Week modal** — what is still outstanding from earlier weeks, what is planned for this one, a
status dropdown per task, tick to complete, shift to next week, add a task. Edits a deep copy,
so Save is a real commit and Back genuinely discards.

**Templates** — the master plan, fully editable: phases, tasks, domains, channels, owners,
per-cycle offsets. **Team** — members per project. **Calendar** — tasks by date.
**Settings** — account, change password, demo data, clear data.

---

## 6. Two ideas that shape the whole tool

**Carryover is display-only.** A task stays owned by the week it was planned in. Earlier weeks'
unfinished work is *shown* in later weeks labelled with its source. Moving it automatically
would rewrite history — a week that held 12 tasks would quietly hold 9, and the record of what
happened that week would change every time someone opened a later one. Moving between weeks is
always a deliberate action: **Shift to next week**, or setting a task to **Pending**.

**Pending** means work is deliberately being carried in the week it now sits in, rather than
merely unfinished. Choosing it moves the task into the week being triaged, keeps its
"carried from Week N" label, and disables Shift — the task has just been pinned there.

Task statuses: not started, in progress, delayed, blocked, completed, **pending**.
Week statuses: not started, on track, needs attention, blocked, completed.

---

## 7. The report

Columns, in the editor and every output: **Phase | Domain | Tasks | Owner | Completed On |
Status | Comments**. Phase and Domain merge vertically over their runs.

Two dates are distinct: `dueDate` is the plan (from the master offsets, decides which week a
task sits in, not editable by hand); **Completed On** is what actually happened and is what the
report prints. Marking a task completed fills it with today if blank.

Priority and Blockers/Risk were removed — neither had an input, and every task was "medium", so
both printed the same value on every row.

**The report covers only the current week and the next one** — a deliberate earlier decision.
Now that the report has a page of its own, showing all weeks is an open question.

Output as: on-screen, print/PDF, inline-styled HTML for email, and plain text.

---

## 8. Access control

Email and password, **`@webengage.com` only**. Two roles: **Admin** (everything) and **Viewer**
(read-only across ten capabilities). Currently one user: stuti.khare@webengage.com (admin).
Passwords are SHA-256 hashes in `roles-config.json`, policy enforced (10+ chars, upper, lower,
number, symbol).

**This is a gate, not security.** `roles-config.json` is publicly fetchable on the deployed
site, so the hashes are readable by anyone with the URL, and the check happens in the browser so
it is bypassable through DevTools. Fine for an internal demo; not suitable for real client data
on a public URL. Adding a user or resetting a password means editing that file and pushing.

---

## 9. Decisions already taken (so they are not re-opened)

- **No Google OAuth** — demo and internal use only, basic login with a strong password pattern.
- **Two roles only**, Admin and Viewer.
- **Task owners** come from the sheet's role-type values (Webengage OBM, Client tech team,
  Cpaas / Client team) and the project's POCs and team.
- **Target go-live is calculated** from kickoff + cycle length, never entered. Go-live is
  whichever is later — the end of the cycle, or the last task to finish — so the cycle is a
  plan, not a ceiling.
- **The GitHub PAT feature was built, then deliberately removed** rather than put a real
  credential in browser storage.
- **The old hard-coded onboarding checklist was deleted** — the sheet supersedes it.
- **Colours are theme tokens, not fixed hex.** Light matches the WebEngage palette exactly
  (`#0066cc` accent, `#ff8c3d` primary, `#52c41a` done); dark keeps the same roles at usable
  contrast, since `#0066cc` on a dark ground would be near-invisible.

---

## 10. Open questions and known issues

**Needs a decision:**

1. **The report shows only the current + upcoming week.** Should the report page show all weeks?
   Options: keep as-is; show all; or all on screen with current+upcoming in the PDF/email.
2. **Three editing surfaces** now exist for the same weeks — the accordion's inline table, the
   week modal, and the report view. The modal handles status, shifting and carryover; the
   accordion adds Owner and Completed On. Worth deciding whether to retire one.
3. **Per-field click-to-edit** was specified for the overview cards but is not built — editing
   is per-card via Edit buttons.

**In the sheet, not the tool:**

4. **Tab wording has drifted.** 11 rows name the same work differently across the three tabs
   (Week 6 still says "Fixes or Changes"; Week 12 renamed three Android audit rows). The
   importer matches rows **by position**, which still aligns exactly, and refuses to run if that
   stops being true — so this is a readability issue, not a correctness one.
   `python3 tools/import-sheet.py` lists the exact cells.
5. **Five phases, not six.** Designs have asked for a "Discovery" phase; Discovery is a *task*
   inside Kickoff in the master plan.

**Deliberately deferred:**

6. GitHub PR creation for access changes via a fine-grained PAT — built once, removed.
7. Real accounts and server-enforced roles via Supabase — schema written, not switched on.
8. Sharing projects across users — needs proper tables rather than one JSON blob per user.

---

## 11. If you are proposing changes

- No backend and no build step is a deliberate constraint, not an oversight.
- Anything involving multiple people seeing the same project needs the Supabase work first.
- The master plan is data, editable in the UI — changes to task lists, timings, domains or
  channels usually need **no code**.
- The sheet is the source of truth for timings; the tool should not invent dates.
- The app is theme-aware. Fixed hex colours and `style.display` toggles both break it — there is
  a global `[hidden] { display: none !important }`.
- Re-importing the sheet: `python3 tools/import-sheet.py` checks and reports drift;
  `--write` updates the plan and the seed. Then bump `version` in `week-templates.json`,
  `WEEK_TEMPLATE_VERSION` in `app.js` and `CACHE_NAME` in `sw.js`, and run `build-standalone.py`.
