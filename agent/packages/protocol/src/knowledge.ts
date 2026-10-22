// Knowledge entries, works, editions and library artifacts (03 §6–7).
import { z } from "zod";
import { Hash, Id, JsonObject, Span, Version } from "./primitives.ts";
import { Address, Locator, WorkspacePath } from "./refs.ts";

export const PassageLabel = z.object({ label: z.string(), span: Span });
export type PassageLabel = z.infer<typeof PassageLabel>;

export const KnowledgeEntry = z.object({
  path: WorkspacePath,
  title: z.string(),
  kind: z.string(),
  area: z.string().optional(),
  support: z.string().optional(),
  review: z.string().optional(),
  arxiv: z.string().optional(),
  version: z.string().optional(),
  readingDepth: z.string().optional(),
  closeReading: z.string().optional(),
  attribution: z.string().optional(),
  /** The frontmatter exactly as parsed. */
  frontmatter: JsonObject,
  /** Paragraph labels such as `[Imported]` and `[Reconstructed]`, in document order. */
  passages: z.array(PassageLabel),
  /** Sections that state their own support, where the collection allows support to differ within a note. */
  sectionSupport: z.array(z.object({ heading: z.string(), support: z.string(), span: Span })),
  fileVersion: Version,
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntry>;

export const KnowledgeArea = z.object({
  id: z.string(),
  title: z.string(),
  span: Span,
  entries: z.array(WorkspacePath),
});
export type KnowledgeArea = z.infer<typeof KnowledgeArea>;

/** Bibliographic identity. */
export const Work = z.object({
  key: Id,
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int().optional(),
  doi: z.string().optional(),
  /** arXiv identifier without version. */
  arxiv: z.string().optional(),
});
export type Work = z.infer<typeof Work>;

/** A local file of an edition: a library PDF or TeX source. */
export const LibraryArtifact = z.object({
  hash: Hash.optional(),
  address: Address,
  mime: z.string(),
  bytes: z.number().int().nonnegative(),
  edition: Id,
  pages: z.number().int().positive().optional(),
});
export type LibraryArtifact = z.infer<typeof LibraryArtifact>;

/** One version of a work (arXiv `v2`, a journal version) with its page numbering. */
export const Edition = z.object({
  id: Id,
  work: Id,
  version: z.string().optional(),
  /** Printed page = PDF page index + offset, when known. */
  pageOffset: z.number().int().optional(),
  pageOffsetSource: z.enum(["configured", "page-labels", "footers"]).optional(),
  artifacts: z.array(LibraryArtifact),
  map: WorkspacePath.optional(),
  sections: z.array(WorkspacePath),
});
export type Edition = z.infer<typeof Edition>;

/** A resolution of a locator written in a note; ambiguity is kept, never guessed away. */
export const LocatorCandidate = z.object({
  locator: Locator,
  edition: Id,
  artifactHash: Hash.optional(),
  confidence: z.enum(["exact", "inferred", "ambiguous"]),
  note: z.string().optional(),
});
export type LocatorCandidate = z.infer<typeof LocatorCandidate>;
