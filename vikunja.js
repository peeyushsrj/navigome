/**
 * Vikunja REST client. Every call: 10s abort timeout, Bearer auth.
 * Verified live 2026-10-20 on Vikunja v2.7.0:
 * - OR filter `project_id = 14 || project_id = 12` → 200 (PRIMARY strategy)
 * - POST /api/v1/tasks/{id} {"done":bool} round-trips
 * - due_date arrives as zero-date sentinel "0001-01-01T00:00:00Z", never null
 */

/** @typedef {{id: number, title: string, done: boolean, due_date: string | null, priority: number, project_id: number}} Task */

export class VikunjaError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} body response body
   */
  constructor(status, body) {
    super(`vikunja ${status}: ${body.slice(0, 200)}`);
    this.name = "VikunjaError";
    this.status = status;
    this.body = body;
  }
}

/**
 * @param {string} base e.g. "/vikunja-api" or "http://vikunja.local:3456"
 * @param {string} token API token
 * @param {string} path e.g. "/api/v1/projects"
 * @param {RequestInit} [init]
 * @returns {Promise<any>} parsed JSON
 * @throws {VikunjaError} non-2xx response
 */
async function req(base, token, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new VikunjaError(res.status, body);
  return body ? JSON.parse(body) : null;
}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<Array<{id: number, title: string}>>}
 */
export async function listProjects(base, token) {
  return req(base, token, "/api/v1/projects");
}

/**
 * @param {any} raw
 * @returns {Task}
 */
function normalizeTask(raw) {
  const due =
    !raw.due_date || raw.due_date.startsWith("0001-01-01") ? null : raw.due_date;
  return {
    id: raw.id,
    title: raw.title,
    done: Boolean(raw.done),
    due_date: due,
    priority: Number(raw.priority) || 0,
    project_id: raw.project_id,
  };
}

/**
 * Tasks for the given projects. Strategy ladder (see file header):
 * 1. single OR-filter query — verified primary on this instance
 * 2. on 400: one query per project, concatenated
 * 3. on 400 again: unfiltered query, client-side project filter
 * Auth/network errors always propagate.
 * @param {string} base
 * @param {string} token
 * @param {number[]} projectIds
 * @returns {Promise<Task[]>}
 */
export async function listTasks(base, token, projectIds) {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return [];
  const filter = ids.map((id) => `project_id = ${id}`).join(" || ");
  try {
    const rows = await req(
      base,
      token,
      `/api/v1/tasks?filter=${encodeURIComponent(filter)}`,
    );
    const tasks = Array.isArray(rows) ? rows.map(normalizeTask) : [];
    // rows missing project_id → cannot trust filter, degrade to client-side
    if (tasks.length > 0 && tasks.every((t) => t.project_id != null)) return tasks;
  } catch (err) {
    if (!(err instanceof VikunjaError) || err.status !== 400) throw err;
  }
  // Strategy 2: per-project queries
  try {
    const out = [];
    for (const id of ids) {
      const rows = await req(
        base,
        token,
        `/api/v1/tasks?filter=${encodeURIComponent(`project_id = ${id}`)}`,
      );
      if (Array.isArray(rows)) out.push(...rows.map(normalizeTask));
    }
    return out;
  } catch (err) {
    if (!(err instanceof VikunjaError) || err.status !== 400) throw err;
  }
  // Strategy 3: unfiltered + client-side
  const rows = await req(base, token, "/api/v1/tasks");
  const wanted = new Set(ids);
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeTask)
    .filter((t) => wanted.has(t.project_id));
}

/**
 * @param {string} base
 * @param {string} token
 * @param {number} taskId
 * @param {boolean} done
 * @returns {Promise<void>}
 */
export async function setTaskDone(base, token, taskId, done) {
  await req(base, token, `/api/v1/tasks/${taskId}`, {
    method: "POST",
    body: JSON.stringify({ done }),
  });
}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testConnection(base, token) {
  try {
    const projects = await listProjects(base, token);
    return { ok: true, message: `${projects.length} projects reachable` };
  } catch (err) {
    if (err instanceof VikunjaError && err.status === 401) {
      return { ok: false, message: "token rejected" };
    }
    if (err instanceof VikunjaError) {
      return { ok: false, message: `server replied ${err.status}` };
    }
    return { ok: false, message: "unreachable (timeout?)" };
  }
}
