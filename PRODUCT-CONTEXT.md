# Weekly Report Dashboard — product context

Context dump for discussing this product away from the codebase. Everything below reflects
what is actually built and live as of 4 September 2026, not what is planned.

---

## 1. What it is

An internal tool for WebEngage onboarding managers to track client integration projects week
by week and produce a weekly status report for the client.

- **Owner:** Stuti Khare (stuti.khare@webengage.com)
- **Audience:** her team — WebEngage OBMs and project owners
- **Live at:** https://weekly-report-dashboard-one.vercel.app/
- **Status:** working, in use for demo/internal purposes

A project is created once with a kickoff date, a cycle length and the domains/channels in
scope. The tool then generates the full week-by-week task plan for that project from a master
plan, and the team fills in status each week and generates a client-facing report.

---

## 2. How it is built (constraints worth knowing)

Plain HTML, CSS and JavaScript. **No framework, no build step, no backend, no dependencies.**
About 4,700 lines of JS, 3,000 of CSS, 680 of HTML. Deployed as static files on Vercel.

**All data lives in the browser's `localStorage`.** There is no server. This drives several
real limitations that shape what is worth proposing:

- Each person's dashboard is entirely their own. **Projects cannot be shared between users.**
- Clearing browser data loses everything. There is no backup or sync.
- Two people cannot collaborate on the same project.
- Data is per-origin, so the live site and a local copy hold separate data.

There is a `build-standalone.py` that inlines everything into a single portable
`weekly-report-dashboard.html` that runs by double-clicking, with no server.

A Supabase backend (real accounts, per-user cloud storage, row-level security) is **written but
not switched on** — schema and setup notes exist, the app ignores them.

---

## 3. The master plan — the core product concept

Everything the tool generates comes from one master plan, held in `week-templates.json` and
generated from the team's Google Sheet:

https://docs.google.com/spreadsheets/d/1szgspVwOpiUgsS3DKoybF_UKB8t6LXRNXBAnr_pmO7E/edit

The sheet has **three tabs — Week 4, Week 6, Week 12** — holding the *same* task list with
different timings. That structure is the heart of the scheduling model.

**109 tasks across 5 phases:**

| Phase | Tasks |
|---|---|
| 1. Kickoff | 6 |
| 2. Staging Deployment | 55 |
| 3. Production Deployment | 41 |
| 4. Training and Use-Cases | 6 |
| 5. Go Live | 1 |

95 tasks come from the sheet; 14 are a **Web App** domain that is not in the sheet — it mirrors
the Website tasks with Android/iOS timing, per a decision recorded below.

**Domains** (tasks are tagged, and only generate if the project selected that domain):
Website (14), Web App (14), Android (20), iOS (20), Rest API / shown as "CRM" (7),
Communication Channels (23), plus 11 general tasks that apply to every project.

**Channels** (a second filter — Email, SMS, WhatsApp, RCS, IVR, Push, Web Push, In-App,
On-site Notification). A channel-specific task only appears if the project uses that channel.
So a website-only project using just Web Push gets 26 tasks, not 109.

**Every task carries its completion date as a day offset from kickoff, per cycle length.**
This is where the tool's central rule lives:

| Task | Week 4 plan | Week 6 plan | Week 12 plan |
|---|---|---|---|
| SDK Set Up (any domain) | N+5 | N+5 | N+5 |
| Event Tracking (Website) | N+7 | N+10 | N+17 |
| Event Tracking (Android / iOS / Web App) | N+10 | N+15 | N+30 |

Fixed work (SDK setup, user tracking, push, deeplinking) takes the same time regardless of
project length. **Event tracking is the elastic part that absorbs the project length.** 80 of
the 109 tasks have an offset that varies by cycle; 29 are fixed. This is the team's own data,
not a rule the code infers.

The master plan is **fully editable in the app** (Templates screen) — tasks, domains, channels,
owners and the per-cycle offsets — without touching the sheet or the code.

---

## 4. How a project becomes weekly reports

At project creation the tool takes the kickoff date, cycle length (2–12 weeks, default 5) and
the selected domains and channels, then:

1. Filters the 109 tasks down to those matching the project's domains and channels
2. Looks up each task's completion offset for that cycle length
3. Files each task into the week containing kickoff + offset
4. Creates one weekly report per week of the cycle

**A cycle length with no tab in the sheet is interpolated** between the two nearest ones — an
8-week project sits between the 6- and 12-week plans. So new cycle lengths need no edits.

**Every task appears at every cycle length.** A 4-week project and a 12-week project contain
the same 109 tasks, differently spread. Go Live is never dropped.

Worth knowing for product discussions:

- **Week 1 is heavy.** It holds every task due in days N+0 to N+6 — 24 tasks in an all-domains
  project, because the sheet puts 18 tasks at N+5. That is the sheet's arithmetic, not a bug.
- **Some weeks can be empty.** The Week 12 plan has nothing due in days 21–27 or 42–48, so
  those weeks show "No tasks due". Again the sheet's own shape.
- Both are fixed by editing the sheet's offsets, not the tool.

---

## 5. Screens and what they do

**Dashboard** — projects split into Current and Closed.

