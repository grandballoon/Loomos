/** Every reading-order spread at once, as a grid of thumbnails. */

import { readingSpreads, spreadPosition, type BookStructure } from "../../core/binding";
import { TaggedLeaf, type LeafContext } from "./LeafSvg";

export function SpreadsView(props: { context: LeafContext; structure: BookStructure }) {
  const { context, structure } = props;
  const { geometry } = context;
  const spreads = readingSpreads(structure.paddedLeafCount);

  return (
    <div className="preview-grid">
      {spreads.map(([left, right], index) => {
        const position = spreadPosition(left, right, structure);
        return (
          <figure className="preview-card" key={index}>
            <svg
              viewBox={`0 0 ${geometry.width * 2} ${geometry.height}`}
              className="preview-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <TaggedLeaf context={context} slot={left} ox={0} oy={0} faceH={geometry.height} />
              <TaggedLeaf
                context={context}
                slot={right}
                ox={geometry.width}
                oy={0}
                faceH={geometry.height}
              />
              <line
                x1={geometry.width}
                y1={0}
                x2={geometry.width}
                y2={geometry.height}
                className={position.seam ? "spine-line seam" : "spine-line"}
              />
            </svg>
            <figcaption>
              {index === 0 ? "Cover" : `Pages ${2 * index}–${2 * index + 1}`}
              {position.centre && " · centre fold"}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
