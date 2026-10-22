// The research model read from the workspace (03). Every record is derived and names its sources.
import { z } from "zod";
import { Id, IsoDate, IsoTime, Span, Version } from "./primitives.ts";
import { projectionOf, ResourceRef, WorkspacePath } from "./refs.ts";

export const LocationKind = z.enum(["root", "family", "topic", "branch", "learning", "record"]);
export type LocationKind = z.infer<typeof LocationKind>;

export const ScopeFlagName = z.enum(["analyticOnly", "executionExcluded", "dormant", "paused", "deferred"]);
export type ScopeFlagName = z.infer<typeof ScopeFlagName>;

/** A scope restriction stated by a note, at the narrowest unit it names: the location or one thread. */
export const ScopeFlag = z.object({
  flag: ScopeFlagName,
  location: WorkspacePath,
  /** Thread key (`ThreadRef.key`) when the flag applies to one thread only. */
  thread: z.string().optional(),
  /** The span that states the flag. */
  source: ResourceRef,
  /** The researcher's grant that overrides the flag, if any (never written into the note). */
  overriddenBy: Id.optional(),
});
export type ScopeFlag = z.infer<typeof ScopeFlag>;

export const ResearchLocation = z.object({
  /** Workspace-relative path of the main note. */
  id: WorkspacePath,
  kind: LocationKind,
  format: z.enum(["markdown", "tex"]),
  title: z.string(),
  /** Scientific parents: notes with a pointer entry to this one, or notes its opening links while they link to it. */
  parents: z.array(WorkspacePath),
  children: z.array(WorkspacePath),
  groupings: z.array(Id),
  scope: z.array(ScopeFlag),
  source: z.enum(["link", "map", "configured", "listing"]),
  version: Version,
});
export type ResearchLocation = z.infer<typeof ResearchLocation>;

export const ThreadState = z.enum([
  "active",
  "proposed",
  "waiting-researcher",
  "waiting-analysis",
  "waiting-run",
  "waiting-input",
  "waiting-integration",
  "paused",
  "stopped",
  "dormant",
  "deferred",
  "blocked",
  "concluded",
  "pointer",
  "unknown",
]);
export type ThreadState = z.infer<typeof ThreadState>;

export const EntryForm = z.enum(["pointer", "thread", "heading", "raw"]);
export type EntryForm = z.infer<typeof EntryForm>;

export const PlanRef = z.object({
  ref: ResourceRef,
  title: z.string(),
  phases: z.array(z.object({ title: z.string(), span: Span })),
  /** Index into `phases` of the phase the plan marks as operative. */
  operative: z.number().int().nonnegative().optional(),
});
export type PlanRef = z.infer<typeof PlanRef>;

export const ContinuationSuggestion = projectionOf(z.string());
export type ContinuationSuggestion = z.infer<typeof ContinuationSuggestion>;

/** One Current work entry with its complete source span. State is normalized from the disposition only. */
export const ThreadEntry = z.object({
  owner: WorkspacePath,
  index: z.number().int().nonnegative(),
  /** Slug of the name, de-duplicated within the note; `ThreadRef.key`. */
  key: z.string().min(1),
  form: EntryForm,
  name: z.string().nullable(),
  /** The disposition exactly as written (whitespace normalized). The UI always shows it. */
  dispositionText: z.string().optional(),
  state: ThreadState,
  date: z.union([IsoDate, z.literal("unrecorded")]).optional(),
  /**
   * `resolved` is null when resolution was not attempted: pure parsing returns unchecked pointers, and
   * `outline` resolves targets and loads linked plans.
   */
  pointer: z
    .object({ target: WorkspacePath, anchor: z.string().optional(), resolved: z.boolean().nullable() })
    .optional(),
  /** Extracted next step, labelled as a suggestion; never an execution instruction. */
  continuation: ContinuationSuggestion.optional(),
  anchors: z.array(z.string()),
  links: z.array(ResourceRef),
  plan: PlanRef.optional(),
  span: Span,
  text: z.string(),
});
export type ThreadEntry = z.infer<typeof ThreadEntry>;

/** A board row: an entry with display context. */
export const ThreadRow = ThreadEntry.extend({
  ownerTitle: z.string(),
  ownerKind: LocationKind,
  grouping: z.string().optional(),
});
export type ThreadRow = z.infer<typeof ThreadRow>;

