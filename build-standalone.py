#!/usr/bin/env python3
"""Bundle the dashboard into one portable weekly-report-dashboard.html.

Inlines styles.css, app.js, week-templates.json and everything under demo-data/ so the
result runs by double-clicking it — no server, and no fetch (which file:// blocks).
Run after changing any of those files:  python3 build-standalone.py
"""
import base64
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
OUT = HERE / "weekly-report-dashboard.html"


def read(name):
    return (HERE / name).read_text(encoding="utf-8")


def js_safe(text):
    """Keep an inline <script> from being closed early by its own content.

    Only `</script` needs escaping. A bare `<!--` is safe here (no `<script` follows it),
    and escaping it as `<\\!--` produces an invalid escape sequence inside a template
    literal, which is a SyntaxError.
    """
    return re.sub(r"</(script)", r"<\\/\1", text, flags=re.I)


def main():
    html = read("index.html")
    css = read("styles.css")
    app = read("app.js")

    demo_index = json.loads(read("demo-data/index.json"))
    demos = {
        entry["file"]: json.loads(read(f"demo-data/{entry['file']}"))
        for entry in demo_index.get("demos", [])
    }

    supabase_config = json.loads(read("supabase-config.json"))

    bundle = {
        "supabaseConfig": supabase_config,
        "weekTemplates": json.loads(read("week-templates.json")),
        "demoIndex": demo_index,
        "demos": demos,
    }

    # favicon as a data URI so the single file carries its own icon
    icon = base64.b64encode((HERE / "icon.svg").read_bytes()).decode("ascii")
    html = html.replace(
        '<link rel="icon" href="icon.svg" type="image/svg+xml" />',
        f'<link rel="icon" href="data:image/svg+xml;base64,{icon}" />',
    )

    # a single file cannot install as a PWA, and the SW would 404 from disk
    html = html.replace('<link rel="manifest" href="manifest.webmanifest" />\n    ', "")
    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>\n{css}\n    </style>")

    # inline scripts ignore `defer`, so app.js moves to the end of <body> where the DOM exists
    html = html.replace('<script defer src="app.js"></script>\n  ', "")
    scripts = (
        f'<script>window.__BUNDLED_DATA__ = {js_safe(json.dumps(bundle, ensure_ascii=False))};</script>\n'
        f'    <script>\n{js_safe(app)}\n    </script>\n  '
    )
    html = html.replace("</body>", f"  {scripts}</body>")

    OUT.write_text(html, encoding="utf-8")

    weeks = len(bundle["weekTemplates"]["weeks"])
    tasks = sum(len(w["tasks"]) for w in bundle["weekTemplates"]["weeks"])
    size = OUT.stat().st_size / 1024
    print(f"wrote {OUT.name}  ({size:.0f} KB)")
    print(f"  inlined: styles.css, app.js, {weeks} template weeks / {tasks} tasks, {len(demos)} demo dataset(s)")
    leftover = re.findall(r'(?:src|href)="(?!data:|#)([^"]+)"', html)
    print(f"  external references remaining: {leftover or 'none'}")


if __name__ == "__main__":
    main()
