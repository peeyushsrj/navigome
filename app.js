import config from "./config.js";
import { overrideExpiry, resolveState, nextTransition } from "./statemachine.js";
import { listTasks, setTaskDone, testConnection, VikunjaError } from "./vikunja.js";

/** @param {string} id */
const $ = (id) => document.getElementById(id);
const LS = { token: "navigome.token", base: "navigome.apiBase", override: "navigome.override" };

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {Array<Node | string>} [children]
 * @returns {HTMLElement}
 */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) node.append(c);
  return node;
}

/** @param {number} ms @returns {string} "HH:MM" local */
const fmtTime = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** @param {string} iso @returns {string} "Oct 20" */
const fmtDue = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** @returns {{stateId: string | null, mode: "auto" | "override"}} */
function resolveNow() {
  return resolveState(Date.now(), config.states, override);
}

/** @param {string | null} stateId */
function stateById(stateId) {
  return config.states.find((s) => s.id === stateId) || null;
}

/**
 * @param {"no-token" | "api-down" | "unmapped" | "ok" | null} kind
 * @param {string} [text]
 */
function banner(kind, text) {
  const b = $("banner");
  if (!kind) {
    b.hidden = true;
    b.textContent = "";
    return;
  }
  b.hidden = false;
  b.className = kind === "ok" ? "ok" : "";
  b.textContent = text || "";
}

/** Read local storage into module state. */
function loadPrefs() {
  token = localStorage.getItem(LS.token) || "";
  base = localStorage.getItem(LS.base) || "/vikunja-api";
  try {
    override = JSON.parse(localStorage.getItem(LS.override) || "null");
  } catch {
    override = null;
  }
}

/** @param {string} stateId @param {number} until */
function saveOverride(stateId, until) {
  override = { stateId, validUntil: until };
  localStorage.setItem(LS.override, JSON.stringify(override));
}

function renderHeader() {
  const resolved = resolveNow();
  const st = stateById(resolved.stateId);
  const nameEl = $("state-name");
  nameEl.textContent = st ? st.name : "No state";
  nameEl.style.setProperty("--state-color", st ? st.color : "#9aa4ad");

  const badge = $("override-badge");
  if (resolved.mode === "override" && override) {
    badge.hidden = false;
    badge.textContent = `manual — until ${fmtTime(override.validUntil)}`;
  } else {
    badge.hidden = true;
  }

  for (const chip of document.querySelectorAll(".chip")) {
    chip.classList.toggle("active", chip.dataset.stateId === resolved.stateId);
  }
  return resolved;
}

function renderChips() {
  const nav = $("chips");
  nav.textContent = "";
  for (const s of config.states) {
    nav.append(
      el(
        "button",
        {
          class: "chip",
          type: "button",
          "data-state-id": s.id,
          style: `--chip-color:${s.color}`,
          onclick: () => {
            const until = overrideExpiry(config.states, s.id, Date.now());
            if (until == null) return;
            saveOverride(s.id, until);
            void tick(true);
          },
        },
        [s.name.split(" · ")[0]],
      ),
    );
  }
}

/** @param {import("./vikunja.js").Task[]} list */
function renderTasks(list) {
  const ul = $("task-list");
  ul.textContent = "";
  if (list.length === 0) {
    ul.append(el("li", { class: "empty" }, ["No tasks here — enjoy the space."]));
    return;
  }
  for (const t of list) {
    const box = el("input", {
      type: "checkbox",
      ...(t.done ? { checked: true } : {}),
      onchange: (e) => void toggleTask(t, e.target.checked, e.target),
    });
    const kids = [box, el("span", { class: "title" }, [t.title])];
    if (t.priority > 0) kids.push(el("span", { class: "prio" }, ["•".repeat(Math.min(5, t.priority))]));
    if (t.due_date) kids.push(el("span", { class: "due" }, [fmtDue(t.due_date)]));
    const li = el("li", { class: t.done ? "done" : "" }, kids);
    ul.append(li);
  }
}

