# Integration guide

**Status: the engine is already integrated and live.** There is no integration phase to hand
to anyone. This document describes how the running system fits together, and corrects an
earlier draft guide that described a different design.

Verified on the deployed site: `plan-engine.js` returns HTTP 200, `index.html` loads it before
`app.js`, and `app.js` calls into it at five places. Creating a project in the browser and
running the Node tool for the same inputs produce identical week counts.

---

## What exists

| File | Role |
|---|---|
| `week-templates.json` | The data: 100 tasks, each with `offsetByCycle` per cycle length |
| `plan-engine.js` | The rules: interpolation and week bucketing. **No data.** |
| `app.js` | The dashboard, which calls the engine |
| `tools/generate-weekly-report.js` | CLI generator + validator, uses the same engine |
| `tools/import-sheet.py` | Re-import from the Google Sheet, with an alignment guard |
| `artifacts/*.json` | Registry, cycle 2–12 test matrix, sample 5-week report |

`plan-engine.js` is loaded as a plain `<script>` in the browser and `require`d in Node, so the
dashboard and the tooling cannot disagree about when a task is due.

---

## The real API

`plan-engine.js` exports:

```js
cyclesWithData(meta)                       // cycle lengths the sheet plans for -> [4, 6, 12]
baseCycle(meta)                            // 4
roundHalfDown(value)                       // interpolation rounding
resolveTaskOffset(task, cycleWeeks, meta)  // completion offset in days from kickoff
isElastic(task)                            // does this task's offset move with cycle length
weekIndexFor(offset, cycleWeeks, lead)     // which project week an offset lands in
distribute(tasks, cycleWeeks, meta, lead)  // group a task list into per-week buckets
```

It does **not** export `generateWeeklyReport`. That lives in the CLI tool, and takes positional
arguments:

```js
const { generateWeeklyReport, validate } = require("./tools/generate-weekly-report.js");
const report = generateWeeklyReport("2026-09-07", 5);   // not an options object
```

```bash
node tools/generate-weekly-report.js 2026-09-07 5          # print a plan
node tools/generate-weekly-report.js 2026-09-07 5 out.json # write it
node tools/generate-weekly-report.js --artifacts           # regenerate artifacts/
```

---

## How a project becomes weekly reports

`generateWeeklyPlan(project)` in `app.js`:

1. **Filter first.** `templateTasksForProject()` drops tasks whose `platforms` do not match the
   project's domains, and whose `channels` do not match its channels. Filtering happens *before*
   distribution, not in the UI afterwards — the week counts have to reflect the project's real
   scope.
2. **Resolve each task's offset** for this cycle via `PlanEngine.resolveTaskOffset`.
3. **Bucket into weeks** via `PlanEngine.weekIndexFor`. Week 1 is the week the kickoff falls in,
   so an N+0 task lands in it whatever weekday the project starts on.
4. **Create one `update` per week**, each holding its tasks with `dueDate` = kickoff + offset.

Task-to-project filtering is by **`platforms`** and **`channels`**, both already tagged on every
task (37 of the 100 carry channels). There is no `General` domain — a task that applies to every
project has an **empty** `platforms` array, which is what makes it universal.

---

## How data is stored

One localStorage key holds the whole state — not one key per project:

```js
const STATE_KEY = "multi-project-dashboard-state";
// { projects: [...], updates: [...], weekTemplates: [...], settings, ... }
```

`projects` and `updates` are separate top-level arrays; an update points at its project by
`projectId`. Weeks are **not** nested inside the project object. Anything that writes
`project_<id>` keys, or nests `weeks` inside a project, is writing a schema the app does not
read.

Generated planned dates and user edits live on the same task object but in different fields:
`dueDate` is the plan, `date` is when the work actually finished, plus `status`, `owner` and
`comments`.

---

## Maintenance

**When the sheet changes:**

```bash
python3 tools/import-sheet.py            # check and report drift, writes nothing
python3 tools/import-sheet.py --write    # update week-templates.json + app.js seed
```

Then bump `version` in `week-templates.json` **and** `WEEK_TEMPLATE_VERSION` in `app.js` so
existing browsers re-seed, bump `CACHE_NAME` in `sw.js`, and run `python3 build-standalone.py`.

The importer pairs rows across tabs by position and refuses to write if the tabs stop agreeing
on length, phase or domain — a row inserted into one tab alone would otherwise pair every task
below it with another task's offsets and produce a plausible, wrong schedule.

`tools/import-sheet.py --write` updates `week-templates.json` and the seed in `app.js`. It does
**not** touch `plan-engine.js`, which holds no data.

---

## Corrections to the earlier draft guide

Recorded so nobody works from it:

| Draft said | Actually |
|---|---|
| "Engine integration: your dev team, 1–2 days" | Already integrated and live |
| `cp plan-engine.js your-app/src/core/` | There is no separate app; copying it forks the engine |
| `engine.generateWeeklyReport({kickoffDate, cycleLength})` | Not exported from the engine; the CLI takes positional args |
| `--cycle 5 --kickoff 2024-09-04` | `node tools/generate-weekly-report.js 2026-09-07 5` |
| "Current flow (broken): hard-coded task list" | Generation from the master plan already works |
| "TODO: add channel filtering when channels are tagged" | Channels are tagged and filtered today |
| "Filtering happens in the UI layer, not the engine" | It happens before distribution, by design |
| `localStorage['project_abc123'] = {... weeks: [...] }` | One state key; `projects` and `updates` are separate arrays |
| `import-sheet.py --write` updates `plan-engine.js` | It updates `week-templates.json` and the `app.js` seed |
| Filter on `domains.includes(d) \|\| d === 'General'` | No `General` domain exists — this drops 24 universal tasks, including all 6 Kickoff tasks, Training and Go Live |

The draft's project-creation snippet would also generate all 100 tasks regardless of the
project's domains, so a website-only project would show Android and iOS work.
