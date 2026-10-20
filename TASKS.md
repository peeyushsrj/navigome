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
- [x] Spec self-review (inline fixes)
- [x] **User reviews spec + approves** ✅ 2026-10-20
- [x] Created Vikunja projects: 14 Spiritual, 15 Nature (v2.7 quirk: create = `PUT /api/v1/projects`)
- [x] Writing-plans → `docs/superpowers/plans/2026-10-20-navigome.md`

## Stage — Implementation (after approval; invoke writing-plans first)

- [x] P0: ✅ Pi reachable, Vikunja active + API auth-live (2026-10-20). nginx already running on :80 (earlier "not found" = PATH quirk) → P8 = add locations, no install
- [x] P3 (folded into plan): projects 14/15 created; list=`GET /tasks?filter=`, toggle=`POST /tasks/{id}` verified from live swagger
- [ ] P1: scaffold static app (`index.html`, `style.css`, `config.js` — default windows, projectIds TBD)
- [ ] P2: `statemachine.js` + `statemachine.test.js` — `node --test` green (window match, midnight wrap, override expiry, next transition)
- [x] P3: folded into plan (see above) — live endpoints + project IDs resolved 2026-10-20
- [ ] P4: `app.js` — clock/resolve loop, state chips, task list, complete-toggle, settings (token, API base, test connection), error banners (401 / timeout)
- [ ] P5: PWA — `manifest.webmanifest`, icons, `sw.js` (cache shell, network-first tasks)
- [ ] P6: in-app guide overlay (first-load + `?`)
- [ ] P7: browser verification checklist (spec §6) incl. phone standalone install
- [ ] P8: Pi deploy — rsync to `/var/www/navigome/`, nginx locations (`/navigome/`, `/vikunja-api/`) — sudo, confirm with user; verify no CORS errors
- [ ] P9: README.md (launch instructions: how to load, edit windows, paste token)
- [ ] Final: verification run before "done" claim; git init + baseline commit only if user asks
