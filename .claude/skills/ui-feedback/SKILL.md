---
name: ui-feedback
description: Pull and act on UI feedback notes the user left by Alt-clicking elements in the crosshair-web dev server at /ui-feedback. Use when the user says "pull UI feedback", "check my feedback", "address the notes", or invokes /ui-feedback.
---

# UI feedback

The user leaves notes on the running webapp by opening the dev server at `/ui-feedback` (e.g. http://localhost:5173/ui-feedback) and Alt-clicking (⌥-click) an element.
Each note lands in `crosshair-web/ui-feedback.json` (gitignored), which is the single source of truth.

## Pull

1. Read `crosshair-web/ui-feedback.json`.
   If it is missing or has no `"status": "open"` notes, tell the user there is nothing open and stop.
2. For each open note, read in this order:
   - `comment`: what the user wants.
   - `element.frames`: innermost first.
     `frames[0].source` is the JSX of the clicked element; later frames are each enclosing component's usage site (`src/...:line:column`, relative to `crosshair-web/`).
     Usually the fix is in `frames[0]` or `frames[1]`; styles live in `src/index.css` by class name from `element.html`.
   - `element.selector`, `element.text`, `element.rect`, `viewport`, `page`: context for which instance was clicked and at what window size.
3. Summarise the open notes back to the user in one short list before changing code when any note is ambiguous; otherwise go ahead.

## Resolve

1. Fix each note following the repo's CLAUDE.md (functional core, tests, lint).
2. In `ui-feedback.json`, set that note's `"status"` to `"resolved"` and add `"resolution"`: one sentence on what changed.
   Edit the file in place; do not delete notes (the user deletes them from the overlay).
   The overlay re-reads the file, so resolved notes show struck through with the resolution.
3. Do not verify visually in a browser; the user checks the result in the overlay.
4. Report which notes were resolved and which were not, and why.

## How it works

- `crosshair-web/feedback/core.ts`: pure note model and validation.
- `crosshair-web/feedback/plugin.ts`: Vite dev-server endpoint at `/__ui-feedback` (GET, POST, DELETE) that reads and writes the file.
- `crosshair-web/src/dev/feedback/`: the overlay, loaded only in dev at `/ui-feedback`; the production build contains none of it.
