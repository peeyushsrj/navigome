import test from "node:test";
import assert from "node:assert/strict";
import { parseHM, stateFor, overrideExpiry, resolveState, nextTransition } from "./statemachine.js";
import config from "./config.js";

const states = config.states;
/** @param {number} h @param {number} m @param {number} [d] */
const at = (h, m, d = 20) => new Date(2026, 9, d, h, m).getTime();

test("parseHM converts HH:MM to minutes", () => {
  assert.equal(parseHM("00:00"), 0);
  assert.equal(parseHM("09:30"), 570);
  assert.equal(parseHM("17:30"), 1050);
});

test("parseHM rejects invalid values with RangeError", () => {
  assert.throws(() => parseHM("99:99"), RangeError);
  assert.throws(() => parseHM("ab:cd"), RangeError);
  assert.throws(() => parseHM("7"), RangeError);
});

test("stateFor picks the state whose window contains now", () => {
  assert.equal(stateFor(at(6, 0), states), "morning");
  assert.equal(stateFor(at(12, 0), states), "daytime");
  assert.equal(stateFor(at(18, 0), states), "sunset");
  assert.equal(stateFor(at(20, 0), states), "evening");
  assert.equal(stateFor(at(23, 0), states), "night");
  assert.equal(stateFor(at(4, 0), states), "night"); // midnight wrap
  assert.equal(stateFor(at(4, 59), states), "night");
});

test("stateFor: window start inclusive, end exclusive", () => {
  assert.equal(stateFor(at(9, 0), states), "daytime"); // 09:00 exactly = start of daytime
  assert.equal(stateFor(at(8, 59), states), "morning");
  assert.equal(stateFor(at(17, 30), states), "sunset");
});

test("overrideExpiry: end of the state's window, midnight-aware", () => {
  assert.equal(overrideExpiry(states, "morning", at(6, 0)), at(9, 0));
  assert.equal(overrideExpiry(states, "night", at(22, 0)), at(5, 0, 21)); // next day
  assert.equal(overrideExpiry(states, "daytime", at(12, 0)), at(17, 30));
});

test("overrideExpiry: unknown state id → null", () => {
  assert.equal(overrideExpiry(states, "nope", at(6, 0)), null);
});

test("resolveState honors a live override", () => {
  const r = resolveState(at(6, 0), states, { stateId: "sunset", validUntil: at(6, 1) });
  assert.deepEqual(r, { stateId: "sunset", mode: "override" });
});

test("resolveState drops an expired override", () => {
  const r = resolveState(at(6, 0), states, { stateId: "sunset", validUntil: at(5, 59) });
  assert.equal(r.mode, "auto");
  assert.equal(r.stateId, "morning");
});

test("resolveState: unknown override id → auto", () => {
  const r = resolveState(at(6, 0), states, { stateId: "nope", validUntil: at(7, 0) });
  assert.equal(r.mode, "auto");
  assert.equal(r.stateId, "morning");
});

test("resolveState: no override → auto", () => {
  const r = resolveState(at(12, 0), states, null);
  assert.deepEqual(r, { stateId: "daytime", mode: "auto" });
});

test("nextTransition: next boundary strictly after now", () => {
  assert.equal(nextTransition(at(8, 59), states), at(9, 0)); // same day
  assert.equal(nextTransition(at(18, 0), states), at(18, 30));
  assert.equal(nextTransition(at(23, 0), states), at(5, 0, 21)); // cross-midnight
});

test("stateFor skips invalid windows but matches valid ones", () => {
  const bad = [
    { id: "broken", name: "x", window: ["99:99", "10:00"], projects: [], color: "#000" },
    { id: "fine", name: "y", window: ["10:00", "11:00"], projects: [], color: "#000" },
  ];
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(stateFor(at(10, 30), bad), "fine");
    assert.equal(stateFor(at(12, 0), bad), null);
  } finally {
    console.error = orig;
  }
});
