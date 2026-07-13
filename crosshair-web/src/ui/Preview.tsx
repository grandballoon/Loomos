/**
 * Live preview of the book. Two views: "Spreads" shows the bound book in
 * reading order (what you flip through); "Sheets" shows the imposed printer
 * faces per signature (what comes out of the printer).
 *
 * Everything is SVG in page-point coordinates. Effect geometry comes from the
 * same shape functions the PDF renderer uses; only the y-axis is flipped
 * (PDF is y-up, SVG y-down).
 */

import { useMemo, useState, type ReactNode } from "react";

import { contentBox, leafContentRect, type Leaf, type PageGeometry } from "../core/book";
import { effectShapes, type EffectSettings, type Shape } from "../core/effects";
import { PAGE_LABEL_STYLE, pageLabel, type ImpositionPlan } from "../core/imposition";
import type { ImageItem } from "../state";

const TITLE_STYLES = [
  { weight: 700, size: 16 },
  { weight: 400, size: 10 },
  { weight: 400, size: 8 },
];

function shapeToSvg(shape: Shape, flipY: (y: number) => number, key: number, stroke: string, thickness: number) {
  switch (shape.kind) {
    case "line":
      return (
        <line
          key={key}
          x1={shape.x1}
          y1={flipY(shape.y1)}
          x2={shape.x2}
          y2={flipY(shape.y2)}
          stroke={stroke}
          strokeWidth={thickness}
        />
      );
    case "circle":
      return <circle key={key} cx={shape.cx} cy={flipY(shape.cy)} r={shape.r} fill={stroke} />;
    case "rect":
      return (
        <rect
          key={key}
          x={shape.x}
          y={flipY(shape.y + shape.h)}
          width={shape.w}
          height={shape.h}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
        />
      );
  }
}

/** "Signature-item" tag at the lower fore-edge corner of the leaf at (ox, oy). */
function PageLabel(props: { slot: number; ox: number; oy: number; faceH: number; leafW: number }) {
  // Even slots are rectos (spine on the left), so their fore edge is on the
  // right and the tag right-aligns there; versos mirror it on the left.
  const recto = props.slot % 2 === 0;
  return (
    <text
      x={
        recto
          ? props.ox + props.leafW - PAGE_LABEL_STYLE.inset
          : props.ox + PAGE_LABEL_STYLE.inset
      }
      y={props.faceH - (props.oy + PAGE_LABEL_STYLE.inset)}
      fontSize={PAGE_LABEL_STYLE.size}
      textAnchor={recto ? "end" : "start"}
      className="leaf-pagenum"
    >
      {pageLabel(props.slot)}
    </text>
  );
}

