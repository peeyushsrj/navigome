/**
 * Pure time-of-day state machine. No DOM, no I/O.
 * Windows are ["HH:MM","HH:MM"] local time, start inclusive, end exclusive.
 * A window with start > end wraps midnight (e.g. night 21:30–05:00).
 */

/**
 * @param {string} hm "HH:MM" 24h
 * @returns {number} minutes since midnight
 * @throws {RangeError} invalid format or out-of-range value
 */
export function parseHM(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) throw new RangeError(`invalid time: ${hm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new RangeError(`invalid time: ${hm}`);
  return h * 60 + min;
}

/** @param {number} now epoch ms @returns {number} fractional minutes since local midnight */
function minutesNow(now) {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * @param {number} minutes minutes since midnight (can be fractional)
 * @param {[string, string]} win
 * @returns {boolean} whether minutes falls inside win (midnight-aware)
 * @throws {RangeError} invalid window strings
 */
function inWindow(minutes, [startHM, endHM]) {
  const start = parseHM(startHM);
  const end = parseHM(endHM);
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end; // wraps midnight
}

/**
 * @param {number} now epoch ms
 * @param {Array<{id: string, window: [string, string]}>} states
 * @returns {string | null} active state id, first match wins
 */
export function stateFor(now, states) {
  const minutes = minutesNow(now);
  for (const s of states) {
    try {
      if (inWindow(minutes, s.window)) return s.id;
    } catch (err) {
      if (err instanceof RangeError) {
        console.error(`navigome: bad window for state "${s.id}": ${s.window.join("-")}`);
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * @param {Array<{id: string, window: [string, string]}>} states
 * @param {string} stateId
 * @param {number} now epoch ms
 * @returns {number | null} epoch ms when an override of stateId expires (end of its window; may be next day)
 */
export function overrideExpiry(states, stateId, now) {
  const s = states.find((x) => x.id === stateId);
  if (!s) return null;
  let endMin;
  try {
    endMin = parseHM(s.window[1]);
  } catch (err) {
    console.error(`navigome: bad window end for state "${stateId}"`);
    return null;
  }
  const d = new Date(now);
  const expiry = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, endMin, 0);
  if (expiry.getTime() <= now) expiry.setDate(expiry.getDate() + 1);
  return expiry.getTime();
}

/**
 * @param {number} now epoch ms
 * @param {Array<{id: string, window: [string, string]}>} states
 * @param {{stateId: string, validUntil: number} | null} override
 * @returns {{stateId: string | null, mode: "auto" | "override"}}
 */
export function resolveState(now, states, override) {
  const known = override != null && states.some((s) => s.id === override.stateId);
  if (known && now < override.validUntil) {
    return { stateId: override.stateId, mode: "override" };
  }
  return { stateId: stateFor(now, states), mode: "auto" };
}

/**
 * @param {number} now epoch ms
 * @param {Array<{id: string, window: [string, string]}>} states
 * @returns {number | null} epoch ms of the next window boundary strictly after now
 */
export function nextTransition(now, states) {
  const bounds = new Set();
  for (const s of states) {
    try {
      bounds.add(parseHM(s.window[0]));
      bounds.add(parseHM(s.window[1]));
    } catch (err) {
      if (err instanceof RangeError) {
        console.error(`navigome: bad window for state "${s.id}": ${s.window.join("-")}`);
        continue;
      }
      throw err;
    }
  }
  const d = new Date(now);
  let best = null;
  for (const b of bounds) {
    const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, b, 0);
    if (cand.getTime() <= now) cand.setDate(cand.getDate() + 1);
    if (best === null || cand.getTime() < best) best = cand.getTime();
  }
  return best;
}
