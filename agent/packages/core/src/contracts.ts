// Interfaces between the research core's modules and its users (03). Owned by S1; types only.
// S2 implements: WorkspaceFs, DerivedIndex, WorkspaceModel, DocumentService.
// S5 implements: KnowledgeService, WorksService, CheckoutService, RunService, MethodIndex, EpisodeStore,
// ManuscriptService. `compose.ts` (S1) wires them into CoreServices.
import type {
  Address,
  ApplyResult,
  CampaignCoverage,
  ChangeSet,
  CheckoutRecord,
  Config,
  DocumentOp,
  Edition,
  Episode,
  FileVersion,
  Graph,
  Grouping,
  Hash,
  Id,
  InstructionSource,
  IsoTime,
  JsonValue,
  KnowledgeArea,
  KnowledgeEntry,
  LocatorCandidate,
  ManuscriptProject,
  MethodRecord,
  Outline,
  RecoverySummary,
  RequestId,
  ResearchLocation,
  RunRecord,
  SearchHit,
  SnapshotRecord,
  SymbolRecord,
  ThreadRow,
  ThreadState,
  Use,
  Version,
  Work,
  WorkspacePath,
  Writer,
} from "@aitp/protocol";

export interface Clock {
  now(): Date;
}

export interface Hasher {
  sha256(data: string | Uint8Array): Hash;
}

export type FileKind = "file" | "directory" | "link";

/**
 * Read access to configured roots. Every call resolves real paths and refuses anything outside the roots or
 * below a hidden path (`forbidden_path`). Writes never go through this interface.
 */
export interface WorkspaceFs {
  /** The absolute real path, and the workspace-relative path when it lies under `workspace.root`. */
  resolve(address: Address): Promise<{ absolute: string; workspacePath?: WorkspacePath }>;
  toAddress(absolute: string): Address;
  readText(address: Address, options?: { maxBytes?: number }): Promise<{ text: string; version: Version }>;
  readBytes(
    address: Address,
    options?: { maxBytes?: number; range?: { start: number; end: number } },
  ): Promise<{ bytes: Uint8Array; hash?: Hash; mime: string; size: number }>;
  stat(address: Address): Promise<{ kind: FileKind; bytes: number; mtimeMs: number } | undefined>;
  /** Bounded listing; directories over the limit (default 2,000 entries) are reported truncated. */
  list(
    address: Address,
    options?: { limit?: number },
  ): Promise<{ entries: { name: string; kind: FileKind; bytes?: number }[]; truncated: boolean }>;
}

/** The disposable derived index (`index.sqlite`); rebuilt from files. */
export interface DerivedIndex {
  rebuild(): Promise<void>;
  status(): Promise<{ builtAt?: IsoTime; documents: number }>;
  search(query: string, options?: { scope?: "notes" | "knowledge" | "all"; limit?: number }): Promise<SearchHit[]>;
  /** A namespaced cache for adapters, keyed by content hash where possible (symbols, method records). */
  cache<T extends JsonValue>(namespace: string): {
    get(key: string): Promise<T | undefined>;
    put(key: string, value: T): Promise<void>;
    clear(): Promise<void>;
  };
}

export type BoardFilter = { state?: ThreadState; grouping?: string; owner?: WorkspacePath };

/** Locations, notes, the graph, the board and instruction resolution (03 §2–5). */
export interface WorkspaceModel {
  /** Pure and total: never throws; structure it cannot read is kept as raw entries and warnings. */
  parseNote(location: WorkspacePath, text: string, format: "markdown" | "tex", version: Version): Outline;
  locations(): Promise<ResearchLocation[]>;
  graph(): Promise<Graph>;
  groupings(): Promise<Grouping[]>;
  outline(location: WorkspacePath): Promise<Outline>;
  board(filter?: BoardFilter): Promise<ThreadRow[]>;
  /** The caller resolves a checkout id to its address; instruction sources are found from the address. */
  instructions(target: { location?: WorkspacePath; checkout?: { id: Id; address: Address } }): Promise<InstructionSource[]>;
  whereUsed(path: WorkspacePath, anchor?: string): Promise<Use[]>;
  /** Re-reads changed files (polling found them, or a writer reported them). */
  refresh(paths?: WorkspacePath[]): Promise<void>;
  onChange(listener: (change: { path: WorkspacePath; version: Version }) => void): () => void;
}

