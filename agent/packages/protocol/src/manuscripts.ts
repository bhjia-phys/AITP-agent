// Manuscript projects and paragraph review threads (06 §3.10).
import { z } from "zod";
import { Hash, Id, IsoTime, Span } from "./primitives.ts";
import { WorkspacePath } from "./refs.ts";

export const ManuscriptProject = z.object({
  id: Id,
  root: WorkspacePath,
  main: WorkspacePath,
  sources: z.array(WorkspacePath).min(1),
  bibliography: z.array(WorkspacePath),
  figures: z.array(WorkspacePath),
  build: z.object({ kind: z.enum(["make", "latex", "command"]), command: z.array(z.string()).min(1) }),
  outputs: z.array(WorkspacePath),
  source: z.enum(["folder", "link", "configured"]),
});
export type ManuscriptProject = z.infer<typeof ManuscriptProject>;

/** Source-span review record. Content-hash binding and staleness checks are disabled. */
export const ReviewThread = z.object({
  id: Id,
  project: Id,
  anchor: z.object({ path: WorkspacePath, span: Span, textHash: Hash.optional() }),
  status: z.enum(["open", "addressed", "resolved", "stale"]),
  author: z.enum(["researcher", "agent", "external"]),
  comments: z
    .array(z.object({ author: z.enum(["researcher", "agent", "external"]), text: z.string(), at: IsoTime }))
    .min(1),
  createdAt: IsoTime,
});
export type ReviewThread = z.infer<typeof ReviewThread>;
