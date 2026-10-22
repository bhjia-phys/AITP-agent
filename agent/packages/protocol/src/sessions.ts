// Sessions, active tasks and inputs (04 §1).
import { z } from "zod";
import { ContentBlock } from "./content.ts";
import { ModelUsage } from "./models.ts";
import { Id, IsoTime, RequestId } from "./primitives.ts";
import { FrozenRef, ResourceRef, ThreadRef, WorkspacePath } from "./refs.ts";

export const SessionKind = z.enum(["research", "reading", "code", "worker", "review"]);
export type SessionKind = z.infer<typeof SessionKind>;

export const Mode = z.enum(["continue", "theory", "computation", "reading", "learning", "writing", "brainstorm", "status"]);
export type Mode = z.infer<typeof Mode>;

export const SessionMeta = z.object({
  id: Id,
  conversation: Id,
  kind: SessionKind,
  location: WorkspacePath,
  edition: Id.optional(),
  checkout: Id.optional(),
  title: z.string(),
  mode: Mode,
  /** The thread the session works on, when it is bound to one. */
  thread: ThreadRef.optional(),
  /** Selected materials, frozen at their versions. */
  scope: z.array(FrozenRef),
  createdAt: IsoTime,
  archived: z.boolean(),
  lastSeen: z.object({ manifest: Id, at: IsoTime }).optional(),
});
export type SessionMeta = z.infer<typeof SessionMeta>;

/**
 * The researcher's current authorized request in a session. It changes only when a `task` input is placed;
 * interjections and status questions leave it as it is.
 */
export const ActiveTask = z.object({
  id: Id,
  session: Id,
  request: z.string(),
  agreement: z.object({ source: z.enum(["request", "plan", "standing", "grant"]), ref: ResourceRef.optional() }),
  thread: ThreadRef.optional(),
  scope: z.array(FrozenRef),
  nextAction: z.string().optional(),
  status: z.enum(["active", "waiting-researcher", "done", "stopped"]),
  placedAt: IsoTime,
  updatedAt: IsoTime,
});
export type ActiveTask = z.infer<typeof ActiveTask>;

/** What the input is for. */
export const MessagePurpose = z.enum(["task", "interjection", "continue"]);
export type MessagePurpose = z.infer<typeof MessagePurpose>;

/** What happens when the conversation is busy: join the running turn, wait for its end, or refuse. */
export const Delivery = z.enum(["steer", "follow-up", "reject"]);
export type Delivery = z.infer<typeof Delivery>;

/**
 * One input. Task-specific data for a queued input travels inside `content` as data blocks, so it is placed
 * with the input and never enters the running turn early. The session prepares that data once and submits the
 * input once; a repeat of the same request id reuses the persisted preparation (09 §4).
 */
export const InputSubmission = z.object({
  purpose: MessagePurpose,
  delivery: Delivery,
  content: z.array(ContentBlock).min(1),
  scope: z.array(FrozenRef).optional(),
  thread: ThreadRef.optional(),
  requestId: RequestId,
});
export type InputSubmission = z.infer<typeof InputSubmission>;

export const SubmissionReceipt = z.object({
  submission: Id,
  requestId: RequestId,
  status: z.enum(["admitted", "placed", "rejected", "aborted", "settled"]),
  entry: Id.optional(),
  /** Why an admitted input could not be placed; preserve the execution port's reason. */
  reason: z.string().optional(),
  at: IsoTime,
});
export type SubmissionReceipt = z.infer<typeof SubmissionReceipt>;

/** A transcript entry as the workbench shows it; never raw Pi JSON. */
export const TranscriptEntryView = z.object({
  id: Id,
  conversation: Id,
  ordinal: z.number().int().nonnegative(),
  kind: z.enum(["user", "assistant", "thinking-summary", "tool-call", "tool-result", "data", "summary", "audit", "notice"]),
  at: IsoTime.optional(),
  content: z.array(ContentBlock),
  usage: ModelUsage.optional(),
  purpose: MessagePurpose.optional(),
  delivery: Delivery.optional(),
  tool: z
    .object({ callId: z.string(), name: z.string(), isError: z.boolean().optional(), summary: z.string().optional() })
    .optional(),
});
export type TranscriptEntryView = z.infer<typeof TranscriptEntryView>;
