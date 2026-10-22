// Interaction cards with typed payloads and responses (04 §8; 06 §4).
import { z } from "zod";
import { ActionKind, GrantScope, Limits } from "./actions.ts";
import { FileOutcome } from "./documents.ts";
import { Hash, Id, IsoTime, JsonValue } from "./primitives.ts";
import { FrozenRef, ResourceRef, WorkspacePath } from "./refs.ts";
import { PlanProposal } from "./workers.ts";

const base = {
  id: Id,
  session: Id,
  status: z.enum(["open", "answered", "resolved", "expired"]),
  createdAt: IsoTime,
};
const informational = { ...base, kind: z.literal("informational") };
const optional = { ...base, kind: z.literal("optional") };
const required = { ...base, kind: z.literal("required") };

export const CloseReportPayload = z.object({
  supported: z.string(),
  retained: z.array(FrozenRef).describe("Source references including kind, address, and version.observedAt returned by read/outline. Copy the observation metadata from the source result. Hash checks are disabled."),
  next: z.string(),
});

/**
 * Informational cards change nothing about the run. Optional ones may be answered. Required ones end the run;
 * the answer arrives as the next input. A restructuring review result is informational: application waits on
 * the main agent's assessment, and a required card appears only for an unresolved human decision.
 */
export const Card = z.discriminatedUnion("type", [
  z.object({
    ...informational,
    type: z.literal("change-set"),
    payload: z.object({ changeSet: Id, summary: z.string(), files: z.array(FileOutcome), undo: Id.optional() }),
  }),
  z.object({ ...informational, type: z.literal("run"), payload: z.object({ action: Id, receipt: Id }) }),
  z.object({ ...informational, type: z.literal("artifact"), payload: z.object({ artifact: Id }) }),
  z.object({
    ...informational,
    type: z.literal("close"),
    payload: CloseReportPayload,
  }),
  z.object({
    ...informational,
    type: z.literal("review-report"),
    payload: z.object({ review: Id, findings: z.number().int().nonnegative(), assessment: Id.optional() }),
  }),
  z.object({
    ...optional,
    type: z.literal("exercise"),
    payload: z.object({ prompt: z.string(), source: ResourceRef.optional() }),
  }),
  z.object({
    ...optional,
    type: z.literal("artifact-placement"),
    payload: z.object({ artifact: Id, changeSet: Id }),
  }),
  z.object({
    ...required,
    type: z.literal("approval"),
    payload: z.object({
      action: Id,
      kind: ActionKind,
      display: JsonValue,
      scopes: z.array(GrantScope).min(1),
      limits: Limits.optional(),
    }),
  }),
  z.object({
    ...required,
    type: z.literal("choice"),
    payload: z.object({
      question: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string(), consequence: z.string() })).min(2),
    }),
  }),
  z.object({ ...required, type: z.literal("plan"), payload: z.object({ plan: PlanProposal }) }),
  z.object({
    ...required,
    type: z.literal("conflict"),
    payload: z.object({
      changeSet: Id,
      path: WorkspacePath,
      base: Hash,
      current: Hash,
      preserved: Hash.optional(),
      mergeProposal: z.string().optional(),
    }),
  }),
  z.object({ ...required, type: z.literal("distillation"), payload: z.object({ proposal: Id }) }),
  z.object({
    ...required,
    type: z.literal("uncertain-effect"),
    payload: z.object({ action: Id, evidence: z.array(ResourceRef) }),
  }),
]);
export type Card = z.infer<typeof Card>;
export type CardType = Card["type"];

/** Answers to optional and required cards. Responding twice with the same request id is idempotent. */
export const CardResponse = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exercise"), answer: z.string() }),
  z.object({ type: z.literal("artifact-placement"), accept: z.boolean() }),
  z.object({
    type: z.literal("approval"),
    decision: z.enum(["approve", "deny"]),
    scope: GrantScope,
    limits: Limits.optional(),
  }),
  z.object({ type: z.literal("choice"), option: z.string(), note: z.string().optional() }),
  z.object({ type: z.literal("plan"), decision: z.enum(["approve", "revise", "deny"]), note: z.string().optional() }),
  z.object({
    type: z.literal("conflict"),
    resolution: z.enum(["use-merge", "keep-current", "edit"]),
    text: z.string().optional(),
  }),
  z.object({ type: z.literal("distillation"), decision: z.enum(["apply", "decline"]), note: z.string().optional() }),
  /**
   * Only another reconciliation for now: a response must not bypass the uncertainty rule. Other decisions wait
   * for an explicit, evidence-bearing transition.
   */
  z.object({ type: z.literal("uncertain-effect"), decision: z.literal("reconcile-again"), note: z.string().optional() }),
]);
export type CardResponse = z.infer<typeof CardResponse>;
