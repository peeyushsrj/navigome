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
- [x] P1: scaffold static app ✅ 2026-10-20
- [x] P2: `statemachine.js` + tests — 12/12 green ✅ 2026-10-20
- [x] P3: folded into plan (see above) — live endpoints + project IDs resolved 2026-10-20
- [x] P4: `app.js` + `vikunja.js` ✅ 2026-10-20 (headless E2E: state, chips, override, banners)
- [x] P5: ~~override-expiry + edge pass~~ ✅ 2026-10-20 (headless E2E): auto-select ✓, manual override ✓, boundary revert w/o reload ✓, 401 banner ✓, unreachable banner ✓ — pending: phone+nginx (P8)
- [x] P6: PWA — `manifest.webmanifest`, icons, `sw.js` (shell cache-first, API network-first) ✅ server-kill test
- [x] P6: in-app guide overlay (first-load + `?`) ✅
- [ ] P7: browser verification checklist (spec §6) incl. phone standalone install — Mac browser blocked by Sophos (see note), phone pending
- [x] P8: Pi deploy ✅ 2026-10-20 — `/var/www/navigome/`, nginx `/navigome/` + `/vikunja-api/` (proxy 200, manifest MIME fixed), repo copy in `deploy/nginx-navigome.conf`; **phone check pending**
- [x] P9: README.md ✅
- [ ] Final: verification run before "done" claim; **Sophos note**: Mac browsers currently get a Sophos warn page for browser→private-IP requests (curl unaffected) — whitelist `192.168.1.38` if Chrome/Safari fails; phone unaffected
