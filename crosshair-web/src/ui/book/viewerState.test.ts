import { describe, expect, it } from "vitest";

import { INITIAL_VIEWER, layers, step, type Spread } from "./viewerState";

const spreads: Spread[] = [
  [null, 0],
  [1, 2],
  [3, 4],
  [5, null],
];

describe("step", () => {
  it("animates single steps and lands on turnEnd", () => {
    const turning = step(INITIAL_VIEWER, { kind: "next" }, 4);
    expect(turning).toEqual({ spread: 0, turn: { to: 1 } });
    expect(step(turning, { kind: "turnEnd" }, 4)).toEqual({ spread: 1, turn: null });
  });

  it("ignores input mid-turn", () => {
    const turning = { spread: 1, turn: { to: 2 } };
    expect(step(turning, { kind: "next" }, 4)).toBe(turning);
    expect(step(turning, { kind: "jump", to: 0 }, 4)).toBe(turning);
  });

  it("stays put at either end", () => {
    expect(step(INITIAL_VIEWER, { kind: "prev" }, 4)).toEqual({ spread: 0, turn: null });
    expect(step({ spread: 3, turn: null }, { kind: "next" }, 4)).toEqual({ spread: 3, turn: null });
  });

  it("jumps directly and clamps", () => {
    expect(step(INITIAL_VIEWER, { kind: "jump", to: 9 }, 4)).toEqual({ spread: 3, turn: null });
  });

  it("clamps a stale spread after the book shrinks", () => {
    expect(step({ spread: 10, turn: null }, { kind: "prev" }, 4)).toEqual({
      spread: 3,
      turn: { to: 2 },
    });
  });
});

describe("layers", () => {
  it("shows the spread at rest", () => {
    expect(layers({ spread: 1, turn: null }, spreads)).toEqual({
      left: 1,
      right: 2,
      turning: null,
      leavesLeft: 1,
      leavesRight: 2,
    });
  });

  it("turns forward: current right page lifts, next spread's left is its back", () => {
    expect(layers({ spread: 1, turn: { to: 2 } }, spreads)).toEqual({
      left: 1,
      right: 4,
      turning: { from: "right", front: 2, back: 3 },
      leavesLeft: 1,
      leavesRight: 1,
    });
  });

  it("turns backward: current left page lifts, previous spread's right is its back", () => {
    expect(layers({ spread: 2, turn: { to: 1 } }, spreads)).toEqual({
      left: 1,
      right: 4,
      turning: { from: "left", front: 3, back: 2 },
      leavesLeft: 1,
      leavesRight: 1,
    });
  });
});
