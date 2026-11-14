/**
 * App shell: holds the image list, both presses' settings and the active
 * mode, and handles intake (drop, file picker). Each press's layout and
 * export live in its workspace.
 */

import { useCallback, useRef, useState } from "react";

import { EFFECT_KINDS, EFFECT_LABELS, type EffectKind } from "./core/effects";
import { collectDrop, type DropResult } from "./core/images";
import { moveItem, setAllEffects, setEffectAt, sharedEffect } from "./items";
import {
  DEFAULT_CARD_SETTINGS,
  DEFAULT_SETTINGS,
  type CardSettings,
  type ImageItem,
  type Mode,
  type Settings,
} from "./state";
import { BookWorkspace } from "./ui/BookWorkspace";
import { CardsWorkspace } from "./ui/CardsWorkspace";
import { ImageList } from "./ui/ImageList";

const MODE_NOTES: Record<Mode, string> = {
  cards: "Drop images → cards cut to your notebook page, tiled onto printer paper at true scale.",
  book: "Drop images → get a saddle-fold, signature-bound sketchbook PDF at true scale.",
};

export default function App() {
  const [mode, setMode] = useState<Mode>("cards");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [cardSettings, setCardSettings] = useState<CardSettings>(DEFAULT_CARD_SETTINGS);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [folderName, setFolderName] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const addImages = useCallback(
    (result: DropResult) => {
      if (result.images.length > 0) {
        setItems((current) => [
          ...current,
          ...result.images.map((source) => ({ source, effect: settings.defaultEffect })),
        ]);
        if (result.folderName) {
          const name = result.folderName;
          setFolderName((current) => current ?? name);
          setSettings((current) =>
            current.title === DEFAULT_SETTINGS.title ? { ...current, title: name } : current,
          );
        }
      }
      setNotices(result.skipped);
    },
    [settings.defaultEffect],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addImages(await collectDrop(event.dataTransfer.items));
    },
    [addImages],
  );

  // Applying an effect to every image also makes it the default for images
  // added later, so the whole folder stays consistent.
  const applyEffectToAll = (effect: EffectKind) => {
    setItems((current) => setAllEffects(current, effect));
    setSettings((current) => ({ ...current, defaultEffect: effect }));
  };
  const allEffect = sharedEffect(items);

  const noticePanel = notices.length > 0 && (
    <div className="notices" role="status">
      {notices.map((notice) => (
        <p key={notice}>Skipped: {notice}</p>
      ))}
    </div>
  );

  const imagePanel = (
    <>
      {items.length === 0 ? (
        <button className="dropzone" type="button" onClick={() => fileInput.current?.click()}>
          <svg className="dropzone-mark" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1" />
            <line x1="60" y1="4" x2="60" y2="116" stroke="currentColor" strokeWidth="1" />
            <line x1="4" y1="60" x2="116" y2="60" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="dropzone-title">Drop images or a folder</span>
          <span className="dropzone-hint">or click to choose files</span>
        </button>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Plates</h2>
            {mode === "book" && (
              <label className="apply-all">
                <span className="apply-all-label">All</span>
                <select
                  className="image-effect"
                  value={allEffect ?? "mixed"}
                  aria-label="Effect for all images"
                  onChange={(event) => applyEffectToAll(event.target.value as EffectKind)}
                >
                  {allEffect === undefined && (
                    <option value="mixed" disabled>
                      Mixed
                    </option>
                  )}
                  {EFFECT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {EFFECT_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="ghost-button" onClick={() => fileInput.current?.click()}>
              + Add images
            </button>
          </div>
          <ImageList
            items={items}
            onEffectChange={
              mode === "book"
                ? (index, effect) => setItems((current) => setEffectAt(current, index, effect))
                : undefined
            }
            onMove={(index, delta) => setItems((current) => moveItem(current, index, delta))}
            onRemove={(index) =>
              setItems((current) => {
                URL.revokeObjectURL(current[index].source.url);
                return current.filter((_, i) => i !== index);
              })
            }
          />
        </section>
      )}
    </>
  );

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
        <p className="masthead-note">{MODE_NOTES[mode]}</p>
        <div className="view-tabs mode-tabs" role="tablist" aria-label="Press">
          {(
            [
              ["cards", "Card sheets"],
              ["book", "Bound book"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={mode === value}
              className={mode === value ? "active" : ""}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {mode === "cards" ? (
        <CardsWorkspace
          items={items}
          settings={cardSettings}
          onSettingsChange={setCardSettings}
          folderName={folderName}
          notices={noticePanel}
          imagePanel={imagePanel}
        />
      ) : (
        <BookWorkspace
          items={items}
          settings={settings}
          onSettingsChange={setSettings}
          notices={noticePanel}
          imagePanel={imagePanel}
        />
      )}

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
          addImages(await collectDrop(transfer.items));
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
