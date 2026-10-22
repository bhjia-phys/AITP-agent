// Independent process review: requests, reports and the main agent's assessment (04 §10).
import { z } from "zod";
import { ModelChoice } from "./models.ts";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { FrozenRef, ResourceRef } from "./refs.ts";

/** A stable position in a conversation's log: Pi entry id plus its ordinal. */
export const Cursor = z.object({ conversation: Id, entry: Id, ordinal: z.number().int().nonnegative() });
export type Cursor = z.infer<typeof Cursor>;

export const CoverageRange = z.object({
  conversation: Id,
  /** Absent: from the start of the conversation. */
  from: Cursor.optional(),
  to: Cursor,
});
export type CoverageRange = z.infer<typeof CoverageRange>;

export const ReviewSignal = z.enum([
  "compaction",
  "handoff",
  "session-end",
  "delegation",
  "restructuring",
  "outside-reliance",
  "researcher",
]);
export type ReviewSignal = z.infer<typeof ReviewSignal>;

const WHOLE_SESSION: readonly ReviewSignal[] = ["handoff", "session-end", "delegation"];

/**
 * A review to run. Coverage follows the reviewer Skill: every part of the log no earlier review inspected,
 * gaps included, or the whole session at handoff, session end and delegation; the researcher's messages across
 * the whole session always.
 */
export const ReviewRequest = z
  .object({
    id: Id,
    session: Id,
    signal: ReviewSignal,
    wholeSession: z.boolean(),
    ranges: z.array(CoverageRange).min(1),
    /** For a restructuring: the exact proposed change and the baselines it is judged against. */
    changeSet: z.object({ id: Id, digest: Hash.optional(), baselines: z.array(FrozenRef).min(1) }).optional(),
    status: z.enum(["queued", "running", "reported", "assessed", "superseded", "failed"]),
    /** Duplicate triggers merged into this request. */
    mergedFrom: z.array(Id),
    createdAt: IsoTime,
  })
  .refine((r) => r.signal !== "restructuring" || r.changeSet !== undefined, {
    message: "a restructuring review names its change set and baselines",
  })
  .refine((r) => !WHOLE_SESSION.includes(r.signal) || r.wholeSession, {
    message: "handoff, session-end and delegation reviews cover the whole session",
  });
export type ReviewRequest = z.infer<typeof ReviewRequest>;

export const ReviewFinding = z.object({
  id: Id,
  severity: z.enum(["blocking", "important", "minor"]),
  dimension: z.enum(["complete", "sound", "preserved", "coherent", "agreement", "other"]),
  location: ResourceRef,
  text: z.string(),
  evidence: z.array(ResourceRef),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

/** Submitted by the reviewer through its report tool; the reviewer edits nothing. */
export const ReviewReport = z.object({
  request: Id,
  text: z.string(),
  findings: z.array(ReviewFinding),
  covered: z.array(CoverageRange),
  limitations: z.array(z.string()),
  model: ModelChoice,
  reportedAt: IsoTime,
});
export type ReviewReport = z.infer<typeof ReviewReport>;

/**
 * The main agent's assessment. Digest binding is disabled; any substantive revision
 * of the change set invalidates it, and the application gate closes again.
 */
export const ReviewAssessment = z.object({
  id: Id,
  request: Id,
  changeSetDigest: Hash.optional(),
  verdicts: z.array(
    z.object({
      finding: Id,
      verdict: z.enum(["valid", "partly-valid", "invalid"]),
      note: z.string(),
      applied: z.array(ResourceRef),
    }),
  ),
  /** True when the assessed change may be applied; an unresolved human decision keeps it false. */
  clearsGate: z.boolean(),
  at: IsoTime,
});
export type ReviewAssessment = z.infer<typeof ReviewAssessment>;
