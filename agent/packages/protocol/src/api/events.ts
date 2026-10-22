// WebSocket envelope, server events and client messages (07, WebSocket).
import { z } from "zod";
import { ActionRecord } from "../actions.ts";
import { Card } from "../cards.ts";
import { ContextManifest } from "../context.ts";
import { ChangeSet } from "../documents.ts";
import { LoginChallenge, LoginResult } from "../models.ts";
import { Id, IsoTime, JsonValue, Version } from "../primitives.ts";
import { WorkspacePath } from "../refs.ts";
import { ActiveTask, SessionMeta, TranscriptEntryView } from "../sessions.ts";
import { TaskView } from "../workers.ts";
import { ErrorCode } from "./errors.ts";

/**
 * `epoch` changes when the server restarts or drops a client's backlog: the client then discards its state for
 * each subscribed topic and applies the snapshots that follow. `seq` increases within an epoch; a repeated
 * `seq` is ignored. Partial deltas are best effort; committed entries are authoritative.
 */
export const Envelope = z.object({
  epoch: Id,
  seq: z.number().int().nonnegative(),
  at: IsoTime,
  type: z.string(),
  payload: JsonValue,
});
export type Envelope = z.infer<typeof Envelope>;

/** Whether a turn runs; compaction is reported separately (`compacting`), because Pi compacts while work continues. */
export const SessionState = z.enum(["idle", "busy", "waiting-researcher"]);
export type SessionState = z.infer<typeof SessionState>;

/** Topics: `session:<id>`, `tasks`, `inbox`, `board`, `notes`, `login`, `server`. */
export const Topic = z.string().regex(/^(session:[^\s]+|tasks|inbox|board|notes|login|server)$/);
export type Topic = z.infer<typeof Topic>;

export const EVENTS = {
  "session.snapshot": z.object({
    session: SessionMeta,
    activeTask: ActiveTask.optional(),
    entries: z.array(TranscriptEntryView),
    cards: z.array(Card),
    manifest: ContextManifest.optional(),
    state: SessionState,
    compacting: z.boolean(),
    live: z.object({ text: z.string(), thinkingSummary: z.string().optional() }).optional(),
  }),
  "session.entry": z.object({ session: Id, entry: TranscriptEntryView }),
  "session.partial": z.object({
    session: Id,
    delta: z.object({ text: z.string().optional(), thinkingSummary: z.string().optional() }),
  }),
  "session.tool": z.object({
    session: Id,
    phase: z.enum(["start", "update", "end"]),
    callId: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    isError: z.boolean().optional(),
  }),
  "session.card": z.object({ card: Card }),
  "session.state": z.object({ session: Id, state: SessionState, compacting: z.boolean() }),
  "session.manifest": z.object({ manifest: ContextManifest }),
  "session.active-task": z.object({ task: ActiveTask }),
  "session.error": z.object({ session: Id, code: ErrorCode, message: z.string() }),
  "action.changed": z.object({ action: ActionRecord }),
  "changes.changed": z.object({ changeSet: ChangeSet }),
  "tasks.snapshot": z.object({ tasks: z.array(TaskView) }),
  "tasks.changed": z.object({ task: TaskView }),
  "inbox.changed": z.object({ keys: z.array(z.string()) }),
  "board.changed": z.object({ locations: z.array(WorkspacePath) }),
  "note.changed": z.object({ path: WorkspacePath, version: Version }),
  "instructions.changed": z.object({ paths: z.array(z.string()) }),
  "login.challenge": z.object({ challenge: LoginChallenge }),
  "login.result": LoginResult,
  "server.notice": z.object({ level: z.enum(["info", "warn", "error"]), message: z.string() }),
  /** Sent with a new epoch before the replacement snapshots. */
  reset: z.object({ topics: z.array(Topic), reason: z.string() }),
} as const;
export type EventType = keyof typeof EVENTS;
export type EventPayload<T extends EventType> = z.infer<(typeof EVENTS)[T]>;

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    topics: z.array(Topic).min(1),
    epoch: Id.optional(),
    lastSeq: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("unsubscribe"), topics: z.array(Topic).min(1) }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