/** One leaf drawn at (ox, oy) in PDF coords on a face of height faceH. */
function LeafGroup(props: {
  leaf: Leaf | null;
  geometry: PageGeometry;
  images: ImageItem[];
  effectSettings: EffectSettings;
  ox: number;
  oy: number;
  faceH: number;
}) {
  const { leaf, geometry, effectSettings, ox, oy, faceH } = props;
  const flipY = (y: number) => faceH - y;

  const pageOutline = (
    <rect
      x={ox}
      y={flipY(oy + geometry.height)}
      width={geometry.width}
      height={geometry.height}
      className="leaf-outline"
    />
  );

  if (!leaf || leaf.kind === "blank") return <g>{pageOutline}</g>;

  if (leaf.kind === "title") {
    const box = contentBox(geometry, leaf.role);
    let baseline = oy + box.y + box.h * 0.62;
    const lines: ReactNode[] = [];
    (leaf.titleLines ?? []).forEach((text, index) => {
      const style = TITLE_STYLES[Math.min(index, TITLE_STYLES.length - 1)];
      lines.push(
        <text
          key={index}
          x={ox + box.x + box.w / 2}
          y={flipY(baseline)}
          textAnchor="middle"
          fontSize={style.size}
          fontWeight={style.weight}
          className="leaf-title-text"
        >
          {text}
        </text>,
      );
      baseline -= style.size * 2.2;
    });
    return (
      <g>
        {pageOutline}
        {lines}
      </g>
    );
  }

  const rect = leafContentRect(leaf, geometry);
  if (!rect) return <g>{pageOutline}</g>;
  const placed = { x: rect.x + ox, y: rect.y + oy, w: rect.w, h: rect.h };
  const item = leaf.imageIndex !== undefined ? props.images[leaf.imageIndex] : undefined;
  const color = effectSettings.color;
  const stroke = `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
  const shapes = effectShapes(leaf.effect ?? "none", effectSettings, placed);

  return (
    <g>
      {pageOutline}
      {leaf.kind === "image" && item && (
        <image
          href={item.source.url}
          x={placed.x}
          y={flipY(placed.y + placed.h)}
          width={placed.w}
          height={placed.h}
          preserveAspectRatio="none"
        />
      )}
      {shapes.map((shape, index) =>
        shapeToSvg(shape, flipY, index, stroke, effectSettings.thickness),
      )}
    </g>
  );
}

export function Preview(props: {
  leaves: Leaf[];
  plan: ImpositionPlan;
  geometry: PageGeometry;
  images: ImageItem[];
  effectSettings: EffectSettings;
}) {
  const { leaves, plan, geometry } = props;
  const [view, setView] = useState<"spreads" | "sheets">("spreads");

  // Spreads: cover alone, then (1,2), (3,4), … padded slots show as blanks.
  const spreads = useMemo(() => {
    const total = plan.paddedLeafCount;
    const result: [number | null, number | null][] = [[null, 0]];
    for (let left = 1; left < total; left += 2) {
      result.push([left, left + 1 < total ? left + 1 : null]);
    }
    return result;
  }, [plan.paddedLeafCount]);

  const leafAt = (index: number | null): Leaf | null =>
    index === null ? null : leaves[index] ?? { kind: "blank", role: index % 2 === 0 ? "recto" : "verso" };

  const spreadW = geometry.width * 2;

  // Per-face captions: sheet numbering restarts inside each signature.
  const faceCaptions = useMemo(() => {
    const captions: string[] = [];
    let signature = -1;
    let faceInSignature = 0;
    for (const face of plan.faces) {
      if (face.signature !== signature) {
        signature = face.signature;
        faceInSignature = 0;
      }
      const sheet = Math.floor(faceInSignature / 2) + 1;
      captions.push(
        `Signature ${signature + 1} · Sheet ${sheet} · ${face.side === "front" ? "Front" : "Back"}`,
      );
      faceInSignature += 1;
    }
    return captions;
  }, [plan.faces]);

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <div className="view-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={view === "spreads"}
            className={view === "spreads" ? "active" : ""}
            onClick={() => setView("spreads")}
          >
            Book spreads
          </button>
          <button
            role="tab"
            aria-selected={view === "sheets"}
            className={view === "sheets" ? "active" : ""}
            onClick={() => setView("sheets")}
          >
            Printed sheets
          </button>
        </div>
      </div>

      {view === "spreads" ? (
        <div className="preview-grid">
          {spreads.map(([left, right], index) => (
            <figure className="preview-card" key={index}>
              <svg
                viewBox={`0 0 ${spreadW} ${geometry.height}`}
                className="preview-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <LeafGroup
                  leaf={leafAt(left)}
                  geometry={geometry}
                  images={props.images}
                  effectSettings={props.effectSettings}
                  ox={0}
                  oy={0}
                  faceH={geometry.height}
                />
                <LeafGroup
                  leaf={leafAt(right)}
                  geometry={geometry}
                  images={props.images}
                  effectSettings={props.effectSettings}
                  ox={geometry.width}
                  oy={0}
                  faceH={geometry.height}
                />
                {left !== null && (
                  <PageLabel
                    slot={left}
                    ox={0}
                    oy={0}
                    faceH={geometry.height}
                    leafW={geometry.width}
                  />
                )}
                {right !== null && (
                  <PageLabel
                    slot={right}
                    ox={geometry.width}
                    oy={0}
                    faceH={geometry.height}
                    leafW={geometry.width}
                  />
                )}
                <line
                  x1={geometry.width}
                  y1={0}
                  x2={geometry.width}
                  y2={geometry.height}
                  className="spine-line"
                />
              </svg>
              <figcaption>
                {index === 0 ? "Cover" : `Pages ${2 * index}–${2 * index + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="preview-grid">
          {plan.faces.map((face, index) => (
            <figure className="preview-card" key={index}>
              <svg
                viewBox={`0 0 ${plan.sheetSize.w} ${plan.sheetSize.h}`}
                className="preview-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <rect
                  x={0}
                  y={0}
                  width={plan.sheetSize.w}
                  height={plan.sheetSize.h}
                  className="sheet-outline"
                />
                {face.placements.map((placement, index) => (
                  <g key={index}>
                    <LeafGroup
                      leaf={placement.leaf !== null ? leaves[placement.leaf] ?? null : null}
                      geometry={geometry}
                      images={props.images}
                      effectSettings={props.effectSettings}
                      ox={placement.x}
                      oy={placement.y}
                      faceH={plan.sheetSize.h}
                    />
                    <PageLabel
                      slot={placement.slot}
                      ox={placement.x}
                      oy={placement.y}
                      faceH={plan.sheetSize.h}
                      leafW={geometry.width}
                    />
                  </g>
                ))}
                <line
                  x1={plan.sheetSize.w / 2}
                  y1={0}
                  x2={plan.sheetSize.w / 2}
                  y2={plan.sheetSize.h}
                  className="fold-line"
                />
              </svg>
              <figcaption>{faceCaptions[index]}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