export const LinkKind = z.enum([
  "main-note",
  "note",
  "code",
  "data",
  "figure",
  "pdf",
  "tex",
  "directory",
  "arxiv",
  "doi",
  "web",
  "anchor",
  "unknown",
]);
export type LinkKind = z.infer<typeof LinkKind>;

export const LinkRecord = z.object({
  text: z.string(),
  /** The target exactly as written. */
  target: z.string(),
  kind: LinkKind,
  resolved: ResourceRef.nullable(),
  /** False when the target file exists but the anchor does not. */
  anchorOk: z.boolean().optional(),
  line: z.number().int().positive(),
});
export type LinkRecord = z.infer<typeof LinkRecord>;

export const Heading = z.object({
  level: z.number().int().min(1).max(6),
  text: z.string(),
  slug: z.string(),
  line: z.number().int().positive(),
});
export type Heading = z.infer<typeof Heading>;

export const ParseWarning = z.object({ line: z.number().int().positive().optional(), message: z.string() });
export type ParseWarning = z.infer<typeof ParseWarning>;

/** What `parseNote` returns. It never throws; unstructured parts are kept as raw entries or warnings. */
export const Outline = z.object({
  location: WorkspacePath,
  version: Version,
  format: z.enum(["markdown", "tex"]),
  title: z.string(),
  opening: z.object({ span: Span, text: z.string() }),
  headings: z.array(Heading),
  anchors: z.array(z.object({ id: z.string(), line: z.number().int().positive() })),
  currentWork: z.object({ span: Span, entries: z.array(ThreadEntry) }).nullable(),
  links: z.array(LinkRecord),
  plans: z.array(PlanRef),
  scope: z.array(ScopeFlag),
  warnings: z.array(ParseWarning),
});
export type Outline = z.infer<typeof Outline>;

export const GraphNode = z.object({
  id: z.string(),
  kind: z.enum(["location", "grouping"]),
  location: WorkspacePath.optional(),
  title: z.string(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(["uses", "pointer-to", "maps-to", "cites", "groups"]),
  source: ResourceRef,
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const NavigationNode = z.object({
  id: z.string(),
  title: z.string(),
  location: WorkspacePath.optional(),
  children: z.array(z.string()),
  /** Other primary positions of a node with several users. */
  alsoUnder: z.array(z.string()),
});
export type NavigationNode = z.infer<typeof NavigationNode>;

export const Graph = z.object({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  navigation: z.object({
    roots: z.array(z.string()),
    nodes: z.record(z.string(), NavigationNode),
    unmapped: z.array(WorkspacePath),
  }),
  builtAt: IsoTime,
});
export type Graph = z.infer<typeof Graph>;

/** Display grouping: a root direction or a family README, rendered from its source section. */
export const Grouping = z.object({
  id: Id,
  title: z.string(),
  source: ResourceRef,
  sectionText: z.string(),
  members: z.array(WorkspacePath),
});
export type Grouping = z.infer<typeof Grouping>;

export const InstructionSourceKind = z.enum([
  "workspace",
  "family-readme",
  "repository",
  "method-guidance",
  "root-agreement",
]);
export type InstructionSourceKind = z.infer<typeof InstructionSourceKind>;

/** An instruction that applies to a task; delivered as an instruction, never as data (04 §2). */
export const InstructionSource = z.object({
  ref: ResourceRef,
  kind: InstructionSourceKind,
  appliesTo: z.object({ location: WorkspacePath.optional(), checkout: Id.optional() }),
  text: z.string(),
});
export type InstructionSource = z.infer<typeof InstructionSource>;

export const SearchHit = z.object({
  ref: ResourceRef,
  heading: z.string().optional(),
  snippet: z.string(),
  score: z.number(),
});
export type SearchHit = z.infer<typeof SearchHit>;

/** A use of something, found in the link graph; relationships the graph cannot establish are marked unknown. */
export const Use = z.object({
  user: ResourceRef,
  relation: z.enum(["links", "cites", "pointer", "index-row", "unknown"]),
  passage: z.string(),
});
export type Use = z.infer<typeof Use>;

export const InboxItem = z.object({
  id: Id,
  kind: z.enum(["thread", "decision", "review", "distillation", "uncertain-effect", "recovery"]),
  title: z.string(),
  source: ResourceRef,
  createdAt: IsoTime,
  card: Id.optional(),
  action: Id.optional(),
  review: Id.optional(),
  proposal: Id.optional(),
});
export type InboxItem = z.infer<typeof InboxItem>;
