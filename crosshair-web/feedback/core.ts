/**
 * UI feedback notes: the pure core shared by the dev-server endpoint
 * (feedback/plugin.ts) and the in-page overlay (src/dev/feedback/).
 *
 * Notes live in one JSON file in the project (FEEDBACK_FILE) so Claude can
 * read them, fix what they describe, and mark them resolved in place.
 * Everything here is plain values in, plain values out: no I/O, no DOM.
 */

/** Project-relative path of the notes file. */
export const FEEDBACK_FILE = "ui-feedback.json";

/** URL the dev server answers notes requests on. */
export const FEEDBACK_ENDPOINT = "/__ui-feedback";

/** Page path that turns the overlay on. */
export const FEEDBACK_ROUTE = "/ui-feedback";

/** A rendered-by location: a component (or element) and where its JSX is. */
export interface SourceFrame {
  name: string;
  /** "path/to/file.tsx:line:column", project-relative once stored. */
  source?: string;
}

/** What the person alt-clicked. */
export interface ElementInfo {
  selector: string;
  tag: string;
  /** Visible text, trimmed and truncated. */
  text: string;
  /** Opening outer HTML, truncated. */
  html: string;
  rect: { x: number; y: number; w: number; h: number };
  /** Innermost first: the clicked element, then the components around it. */
  frames: SourceFrame[];
}

export interface NoteInput {
  comment: string;
  /** Page path and query when the note was left. */
  page: string;
  viewport: { w: number; h: number };
  element: ElementInfo;
}

export interface Note extends NoteInput {
  id: string;
  createdAt: string;
  status: "open" | "resolved";
  /** What Claude did about it, filled in when resolving. */
  resolution?: string;
}

export interface FeedbackFile {
  notes: Note[];
}

export const EMPTY_FILE: FeedbackFile = { notes: [] };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";

function parseFrames(v: unknown): SourceFrame[] | null {
  if (!Array.isArray(v)) return null;
  const frames: SourceFrame[] = [];
  for (const f of v) {
    if (!isObject(f) || !isString(f.name)) return null;
    if (f.source !== undefined && !isString(f.source)) return null;
    frames.push(f.source === undefined ? { name: f.name } : { name: f.name, source: f.source });
  }
  return frames;
}

/** Validate an untrusted request body as a note. */
export function parseNoteInput(body: unknown): Result<NoteInput> {
  if (!isObject(body)) return { ok: false, error: "body must be an object" };
  const { comment, page, viewport, element } = body;
  if (!isString(comment) || comment.trim() === "") return { ok: false, error: "comment is required" };
  if (!isString(page)) return { ok: false, error: "page must be a string" };
  if (!isObject(viewport) || !isNumber(viewport.w) || !isNumber(viewport.h)) {
    return { ok: false, error: "viewport must be { w, h }" };
  }
  if (!isObject(element)) return { ok: false, error: "element is required" };
  const { selector, tag, text, html, rect } = element;
  if (!isString(selector) || !isString(tag) || !isString(text) || !isString(html)) {
    return { ok: false, error: "element needs selector, tag, text and html strings" };
  }
  if (!isObject(rect) || ![rect.x, rect.y, rect.w, rect.h].every(isNumber)) {
    return { ok: false, error: "element.rect must be { x, y, w, h }" };
  }
  const frames = parseFrames(element.frames);
  if (!frames) return { ok: false, error: "element.frames must be [{ name, source? }]" };
  return {
    ok: true,
    value: {
      comment: comment.trim(),
      page,
      viewport: { w: viewport.w, h: viewport.h },
      element: {
        selector,
        tag,
        text,
        html,
        rect: { x: rect.x as number, y: rect.y as number, w: rect.w as number, h: rect.h as number },
        frames,
      },
    },
  };
}

/**
 * Read the notes file's text. A missing or empty file is no notes; a file
 * that is not valid notes JSON is an error, so it is never overwritten.
 */
export function parseFeedbackFile(text: string | null): Result<FeedbackFile> {
  if (text === null || text.trim() === "") return { ok: true, value: EMPTY_FILE };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `${FEEDBACK_FILE} is not valid JSON` };
  }
  if (!isObject(data) || !Array.isArray(data.notes)) {
    return { ok: false, error: `${FEEDBACK_FILE} must be { "notes": [...] }` };
  }
  return { ok: true, value: { notes: data.notes as Note[] } };
}

export function serializeFeedbackFile(file: FeedbackFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Make an absolute source path project-relative; other paths pass through. */
export function relativeSource(source: string, root: string): string {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return source.startsWith(prefix) ? source.slice(prefix.length) : source;
}

export function addNote(
  file: FeedbackFile,
  input: NoteInput,
  id: string,
  now: string,
  root: string,
): { file: FeedbackFile; note: Note } {
  const note: Note = {
    ...input,
    element: {
      ...input.element,
      frames: input.element.frames.map((f) =>
        f.source === undefined ? f : { ...f, source: relativeSource(f.source, root) },
      ),
    },
    id,
    createdAt: now,
    status: "open",
  };
  return { file: { notes: [...file.notes, note] }, note };
}

export function removeNote(file: FeedbackFile, id: string): { file: FeedbackFile; removed: boolean } {
  const notes = file.notes.filter((note) => note.id !== id);
  return { file: { notes }, removed: notes.length !== file.notes.length };
}

/** Whether a page path (any base, optional trailing slash) is the feedback route. */
export function isFeedbackRoute(pathname: string): boolean {
  return pathname.replace(/\/+$/, "").endsWith(FEEDBACK_ROUTE);
}
