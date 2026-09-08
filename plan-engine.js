/* Shared planning engine.
 *
 * Loaded as a plain script by the dashboard and required as a module by tools/, so the
 * schedule the app shows and the schedule the generated artifacts describe come from the
 * same code and cannot drift apart.
 *
 * The master plan gives each task a completion date as a day offset from kickoff, listed
 * separately for each cycle length the team plans for (currently 4, 6 and 12 weeks). Nothing
 * here invents a date: a cycle the sheet covers is used as written, and one it does not is
 * interpolated between the two nearest plans.
 */
(function (factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else globalThis.PlanEngine = api;
})(function () {
  const FALLBACK_BASE_CYCLE = 4;

  function cyclesWithData(meta) {
    const listed = ((meta && meta.cycleWeeksWithData) || [])
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    return listed.length ? listed : [baseCycle(meta)];
  }

  function baseCycle(meta) {
    const value = Number(meta && meta.baseCycleWeeks);
    return Number.isFinite(value) && value > 0 ? value : FALLBACK_BASE_CYCLE;
  }

  /* Round halves down, so an interpolated offset that lands exactly between two days takes
     the earlier one. Math.round would go the other way and is asymmetric for negatives. */
  function roundHalfDown(value) {
    return Math.ceil(value - 0.5);
  }

  /* The completion offset for this task at this cycle length:
       - the sheet plans for this cycle    -> use it as written
       - it falls between two planned ones -> interpolate linearly between them
       - it falls outside the planned range -> scale from the nearest plan
     so a new cycle length never needs an edit to the master list. */
  function resolveTaskOffset(task, cycleWeeks, meta) {
    const cycle = Math.max(1, Number(cycleWeeks) || baseCycle(meta));
    const table = (task && task.offsetByCycle) || {};
    const known = cyclesWithData(meta).filter((weeks) => table[String(weeks)] !== undefined);
    if (!known.length) return 0;

    const at = (weeks) => Number(table[String(weeks)]) || 0;
    if (table[String(cycle)] !== undefined) return Math.max(0, at(cycle));

    const below = [...known].reverse().find((weeks) => weeks < cycle);
    const above = known.find((weeks) => weeks > cycle);

    if (below !== undefined && above !== undefined) {
      const ratio = (cycle - below) / (above - below);
      return Math.max(0, roundHalfDown(at(below) + (at(above) - at(below)) * ratio));
    }

    const nearest = below !== undefined ? below : above;
    return Math.max(0, roundHalfDown(at(nearest) * cycle / nearest));
  }

  /* A task is elastic when its completion date moves with the project length. This is read
     off the data rather than configured: SDK setup that sits at N+5 in every plan is fixed,
     event tracking that runs N+10 / N+15 / N+35 is elastic. */
  function isElastic(task) {
    const values = Object.values((task && task.offsetByCycle) || {});
    return new Set(values.map(Number)).size > 1;
  }

  /* Which week of the project a task belongs to. `lead` is how many days the kickoff sits
     after the start of its own week, so an N+0 task lands in week 1 whatever weekday the
     project starts on. Week 1 covers days 0-6, week 2 days 7-13, and so on. */
  function weekIndexFor(offset, cycleWeeks, lead) {
    const index = Math.floor(((Number(lead) || 0) + offset) / 7);
    return Math.min(Math.max(index, 0), Math.max(0, cycleWeeks - 1));
  }

  /* Foundational work sits in a named week rather than wherever its offset lands. Placing it by
     offset alone would only hold for a Monday or Tuesday kickoff: with `lead` counted in, an
     N+5 task slides into week 2 for a project starting on a Wednesday or later. */
  function placementFor(task, cycleWeeks, lead, meta) {
    const pinned = Number(task && task.fixedWeek);
    if (Number.isFinite(pinned) && pinned > 0) {
      return Math.min(pinned - 1, Math.max(0, cycleWeeks - 1));
    }
    return weekIndexFor(resolveTaskOffset(task, cycleWeeks, meta), cycleWeeks, lead);
  }

  /* Group a flat task list into one bucket per project week. */
  function distribute(tasks, cycleWeeks, meta, lead) {
    const weeks = Array.from({ length: cycleWeeks }, () => []);
    (tasks || []).forEach((task) => {
      const offset = resolveTaskOffset(task, cycleWeeks, meta);
      weeks[placementFor(task, cycleWeeks, lead, meta)].push({ task, offset });
    });
    weeks.forEach((bucket) => bucket.sort((left, right) => left.offset - right.offset));
    return weeks;
  }

  return { cyclesWithData, baseCycle, roundHalfDown, resolveTaskOffset, isElastic, weekIndexFor, placementFor, distribute };
});
