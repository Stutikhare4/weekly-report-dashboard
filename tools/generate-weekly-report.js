#!/usr/bin/env node
/* Generate a weekly plan for any cycle length, using the dashboard's own scheduling engine.
 *
 *   node tools/generate-weekly-report.js <kickoff YYYY-MM-DD> <cycle 2-12> [outfile.json]
 *   node tools/generate-weekly-report.js --artifacts        writes the three review artifacts
 *
 * The engine is plan-engine.js, the same file the browser loads, so anything produced here
 * matches what the dashboard shows for the same inputs.
 */
const fs = require("fs");
const path = require("path");
const PlanEngine = require("../plan-engine.js");

const ROOT = path.join(__dirname, "..");
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "week-templates.json"), "utf8"));
const meta = {
  baseCycleWeeks: plan.baseCycleWeeks,
  cycleWeeksWithData: plan.cycleWeeksWithData,
};
const allTasks = plan.weeks.flatMap((phase) =>
  phase.tasks.map((task, index) => ({ ...task, phase: phase.label, phaseOrder: phase.week, order: index })));

const shift = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/* Week 1 is the week the kickoff falls in, so an N+0 task lands in it whatever weekday the
   project starts on. */
const mondayOnOrBefore = (iso) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return shift(iso, -((date.getUTCDay() + 6) % 7));
};

function generateWeeklyReport(kickoffDate, cycleLength, { tasks = allTasks } = {}) {
  const weekOne = mondayOnOrBefore(kickoffDate);
  const lead = Math.round((Date.parse(`${kickoffDate}T00:00:00Z`) - Date.parse(`${weekOne}T00:00:00Z`)) / 86400000);
  const buckets = PlanEngine.distribute(tasks, cycleLength, meta, lead);

  const weeks = buckets.map((bucket, index) => {
    const start = shift(weekOne, index * 7);
    const phases = [...new Set(bucket.map((entry) => entry.task.phase))];
    return {
      week_number: index + 1,
      start_date: start,
      end_date: shift(start, 6),
      phase: phases.join(" + ") || "No tasks due",
      tasks: bucket.map((entry, position) => ({
        task_id: `w${index + 1}_t${position + 1}`,
        domain: entry.task.scope,
        task_name: entry.task.title,
        phase: entry.task.phase,
        owner: entry.task.owner || "",
        offset_days: entry.offset,
        planned_date: shift(kickoffDate, entry.offset),
        is_elastic: PlanEngine.isElastic(entry.task),
        status: "not started",
      })),
      task_count: bucket.length,
      completed_count: 0,
      progress_percent: 0,
    };
  });

  const offsets = tasks.map((task) => PlanEngine.resolveTaskOffset(task, cycleLength, meta));
  return {
    project: {
      cycle_length: cycleLength,
      kickoff_date: kickoffDate,
      week_one_starts: weekOne,
      /* Go-live is the last task to finish, which the sheet places just inside the final
         week rather than exactly cycle x 7 days out. */
      go_live_date: shift(kickoffDate, Math.max(...offsets)),
      total_tasks: tasks.length,
    },
    weeks,
  };
}

function validate(report) {
  const weeks = report.weeks;
  const placed = weeks.reduce((sum, week) => sum + week.task_count, 0);
  const problems = [];
  const empty = weeks.filter((week) => !week.task_count).map((week) => week.week_number);
  if (empty.length) problems.push(`weeks with no task due: ${empty.join(", ")}`);
  if (placed !== report.project.total_tasks) problems.push(`placed ${placed} of ${report.project.total_tasks} tasks`);
  if (weeks.length !== report.project.cycle_length) problems.push(`${weeks.length} weeks for a ${report.project.cycle_length}-week cycle`);

  /* Phases should still run Kickoff -> ... -> Go Live once tasks are laid out by date. */
  const seen = [];
  weeks.forEach((week) => week.tasks.forEach((task) => {
    if (seen[seen.length - 1] !== task.phase) seen.push(task.phase);
  }));
  const order = plan.weeks.map((phase) => phase.label);
  const firstSeen = order.map((label) => weeks.findIndex((week) => week.tasks.some((task) => task.phase === label)));
  const present = firstSeen.filter((index) => index >= 0);
  if (present.some((value, index) => index && value < present[index - 1])) {
    problems.push("phases do not start in order");
  }
  return { ok: !problems.length, problems, empty_weeks: empty, tasks_placed: placed };
}

