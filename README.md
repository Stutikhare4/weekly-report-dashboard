# Weekly Report Dashboard

A lightweight, installable web app (PWA) for tracking weekly status updates across multiple projects. Organize projects as Current or Closed, log weekly updates with tasks and sub-tasks, and generate a per-project report you can copy or download.

All data is stored locally in the browser (`localStorage`) — there is no backend.

## Project structure

```
index.html            App shell / markup
app.js                App logic and state management
styles.css            Styling
sw.js                 Service worker (offline caching)
manifest.webmanifest  PWA manifest (installable app metadata)
icon.svg              App icon
```

## Running locally

The app is fully static, so any local file server works. Using Python's built-in server:

**Start the server**

```bash
cd weekly-report-dashboard
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

To run it in the background instead of tying up your terminal:

```bash
cd weekly-report-dashboard
python3 -m http.server 8000 > /tmp/weekly-report-dashboard-server.log 2>&1 &
disown
```

**Stop the server**

If running in the foreground, press `Ctrl+C`.

If running in the background, find and kill it by port:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN   # find the PID bound to port 8000
kill <PID>
```

## Notes

- The service worker (`sw.js`) caches the app for offline use. If you change any files and don't see updates reflected, do a hard refresh or bump `CACHE_NAME` in `sw.js`.
- Data lives in your browser's `localStorage`, scoped to whatever origin you serve the app from (e.g. `http://localhost:8000`). Serving from a different port or host will look empty.
