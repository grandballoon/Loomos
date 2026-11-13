/**
 * Dev-only UI feedback overlay, on at the /ui-feedback route.
 *
 * Hold Alt (⌥) to see what is under the pointer; Alt-click it to leave a
 * note. Notes go to the dev server, which stores them in ui-feedback.json
 * for Claude to read, with the element's selector and React source frames.
 * The badge lists notes, including ones Claude has marked resolved.
 *
 * Mounted in its own React root (mount.tsx) so the app never knows it is
 * there; its host carries OVERLAY_ATTR so overlay elements are never picked.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Note } from "../../../feedback/core";
import { createNote, deleteNote, listNotes } from "./api";
import "./feedback.css";
import { describeElement, isOverlayElement, sourceFrames } from "./inspect";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ALT_CLASS = "ui-feedback-alt";
const POPOVER_W = 320;
const POPOVER_GAP = 8;

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};

/** A pickable element under a pointer event, or null. */
function pickable(event: Event): Element | null {
  const target = event.target;
  if (!(target instanceof Element) || isOverlayElement(target)) return null;
  return target;
}

/** Popover position: below the box if it fits, else above; inside the viewport. */
function popoverPosition(box: Box, height: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(POPOVER_GAP, box.x), vw - POPOVER_W - POPOVER_GAP);
  const below = box.y + box.h + POPOVER_GAP;
  const above = box.y - height - POPOVER_GAP;
  const top = below + height <= vh - POPOVER_GAP || above < POPOVER_GAP ? below : above;
  return { left, top: Math.min(Math.max(POPOVER_GAP, top), vh - height - POPOVER_GAP) };
}

function Outline(props: { box: Box; variant: "hover" | "picked" }) {
  return (
    <div
      className={`uifb-outline uifb-outline-${props.variant}`}
      style={{ left: props.box.x, top: props.box.y, width: props.box.w, height: props.box.h }}
    />
  );
}

