/**
 * Book press: saddle-fold, signature-bound sketchbook. Owns the book's
 * derived layout (leaves, imposition) and its export; images and intake come
 * from the app shell.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { assembleBook, type PageGeometry } from "../core/book";
import { imposeSignatures, SHEETS_PER_SIGNATURE } from "../core/imposition";
import { formatLength } from "../core/lengths";
import type { ImageItem, Settings } from "../state";
import { downloadPdf, slugify } from "./download";
import { Preview } from "./Preview";
import { SettingsPanel } from "./SettingsPanel";

export function BookWorkspace(props: {
  items: ImageItem[];
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  /** Notices, image list or dropzone, rendered above the preview. */
  imagePanel: ReactNode;
}) {
  const { items, settings } = props;
  const [exporting, setExporting] = useState(false);

  const geometry: PageGeometry = useMemo(
    () => ({
      width: settings.sheetW / 2,
      height: settings.sheetH,
      gutter: settings.gutter,
      margin: settings.margin,
    }),
    [settings.sheetW, settings.sheetH, settings.gutter, settings.margin],
  );

  // Mirrors assembleBook's leaf count: cover + one or two leaves per image.
  const leafCount = 1 + items.length * (settings.facingPages ? 2 : 1);
  const sheetCount = Math.max(1, Math.ceil(leafCount / 4));
  const signatureCount = Math.ceil(sheetCount / SHEETS_PER_SIGNATURE);

  const leaves = useMemo(
    () =>
      assembleBook(
        items.map((item) => ({
          width: item.source.width,
          height: item.source.height,
          effect: item.effect,
        })),
        {
          geometry,
          facingPages: settings.facingPages,
          imageSide: settings.imageSide,
          titleLines: [
            settings.title,
            new Date().toLocaleDateString(),
            `${formatLength(settings.sheetW, settings.unit)}×${formatLength(settings.sheetH, settings.unit)}${settings.unit} · ${signatureCount} signature${signatureCount === 1 ? "" : "s"}`,
          ],
        },
      ),
    [items, geometry, settings, signatureCount],
  );

  const plan = useMemo(
    () =>
      imposeSignatures(
        leaves.length,
        { w: geometry.width, h: geometry.height },
        { w: settings.sheetW, h: settings.sheetH },
      ),
    [leaves.length, geometry, settings.sheetW, settings.sheetH],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // pdf-lib is heavy and only needed at export time; load it lazily.
      const { renderBookPdf } = await import("../core/pdf");
      const bytes = await renderBookPdf({
        leaves,
        plan,
        geometry,
        images: items.map((item) => item.source),
        effectSettings: settings.effectSettings,
      });
      downloadPdf(bytes, `${slugify(settings.title, "book")}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [leaves, plan, geometry, items, settings.effectSettings, settings.title]);

  const totalSheets = plan.sheetsPerSignature.reduce((sum, sheets) => sum + sheets, 0);

  return (
    <div className="columns">
      <aside className="sidebar">
        <SettingsPanel settings={settings} onChange={props.onSettingsChange} />

        <div className="export-block">
          <dl className="tally">
            <div>
              <dt>Images</dt>
              <dd>{items.length}</dd>
            </div>
            <div>
              <dt>Book pages</dt>
              <dd>{plan.paddedLeafCount}</dd>
            </div>
            <div>
              <dt>Sheets</dt>
              <dd>{totalSheets}</dd>
            </div>
            <div>
              <dt>Signatures</dt>
              <dd>{plan.sheetsPerSignature.length}</dd>
            </div>
          </dl>
          <button
            className="export-button"
            disabled={items.length === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? "Pressing…" : "Export print PDF"}
          </button>
          <p className="print-note">
            Print two-sided, flip on short edge, Scale 100%. Fold each signature in half, nest its
            sheets, stack signatures in order, staple at the fold.
          </p>
        </div>
      </aside>

      <main className="content">
        {props.imagePanel}
        {items.length > 0 && (
          <section className="panel">
            <Preview
              leaves={leaves}
              plan={plan}
              geometry={geometry}
              images={items}
              effectSettings={settings.effectSettings}
            />
          </section>
        )}
      </main>
    </div>
  );
}