function writeArtifacts() {
  const outDir = path.join(ROOT, "artifacts");
  fs.mkdirSync(outDir, { recursive: true });

  const registry = {
    source: plan.source,
    version: plan.version,
    cycles_with_data: plan.cycleWeeksWithData,
    total_tasks: allTasks.length,
    elastic_tasks: allTasks.filter(PlanEngine.isElastic).length,
    fixed_tasks: allTasks.filter((task) => !PlanEngine.isElastic(task)).length,
    tasks: allTasks.map((task, index) => ({
      task_id: `task_${String(index + 1).padStart(3, "0")}`,
      domain: task.scope,
      task_name: task.title,
      phase: task.phase,
      owner: task.owner || "",
      platforms: task.platforms,
      channels: task.channels,
      is_elastic: PlanEngine.isElastic(task),
      offsets: task.offsetByCycle,
    })),
  };

  const cases = [];
  for (let cycle = 2; cycle <= 12; cycle += 1) {
    const report = generateWeeklyReport("2026-09-07", cycle);
    const result = validate(report);
    cases.push({
      cycle_length: cycle,
      interpolated: !plan.cycleWeeksWithData.includes(cycle),
      expected_tasks: allTasks.length,
      tasks_placed: result.tasks_placed,
      weeks_with_tasks: report.weeks.filter((week) => week.task_count).length,
      empty_weeks: result.empty_weeks,
      tasks_per_week: report.weeks.map((week) => week.task_count),
      go_live_offset: Math.max(...allTasks.map((task) => PlanEngine.resolveTaskOffset(task, cycle, meta))),
      passes: result.ok,
      problems: result.problems,
      sample_task_offsets: Object.fromEntries(
        [["Event Tracking", "Website"], ["Event Tracking", "Android"], ["Production Migration", "Website"],
         ["Training Session I", "Training and Use-Cases"], ["Integration / Domains check", "All Integrated Domains"]]
          .map(([title, scope]) => {
            const task = allTasks.find((item) => item.title === title && item.scope === scope);
            return [`${title} (${scope})`, task ? PlanEngine.resolveTaskOffset(task, cycle, meta) : null];
          })),
    });
  }

  const sample = generateWeeklyReport("2026-09-07", 5);
  const write = (name, data) => {
    fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
    return `${name} (${(fs.statSync(path.join(outDir, name)).size / 1024).toFixed(0)} KB)`;
  };
  return [
    write("task_registry.json", registry),
    write("interpolation_test.json", { generated_from: plan.version, cases }),
    write("sample_5_week_report.json", sample),
  ];
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--artifacts") {
    writeArtifacts().forEach((line) => console.log(`wrote artifacts/${line}`));
  } else if (args.length >= 2) {
    const report = generateWeeklyReport(args[0], Number(args[1]));
    const result = validate(report);
    if (args[2]) fs.writeFileSync(args[2], `${JSON.stringify(report, null, 2)}\n`);
    else console.log(JSON.stringify(report, null, 2));
    if (!result.ok) console.error(`validation: ${result.problems.join("; ")}`);
  } else {
    console.error("usage: generate-weekly-report.js <kickoff YYYY-MM-DD> <cycle> [out.json] | --artifacts");
    process.exit(1);
  }
}

module.exports = { generateWeeklyReport, validate, allTasks, meta };
