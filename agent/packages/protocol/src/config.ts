// Configuration (02, data locations). Secrets never appear here.
import { z } from "zod";
import { ModelChoice } from "./models.ts";
import { AbsolutePath, WorkspacePath } from "./refs.ts";

export const Config = z.object({
  workspace: z.object({
    /** Base of every workspace-relative path; by default the parent of `topicsRoot`. */
    root: AbsolutePath,
    topicsRoot: AbsolutePath,
    knowledgeRoot: AbsolutePath.optional(),
    /** Code checkouts outside the workspace, the AITP checkout, skill sets. */
    extraReadRoots: z.array(AbsolutePath),
    /** Main notes discovery cannot find: TeX mains, stories, unusual files. */
    locations: z.array(
      z.object({ path: WorkspacePath, kind: z.enum(["topic", "branch", "learning", "record"]).optional() }),
    ),
    writeMode: z.enum(["off", "pilot", "on"]),
    pilotTopics: z.array(WorkspacePath),
    previews: z.object({ openings: z.boolean(), conclusions: z.boolean(), parents: z.boolean() }),
  }),
  aitp: z.object({
    checkout: AbsolutePath,
    extraSkillRoots: z.array(AbsolutePath),
    /** Where general-method revisions are written; never the live checkout. */
    methodsBranchWorktree: AbsolutePath.optional(),
  }),
  /** Background and teaching preferences, free text. */
  researcher: z.string().optional(),
  models: z.object({
    main: ModelChoice,
    reviewer: ModelChoice.optional(),
    workers: z.record(z.string(), ModelChoice).optional(),
    budget: z.object({ maxRequestFraction: z.number().gt(0).lte(1).optional() }).optional(),
  }),
  clusters: z.array(z.object({ name: z.string(), sshHost: z.string(), scheduler: z.literal("slurm") })),
  sandbox: z.object({
    engine: z.enum(["bwrap", "none"]),
    /** Read roots in addition to the workspace roots: toolchains, interpreters, site-packages. */
    readRoots: z.array(AbsolutePath),
    /** Never mounted, even below a read root; added to the built-in hidden list. */
    hiddenPaths: z.array(AbsolutePath),
    limits: z.object({
      addressSpaceMB: z.number().int().positive(),
      processes: z.number().int().positive(),
      fileSizeMB: z.number().int().positive(),
      wallSeconds: z.number().int().positive(),
    }),
    maxConcurrentHeavy: z.number().int().positive(),
  }),
  python: z.object({ interpreter: AbsolutePath }).optional(),
  server: z.object({ port: z.number().int().min(0).max(65535), host: z.literal("127.0.0.1") }),
  ui: z.object({ theme: z.enum(["system", "light", "dark"]), language: z.literal("en") }),
});
export type Config = z.infer<typeof Config>;
