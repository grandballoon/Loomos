/**
 * The finished book, bound as configured, with turnable pages. Click a page
 * or use the arrow keys to turn; the slider jumps anywhere. Staples, thread
 * and glued spines are drawn where they would show in the real book.
 */

import { useReducer, type CSSProperties } from "react";

import {
  BINDING_INFO,
  describeSpread,
  readingSpreads,
  spreadPosition,
  type BindingMethod,
  type BookStructure,
} from "../../core/binding";
import { LeafSvg, type LeafContext } from "./LeafSvg";
import { INITIAL_VIEWER, layers, step, type ViewerEvent, type ViewerState } from "./viewerState";

/** Page-edge thickness in px per physical leaf, and its cap. */
const EDGE_PX_PER_LEAF = 0.35;
const EDGE_MAX_PX = 10;

const edgeWidth = (leaves: number) => Math.min(EDGE_MAX_PX, leaves * EDGE_PX_PER_LEAF);

/** Stitching that shows at a signature's centre fold, in spread points. */
function SpineMarks(props: { method: BindingMethod; width: number; height: number }) {
  const { width: w, height: h } = props;
  const spine = BINDING_INFO[props.method].spine;
  if (spine === "staples") {
    const length = Math.min(34, h * 0.12);
    return (
      <g className="spine-staples">
        {[0.25, 0.75].map((at) => (
          <rect key={at} x={w - 1.2} y={h * at - length / 2} width={2.4} height={length} rx={1.2} />
        ))}
      </g>
    );
  }
  if (spine === "thread") {
    const stations = [0.1, 0.35, 0.65, 0.9].map((at) => at * h);
    return (
      <g className="spine-thread">
        <line x1={w} y1={stations[0]} x2={w} y2={stations[1]} />
        <line x1={w} y1={stations[2]} x2={w} y2={stations[3]} />
        {stations.map((y) => (
          <circle key={y} cx={w} cy={y} r={1.6} />
        ))}
      </g>
    );
  }
  return null;
}

function BookHalf(props: {
  side: "left" | "right";
  slot: number | null;
  leaves: number;
  context: LeafContext;
  onClick: () => void;
}) {
  if (props.slot === null) return <div className={`book-half ${props.side} empty`} />;
  const style = { "--edge": `${edgeWidth(props.leaves)}px` } as CSSProperties;
  return (
    <div className={`book-half ${props.side}`} style={style} onClick={props.onClick}>
      <div className="book-board" />
      <div className="book-edges" />
      <LeafSvg context={props.context} slot={props.slot} className="book-page" />
    </div>
  );
}

export function BookViewer(props: {
  context: LeafContext;
  structure: BookStructure;
  method: BindingMethod;
}) {
  const { context, structure, method } = props;
  const { geometry } = context;
  const spreads = readingSpreads(structure.paddedLeafCount);
  const [state, dispatch] = useReducer(
    (current: ViewerState, event: ViewerEvent) => step(current, event, spreads.length),
    INITIAL_VIEWER,
  );
  const view = layers(state, spreads);
  const shown = Math.min(state.spread, spreads.length - 1);
  const [left, right] = spreads[shown];
  const position = spreadPosition(left, right, structure);
  const info = BINDING_INFO[method];
  const atRest = state.turn === null;

  return (
    <div
      className="book-viewer"
      data-binding={method}
      data-opens-flat={info.opensFlat}
      tabIndex={0}
      aria-label="Finished book viewer"
      onKeyDown={(event) => {
        const events: Record<string, ViewerEvent> = {
          ArrowRight: { kind: "next" },
          ArrowLeft: { kind: "prev" },
          Home: { kind: "jump", to: 0 },
          End: { kind: "jump", to: spreads.length - 1 },
        };
        const mapped = events[event.key];
        if (mapped) {
          event.preventDefault();
          dispatch(mapped);
        }
      }}
    >
      <div className="book-stage">
        <div
          className="book-spread"
          style={{ aspectRatio: `${geometry.width * 2} / ${geometry.height}` }}
        >
          <BookHalf
            side="left"
            slot={view.left}
            leaves={view.leavesLeft}
            context={context}
            onClick={() => dispatch({ kind: "prev" })}
          />
          <BookHalf
            side="right"
            slot={view.right}
            leaves={view.leavesRight}
            context={context}
            onClick={() => dispatch({ kind: "next" })}
          />

          {atRest && left !== null && right !== null && (
            <>
              <div className={position.seam ? "book-gutter seam" : "book-gutter"} />
              {position.centre && (
                <svg
                  className="book-marks"
                  viewBox={`0 0 ${geometry.width * 2} ${geometry.height}`}
                  preserveAspectRatio="none"
                >
                  <SpineMarks method={method} width={geometry.width} height={geometry.height} />
                </svg>
              )}
            </>
          )}

          {view.turning && (
            <div
              className={`book-turning from-${view.turning.from}`}
              onAnimationEnd={() => dispatch({ kind: "turnEnd" })}
            >
              <div className="book-face front">
                {view.turning.front !== null && (
                  <LeafSvg context={context} slot={view.turning.front} className="book-page" />
                )}
              </div>
              <div className="book-face back">
                {view.turning.back !== null && (
                  <LeafSvg context={context} slot={view.turning.back} className="book-page" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="book-controls">
        <button
          type="button"
          className="ghost-button"
          aria-label="Previous page"
          disabled={shown === 0}
          onClick={() => dispatch({ kind: "prev" })}
        >
          ‹
        </button>
        <input
          type="range"
          className="book-scrubber"
          min={0}
          max={spreads.length - 1}
          value={state.turn ? state.turn.to : shown}
          aria-label="Spread"
          onChange={(event) => dispatch({ kind: "jump", to: Number(event.target.value) })}
        />
        <button
          type="button"
          className="ghost-button"
          aria-label="Next page"
          disabled={shown === spreads.length - 1}
          onClick={() => dispatch({ kind: "next" })}
        >
          ›
        </button>
      </div>
      <p className="book-caption">{describeSpread(shown, left, right, structure, method)}</p>
    </div>
  );
}
