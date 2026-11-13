/**
 * Dev-server endpoint for UI feedback notes (imperative shell over
 * feedback/core.ts). Dev only: the static production build has no server.
 *
 *   GET    /__ui-feedback       → { notes }
 *   POST   /__ui-feedback       → add a note (NoteInput body) → 201 note
 *   DELETE /__ui-feedback/:id   → remove a note → 204
 *
 * The file is re-read on every request, so edits Claude makes to it (such
 * as marking notes resolved) show up in the overlay without a restart.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { Plugin } from "vite";

import {
  addNote,
  FEEDBACK_ENDPOINT,
  FEEDBACK_FILE,
  parseFeedbackFile,
  parseNoteInput,
  removeNote,
  serializeFeedbackFile,
} from "./core";

/** Request bodies are small JSON notes; anything larger is refused. */
const MAX_BODY_BYTES = 256 * 1024;

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function uiFeedbackPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: "ui-feedback",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      const path = () => resolve(root, FEEDBACK_FILE);
      const load = () => parseFeedbackFile(existsSync(path()) ? readFileSync(path(), "utf8") : null);

      server.middlewares.use(FEEDBACK_ENDPOINT, async (req, res) => {
        try {
          const current = load();
          if (!current.ok) return send(res, 500, { error: current.error });
          const id = decodeURIComponent((req.url ?? "/").split("?")[0].replace(/^\/+/, ""));

          if (req.method === "GET" && id === "") return send(res, 200, current.value);

          if (req.method === "POST" && id === "") {
            let body: unknown;
            try {
              body = JSON.parse(await readBody(req));
            } catch {
              return send(res, 400, { error: "body must be JSON" });
            }
            const input = parseNoteInput(body);
            if (!input.ok) return send(res, 400, { error: input.error });
            const noteId = `fb-${randomUUID().slice(0, 8)}`;
            const next = addNote(current.value, input.value, noteId, new Date().toISOString(), root);
            writeFileSync(path(), serializeFeedbackFile(next.file));
            return send(res, 201, next.note);
          }

          if (req.method === "DELETE" && id !== "") {
            const next = removeNote(current.value, id);
            if (!next.removed) return send(res, 404, { error: `no note ${id}` });
            writeFileSync(path(), serializeFeedbackFile(next.file));
            return send(res, 204);
          }

          return send(res, 405, { error: "method not allowed" });
        } catch (error) {
          return send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
