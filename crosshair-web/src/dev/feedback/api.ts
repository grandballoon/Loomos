/** Thin client for the dev-server notes endpoint (feedback/plugin.ts). */

import { FEEDBACK_ENDPOINT, type Note, type NoteInput } from "../../../feedback/core";

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
}

export async function listNotes(): Promise<Note[]> {
  const res = await check(await fetch(FEEDBACK_ENDPOINT));
  return ((await res.json()) as { notes: Note[] }).notes;
}

export async function createNote(input: NoteInput): Promise<Note> {
  const res = await check(
    await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return (await res.json()) as Note;
}

export async function deleteNote(id: string): Promise<void> {
  await check(await fetch(`${FEEDBACK_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