function shortSource(note: Note): string | undefined {
  // The innermost frame with a source is the most specific location.
  const frame = note.element.frames.find((f) => f.source);
  return frame?.source?.replace(/^src\//, "");
}

export function FeedbackOverlay() {
  const [altDown, setAltDown] = useState(false);
  const [hover, setHover] = useState<Box | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [pickedBox, setPickedBox] = useState<Box | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flagged, setFlagged] = useState<Box | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [popoverH, setPopoverH] = useState(180);
  const popover = useRef<HTMLDivElement>(null);
  /** Nearest component around the picked element, for the popover header. */
  const pickedComponent = useMemo(() => (picked ? sourceFrames(picked)[1]?.name ?? "" : ""), [picked]);

  const refresh = useCallback(async () => {
    try {
      setNotes(await listNotes());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Alt tracking, hover highlight, and Alt-click capture before the app sees it.
  useEffect(() => {
    const setAlt = (down: boolean) => {
      setAltDown(down);
      document.documentElement.classList.toggle(ALT_CLASS, down);
      if (!down) setHover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAlt(e.type === "keydown");
    };
    const onBlur = () => setAlt(false);
    const onMove = (e: PointerEvent) => {
      if (e.altKey !== document.documentElement.classList.contains(ALT_CLASS)) setAlt(e.altKey);
      const el = e.altKey ? pickable(e) : null;
      setHover(el ? boxOf(el) : null);
    };
    const swallow = (e: MouseEvent) => {
      if (e.altKey && pickable(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onDown = (e: PointerEvent) => {
      const el = e.altKey ? pickable(e) : null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setPicked(el);
      setComment("");
      setError(null);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("mousedown", swallow, true);
    window.addEventListener("click", swallow, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("mousedown", swallow, true);
      window.removeEventListener("click", swallow, true);
      document.documentElement.classList.remove(ALT_CLASS);
    };
  }, []);

  // Keep the picked outline on its element through scrolling and resizing.
  useEffect(() => {
    if (!picked) {
      setPickedBox(null);
      return;
    }
    const update = () => setPickedBox(boxOf(picked));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [picked]);

  useLayoutEffect(() => {
    if (popover.current) setPopoverH(popover.current.offsetHeight);
  }, [pickedBox, error]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cancel = () => {
    setPicked(null);
    setComment("");
    setError(null);
  };

  const save = async () => {
    if (!picked || comment.trim() === "" || saving) return;
    setSaving(true);
    try {
      const note = await createNote({
        comment,
        page: `${location.pathname}${location.search}`,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        element: describeElement(picked),
      });
      setPicked(null);
      setComment("");
      setToast(`Saved ${note.id} — ask Claude to pull UI feedback`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNote(id);
      setFlagged(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const flag = (note: Note | null) => {
    const el = note ? document.querySelector(note.element.selector) : null;
    setFlagged(el ? boxOf(el) : null);
  };

  const open = notes.filter((n) => n.status === "open");
  const resolved = notes.filter((n) => n.status === "resolved");
  const position = pickedBox ? popoverPosition(pickedBox, popoverH) : null;

  return (
    <>
      {hover && !picked && <Outline box={hover} variant="hover" />}
      {flagged && <Outline box={flagged} variant="hover" />}
      {pickedBox && <Outline box={pickedBox} variant="picked" />}

      {picked && position && (
        <div
          ref={popover}
          className="uifb-popover"
          style={{ left: position.left, top: position.top, width: POPOVER_W }}
          role="dialog"
          aria-label="Leave UI feedback"
        >
          <div className="uifb-popover-head">
            <span className="uifb-tag">&lt;{picked.tagName.toLowerCase()}&gt;</span>
            <span className="uifb-where">{pickedComponent}</span>
          </div>
          <textarea
            autoFocus
            value={comment}
            placeholder="What should change here?"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
            }}
          />
          {error && <p className="uifb-error">{error}</p>}
          <div className="uifb-actions">
            <span className="uifb-hint">⌘↵ save · esc cancel</span>
            <button type="button" className="uifb-button-ghost" onClick={cancel}>
              Cancel
            </button>
            <button
              type="button"
              className="uifb-button"
              disabled={comment.trim() === "" || saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div className="uifb-panel" role="dialog" aria-label="UI feedback notes">
          <div className="uifb-panel-head">
            <span>Notes for Claude</span>
            <span className="uifb-file">ui-feedback.json</span>
          </div>
          {notes.length === 0 && (
            <p className="uifb-empty">None yet. Hold ⌥ and click any element to leave one.</p>
          )}
          <ol className="uifb-list">
            {[...open, ...resolved].map((note) => (
              <li
                key={note.id}
                className={`uifb-note${note.status === "resolved" ? " uifb-note-resolved" : ""}`}
                onMouseEnter={() => flag(note)}
                onMouseLeave={() => flag(null)}
              >
                <p className="uifb-comment">{note.comment}</p>
                {note.resolution && <p className="uifb-resolution">↳ {note.resolution}</p>}
                <p className="uifb-meta">
                  {note.status === "resolved" ? "resolved · " : ""}
                  {shortSource(note) ?? note.element.selector}
                </p>
                <button
                  type="button"
                  className="uifb-delete"
                  aria-label={`Delete note ${note.id}`}
                  onClick={() => void remove(note.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          {error && !picked && <p className="uifb-error">{error}</p>}
        </div>
      )}

      {toast && !panelOpen && <div className="uifb-toast">{toast}</div>}

      <button
        type="button"
        className={`uifb-badge${altDown ? " uifb-badge-alt" : ""}`}
        onClick={() => {
          setPanelOpen((v) => !v);
          void refresh();
        }}
      >
        <span className="uifb-dot" aria-hidden="true" />
        {altDown ? "Click an element" : "UI feedback · ⌥-click"}
        <span className="uifb-count">{open.length} open</span>
      </button>
    </>
  );
}

