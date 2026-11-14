/**
 * SVG drawing of single book leaves, shared by every book preview.
 *
 * Everything is in page-point coordinates. Effect geometry comes from the
 * same shape functions the PDF renderer uses; only the y-axis is flipped
 * (PDF is y-up, SVG y-down).
 */

import type { ReactNode } from "react";

import { pageLabel } from "../../core/binding";
import { contentBox, leafAt, leafContentRect, type Leaf, type PageGeometry } from "../../core/book";
import { effectShapes, type EffectSettings, type Shape } from "../../core/effects";
import { PAGE_LABEL_STYLE } from "../../core/imposition";
import type { ImageItem } from "../../state";

const TITLE_STYLES = [
  { weight: 700, size: 16 },
  { weight: 400, size: 10 },
  { weight: 400, size: 8 },
];

/** What every leaf drawing needs besides its own position. */
export interface LeafContext {
  leaves: Leaf[];
  geometry: PageGeometry;
  images: ImageItem[];
  effectSettings: EffectSettings;
  leavesPerSignature: number;
}

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

/** Page tag (e.g. "B3") at the lower fore-edge corner of the leaf at (ox, oy). */
export function PageLabel(props: {
  slot: number;
  leavesPerSignature: number;
  ox: number;
  oy: number;
  faceH: number;
  leafW: number;
}) {
  // Even slots are rectos (spine on the left), so their fore edge is on the
  // right and the tag right-aligns there; versos mirror it on the left.
  const recto = props.slot % 2 === 0;
  return (
    <text
      x={recto ? props.ox + props.leafW - PAGE_LABEL_STYLE.inset : props.ox + PAGE_LABEL_STYLE.inset}
      y={props.faceH - (props.oy + PAGE_LABEL_STYLE.inset)}
      fontSize={PAGE_LABEL_STYLE.size}
      textAnchor={recto ? "end" : "start"}
      className="leaf-pagenum"
    >
      {pageLabel(props.slot, props.leavesPerSignature)}
    </text>
  );
}

/** One leaf's content drawn at (ox, oy) in PDF coords on a face of height faceH. */
export function LeafGroup(props: {
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
      {shapes.map((shape, index) => shapeToSvg(shape, flipY, index, stroke, effectSettings.thickness))}
    </g>
  );
}

/** A leaf with its tag, at (ox, oy) on a face of height faceH. */
export function TaggedLeaf(props: {
  context: LeafContext;
  slot: number | null;
  ox: number;
  oy: number;
  faceH: number;
}) {
  const { context, slot } = props;
  return (
    <g>
      <LeafGroup
        leaf={leafAt(context.leaves, slot)}
        geometry={context.geometry}
        images={context.images}
        effectSettings={context.effectSettings}
        ox={props.ox}
        oy={props.oy}
        faceH={props.faceH}
      />
      {slot !== null && (
        <PageLabel
          slot={slot}
          leavesPerSignature={context.leavesPerSignature}
          ox={props.ox}
          oy={props.oy}
          faceH={props.faceH}
          leafW={context.geometry.width}
        />
      )}
    </g>
  );
}

/** One leaf as its own SVG, filling its container. */
export function LeafSvg(props: { context: LeafContext; slot: number | null; className?: string }) {
  const { geometry } = props.context;
  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className={props.className}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={geometry.width} height={geometry.height} fill="#ffffff" />
      <TaggedLeaf context={props.context} slot={props.slot} ox={0} oy={0} faceH={geometry.height} />
    </svg>
  );
}
