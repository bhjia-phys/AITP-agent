// Exported outputs with provenance (02, sandbox; 04 §5).
import { z } from "zod";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { ResourceRef } from "./refs.ts";

export const Provenance = z.object({
  session: Id.optional(),
  task: Id.optional(),
  action: Id.optional(),
  command: z.array(z.string()).optional(),
  script: z.object({ hash: Hash.optional(), text: z.string().optional() }).optional(),
  inputs: z.array(ResourceRef),
  environment: z.record(z.string(), z.string()),
  exitStatus: z.number().int().nullable().optional(),
  checks: z.array(z.object({ what: z.string(), outcome: z.string() })),
});
export type Provenance = z.infer<typeof Provenance>;

export const ArtifactFile = z.object({
  name: z.string().min(1),
  hash: Hash.optional(),
  bytes: z.number().int().nonnegative(),
  mime: z.string(),
});
export type ArtifactFile = z.infer<typeof ArtifactFile>;

/** Immutable once created; pinned while anything (an episode, action, review or export) refers to it. */
export const ArtifactRecord = z.object({
  id: Id,
  files: z.array(ArtifactFile).min(1),
  provenance: Provenance,
  pinned: z.boolean(),
  createdAt: IsoTime,
});
export type ArtifactRecord = z.infer<typeof ArtifactRecord>;
