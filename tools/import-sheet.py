#!/usr/bin/env python3
"""Re-import the master plan from the team's Google Sheet.

    python3 tools/import-sheet.py            # check the sheet, report drift, change nothing
    python3 tools/import-sheet.py --write    # rewrite week-templates.json and app.js's seed

The sheet has one tab per planned cycle length, each holding the same task list with
different timings. The import matches rows across tabs *by position*, because the tabs have
drifted apart on wording, and refuses to run if the positions stop agreeing -- a row inserted
into one tab alone would otherwise pair every task below it with the wrong offsets, silently.
"""
import json, re, shutil, subprocess, sys, zipfile, io
import xml.etree.ElementTree as ET
from pathlib import Path

SHEET_ID = "1szgspVwOpiUgsS3DKoybF_UKB8t6LXRNXBAnr_pmO7E"
ROOT = Path(__file__).resolve().parent.parent
CYCLE_TABS = {4: "Week 4", 6: "Week 6", 12: "Week 12"}
CANONICAL_TAB = "Week 4"          # whose wording wins when the tabs disagree
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

DOMAIN_PLATFORMS = {"Website": ["Website"], "Android": ["Android"], "iOS": ["iOS"],
                    "Web App": ["Web App"], "Rest API": ["REST API"],
                    "Communication Channels": [], "All Integrated Domains": [], "": []}
CHANNEL_RULES = [("Web Push", "Web Push"), ("WebPush", "Web Push"),
                 ("Onsite Notification", "On-site Notification"), ("In-App", "In-App"),
                 ("Rich Push", "Push"), ("Push", "Push"), ("Email", "Email"), ("SMS", "SMS"),
                 ("Whatsapp", "WhatsApp"), ("RCS", "RCS"), ("IVR", "IVR")]
TYPOS = {"Histroical": "Historical", "Jounery": "Journey"}
# Web App is not in the sheet: it mirrors Website's tasks with Android/iOS timing.
WEBAPP_TIMING = {"SDK Set Up": "SDK Set Up", "User Tracking": "User Tracking",
                 "Event Tracking": "Event Tracking", "Web Push Setup": "Push Setup",
                 "Users and Events Audit": "Users and Events Audit",
                 "WebPush Audit": "Push Android", "Onsite Notification Audit": "In-App Android",
                 "Staging Fixes as per Audit Report": "Staging Fixes as per Audit Report",
                 "Production Migration": "Production Migration",
                 "Web Push Setup on dashboard": "Push credentials",
                 "Prod Fixes as per Audit Report": "Prod Fixes as per Audit Report"}


