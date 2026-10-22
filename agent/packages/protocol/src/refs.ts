// Addresses, locators and references (09 §2).
import { z } from "zod";
import { Hash, Id, IsoTime, Version } from "./primitives.ts";

/** A POSIX path relative to the workspace root (`workspace.root`), without `..` or a leading slash. */
export const WorkspacePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.includes("\\") && !p.split("/").includes(".."), {
    message: "expected a workspace-relative POSIX path without '..'",
  });
export type WorkspacePath = z.infer<typeof WorkspacePath>;

/** An absolute POSIX path; it must lie under a configured root, which the path guard checks. */
export const AbsolutePath = z
  .string()
  .refine((p) => p.startsWith("/") && !p.split("/").includes(".."), {
    message: "expected an absolute POSIX path without '..'",
  });
export type AbsolutePath = z.infer<typeof AbsolutePath>;

/** Where a referenced thing lives. Every reference has exactly one address. */
export const Address = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace"), path: WorkspacePath }),
  z.object({ kind: z.literal("absolute"), path: AbsolutePath }),
  z.object({ kind: z.literal("uri"), uri: z.url() }),
  z.object({ kind: z.literal("artifact"), artifact: Id, file: z.string().min(1).optional() }),
  z.object({ kind: z.literal("snapshot"), hash: Hash }),
  z.object({ kind: z.literal("episode"), episode: Id }),
  z.object({ kind: z.literal("entry"), conversation: Id, entry: Id }),
  z.object({ kind: z.literal("action"), action: Id }),
]);
export type Address = z.infer<typeof Address>;

const unit = z.number().min(0).max(1);

/** A position inside the addressed thing. Page and region locators are meaningful only for one edition. */
export const Locator = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("lines"), start: z.number().int().positive(), end: z.number().int().positive() })
    .refine((l) => l.end >= l.start, { message: "end precedes start" }),
  z.object({ kind: z.literal("heading"), path: z.array(z.string()).min(1), slug: z.string().optional() }),
  z.object({ kind: z.literal("anchor"), id: z.string().min(1) }),
  z.object({
    kind: z.literal("quote"),
    exact: z.string().min(1),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
  z.object({ kind: z.literal("pdf-page"), index: z.number().int().positive() }),
  z.object({ kind: z.literal("printed-page"), label: z.string().min(1) }),
  z.object({ kind: z.literal("section"), label: z.string().min(1) }),
  z.object({ kind: z.literal("equation"), label: z.string().min(1) }),
  z.object({ kind: z.literal("tex-label"), label: z.string().min(1) }),
  z
    .object({ kind: z.literal("region"), pdfPage: z.number().int().positive(), x: unit, y: unit, w: unit, h: unit })
    .refine((r) => r.w > 0 && r.h > 0 && r.x + r.w <= 1 && r.y + r.h <= 1, {
      message: "a region is non-empty and lies within the page",
    }),
]);
export type Locator = z.infer<typeof Locator>;

const EDITION_BOUND = new Set(["pdf-page", "printed-page", "region"]);

export const RefKind = z.enum([
  "note",
  "knowledge",
  "file",
  "code",
  "edition",
  "artifact",
  "run",
  "receipt",
  "snapshot",
  "episode",
  "session-entry",
  "action",
  "web",
]);
export type RefKind = z.infer<typeof RefKind>;

export const ResourceRef = z.object({
  kind: RefKind,
  address: Address,
  /** The content version the reference was made against. */
  version: Version.optional(),
  locator: Locator.optional(),
  /** Other readings of an ambiguous locator, kept rather than guessed away (printed versus PDF page). */
  alternatives: z.array(Locator).optional(),
  edition: Id.optional(),
  artifactHash: Hash.optional(),
  label: z.string().optional(),
});
export type ResourceRef = z.infer<typeof ResourceRef>;

/**
 * Source-reference wire name retained for compatibility. Version/hash gates are disabled; page and region
 * locators still identify their edition.
 */
export const FrozenRef = ResourceRef.refine(
  (r) => [r.locator, ...(r.alternatives ?? [])].every(l => l === undefined || !EDITION_BOUND.has(l.kind) || r.edition !== undefined),
  { message: "page and region locators need an edition" },
);
export type FrozenRef = z.infer<typeof FrozenRef>;

/**
 * The identity of one Current work entry: its owning main note and a key derived from its name (a GitHub-style
 * slug, de-duplicated within the note). Sessions, grants, scope flags and the UI all use it.
 */
export const ThreadRef = z.object({
  location: WorkspacePath,
  key: z.string().min(1),
  name: z.string(),
  version: Version.optional(),
});
export type ThreadRef = z.infer<typeof ThreadRef>;

/** A derived value with its sources; semantic extraction is labelled and never replaces the source passage. */
export function projectionOf<T extends z.ZodType>(value: T) {
  return z.object({
    value,
    sources: z.array(ResourceRef).min(1),
    builder: z.string(),
    builtAt: IsoTime,
    fresh: z.boolean(),
    extracted: z
      .object({ kind: z.enum(["suggestion", "summary"]), confidence: z.enum(["low", "medium", "high"]) })
      .optional(),
  });
}