**Project page** — overview, editable project details (name, CSM, project owner, sales owner,
kickoff, cycle length, target go-live, technical team, vendor, notes), the list of weekly
updates, and the generated client report with *Generate report (PDF)* (print dialog) and
*Copy HTML for email* (inline-styled HTML that survives email clients).

**Project Reports** — the weekly reports for a project as a **collapsible accordion**, one week
open at a time. Each row shows week number, dates, phase, task count, completed count and
status. **The open week is the editor**: task, domain, owner, Planned date, Completed On date,
status and comments, with sub-tasks nested underneath. Everything saves as you type.

Two date columns, deliberately distinct:
- **Planned** — from the master plan; decides which week a task sits in
- **Completed On** — when the work actually finished; **this is what the report prints**.
  Marking a task completed fills it with today's date if blank.

**Templates** — the master plan, fully editable: phases, tasks, domains, channels, owners,
per-cycle offsets. Tasks are marked Elastic or Fixed automatically based on whether their
offset varies by cycle.

**Team** — team members per project. Only that project's people appear in it. Owner fields
across the app suggest from the project's team and client POCs.

**Calendar** — tasks by date.

**Settings** — account, change password, demo data, clear data.

---

## 6. Access control

Sign-in by email and password. **`@webengage.com` addresses only**; anything else is rejected.
Two roles:

- **Admin** — everything (create/edit/delete projects and reports, edit the master template,
  manage team, manage users and data)
- **Viewer** — read-only across all ten capabilities

Currently one user: stuti.khare@webengage.com (admin).

Passwords are stored as SHA-256 hashes in `roles-config.json`, with a strong policy enforced
(10+ chars, upper, lower, number, symbol).

**Important limitation:** this is a gate, not security. `roles-config.json` is publicly
fetchable on the deployed site, so the hashes are readable by anyone with the URL, and the
check happens in the browser so it is bypassable through DevTools. Fine for an internal demo;
not suitable for real client data on a public URL. Adding a user or resetting a password means
editing that file and pushing — the browser cannot write to it.

---

## 7. Product decisions already taken (with reasons)

Recorded so they are not accidentally re-opened:

- **No Google OAuth.** Explicitly dropped — demo and internal use only, basic login with a
  strong password pattern instead.
- **Two roles only**, Admin and Viewer.
- **Task owners come from the project's POCs and team**, not from the master template. Owner
  values were deliberately cleared from the template once; the new sheet reintroduced role-type
  owners (Webengage OBM, Client tech team, Cpaas / Client team) which are now used.
- **Priority is task-level only**, removed from project creation.
- **Client Name removed** from project creation; the project name covers it.
- **Target go-live is calculated** from kickoff + cycle length, not entered.
- **The cycle length is a plan, not a ceiling** — go-live is whichever is later, the end of the
  cycle or the last task to finish.
- **Reports are chronological, Week 1 first**, tabular with headings, HTML output, scoped to
  the current and upcoming week, with a project summary card in the first fold showing exactly:
  project name, project owner, client POC, status, kickoff, target go-live.
- **The GitHub PAT feature was built, then deliberately removed** before shipping rather than
  put a real credential in browser storage.
- **The old hard-coded onboarding checklist was deleted** — the Google Sheet master plan
  supersedes it.

---

## 8. Open issues in the source sheet (needs a decision)

Two problems in the Google Sheet were imported **as written** rather than silently corrected,
because it is the team's data:

1. **Production channel setup is mis-timed in the Week 6 and Week 12 tabs.** The five
   *Production* rows (Email/SMS/WhatsApp/RCS/IVR setup) still carry the staging value **N+10**,
   while the Week 4 tab correctly has N+22. In the 12-week plan the production dashboard is not
   created until N+35, so those five tasks currently schedule 25 days before the dashboard they
   configure. Correcting them to N+27 (6wk) and N+40 (12wk) moves 5 tasks from week 2 to week 9.

2. **The Week 12 plan has gaps.** Offsets jump N+17 → N+30 → N+35, so nothing is due in days
   21–27 or 42–48 and weeks 4 and 7 appear empty.

Also worth a view: **week 1 carries 24 tasks** in an all-domains project because the sheet puts
18 tasks at N+5.

---

## 9. Deliberately deferred

- **Raising a GitHub PR for access changes** via a fine-grained PAT — built once, removed. A
  PAT in the browser is a real credential in a place that cannot protect it. Roughly an hour to
  rebuild once the token-handling question is decided.
- **Real accounts and server-enforced roles** via Supabase — schema and setup notes written,
  not switched on. Would also give self-service password resets by email.
- **Sharing projects across users** — needs proper tables rather than one JSON blob per user.
  The existing role matrix carries over unchanged.

---

## 10. If you are proposing changes

Useful things to keep in mind:

- No backend and no build step is a deliberate constraint, not an oversight.
- Anything involving multiple people seeing the same project needs the Supabase work first.
- The master plan is data, editable in the UI — changes to task lists, timings, domains or
  channels usually do **not** need code.
- The sheet is the source of truth for timings; the tool should not invent dates.
- Cycle lengths other than 4, 6 and 12 are interpolated, so adding a new one needs no work.
