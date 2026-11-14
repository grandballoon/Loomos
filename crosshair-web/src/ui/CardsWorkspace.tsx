/**
 * Card press: each image on a card cut to the notebook page size, tiled
 * one-sided onto printer paper. Owns the card plan and its export; images
 * and intake come from the app shell.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { matchPreset, NOTEBOOK_PRESETS, planCards } from "../core/cards";
import type { GuideOptions } from "../core/cardGuides";
import type { CardSettings, ImageItem } from "../state";
import { CardPreview } from "./CardPreview";
import { CardSettingsPanel } from "./CardSettingsPanel";
import { downloadPdf, slugify } from "./download";

/** Resolution images are resampled down to in the PDF. */
const EXPORT_DPI = 300;

export function CardsWorkspace(props: {
  items: ImageItem[];
  settings: CardSettings;
  onSettingsChange: (settings: CardSettings) => void;
  /** Name of the dropped folder, used for the PDF's filename. */
  folderName?: string;
  /** Intake notices, rendered first. */
  notices: ReactNode;
  /** Image list or dropzone, rendered below the preview. */
  imagePanel: ReactNode;
}) {
  const { items, settings } = props;
  const [exporting, setExporting] = useState(false);

  const guides: GuideOptions = useMemo(
    () => ({
      cornerX: settings.features.cornerX,
      crosshair: settings.features.crosshair,
      grid: settings.features.grid,
      gridSpacing: settings.gridSpacing,
    }),
    [settings.features, settings.gridSpacing],
  );

  const plan = useMemo(
    () =>
      planCards(
        items.map((item) => ({ w: item.source.width, h: item.source.height })),
        {
          paper: settings.notebook,
          sheet: settings.sheet,
          margin: settings.margin,
          padding: settings.padding,
          tab: settings.features.flipTab ? settings.tabHeight : 0,
          fill: settings.fill,
        },
      ),
    [items, settings],
  );

  const sheets = plan.ok ? plan.sheets : [];
  const perSheet = Math.max(0, ...sheets.map((cards) => cards.length));

  const handleExport = useCallback(async () => {
    if (!plan.ok) return;
    setExporting(true);
    try {
      // pdf-lib is heavy and only needed at export time; load it lazily.
      const { renderCardsPdf } = await import("../core/cardsPdf");
      const paperName = matchPreset(NOTEBOOK_PRESETS, settings.notebook)?.name ?? "custom";
      const name = `${slugify(props.folderName ?? "", "cards")}-${paperName}`;
      const bytes = await renderCardsPdf({
        sheets: plan.sheets,
        sheetSize: settings.sheet,
        images: items.map((item) => item.source),
        guides,
        guideColor: settings.guideColor,
        guideThickness: settings.guideThickness,
        dpi: EXPORT_DPI,
        title: name,
      });
      downloadPdf(bytes, `${name}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [plan, items, guides, settings, props.folderName]);

  return (
    <div className="columns">
      <aside className="sidebar">
        <CardSettingsPanel settings={settings} onChange={props.onSettingsChange} />

        <div className="export-block">
          <dl className="tally">
            <div>
              <dt>Images</dt>
              <dd>{items.length}</dd>
            </div>
            <div>
              <dt>Cards / sheet</dt>
              <dd>{perSheet || "—"}</dd>
            </div>
            <div>
              <dt>Sheets</dt>
              <dd>{sheets.length}</dd>
            </div>
          </dl>
          {!plan.ok && (
            <p className="export-error" role="alert">
              {plan.error} Try larger paper, a smaller margin or a shorter tab.
            </p>
          )}
          <button
            className="export-button"
            disabled={items.length === 0 || !plan.ok || exporting}
            onClick={handleExport}
          >
            {exporting ? "Pressing…" : "Export print PDF"}
          </button>
          <p className="print-note">
            Print one-sided at Scale 100% / actual size, never “fit to page”. Cut on the dotted
            lines; each card is exactly the notebook page size.
            {settings.features.flipTab && " Fold the tab on the inner dotted line."}
          </p>
        </div>
      </aside>

      <main className="content">
        {props.notices}
        {items.length > 0 && plan.ok && (
          <section className="panel">
            <CardPreview
              sheets={sheets}
              sheetSize={settings.sheet}
              images={items}
              guides={guides}
              guideColor={settings.guideColor}
              guideThickness={settings.guideThickness}
            />
          </section>
        )}
        {props.imagePanel}
      </main>
    </div>
  );
}
