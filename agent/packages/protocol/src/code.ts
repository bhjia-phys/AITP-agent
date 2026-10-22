// Checkouts, working-tree file versions, approximate symbols and receipts (03 §8).
import { z } from "zod";
import { Hash, Id, IsoTime } from "./primitives.ts";
import { Address, ResourceRef, ThreadRef, WorkspacePath } from "./refs.ts";

/** An observed working-tree file. Legacy hash metadata is optional and never checked. */
export const FileVersion = z.object({
  address: Address,
  hash: Hash.optional(),
  /** True when the working-tree content equals the committed blob. */
  committed: z.boolean(),
  checkout: Id.optional(),
});
export type FileVersion = z.infer<typeof FileVersion>;

export const CheckoutRecord = z.object({
  id: Id,
  address: Address,
  branch: z.string().optional(),
  head: z.string().optional(),
  upstream: z.string().optional(),
  ahead: z.number().int().nonnegative().optional(),
  behind: z.number().int().nonnegative().optional(),
  dirty: z.array(z.string()),
  worktrees: z.array(z.string()),
  /** Locations whose notes or maps link this checkout. */
  locations: z.array(WorkspacePath),
  /** The map row that describes it, with any deliberate-change warning. */
  mapRow: ResourceRef.optional(),
  checkedAt: IsoTime,
});
export type CheckoutRecord = z.infer<typeof CheckoutRecord>;

/** Regex-indexed symbol; always approximate navigation. */
export const SymbolRecord = z.object({
  name: z.string(),
  kind: z.enum(["function", "class", "method", "module", "subroutine", "variable", "unknown"]),
  file: FileVersion,
  line: z.number().int().positive(),
  language: z.enum(["cpp", "python", "fortran", "other"]),
  approximate: z.literal(true),
});
export type SymbolRecord = z.infer<typeof SymbolRecord>;

/** The record of an authorized build, test, run or document build. */
export const Receipt = z.object({
  id: Id,
  kind: z.enum(["build", "test", "run", "document"]),
  action: Id,
  checkout: Id.optional(),
  files: z.array(FileVersion),
  command: z.array(z.string()).min(1),
  cwd: Address,
  environment: z.record(z.string(), z.string()),
  exitStatus: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  output: z.object({ artifact: Id, tail: z.string() }),
  thread: ThreadRef.optional(),
  at: IsoTime,
});
export type Receipt = z.infer<typeof Receipt>;
