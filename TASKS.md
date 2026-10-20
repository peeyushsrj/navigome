# Navigome — Tasks

Spec: `docs/superpowers/specs/2026-10-19-navigome-design.md`
Gate: ⛔ **No implementation until user approves spec AND Pi is up.**

## Stage — Brainstorming (current)

- [x] Classify path: architectural (new project)
- [x] Existing-tool research (XState/Stately exist; no Vikunja time-state app — build custom)
- [x] Q1: task→state mapping = Option A (one Vikunja project per state)
- [x] Q2: switching = auto clock + manual override until window boundary
- [x] Q3: stack = static HTML (+PWA) behind nginx on Pi, Vikunja proxied same-origin
- [x] Write spec
- [ ] Spec self-review (inline fixes)
- [ ] **User reviews spec + approves** ⛔ (also gated on Pi up)

## Stage — Implementation (after approval; invoke writing-plans first)

- [ ] P0: ✅ Pi reachable, Vikunja active + API auth-live (2026-10-20). ⚠️ nginx NOT installed on Pi → install step added to P8 (sudo, confirm with user)
- [ ] P1: scaffold static app (`index.html`, `style.css`, `config.js` — default windows, projectIds TBD)
- [ ] P2: `statemachine.js` + `statemachine.test.js` — `node --test` green (window match, midnight wrap, override expiry, next transition)
- [ ] P3: Vikunja discovery on live server: `GET /api/v1/projects` → map 5 states → project IDs into `config.js`; confirm tasks-by-project + toggle-done endpoints from `/api/v1/docs`
- [ ] P4: `app.js` — clock/resolve loop, state chips, task list, complete-toggle, settings (token, API base, test connection), error banners (401 / timeout)
- [ ] P5: PWA — `manifest.webmanifest`, icons, `sw.js` (cache shell, network-first tasks)
- [ ] P6: in-app guide overlay (first-load + `?`)
- [ ] P7: browser verification checklist (spec §6) incl. phone standalone install
- [ ] P8: Pi deploy — rsync to `/var/www/navigome/`, nginx locations (`/navigome/`, `/vikunja-api/`) — sudo, confirm with user; verify no CORS errors
- [ ] P9: README.md (launch instructions: how to load, edit windows, paste token)
- [ ] Final: verification run before "done" claim; git init + baseline commit only if user asks
