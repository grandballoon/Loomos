/**
 * Page-turning viewer state, as pure values. The viewer component holds a
 * ViewerState, feeds it events through `step`, and draws `layers`.
 */

export type Spread = [number | null, number | null];

export interface ViewerState {
  /** Reading-order spread currently shown (or being turned away from). */
  spread: number;
  /** A one-leaf turn in progress toward `to`, animating. */
  turn: { to: number } | null;
}

export type ViewerEvent =
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "jump"; to: number }
  | { kind: "turnEnd" };

export const INITIAL_VIEWER: ViewerState = { spread: 0, turn: null };

const clamp = (value: number, count: number) => Math.max(0, Math.min(count - 1, value));

/**
 * Next state. Single steps animate as a turn; jumps land directly. Input
 * during a turn is ignored except the turn finishing.
 */
export function step(state: ViewerState, event: ViewerEvent, spreadCount: number): ViewerState {
  const spread = clamp(state.spread, spreadCount);
  if (event.kind === "turnEnd") {
    return state.turn ? { spread: clamp(state.turn.to, spreadCount), turn: null } : state;
  }
  if (state.turn) return state;
  if (event.kind === "jump") return { spread: clamp(event.to, spreadCount), turn: null };
  const to = clamp(spread + (event.kind === "next" ? 1 : -1), spreadCount);
  return to === spread ? { spread, turn: null } : { spread, turn: { to } };
}

/** Which slot each layer of the viewer shows. */
export interface ViewerLayers {
  /** Pages lying still under the turning leaf (or the whole spread at rest). */
  left: number | null;
  right: number | null;
  /** The turning leaf: which half it starts on and the slot on each face. */
  turning: { from: "left" | "right"; front: number | null; back: number | null } | null;
  /** Physical leaves stacked on each side, for drawing page edges. */
  leavesLeft: number;
  leavesRight: number;
}

export function layers(state: ViewerState, spreads: Spread[]): ViewerLayers {
  const count = spreads.length;
  const current = clamp(state.spread, count);
  const [curLeft, curRight] = spreads[current];
  // Spread i has i leaves turned to the left; the rest lie on the right.
  // Mid-turn, the lifted leaf is on neither stack.
  const edges = (leftLeaves: number) => ({
    leavesLeft: leftLeaves,
    leavesRight: count - 1 - leftLeaves,
  });
  if (!state.turn) {
    return { left: curLeft, right: curRight, turning: null, ...edges(current) };
  }
  const to = clamp(state.turn.to, count);
  const [toLeft, toRight] = spreads[to];
  if (to > current) {
    // The leaf lifts off the right stack and lands on the left.
    return {
      left: curLeft,
      right: toRight,
      turning: { from: "right", front: curRight, back: toLeft },
      ...edges(current),
      leavesRight: count - 1 - to,
    };
  }
  return {
    left: toLeft,
    right: curRight,
    turning: { from: "left", front: curLeft, back: toRight },
    ...edges(to),
    leavesRight: count - 1 - current,
  };
}