def fetch_tabs():
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
    # curl rather than urllib: the python.org builds on macOS ship without a CA bundle, so
    # urllib fails to verify Google's certificate on an otherwise healthy machine.
    if not shutil.which("curl"):
        sys.exit("curl is needed to download the sheet")
    result = subprocess.run(["curl", "-sSLf", url], capture_output=True)
    if result.returncode:
        sys.exit(f"could not download the sheet: {result.stderr.decode().strip()}")
    book = zipfile.ZipFile(io.BytesIO(result.stdout))
    strings = ["".join(t.text or "" for t in si.iter(f'{{{NS["m"]}}}t'))
               for si in ET.fromstring(book.read("xl/sharedStrings.xml"))]
    rels = {r.get("Id"): r.get("Target")
            for r in ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))}

    def col(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group(0):
            n = n * 26 + ord(ch) - 64
        return n - 1

    tabs = {}
    for sheet in ET.fromstring(book.read("xl/workbook.xml")).find(f'{{{NS["m"]}}}sheets'):
        target = rels[sheet.get(f'{{{NS["r"]}}}id')]
        path = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
        rows = []
        for row in ET.fromstring(book.read(path)).iter(f'{{{NS["m"]}}}row'):
            cells = {}
            for c in row.iter(f'{{{NS["m"]}}}c'):
                v = c.find(f'{{{NS["m"]}}}v')
                if v is None:
                    continue
                value = strings[int(v.text)] if c.get("t") == "s" else v.text
                cells[col(c.get("r"))] = (value or "").strip()
            rows.append([cells.get(i, "") for i in range(max(cells) + 1 if cells else 0)])
        tabs[sheet.get("name")] = rows
    return tabs


def parse_offset(text):
    match = re.match(r"^N\s*(?:\+\s*(\d+))?$", text.strip())
    return int(match.group(1) or 0) if match else None


def walk(rows):
    """Rows carrying a task, with phase and domain filled down and the real sheet row number."""
    phase = domain = ""
    out = []
    for number, row in enumerate(rows[1:], start=2):
        row = list(row) + [""] * (6 - len(row))
        if row[0].strip():
            phase, domain = row[0].strip(), row[1].strip()
        elif row[1].strip():
            domain = row[1].strip()
        if row[2].strip():
            out.append({"row": number, "phase": phase, "domain": domain.strip(),
                        "title": row[2].strip(), "owner": row[3].strip(),
                        "offset": parse_offset(row[5])})
    return out


def check(seq):
    """Positional alignment is what the import relies on, so it is an error; wording drift
    only makes the sheet harder to read, so it is a warning."""
    errors, warnings = [], []
    lengths = {tab: len(rows) for tab, rows in seq.items()}
    if len(set(lengths.values())) > 1:
        errors.append(f"tabs hold different numbers of tasks: {lengths}")
        return errors, warnings

    canonical = seq[CANONICAL_TAB]
    for i in range(len(canonical)):
        shape = {(seq[tab][i]["phase"], seq[tab][i]["domain"]) for tab in seq}
        if len(shape) > 1:
            errors.append(f"row {canonical[i]['row']}: tabs disagree on phase/domain -> {shape}")
        titles = {tab: seq[tab][i]["title"] for tab in seq}
        if len(set(titles.values())) > 1:
            warnings.append(f"row {canonical[i]['row']} [{canonical[i]['domain']}]: " +
                            ", ".join(f"{tab}={title!r}" for tab, title in titles.items()))
    for tab, rows in seq.items():
        for item in rows:
            if item["offset"] is None:
                errors.append(f"{tab} row {item['row']}: cannot read the offset for {item['title']!r}")
    return errors, warnings


def build(seq):
    canonical = seq[CANONICAL_TAB]
    channels_for = lambda t: [ch for needle, ch in CHANNEL_RULES if needle.lower() in t.lower()]

    block, counter = {}, {}
    for i, row in enumerate(canonical):
        key = (row["phase"], row["domain"])
        previous = canonical[i - 1] if i else None
        if not previous or (previous["phase"], previous["domain"]) != key:
            counter[key] = counter.get(key, -1) + 1
        block[i] = counter[key]
    android = {(r["phase"], block[i], r["title"]): i
               for i, r in enumerate(canonical) if r["domain"] == "Android"}

    phases, web_app = [], 0
    for i, row in enumerate(canonical):
        if not phases or phases[-1]["label"] != row["phase"]:
            phases.append({"week": len(phases) + 1, "label": row["phase"], "tasks": []})
        title = row["title"]
        for bad, good in TYPOS.items():
            title = title.replace(bad, good)

        def task(scope, platforms, offsets):
            seen = {str(c): offsets[c] for c in CYCLE_TABS}
            return {"scope": scope, "title": title, "owner": row["owner"], "priority": "medium",
                    "platforms": platforms, "channels": list(dict.fromkeys(channels_for(title))),
                    "offsetByCycle": seen, "elastic": len(set(seen.values())) > 1}

        own = {c: seq[CYCLE_TABS[c]][i]["offset"] for c in CYCLE_TABS}
        phases[-1]["tasks"].append(task(row["domain"] or row["phase"],
                                        DOMAIN_PLATFORMS.get(row["domain"], []), own))
        if row["domain"] == "Website":
            twin = android.get((row["phase"], block[i], WEBAPP_TIMING.get(row["title"], "")))
            if twin is not None:
                phases[-1]["tasks"].append(
                    task("Web App", ["Web App"], {c: seq[CYCLE_TABS[c]][twin]["offset"] for c in CYCLE_TABS}))
                web_app += 1

    for phase in phases:
        phase["elastic"] = any(t["elastic"] for t in phase["tasks"])
    return phases, web_app


def write_seed(phases):
    dump = lambda v: json.dumps(v, ensure_ascii=False)
    lines = ["const WEEK_TEMPLATE_SEED = ["]
    for phase in phases:
        lines += ["  {", f'    week: {phase["week"]},', f'    label: {dump(phase["label"])},',
                  f'    elastic: {"true" if phase["elastic"] else "false"},', "    tasks: ["]
        for task in phase["tasks"]:
            offsets = ", ".join(f'"{k}": {v}' for k, v in task["offsetByCycle"].items())
            lines.append(
                f'      {{ scope: {dump(task["scope"])}, title: {dump(task["title"])}, '
                f'owner: {dump(task["owner"])}, priority: "{task["priority"]}", '
                f'platforms: {dump(task["platforms"])}, channels: {dump(task["channels"])}, '
                f'elastic: {"true" if task["elastic"] else "false"}, offsetByCycle: {{ {offsets} }} }},')
        lines += ["    ],", "  },"]
    lines.append("];")

    app = (ROOT / "app.js").read_text(encoding="utf-8")
    start = app.index("const WEEK_TEMPLATE_SEED = [")
    end = app.index("\n];", start) + 3
    (ROOT / "app.js").write_text(app[:start] + "\n".join(lines) + app[end:], encoding="utf-8")


def main():
    write = "--write" in sys.argv
    tabs = fetch_tabs()
    missing = [name for name in CYCLE_TABS.values() if name not in tabs]
    if missing:
        sys.exit(f"sheet is missing expected tab(s): {missing}; found {list(tabs)}")

    seq = {name: walk(tabs[name]) for name in CYCLE_TABS.values()}
    errors, warnings = check(seq)

    print(f"tabs: {', '.join(f'{n} ({len(r)} tasks)' for n, r in seq.items())}")
    if warnings:
        print(f"\nwording differs between tabs ({len(warnings)} rows) — the import uses "
              f"{CANONICAL_TAB}'s wording; aligning the sheet would remove this:")
        for line in warnings:
            print(f"  {line}")
    if errors:
        print(f"\n{len(errors)} problem(s) that make the tabs unsafe to combine:")
        for line in errors:
            print(f"  {line}")
        sys.exit("refusing to import — fix the sheet first")

    phases, web_app = build(seq)
    total = sum(len(p["tasks"]) for p in phases)
    print(f"\n{len(phases)} phases, {total} tasks ({total - web_app} from the sheet + {web_app} Web App)")
    for phase in phases:
        print(f'  {phase["week"]}. {phase["label"]:<24} {len(phase["tasks"]):3d}')

    if not write:
        print("\nnothing written — re-run with --write to update week-templates.json and app.js")
        return

    version = json.loads((ROOT / "week-templates.json").read_text(encoding="utf-8")).get("version", "")
    payload = {"source": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit",
               "sourceTabs": {str(c): n for c, n in CYCLE_TABS.items()},
               "version": version, "baseCycleWeeks": min(CYCLE_TABS),
               "cycleWeeksWithData": sorted(CYCLE_TABS), "weeks": phases}
    (ROOT / "week-templates.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_seed(phases)
    print("\nwrote week-templates.json and app.js's WEEK_TEMPLATE_SEED")
    print(f'  version is still "{version}" — bump it in week-templates.json and '
          f"WEEK_TEMPLATE_VERSION in app.js so browsers re-seed, then run build-standalone.py")


if __name__ == "__main__":
    main()