/**
 * The only write path into notes and knowledge. Changes are serialized among AITP writers and journalled;
 * external editors get detection and preservation where possible, not prevention (02, writes).
 */
export interface DocumentService {
  read(path: WorkspacePath): Promise<{ text: string; version: Version; format: "markdown" | "tex" | "text" }>;
  preview(input: { ops: DocumentOp[]; reason: string; writer: Writer; restructure?: boolean }): Promise<ChangeSet>;
  /**
   * Applies a previewed change set. Policy checks (write mode, pilot list, protected paths, label rules) run
   * here; authorization is the runtime's job and has happened before the call. A restructuring needs the
   * assessment that clears its review gate. Digest binding checks are disabled.
   */
  apply(
    changeSet: Id,
    options: { requestId: RequestId; reviewGate?: { assessment: Id; digest?: Hash } },
  ): Promise<ApplyResult>;
  get(changeSet: Id): Promise<{ changeSet: ChangeSet; recovery?: RecoverySummary } | undefined>;
  history(path: WorkspacePath): Promise<SnapshotRecord[]>;
  snapshot(hash: Hash): Promise<{ record: SnapshotRecord; text: string } | undefined>;
  pin(hashes: Hash[], by: string): Promise<void>;
  /** Startup recovery of interrupted applications, before any scheduling. */
  recover(): Promise<RecoverySummary[]>;
}

export interface KnowledgeService {
  areas(): Promise<KnowledgeArea[]>;
  entries(filter?: {
    area?: string[];
    kind?: string[];
    support?: string[];
    review?: string[];
    readingDepth?: string[];
  }): Promise<KnowledgeEntry[]>;
  entry(path: WorkspacePath): Promise<KnowledgeEntry>;
  /** The index header rules plus the named areas; never the whole index. */
  indexExcerpt(areas: string[]): Promise<{ text: string; version: Version }>;
}

export interface WorksService {
  work(key: Id): Promise<Work | undefined>;
  edition(id: Id): Promise<Edition | undefined>;
  /** Finds the edition of a paper map, a library path or an arXiv identifier with version. */
  editionFor(reference: string): Promise<Edition | undefined>;
  resolveLocator(edition: Id, written: string): Promise<LocatorCandidate[]>;
}

export interface CheckoutService {
  list(location?: WorkspacePath): Promise<CheckoutRecord[]>;
  state(address: Address): Promise<CheckoutRecord>;
  tree(checkout: Id, path?: string): Promise<{ entries: { name: string; kind: FileKind; bytes?: number }[]; truncated: boolean }>;
  file(checkout: Id, path: string, range?: { from?: number; to?: number }): Promise<{ file: FileVersion; text: string; startLine: number }>;
  fileVersion(address: Address): Promise<FileVersion>;
  search(checkout: Id, query: string): Promise<SearchHit[]>;
  log(checkout: Id, options?: { path?: string; limit?: number }): Promise<{ commit: string; at: IsoTime; subject: string; author?: string }[]>;
  diff(checkout: Id, options?: { path?: string; from?: string; to?: string }): Promise<string>;
  symbols(checkout: Id, options?: { path?: string; query?: string }): Promise<SymbolRecord[]>;
}

export interface RunService {
  list(location?: WorkspacePath): Promise<RunRecord[]>;
  detail(path: WorkspacePath): Promise<RunRecord>;
  coverage(path: WorkspacePath): Promise<CampaignCoverage | undefined>;
  campaigns(location?: WorkspacePath): Promise<CampaignCoverage[]>;
}

