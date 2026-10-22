// Methods, their use records, distillation proposals and episodes (05; 03 §10–11).
import { z } from "zod";
import { Hash, Id, IsoTime, Version } from "./primitives.ts";
import { Address, ResourceRef, WorkspacePath } from "./refs.ts";

export const MethodHome = z.enum(["core", "domain", "topic", "family", "external"]);
export type MethodHome = z.infer<typeof MethodHome>;

export const MethodRecord = z.object({
  address: Address,
  name: z.string(),
  description: z.string(),
  home: MethodHome,
  domain: z.string().optional(),
  locations: z.array(WorkspacePath),
  version: Version,
  use: z.object({
    validated: z.number().int().nonnegative(),
    corrected: z.number().int().nonnegative(),
    contradicted: z.number().int().nonnegative(),
    lastUsed: IsoTime.optional(),
  }),
});
export type MethodRecord = z.infer<typeof MethodRecord>;

export const MethodOutcome = z.enum(["followed", "validated", "corrected", "contradicted", "not-applicable", "failed"]);
export type MethodOutcome = z.infer<typeof MethodOutcome>;

/** Runtime evidence about a Skill, never content of it. */
export const MethodUse = z.object({
  id: Id,
  skill: Address,
  skillVersion: Hash,
  session: Id,
  location: WorkspacePath,
  outcome: MethodOutcome,
  note: z.string().optional(),
  evidence: z.array(ResourceRef),
  at: IsoTime,
});
export type MethodUse = z.infer<typeof MethodUse>;

/** A proposed Skill revision or new Skill; it arrives in the inbox as a proposal, never as an edit. */
export const DistillationProposal = z.object({
  id: Id,
  kind: z.enum(["revise", "new"]),
  skill: Address.optional(),
  target: Address,
  home: z.enum(["topic", "family", "aitp-branch"]),
  changeSet: Id,
  rationale: z.string(),
  evidence: z.array(ResourceRef).min(1),
  status: z.enum(["open", "applied", "declined"]),
});
export type DistillationProposal = z.infer<typeof DistillationProposal>;

/** Operational recall from a closed session; lower authority than notes, stale when a cited source changes. */
export const Episode = z.object({
  id: Id,
  session: Id,
  location: WorkspacePath,
  activeTask: Id,
  attempted: z.array(z.string()),
  outcomes: z.array(z.string()),
  evidence: z.array(ResourceRef),
  skills: z.array(z.object({ address: Address, version: Hash })),
  notesRead: z.array(ResourceRef),
  notesWritten: z.array(ResourceRef),
  closedAt: IsoTime,
  stale: z.boolean(),
});
export type Episode = z.infer<typeof Episode>;
