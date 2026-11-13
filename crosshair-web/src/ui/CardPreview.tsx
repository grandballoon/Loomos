/**
 * Live preview of the card sheets, one SVG per printed sheet in point
 * coordinates. It draws the same scene (cardScene.ts) the PDF renderer
 * draws; only the y-axis is flipped (PDF is y-up, SVG y-down).
 */

import type { Card, ImagePlacement, Size } from "../core/cards";
import type { GuideOptions } from "../core/cardGuides";
import { CUT_LINE_STYLE, sheetScene } from "../core/cardScene";
import type { Rgb } from "../core/effects";
import type { ImageItem } from "../state";

/**
 * The full source image positioned so its crop box fills the placement rect,
 * clipped to that rect. A rotated placement is drawn in a frame turned 90°
 * counter-clockwise about the rect's lower-left corner, where the source
 * reads upright, matching the PDF rasterizer.
 */
function PlacedImage(props: { id: string; url: string; placement: ImagePlacement; sheetH: number }) {
  const { rect, rotate, crop } = props.placement;
  const [l, t, r, b] = crop;
  const top = props.sheetH - (rect.y + rect.h);
  // Rect size in the source's own orientation.
  const [w, h] = rotate ? [rect.h, rect.w] : [rect.w, rect.h];
  const fullW = w / (r - l);
  const fullH = h / (b - t);
  const transform = rotate
    ? `translate(${rect.x} ${top + rect.h}) rotate(-90)`
    : `translate(${rect.x} ${top})`;
  return (
    <g>
      <clipPath id={props.id}>
        <rect x={rect.x} y={top} width={rect.w} height={rect.h} />
      </clipPath>
      <g clipPath={`url(#${props.id})`}>
        <image
          href={props.url}
          transform={transform}
          x={-l * fullW}
          y={-t * fullH}
          width={fullW}
          height={fullH}
          preserveAspectRatio="none"
        />
      </g>
    </g>
  );
}

const rgbCss = (c: Rgb) =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

export function CardPreview(props: {
  sheets: Card[][];
  sheetSize: Size;
  images: ImageItem[];
  guides: GuideOptions;
  guideColor: Rgb;
  guideThickness: number;
}) {
  const { sheetSize } = props;
  const gray = Math.round(CUT_LINE_STYLE.gray * 255);
  const total = props.sheets.length;

  return (
    <div className="preview">
      <div className="preview-grid">
        {props.sheets.map((cards, sheetIndex) => {
          const scene = sheetScene(cards, props.guides);
          return (
            <figure className="preview-card" key={sheetIndex}>
              <svg
                viewBox={`0 0 ${sheetSize.w} ${sheetSize.h}`}
                className="preview-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                {scene.images.map(({ index, placement }) => {
                  const item = props.images[index];
                  return item ? (
                    <PlacedImage
                      key={item.source.id}
                      id={`clip-${sheetIndex}-${item.source.id}`}
                      url={item.source.url}
                      placement={placement}
                      sheetH={sheetSize.h}
                    />
                  ) : null;
                })}
                {scene.guides.map((s, i) => (
                  <line
                    key={`g${i}`}
                    x1={s.x1}
                    y1={sheetSize.h - s.y1}
                    x2={s.x2}
                    y2={sheetSize.h - s.y2}
                    stroke={rgbCss(props.guideColor)}
                    strokeWidth={props.guideThickness}
                  />
                ))}
                {scene.dotted.map((s, i) => (
                  <line
                    key={`d${i}`}
                    x1={s.x1}
                    y1={sheetSize.h - s.y1}
                    x2={s.x2}
                    y2={sheetSize.h - s.y2}
                    stroke={`rgb(${gray},${gray},${gray})`}
                    strokeWidth={CUT_LINE_STYLE.width}
                    strokeDasharray={CUT_LINE_STYLE.dash.join(" ")}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <figcaption>
                Sheet {sheetIndex + 1} of {total} · {cards.length} card
                {cards.length === 1 ? "" : "s"}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