/**
 * Optimistic toggle with revert on failure.
 * @param {import("./vikunja.js").Task} task
 * @param {boolean} done
 * @param {HTMLInputElement} box
 */
async function toggleTask(task, done, box) {
  const prev = task.done;
  task.done = done;
  box.closest("li").classList.toggle("done", done);
  try {
    await setTaskDone(base, token, task.id, done);
    banner(null);
  } catch (err) {
    task.done = prev;
    box.checked = prev;
    box.closest("li").classList.toggle("done", prev);
    banner("api-down", errMessage(err));
  }
}

/** @param {unknown} err */
function errMessage(err) {
  if (err instanceof VikunjaError && err.status === 401) return "Token rejected — check Settings.";
  if (err instanceof VikunjaError) return `Vikunja replied ${err.status}. Retrying later.`;
  return "Vikunja unreachable — showing last loaded tasks.";
}

/** Fetch + render tasks for the current state. */
async function refresh() {
  const { stateId } = resolveNow();
  const st = stateById(stateId);
  if (!st || st.projects.length === 0) {
    banner("unmapped", "No Vikunja project mapped for this state.");
    renderTasks([]);
    return;
  }
  if (!token) {
    banner("no-token", "Add your Vikunja API token in Settings.");
    openSettingsForToken();
    renderTasks([]);
    return;
  }
  try {
    const list = await listTasks(base, token, st.projects);
    banner(null);
    renderTasks(list);
  } catch (err) {
    banner("api-down", errMessage(err)); // last-good list retained: no renderTasks here
  }
}

/** @param {boolean} [force] force refetch */
async function tick(force = false) {
  const resolved = renderHeader();
  $("clock").textContent = fmtTime(Date.now());
  const nt = nextTransition(Date.now(), config.states);
  $("next-transition").textContent = nt ? `next transition ${fmtTime(nt)}` : "next —";
  if (resolved.stateId !== lastStateId || force) {
    lastStateId = resolved.stateId;
    await refresh();
  }
}

let token = "";
let base = "/vikunja-api";
let override = null;
let lastStateId = /** @type {string | null} */ (undefined);

/**
 * Auto-open Settings for the missing token exactly once per load,
 * and never on top of the first-run guide (defers until guide closes).
 * Later state changes: banner only (no popup).
 */
let settingsOffered = false;
function openSettingsForToken() {
  if (settingsOffered) return;
  settingsOffered = true;
  const open = () => {
    const s = $("settings");
    if (!s.open) {
      s.showModal();
      $("token-input").focus();
    }
  };
  const g = $("guide");
  if (g.open) g.addEventListener("close", open, { once: true });
  else open();
}

function init() {
  loadPrefs();
  renderChips();

  if (!localStorage.getItem("navigome.guideSeen")) {
    $("guide").showModal();
    $("guide").addEventListener(
      "close",
      () => localStorage.setItem("navigome.guideSeen", "1"),
      { once: true },
    );
  }

  $("save-settings").addEventListener("click", () => {
    token = $("token-input").value.trim();
    base = $("api-input").value.trim() || "/vikunja-api";
    localStorage.setItem(LS.token, token);
    localStorage.setItem(LS.base, base);
    void tick(true);
  });
  $("test-conn").addEventListener("click", async () => {
    const b = $("api-input").value.trim() || "/vikunja-api";
    const t = $("token-input").value.trim();
    const r = await testConnection(b, t);
    $("conn-result").textContent = `${r.ok ? "✓" : "✗"} ${r.message}`;
  });
  $("help-btn").addEventListener("click", () => $("guide").showModal());

  void tick(true); // first load: renders header + fetches (opens Settings if no token)
  setInterval(() => void tick(), 1000);
  setInterval(() => void tick(), 30000);
}

init();

if (location.protocol !== "file:" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
