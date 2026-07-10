# Weekly Report Dashboard

A client-side PWA for tracking weekly status updates across multiple projects (Current/Closed), with per-project reports. No backend, no build step, no package.json — plain HTML/CSS/JS.

## Files

- `index.html` — app shell/markup
- `app.js` — all app logic and state management (DOM-driven, no framework)
- `styles.css` — styling
- `sw.js` — service worker; lists cached assets in `ASSETS` — keep in sync if files are added/renamed
- `manifest.webmanifest` — PWA install metadata
- `icon.svg` — app icon

## State

All data lives in the browser's `localStorage` (see `STATE_KEY` / `USER_DATA_PREFIX` in `app.js`). There is no server-side persistence — data is scoped per-origin, so serving from a different host/port shows empty state.

## Running locally

See `README.md` for start/stop commands (`python3 -m http.server 8000`). Any static file server works — no build tooling required.

## Conventions

- Keep this a dependency-free static app unless the user explicitly asks to add a framework/build step or backend.
- If you add/rename a top-level asset file, update the `ASSETS` array in `sw.js` and bump `CACHE_NAME`, or the service worker will serve stale/missing files.

RTK usage instructions live in the workspace-level `CLAUDE.md` (`../CLAUDE.md`) — always prefix shell commands with `rtk` per those instructions.
