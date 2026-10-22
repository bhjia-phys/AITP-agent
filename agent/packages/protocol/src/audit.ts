// Immutable audit events. Each is appended as an `aitp.audit` entry without model messages, in the same
// transaction as the runtime-document change it records, so the export can reconstruct history (09 §11).
import { z } from "zod";
import { ActionRecord, ActionState, Grant } from "./actions.ts";
import { ArtifactRecord } from "./artifacts.ts";
import { Card, CardResponse } from "./cards.ts";
import { ContextItem } from "./context.ts";
import { ApplyResult, ChangeSet, RecoverySummary } from "./documents.ts";
import { MethodUse } from "./methods.ts";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { ResourceRef } from "./refs.ts";
import { CoverageRange, ReviewAssessment, ReviewReport, ReviewRequest } from "./reviews.ts";
import { ActiveTask } from "./sessions.ts";
import { WorkerRecord } from "./workers.ts";

const at = { at: IsoTime };

export const AuditEvent = z.discriminatedUnion("type", [
  /** The rendered text of an instruction section; `text: null, hash: null, bytes: 0` records its removal. */
  z.object({
    ...at,
    type: z.literal("instruction-rendering"),
    section: z.string(),
    text: z.string().nullable(),
    hash: Hash.nullable(),
    bytes: z.number().int().nonnegative(),
  }),
  z.object({ ...at, type: z.literal("context-delivery"), item: ContextItem }),
  z.object({ ...at, type: z.literal("supersession"), items: z.array(Id).min(1), reason: z.string() }),
  z.object({ ...at, type: z.literal("active-task"), task: ActiveTask }),
  z.object({ ...at, type: z.literal("card"), card: Card }),
  z.object({ ...at, type: z.literal("card-response"), card: Id, response: CardResponse }),
  z.object({ ...at, type: z.literal("grant-created"), grant: Grant }),
  z.object({ ...at, type: z.literal("grant-revoked"), grant: Id }),
  /** Every action transition records the complete resulting record, including approval, receipt and reconciliation evidence. */
  z.object({
    ...at,
    type: z.literal("action"),
    action: Id,
    from: ActionState.nullable(),
    to: ActionState,
    record: ActionRecord,
    note: z.string().optional(),
  }),
  z.object({ ...at, type: z.literal("change-set"), changeSet: ChangeSet, result: ApplyResult.optional() }),
  z.object({ ...at, type: z.literal("recovery"), summary: RecoverySummary }),
  z.object({ ...at, type: z.literal("artifact"), artifact: ArtifactRecord }),
  z.object({ ...at, type: z.literal("review-request"), request: ReviewRequest }),
  z.object({ ...at, type: z.literal("review-report"), report: ReviewReport }),
  z.object({ ...at, type: z.literal("review-assessment"), assessment: ReviewAssessment }),
  z.object({
    ...at,
    type: z.literal("worker"),
    event: z.enum(["planned", "admitted", "started", "steered", "settled", "failed", "stopped", "reassigned", "retried"]),
    worker: WorkerRecord,
  }),
  z.object({ ...at, type: z.literal("compaction-applied"), compaction: Id, summaryEntry: Id, covered: CoverageRange }),
  z.object({ ...at, type: z.literal("attachment"), attachment: Id, mime: z.string(), ref: ResourceRef }),
  z.object({ ...at, type: z.literal("method-use"), use: MethodUse }),
  z.object({ ...at, type: z.literal("notice"), level: z.enum(["info", "warn", "error"]), message: z.string() }),
]);
export type AuditEvent = z.infer<typeof AuditEvent>;