export interface MethodIndex {
  list(): Promise<MethodRecord[]>;
  record(address: Address): Promise<MethodRecord | undefined>;
  read(address: Address): Promise<{ text: string; version: Version }>;
}

/** Episodes persist in the data directory (not the disposable index); the runtime writes them at session close. */
export interface EpisodeStore {
  put(episode: Episode): Promise<void>;
  query(options: { location?: WorkspacePath; text?: string; limit?: number }): Promise<Episode[]>;
  /** Marks episodes citing a changed source as stale. */
  invalidate(changed: { path: WorkspacePath; version: Version }[]): Promise<number>;
}

export interface ManuscriptService {
  list(): Promise<ManuscriptProject[]>;
  get(id: Id): Promise<ManuscriptProject | undefined>;
}

export interface CoreServices {
  config: Config;
  fs: WorkspaceFs;
  index: DerivedIndex;
  workspace: WorkspaceModel;
  documents: DocumentService;
  knowledge: KnowledgeService;
  works: WorksService;
  checkouts: CheckoutService;
  runs: RunService;
  methods: MethodIndex;
  episodes: EpisodeStore;
  manuscripts: ManuscriptService;
}

export type CoreDeps = { config: Config; dataDir: string; clock: Clock; hasher: Hasher };

/**
 * Reads a file of the runtime's artifact store. S1 wires it as a late callback to `ArtifactStore.read`; factories
 * must not call it during construction.
 */
export type ReadArtifact = (artifact: Id, file: string) => Promise<{ bytes: Uint8Array; mime: string }>;

/**
 * Reads `AITP_AGENT_CONFIG` (default `~/.config/aitp-agent/config.json`) and `AITP_AGENT_HOME` (default
 * `~/.local/share/aitp-agent`) and validates the configuration.
 */
export type LoadConfig = (
  env: Record<string, string | undefined>,
) => Promise<{ config: Config; dataDir: string; configPath: string }>; // S2: config/index.ts `loadConfig`

/** Factory signatures; each is exported by its owning module under the name in the comment. */
export type CreateWorkspaceFs = (deps: CoreDeps) => WorkspaceFs; // S2: paths/index.ts `createWorkspaceFs`
export type CreateDerivedIndex = (deps: CoreDeps & { fs: WorkspaceFs }) => DerivedIndex; // S2: index/index.ts `createDerivedIndex`
export type CreateWorkspaceModel = (
  deps: CoreDeps & { fs: WorkspaceFs; index: DerivedIndex },
) => WorkspaceModel; // S2: locations/index.ts `createWorkspaceModel`
export type CreateDocumentService = (
  deps: CoreDeps & { fs: WorkspaceFs; workspace: WorkspaceModel; readArtifact: ReadArtifact },
) => DocumentService; // S2: documents/index.ts `createDocumentService`
export type CreateKnowledgeService = (deps: CoreDeps & { fs: WorkspaceFs; index: DerivedIndex }) => KnowledgeService; // S5: knowledge/index.ts
export type CreateWorksService = (deps: CoreDeps & { fs: WorkspaceFs; knowledge: KnowledgeService }) => WorksService; // S5: works/index.ts
export type CreateCheckoutService = (
  deps: CoreDeps & { fs: WorkspaceFs; index: DerivedIndex; workspace: WorkspaceModel },
) => CheckoutService; // S5: checkouts/index.ts
export type CreateRunService = (deps: CoreDeps & { fs: WorkspaceFs; workspace: WorkspaceModel }) => RunService; // S5: runs/index.ts
export type CreateMethodIndex = (deps: CoreDeps & { fs: WorkspaceFs; index: DerivedIndex; workspace: WorkspaceModel }) => MethodIndex; // S5: methods/index.ts
export type CreateEpisodeStore = (deps: CoreDeps) => EpisodeStore; // S5: episodes/index.ts
export type CreateManuscriptService = (deps: CoreDeps & { fs: WorkspaceFs; workspace: WorkspaceModel }) => ManuscriptService; // S5: manuscripts/index.ts
