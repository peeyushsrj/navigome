# Navigome — Design Spec

Date: 2026-10-19 · Status: awaiting user review · Project: `~/Asst/tasks/navigome/`

## 1. Intent

A single-page web app that puts the user into a **time-of-day life state** each part of the day and shows the matching **Vikunja tasks** for that state. Opened morning/noon/evening on phone or browser; the app decides (or lets the user pick) the current state, then lists that state's tasks as a ready-to-execute agenda.

States (fixed daily cycle, boundaries configurable):

| State | Meaning | Default window |
|---|---|---|
| `morning` | Spiritual / personal project | 05:00–09:00 |
| `daytime` | Work + home errands | 09:00–17:30 |
| `sunset` | Nature-related | 17:30–18:30 |
| `evening` | Errands | 18:30–21:30 |
| `night` | Self-care | 21:30–05:00 (wraps midnight) |

Success criteria: load page → correct state preselected by clock → its Vikunja tasks visible → tap task to complete, tap state chip to override → override reverts at next time boundary → usable from phone home screen.

## 2. Decisions (already made with user)

- **Task→state mapping: Option A** — one Vikunja project/list per state; mapping lives in config.
- **State switching: model A** — clock auto-selects; tapping a state chip overrides until that state's window would end (boundary = next window transition), then auto returns to time-based selection.
- **Delivery: static HTML + PWA** — no build step, vanilla JS, served behind **nginx on the Pi** at a path. PWA touches (manifest + service worker) for phone home-screen use. No FastAPI — earlier Q3 option C reference superseded by this decision.
- **Same-origin, no CORS** — nginx serves the app at `/navigome/` and proxies Vikunja at `/vikunja-api/` → `127.0.0.1:3456`, so browser sees one origin. Direct-LAN fallback (`http://<pi-host>:3456`) available in settings for use before nginx is configured.
- **Auth** — Vikunja API token pasted once in the app's Settings screen, stored in `localStorage`. App is LAN-only; no app-level login (non-goal).
- **Gate** — Pi is currently unreachable. Tasks prepared now; implementation waits for user approval when the Pi is up.

## 3. Architecture

```
┌─ phone / browser ────────────────┐
│ index.html + app.js + style.css  │
│ config.js   (states, windows,    │
│              state→project map)  │
│ statemachine.js (pure logic)     │
│ manifest.webmanifest + sw.js     │
└───────┬──────────────────────────┘
        │ fetch (Bearer token, localStorage)
        ▼
 nginx on Pi ── /navigome/   → static files (alias)
               /vikunja-api/ → 127.0.0.1:3456 (Vikunja, systemd unit `vikunja`)
```

Components:

1. **`config.js`** — states array: `id`, display name, `window: [start, end]`, Vikunja `projectId` (filled after discovery on live server), color/icon. Single edit point for windows and project mapping.
2. **`statemachine.js`** — pure functions, no DOM/fetch: `stateFor(now, config)` (window match, handles midnight wrap), `resolve(current, override, now, config)` (override valid until its window's end boundary, else auto), `nextTransition(now, config)`. Tested with `node --test`.
3. **`app.js`** — glue: clock tick (every 1s for display, re-resolve every 30s), state chips, task list rendering, settings + guide overlays, Vikunja client (all requests carry explicit `AbortSignal.timeout(10000)`).
4. **Vikunja client** — endpoints confirmed against the live instance during build (project list `GET /api/v1/projects`; tasks-by-project and toggle-done endpoints verified from `/api/v1/docs` at build time — not assumed here). Fetch tasks for active state's project only; pull-to-refresh + refresh button.
5. **PWA** — `manifest.webmanifest` (name, icons, `start_url: "."`, standalone), `sw.js` caches app shell only (cache-first statics, network-first tasks, never cache API errors).
6. **In-app guide** — first-load overlay + `?` button: how states work, override behavior, where to paste token, how to edit windows in `config.js`.

UI (compact, mobile-first):

- Header: state name, current time, next transition countdown, override badge
- Chips row: 5 states (tap = override until boundary)
- Task list: checkbox (complete), title, due, priority; empty-state message
- Settings: token, API base, "test connection" button
- Guide overlay

## 4. Data flow

1. Load → read config + `localStorage` (token, override) → `resolve(now)` → active state.
2. Active state's `projectId` → `GET tasks` → render.
3. Tap chip → override saved `{stateId, validUntil: windowEnd}` → refetch.
4. Boundary reached (tick) → override expires → auto state → refetch.
5. Checkbox → toggle-done call → optimistic UI → revalidate.

## 5. Error handling

- No token / 401 → banner "Add Vikunja token in Settings", Settings opens focused.
- API unreachable / timeout → banner with retry; last-good list stays visible with staleness note.
- Unmapped state (missing projectId) → "No Vikunja project mapped for this state" + link to Settings.
- Clock sanity: config with overlapping/invalid windows → console.error, fall back to linear first-match.

## 6. Testing

- `statemachine.test.js` (`node --test`): window match incl. midnight wrap, override expiry at boundary, next-transition math, invalid configs.
- Manual browser checklist (run before done): auto-select, manual override + boundary revert, complete task, 401 banner, unreachable-API banner, phone standalone install, guide first-run.
- Deployment verification on Pi: `/navigome/` serves app, `/vikunja-api/` proxies, browser console shows no CORS errors.

## 7. Non-goals (v1)

Task creation/editing from the app · app-level auth · offline writes · multi-device override sync · analytics · editing state windows from the UI (edit `config.js` instead) · Docker (static files, none needed).

## 8. Deployment (Pi)

- Static dir: `/var/www/navigome/` (rsync from `~/Asst/tasks/navigome/`).
- nginx: `location /navigome/ { alias …; }` + `location /vikunja-api/ { proxy_pass http://127.0.0.1:3456/; }` — root-owned config, needs `sudo`; confirm with user at deploy time.
- App works pre-nginx via direct-LAN mode (CORS caveat documented: only viable if user enables CORS in `/etc/vikunja/config.yml` or waits for proxy step).

## 9. Open questions

- None blocking. Project-ID mapping + exact task/toggle endpoints resolved during build against live server.
