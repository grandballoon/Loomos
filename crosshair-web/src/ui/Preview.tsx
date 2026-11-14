/**
 * Live preview of the book, in four views: the finished book with turnable
 * pages, every spread at a glance, the assembly guide, and the imposed
 * printer sheets. Each view lives in ui/book/; this is only the tab shell.
 */

import { useState } from "react";

import type { BindingMethod, BookStructure } from "../core/binding";
import type { Leaf, PageGeometry } from "../core/book";
import type { EffectSettings } from "../core/effects";
import type { ImpositionPlan } from "../core/imposition";
import type { ImageItem } from "../state";
import { AssemblyView } from "./book/AssemblyView";
import { BookViewer } from "./book/BookViewer";
import type { LeafContext } from "./book/LeafSvg";
import { SheetsView } from "./book/SheetsView";
import { SpreadsView } from "./book/SpreadsView";

type View = "book" | "spreads" | "assembly" | "sheets";

const VIEWS: [View, string][] = [
  ["book", "Finished book"],
  ["spreads", "Spreads"],
  ["assembly", "Assembly"],
  ["sheets", "Printed sheets"],
];

export function Preview(props: {
  leaves: Leaf[];
  plan: ImpositionPlan;
  geometry: PageGeometry;
  images: ImageItem[];
  effectSettings: EffectSettings;
  structure: BookStructure;
  method: BindingMethod;
}) {
  const [view, setView] = useState<View>("book");
  const context: LeafContext = {
    leaves: props.leaves,
    geometry: props.geometry,
    images: props.images,
    effectSettings: props.effectSettings,
    leavesPerSignature: props.structure.leavesPerSignature,
  };

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <div className="view-tabs" role="tablist">
          {VIEWS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              className={view === value ? "active" : ""}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "book" && (
        <BookViewer context={context} structure={props.structure} method={props.method} />
      )}
      {view === "spreads" && <SpreadsView context={context} structure={props.structure} />}
      {view === "assembly" && (
        <AssemblyView key={props.method} structure={props.structure} method={props.method} />
      )}
      {view === "sheets" && <SheetsView context={context} plan={props.plan} />}
    </div>
  );
}
