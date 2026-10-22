// Document operations, change sets and their honest guarantees (02, writes; 03 §12).
import { z } from "zod";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { FrozenRef, WorkspacePath } from "./refs.ts";

/** Where an edit applies. An anchor must resolve uniquely; there is no global replace. */
export const Anchor = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("quote"),
    exact: z.string().min(1),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  z.object({ kind: z.literal("heading"), path: z.array(z.string()).min(1) }),
  /** The whole Current work entry with this thread key. */
  z.object({ kind: z.literal("current-work-entry"), thread: z.string().min(1) }),
  z
    .object({
      kind: z.literal("lines"),
      start: z.number().int().positive(),
      end: z.number().int().positive(),
      expected: z.string(),
    })
    .refine((a) => a.end >= a.start, { message: "end precedes start" }),
]);
export type Anchor = z.infer<typeof Anchor>;

/**
 * One operation of a change set. Content-version checks are disabled; legacy base fields are optional.
 * Creation and destination absence remain separate conditions. Link repairs after a move are separate, previewed edits.
 */
export const DocumentOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("edit"),
    path: WorkspacePath,
    base: Hash.optional(),
    anchor: Anchor,
    operation: z.enum(["replace", "insert-after", "insert-before"]),
    text: z.string(),
  }),
  z.object({
    op: z.literal("create"),
    path: WorkspacePath,
    expectedAbsent: z.literal(true),
    text: z.string(),
    template: z.string().optional(),
  }),
  z.object({
    op: z.literal("move"),
    from: WorkspacePath,
    to: WorkspacePath,
    base: Hash.optional(),
    destinationAbsent: z.literal(true),
  }),
  /** Places a binary artifact file (a figure) at a research location. */
  z.object({
    op: z.literal("copy-artifact"),
    artifact: Id,
    file: z.string().min(1),
    to: WorkspacePath,
    expectedAbsent: z.literal(true),
  }),
]);
export type DocumentOp = z.infer<typeof DocumentOp>;

export const PreservationCheck = z.object({
  path: WorkspacePath,
  kind: z.enum(["sentences", "links", "anchors", "labels"]),
  ok: z.boolean(),
  details: z.array(z.string()),
});
export type PreservationCheck = z.infer<typeof PreservationCheck>;

export const ChangeSetStatus = z.enum([
  "previewed",
  "review-required",
  "ready",
  "applying",
  "applied",
  "conflict",
  "recovery-required",
  "abandoned",
]);
export type ChangeSetStatus = z.infer<typeof ChangeSetStatus>;

export const Writer = z.object({ kind: z.enum(["session", "controller", "researcher"]), id: Id });
export type Writer = z.infer<typeof Writer>;

export const ChangeSet = z.object({
  id: Id,
  /** Optional legacy metadata; not checked for approval, conflicts or review binding. */
  digest: Hash.optional(),
  ops: z.array(DocumentOp).min(1),
  reason: z.string(),
  writer: Writer,
  /** A declared or detected restructuring; it needs a review before application. */
  restructure: z.boolean(),
  status: ChangeSetStatus,
  diff: z.string(),
  checks: z.array(PreservationCheck),
  /** For a restructuring: the review record; legacy digest and baseline metadata do not bind it. */
  review: z.object({ request: Id, digest: Hash.optional(), baselines: z.array(FrozenRef).min(1) }).optional(),
  /** The main agent's assessment that clears the application gate. */
  assessment: Id.optional(),
  createdAt: IsoTime,
});
export type ChangeSet = z.infer<typeof ChangeSet>;

export const FileOutcome = z.object({
  path: WorkspacePath,
  outcome: z.enum(["written", "unchanged", "conflict", "not-applied", "compensated", "needs-recovery"]),
  before: Hash.optional(),
  after: Hash.optional(),
  /** Immutable snapshot of a version that was found in place of the expected one. */
  preserved: Hash.optional(),
});
export type FileOutcome = z.infer<typeof FileOutcome>;

/**
 * Result of applying a change set. Changes are serialized among AITP writers and journalled. Filesystem
 * observers may see partial application. Recovery completes or compensates only where version checks permit;
 * otherwise it preserves evidence and reports `recovery-required`. A rollback never overwrites an
 * intervening external edit.
 */
export const ApplyResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("applied"), files: z.array(FileOutcome) }),
  z.object({ status: z.literal("conflict"), files: z.array(FileOutcome), mergeProposal: z.string().optional() }),
  z.object({
    status: z.literal("ambiguous-anchor"),
    path: WorkspacePath,
    candidates: z.array(z.object({ line: z.number().int().positive(), excerpt: z.string() })),
  }),
  z.object({ status: z.literal("denied"), reason: z.string() }),
  z.object({ status: z.literal("review-required"), review: Id }),
  z.object({ status: z.literal("recovery-required"), files: z.array(FileOutcome), note: z.string() }),
]);
export type ApplyResult = z.infer<typeof ApplyResult>;

/** What startup recovery reports for an interrupted application; the journal itself stays internal. */
export const RecoverySummary = z.object({
  changeSet: Id,
  state: z.enum(["completed", "compensated", "recovery-required"]),
  files: z.array(FileOutcome),
  at: IsoTime,
});
export type RecoverySummary = z.infer<typeof RecoverySummary>;

/** A version AITP observed or wrote. Git history, when available, is shown beside these. */
export const SnapshotRecord = z.object({
  hash: Hash.optional(),
  path: WorkspacePath,
  origin: z.enum(["written", "observed"]),
  writer: Writer.optional(),
  at: IsoTime,
  pinned: z.boolean(),
});
export type SnapshotRecord = z.infer<typeof SnapshotRecord>;
