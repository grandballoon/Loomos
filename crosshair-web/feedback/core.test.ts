import { describe, expect, it } from "vitest";

import {
  addNote,
  EMPTY_FILE,
  isFeedbackRoute,
  parseFeedbackFile,
  parseNoteInput,
  relativeSource,
  removeNote,
  serializeFeedbackFile,
  type NoteInput,
} from "./core";

const input: NoteInput = {
  comment: "Toggle label wraps",
  page: "/ui-feedback",
  viewport: { w: 1440, h: 900 },
  element: {
    selector: "aside.sidebar > div.settings > label:nth-of-type(2)",
    tag: "label",
    text: "Grid",
    html: '<label class="field field-toggle">',
    rect: { x: 10, y: 20, w: 270, h: 26 },
    frames: [
      { name: "label", source: "/repo/crosshair-web/src/ui/fields.tsx:112:5" },
      { name: "ToggleField", source: "/repo/crosshair-web/src/ui/CardSettingsPanel.tsx:105:9" },
      { name: "App" },
    ],
  },
};

describe("parseNoteInput", () => {
  it("accepts a well-formed note and trims the comment", () => {
    const result = parseNoteInput({ ...input, comment: "  Toggle label wraps \n" });
    expect(result).toEqual({ ok: true, value: input });
  });

  it("rejects an empty comment", () => {
    expect(parseNoteInput({ ...input, comment: "   " })).toEqual({ ok: false, error: "comment is required" });
  });

  it("rejects malformed elements", () => {
    expect(parseNoteInput({ ...input, element: { ...input.element, rect: { x: 1 } } }).ok).toBe(false);
    expect(parseNoteInput({ ...input, element: { ...input.element, frames: [{ source: "x" }] } }).ok).toBe(false);
    expect(parseNoteInput(null).ok).toBe(false);
  });

  it("drops unknown fields", () => {
    const result = parseNoteInput({ ...input, extra: 1, element: { ...input.element, extra: 2 } });
    expect(result).toEqual({ ok: true, value: input });
  });
});

describe("feedback file", () => {
  it("treats a missing or empty file as no notes", () => {
    expect(parseFeedbackFile(null)).toEqual({ ok: true, value: EMPTY_FILE });
    expect(parseFeedbackFile("  ")).toEqual({ ok: true, value: EMPTY_FILE });
  });

  it("refuses a corrupt file rather than overwriting it", () => {
    expect(parseFeedbackFile("{nope").ok).toBe(false);
    expect(parseFeedbackFile('{"items": []}').ok).toBe(false);
  });

  it("round-trips through serialize", () => {
    const { file } = addNote(EMPTY_FILE, input, "fb-1", "2026-11-13T00:00:00.000Z", "/repo/crosshair-web");
    expect(parseFeedbackFile(serializeFeedbackFile(file))).toEqual({ ok: true, value: file });
  });
});

describe("addNote / removeNote", () => {
  it("appends an open note with project-relative sources", () => {
    const { file, note } = addNote(EMPTY_FILE, input, "fb-1", "2026-11-13T00:00:00.000Z", "/repo/crosshair-web");
    expect(file.notes).toEqual([note]);
    expect(note).toMatchObject({ id: "fb-1", status: "open", createdAt: "2026-11-13T00:00:00.000Z" });
    expect(note.element.frames).toEqual([
      { name: "label", source: "src/ui/fields.tsx:112:5" },
      { name: "ToggleField", source: "src/ui/CardSettingsPanel.tsx:105:9" },
      { name: "App" },
    ]);
  });

  it("removes by id and reports misses", () => {
    const { file } = addNote(EMPTY_FILE, input, "fb-1", "t", "/repo");
    expect(removeNote(file, "fb-1")).toEqual({ file: EMPTY_FILE, removed: true });
    expect(removeNote(file, "fb-2")).toEqual({ file, removed: false });
  });
});

describe("helpers", () => {
  it("relativeSource strips only the project root", () => {
    expect(relativeSource("/a/b/src/x.tsx:1:2", "/a/b")).toBe("src/x.tsx:1:2");
    expect(relativeSource("/a/bc/src/x.tsx:1:2", "/a/b")).toBe("/a/bc/src/x.tsx:1:2");
  });

  it("isFeedbackRoute matches the route under any base", () => {
    expect(isFeedbackRoute("/ui-feedback")).toBe(true);
    expect(isFeedbackRoute("/Loomos/ui-feedback/")).toBe(true);
    expect(isFeedbackRoute("/")).toBe(false);
    expect(isFeedbackRoute("/ui-feedback-old")).toBe(false);
  });
});
