import { useCallback, useMemo, useRef, useState } from "react";

import { assembleBook, type PageGeometry } from "./core/book";
import { collectDrop } from "./core/images";
import { imposeSignatures, SHEETS_PER_SIGNATURE } from "./core/imposition";
import { formatLength } from "./core/lengths";
import { DEFAULT_SETTINGS, type ImageItem, type Settings } from "./state";
import { ImageList } from "./ui/ImageList";
import { Preview } from "./ui/Preview";
import { SettingsPanel } from "./ui/SettingsPanel";

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "book";
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

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

  const addImages = useCallback(
    (added: ImageItem[], skipped: string[], folderName?: string) => {
      if (added.length > 0) {
        setItems((current) => [...current, ...added]);
        if (folderName) {
          setSettings((current) =>
            current.title === DEFAULT_SETTINGS.title ? { ...current, title: folderName } : current,
          );
        }
      }
      setNotices(skipped);
    },
    [],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const result = await collectDrop(event.dataTransfer.items);
      addImages(
        result.images.map((source) => ({ source, effect: settings.defaultEffect })),
        result.skipped,
        result.folderName,
      );
    },
    [addImages, settings.defaultEffect],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // pdf-lib is heavy and only needed at export time; load it lazily.
      const { renderBookPdf } = await import("./core/pdf");
      const bytes = await renderBookPdf({
        leaves,
        plan,
        geometry,
        images: items.map((item) => item.source),
        effectSettings: settings.effectSettings,
      });
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugify(settings.title)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [leaves, plan, geometry, items, settings.effectSettings, settings.title]);

  const totalSheets = plan.sheetsPerSignature.reduce((sum, sheets) => sum + sheets, 0);

  return (
    <div
      className={`app${dragging ? " dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="masthead">
        <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="20" y1="1" x2="20" y2="39" stroke="currentColor" strokeWidth="1.5" />
          <line x1="1" y1="20" x2="39" y2="20" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <h1>
          Crosshair <span className="masthead-sub">sketchbook press</span>
        </h1>
        <p className="masthead-note">
          Drop images → get a saddle-fold, signature-bound sketchbook PDF at true scale.
        </p>
      </header>

      <div className="columns">
        <aside className="sidebar">
          <SettingsPanel settings={settings} onChange={setSettings} />

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
              Print two-sided, flip on short edge, Scale 100%. Fold each signature in half, nest
              its sheets, stack signatures in order, staple at the fold.
            </p>
          </div>
        </aside>

        <main className="content">
          {notices.length > 0 && (
            <div className="notices" role="status">
              {notices.map((notice) => (
                <p key={notice}>Skipped: {notice}</p>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <button
              className="dropzone"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              <svg className="dropzone-mark" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1" />
                <line x1="60" y1="4" x2="60" y2="116" stroke="currentColor" strokeWidth="1" />
                <line x1="4" y1="60" x2="116" y2="60" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="dropzone-title">Drop images or a folder</span>
              <span className="dropzone-hint">or click to choose files</span>
            </button>
          ) : (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h2 className="section-title">Plates</h2>
                  <button className="ghost-button" onClick={() => fileInput.current?.click()}>
                    + Add images
                  </button>
                </div>
                <ImageList
                  items={items}
                  onEffectChange={(index, effect) =>
                    setItems((current) =>
                      current.map((item, i) => (i === index ? { ...item, effect } : item)),
                    )
                  }
                  onMove={(index, delta) =>
                    setItems((current) => {
                      const next = [...current];
                      const [moved] = next.splice(index, 1);
                      next.splice(index + delta, 0, moved);
                      return next;
                    })
                  }
                  onRemove={(index) =>
                    setItems((current) => {
                      URL.revokeObjectURL(current[index].source.url);
                      return current.filter((_, i) => i !== index);
                    })
                  }
                />
              </section>

              <section className="panel">
                <Preview
                  leaves={leaves}
                  plan={plan}
                  geometry={geometry}
                  images={items}
                  effectSettings={settings.effectSettings}
                />
              </section>
            </>
          )}
        </main>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          const transfer = new DataTransfer();
          files.forEach((file) => transfer.items.add(file));
          const result = await collectDrop(transfer.items);
          addImages(
            result.images.map((source) => ({ source, effect: settings.defaultEffect })),
            result.skipped,
          );
        }}
      />

      {dragging && (
        <div className="drop-veil" aria-hidden="true">
          <span>Release to add</span>
        </div>
      )}
    </div>
  );
}
