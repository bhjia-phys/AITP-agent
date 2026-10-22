// Plans, workers, integration and the composed task view (04 §9).
import { z } from "zod";
import { ActionKind, GrantRequest, Limits } from "./actions.ts";
import { ModelChoice } from "./models.ts";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { Address, ResourceRef, WorkspacePath } from "./refs.ts";

export const Budget = z.object({
  modelCalls: z.number().int().positive().optional(),
  wallSeconds: z.number().int().positive().optional(),
  outputTokens: z.number().int().positive().optional(),
});
export type Budget = z.infer<typeof Budget>;

export const WorkerRole = z.object({
  role: z.string().min(1),
  model: ModelChoice,
  /** Role text; the runtime adds AITP's hand-off contract. */
  instructions: z.string(),
  tools: z.array(z.string()),
  /** The notes this worker may write. The integrator alone writes the shared affected set. */
  writable: z.array(WorkspacePath),
  budget: Budget,
});
export type WorkerRole = z.infer<typeof WorkerRole>;

/** A reviewable instantiation of the roles and stopping condition a Skill describes in prose. */
export const WorkerPlan = z.object({
  id: Id,
  method: z.object({ address: Address, version: Hash }).optional(),
  roles: z.array(WorkerRole).min(1),
  checks: z.array(z.string()),
  stopping: z.string(),
  integration: z.object({ affected: z.array(WorkspacePath) }),
});
export type WorkerPlan = z.infer<typeof WorkerPlan>;

/** What a plan card proposes. Approval authorizes only the stated bounded steps, each by a bound grant. */
export const PlanProposal = z.object({
  id: Id,
  title: z.string(),
  steps: z.array(
    z.object({
      id: Id,
      description: z.string(),
      action: ActionKind.optional(),
      tool: z.string().optional(),
      argsHash: Hash.optional(),
      limits: Limits.optional(),
    }),
  ),
  methods: z.array(z.object({ address: Address, version: Hash, departure: z.string().optional() })),
  cost: z.string(),
  stopping: z.string(),
  workers: WorkerPlan.optional(),
  grants: z.array(GrantRequest),
});
export type PlanProposal = z.infer<typeof PlanProposal>;

export const WorkerState = z.enum(["queued", "running", "settled", "failed", "stopped", "reassigned"]);
export type WorkerState = z.infer<typeof WorkerState>;

export const WorkerRecord = z.object({
  id: Id,
  controller: Id,
  role: z.string(),
  model: ModelChoice,
  state: WorkerState,
  task: Id.optional(),
  conversation: Id.optional(),
  admission: z.object({ position: z.number().int().nonnegative().optional(), admittedAt: IsoTime.optional() }),
  budget: Budget,
  used: z.object({
    modelCalls: z.number().int().nonnegative(),
    wallSeconds: z.number().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  restarts: z.number().int().nonnegative(),
  retryOf: Id.optional(),
  reassignedTo: Id.optional(),
  result: z.object({ summary: z.string(), evidence: z.array(ResourceRef) }).optional(),
});
export type WorkerRecord = z.infer<typeof WorkerRecord>;

/**
 * One link of the integration chain: a settled worker's integration task waits for its predecessor, so one
 * integration writes at a time, in completion order.
 */
export const IntegrationRecord = z.object({
  worker: Id,
  task: Id,
  predecessor: Id.optional(),
  status: z.enum(["waiting", "integrating", "integrated", "conflict", "failed"]),
  changeSet: Id.optional(),
});
export type IntegrationRecord = z.infer<typeof IntegrationRecord>;

/** The workbench's view of a task: Pi's live graph composed with AITP's admissions and retained history. */
export const TaskView = z.object({
  id: Id,
  kind: z.enum(["turn", "controller", "worker", "integration", "review", "compaction", "tool", "other"]),
  status: z.enum(["queued", "pending", "running", "waiting", "completing", "terminal"]),
  outcome: z.enum(["ok", "failed", "aborted"]).optional(),
  owner: z.object({ conversation: Id.optional(), task: Id.optional() }),
  conversation: Id.optional(),
  retryOf: Id.optional(),
  title: z.string(),
  queuePosition: z.number().int().nonnegative().optional(),
  updatedAt: IsoTime,
});
export type TaskView = z.infer<typeof TaskView>;
