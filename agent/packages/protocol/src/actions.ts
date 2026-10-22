// Actions, grants and their state machine (04 §6–7). Operational state, never a scientific record.
import { z } from "zod";
import { Hash, Id, IsoTime, JsonValue, Version } from "./primitives.ts";
import { AbsolutePath, Address, FrozenRef, ResourceRef, ThreadRef, WorkspacePath } from "./refs.ts";
import { ScopeFlagName } from "./research.ts";

export const ActionKind = z.enum([
  "run-read",
  "run-write",
  "note-write",
  "knowledge-write",
  "code-write",
  "build",
  "network",
  "library-write",
  "cluster-read",
  "cluster-submit",
  "cluster-cancel",
  "git-commit",
  "git-push",
  "install",
  "skill-write",
  "restructure",
]);
export type ActionKind = z.infer<typeof ActionKind>;

/** Operations requiring effect reconciliation after interruption, including local commits. */
export const EFFECT_KINDS: readonly ActionKind[] = [
  "network",
  "library-write",
  "cluster-submit",
  "cluster-cancel",
  "git-commit",
  "git-push",
  "install",
];

export const ActionState = z.enum([
  "proposed",
  "approved",
  "denied",
  "revoked",
  "reserved",
  "executing",
  "done",
  "failed",
  "cancelled",
  "interrupted",
  "uncertain",
]);
export type ActionState = z.infer<typeof ActionState>;

/**
 * Allowed transitions. `approved → reserved` consumes a once-grant in the same transaction. `executing` is
 * committed, with the operation identity, before any invocation. Startup recovery moves records left in
 * `reserved` or `executing` without a receipt to `interrupted`; reconciliation alone leaves `uncertain`, and an
 * inconclusive reconciliation leaves it there.
 */
export const ACTION_TRANSITIONS: Readonly<Record<ActionState, readonly ActionState[]>> = {
  proposed: ["approved", "denied", "cancelled"],
  approved: ["reserved", "revoked", "cancelled"],
  reserved: ["executing", "revoked", "cancelled", "interrupted"],
  executing: ["done", "failed", "interrupted"],
  interrupted: ["uncertain", "failed"],
  uncertain: ["done", "failed"],
  done: [],
  failed: [],
  denied: [],
  revoked: [],
  cancelled: [],
};

export function canTransition(from: ActionState, to: ActionState): boolean {
  return ACTION_TRANSITIONS[from].includes(to);
}

/** A new attempt is a new record with `retryOf`; it may follow only these states, never `uncertain`. */
export const RETRY_ALLOWED_FROM: readonly ActionState[] = ["failed", "cancelled", "denied", "revoked"];

/** Reserved tool argument naming the approved action a repeated call refers to; excluded from `argsHash`. */
export const APPROVAL_ARGUMENT = "approval";

export const Limits = z.object({
  wallSeconds: z.number().int().positive().optional(),
  addressSpaceMB: z.number().int().positive().optional(),
  processes: z.number().int().positive().optional(),
  fileSizeMB: z.number().int().positive().optional(),
  outputRoots: z.array(AbsolutePath).optional(),
});
export type Limits = z.infer<typeof Limits>;

export const GrantScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once") }),
  /** Bound to one active task (`ActiveTask.id`). */
  z.object({ kind: z.literal("task"), task: Id }),
  z.object({ kind: z.literal("session"), session: Id }),
  z.object({ kind: z.literal("location"), location: WorkspacePath }),
  /** Bound to the thread as it was when granted; a changed entry is a different scope. */
  z.object({ kind: z.literal("thread"), thread: ThreadRef.extend({ version: Version.optional() }) }),
  z.object({ kind: z.literal("workspace") }),
]);
export type GrantScope = z.infer<typeof GrantScope>;

/** Legacy approval metadata. Digest binding checks are disabled. */
export const Binding = z.object({ argsHash: Hash.optional(), targets: z.array(FrozenRef) });
export type Binding = z.infer<typeof Binding>;

export const Grant = z
  .object({
    id: Id,
    actions: z.array(ActionKind).min(1),
    scope: GrantScope,
    bind: Binding.optional(),
    roots: z.array(Address).optional(),
    clusters: z.array(z.string()).optional(),
    limits: Limits.optional(),
    /** Scope flags this grant overrides for its scope; only the researcher creates such grants. */
    overrides: z.array(ScopeFlagName).optional(),
    source: z.enum(["researcher", "default", "plan"]),
    sourceRef: ResourceRef.optional(),
    createdAt: IsoTime,
    expiresAt: IsoTime.optional(),
    /** For once-grants: the action that consumed it, set atomically with `approved → reserved`. */
    consumedBy: Id.optional(),
    revokedAt: IsoTime.optional(),
  })
  .refine((g) => g.overrides === undefined || g.source === "researcher", {
    message: "only the researcher overrides scope flags",
  })
  .refine((g) => g.consumedBy === undefined || g.scope.kind === "once", {
    message: "only once-grants are consumed",
  });
export type Grant = z.infer<typeof Grant>;

/** The execution that created the record: which call, in which conversation and task. */
export const ActionCall = z.object({ conversation: Id, toolCallId: z.string().min(1), task: Id.optional() });
export type ActionCall = z.infer<typeof ActionCall>;

export const ActionRecord = z
  .object({
    id: Id,
    /** Carried outward where possible (job name or comment, commit trailer) for reconciliation. */
    operationId: Id,
    kind: ActionKind,
    tool: z.string().min(1),
    call: ActionCall,
    /** Optional legacy metadata; never checked for authorization. */
    argsHash: Hash.optional(),
    /** A redacted copy of the arguments for display; never used for matching. */
    display: JsonValue,
    targets: z.array(FrozenRef),
    limits: Limits.optional(),
    session: Id,
    activeTask: Id.optional(),
    state: ActionState,
    approval: z
      .object({ grant: Id, decidedBy: z.enum(["researcher", "default", "plan"]), at: IsoTime })
      .optional(),
    retryOf: Id.optional(),
    history: z.array(z.object({ state: ActionState, at: IsoTime, note: z.string().optional() })).min(1),
    receipt: z
      .object({
        at: IsoTime,
        outcome: z.enum(["ok", "error"]),
        details: JsonValue,
        evidence: z.array(ResourceRef),
      })
      .optional(),
    reconciliation: z
      .object({ at: IsoTime, evidence: z.array(ResourceRef), conclusive: z.boolean(), note: z.string() })
      .optional(),
  })
  .refine((a) => a.history[0]?.state === "proposed", { message: "every action starts as proposed" })
  .refine((a) => a.history[a.history.length - 1]?.state === a.state, {
    message: "the last history entry is the current state",
  })
  .refine(
    (a) => a.history.every((h, i) => i === 0 || canTransition(a.history[i - 1]!.state, h.state)),
    { message: "history follows the allowed transitions" },
  );
export type ActionRecord = z.infer<typeof ActionRecord>;

/**
 * A grant a plan, an approval card or the researcher asks for. The service creating the grant enforces the
 * researcher-only rule for `overrides`.
 */
export const GrantRequest = z
  .object({
    actions: z.array(ActionKind).min(1),
    scope: GrantScope,
    bind: Binding.optional(),
    roots: z.array(Address).optional(),
    clusters: z.array(z.string()).optional(),
    limits: Limits.optional(),
    overrides: z.array(ScopeFlagName).optional(),
    reason: z.string(),
  });
export type GrantRequest = z.infer<typeof GrantRequest>;
