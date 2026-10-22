// Run owners, campaign coverage and scheduler observations (03 §9).
import { z } from "zod";
import { Id, IsoTime, Span, Version } from "./primitives.ts";
import { ResourceRef, WorkspacePath } from "./refs.ts";

/** Evidence quoted from a run owner README; never a live state. */
export const RunRecord = z.object({
  path: WorkspacePath,
  title: z.string(),
  locations: z.array(WorkspacePath),
  jobIds: z.array(z.string()),
  clusters: z.array(z.string()),
  receipts: z.array(WorkspacePath),
  observations: z.array(z.object({ text: z.string(), span: Span })),
  version: Version,
});
export type RunRecord = z.infer<typeof RunRecord>;

/** Counts shown only when a receipt states them, each with its source. */
export const CampaignCoverage = z.object({
  run: WorkspacePath,
  counts: z.array(
    z.object({
      name: z.union([z.enum(["expected", "retained", "read-back", "accepted"]), z.string()]),
      value: z.number().int().nonnegative(),
      source: ResourceRef,
    }),
  ),
  failed: z.array(z.string()),
  source: ResourceRef,
});
export type CampaignCoverage = z.infer<typeof CampaignCoverage>;

/** A scheduler query made on request, stamped with its time. */
export const ClusterObservation = z.object({
  cluster: z.string(),
  action: Id,
  command: z.array(z.string()),
  jobs: z.array(z.object({ id: z.string(), state: z.string(), name: z.string().optional(), raw: z.string() })),
  observedAt: IsoTime,
});
export type ClusterObservation = z.infer<typeof ClusterObservation>;
