/**
 * Assembly guide: the binding's steps as a checklist, the stacking order of
 * the signatures, and for each signature how its sheets nest, drawn as seen
 * from the head (top edge) with every page tag the folder should see.
 */

import { useState } from "react";

import {
  BINDING_INFO,
  pageLabel,
  signatureLetter,
  signatureSheets,
  type BindingMethod,
  type BookStructure,
  type SheetInSignature,
} from "../../core/binding";

/** Vertical spacing between nested sheets in the head view, px. */
const NEST_GAP = 11;
const ARM_END = 210;

/** Nested folds seen from the head: spine on the left, sheet 1 outermost. */
function HeadView(props: { sheets: SheetInSignature[]; leavesPerSignature: number }) {
  const { sheets, leavesPerSignature: n } = props;
  const count = sheets.length;
  const cy = count * NEST_GAP + 6;
  const tag = (slots: [number, number]) => `${pageLabel(slots[0], n)} · ${pageLabel(slots[1], n)}`;
  return (
    <svg
      className="head-view"
      viewBox={`0 0 ${ARM_END + 90} ${2 * cy}`}
      role="img"
      aria-label="Sheets nested in this signature, seen from the top edge"
    >
      <line x1={0} y1={cy} x2={ARM_END} y2={cy} className="head-centre" />
      {sheets.map((sheet) => {
        const d = (count - sheet.sheet + 1) * NEST_GAP;
        const x = 10 + (sheet.sheet - 1) * NEST_GAP * 0.5;
        return (
          <g key={sheet.sheet}>
            <path
              d={`M ${ARM_END} ${cy - d} L ${x + d} ${cy - d} A ${d} ${d} 0 0 0 ${x + d} ${cy + d} L ${ARM_END} ${cy + d}`}
              className={sheet.sheet === 1 ? "head-sheet outer" : "head-sheet"}
            />
            <text x={ARM_END + 6} y={cy - d + 3} className="head-tag">
              {tag(sheet.outerLeaf)}
            </text>
            <text x={ARM_END + 6} y={cy + d + 3} className="head-tag">
              {tag(sheet.innerLeaf)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AssemblyView(props: { structure: BookStructure; method: BindingMethod }) {
  const { structure, method } = props;
  const n = structure.leavesPerSignature;
  const info = BINDING_INFO[method];
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const signatures = Array.from({ length: structure.signatureCount }, (_, i) => i);

  return (
    <div className="assembly">
      <section className="assembly-steps">
        <h3 className="assembly-title">{info.label}</h3>
        <ol>
          {info.steps.map((text, index) => (
            <li key={index}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.has(`step-${index}`)}
                  onChange={() => toggle(`step-${index}`)}
                />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="assembly-title">Stack order, front to back</h3>
        <ol className="stack-order">
          {signatures.map((signature) => (
            <li
              key={signature}
              className={checked.has(`sig-${signature}`) ? "done" : ""}
              title={`${pageLabel(signature * n, n)}–${pageLabel(signature * n + n - 1, n)}`}
            >
              {signatureLetter(signature)}
            </li>
          ))}
        </ol>
        <p className="section-note">
          {structure.signatureCount} signature{structure.signatureCount === 1 ? "" : "s"} of{" "}
          {structure.sheetsPerSignature} sheet{structure.sheetsPerSignature === 1 ? "" : "s"},{" "}
          {structure.totalSheets} sheets in all. Every page carries its tag in the lower outer
          corner.
        </p>
      </section>

      <div className="signature-grid">
        {signatures.map((signature) => {
          const sheets = signatureSheets(signature, structure);
          const key = `sig-${signature}`;
          return (
            <figure className="signature-card" key={signature}>
              <figcaption>
                <span className="signature-letter">{signatureLetter(signature)}</span>
                <span>
                  {pageLabel(signature * n, n)}–{pageLabel(signature * n + n - 1, n)}
                </span>
                <label className="signature-check">
                  <input type="checkbox" checked={checked.has(key)} onChange={() => toggle(key)} />
                  Folded &amp; checked
                </label>
              </figcaption>
              <HeadView sheets={sheets} leavesPerSignature={n} />
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Front</th>
                    <th>Back</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((sheet) => (
                    <tr key={sheet.sheet}>
                      <td>
                        {sheet.sheet}
                        {sheet.sheet === 1 && sheets.length > 1 ? " (outer)" : ""}
                      </td>
                      <td>
                        {pageLabel(sheet.innerLeaf[1], n)} | {pageLabel(sheet.outerLeaf[0], n)}
                      </td>
                      <td>
                        {pageLabel(sheet.outerLeaf[1], n)} | {pageLabel(sheet.innerLeaf[0], n)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
