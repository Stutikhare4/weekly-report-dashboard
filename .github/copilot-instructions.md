# Weekly Report Dashboard

Client-side PWA for weekly project status tracking (Current/Closed projects, per-project reports). No backend, no build step, no package.json — plain HTML/CSS/JS.

- `index.html` / `app.js` / `styles.css` — app shell, logic (DOM-driven, no framework), styling
- `sw.js` — service worker; its `ASSETS` list must stay in sync with top-level files; bump `CACHE_NAME` on changes
- State lives entirely in browser `localStorage` (see `app.js`) — no server persistence
- Run locally with any static server, e.g. `python3 -m http.server 8000` (see `README.md`)
- Keep this dependency-free unless explicitly asked to add a framework/backend

<!-- rtk-instructions v2 -->
# RTK — Token-Optimized CLI

**rtk** is a CLI proxy that filters and compresses command outputs, saving 60-90% tokens.

## Rule

Always prefix shell commands with `rtk`:

```bash
# Instead of:              Use:
git status                 rtk git status
git log -10                rtk git log -10
cargo test                 rtk cargo test
docker ps                  rtk docker ps
kubectl get pods           rtk kubectl pods
```

## Meta commands (use directly)

```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
rtk proxy <cmd>       # Run raw (no filtering) but track usage
```
<!-- /rtk-instructions -->
