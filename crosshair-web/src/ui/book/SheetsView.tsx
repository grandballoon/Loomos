/** The imposed printer faces, in print order: what comes out of the printer. */

import { faceCaptions, type ImpositionPlan } from "../../core/imposition";
import { TaggedLeaf, type LeafContext } from "./LeafSvg";

export function SheetsView(props: { context: LeafContext; plan: ImpositionPlan }) {
  const { context, plan } = props;
  const captions = faceCaptions(plan.faces);

  return (
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
            {face.placements.map((placement) => (
              <TaggedLeaf
                key={placement.slot}
                context={context}
                slot={placement.slot}
                ox={placement.x}
                oy={placement.y}
                faceH={plan.sheetSize.h}
              />
            ))}
            <line
              x1={plan.sheetSize.w / 2}
              y1={0}
              x2={plan.sheetSize.w / 2}
              y2={plan.sheetSize.h}
              className="fold-line"
            />
          </svg>
          <figcaption>{captions[index]}</figcaption>
        </figure>
      ))}
    </div>
  );
}
