// Callable contracts of the runtime (04; 09 §10). Owned by S1; types only.
// The execution port is implemented by @aitp/pi-adapter (S3), which imports this module type-only.
// Services: S3 sessions, context, cards, reviews, workers, export; S4 actions, sandbox, artifacts, effects;
// S5 method use and manuscript review. `registry.ts` (S1) registers the tools; `compose.ts` (S1) wires the rest.
import type { CoreServices } from "@aitp/core/contracts";
import type {
  ActionKind,
  ActionRecord,
  ActiveTask,
  Address,
  ApplyResult,
  ArtifactFile,
  ArtifactRecord,
  AuditEvent,
  Card,
  CardResponse,
  ClusterObservation,
  ContentBlock,
  ContextManifest,
  Cursor,
  DataDelivery,
  DeliveryReceipt,
  DistillationProposal,
  FrozenRef,
  Grant,
  GrantRequest,
  GrantScope,
  Hash,
  Id,
  ImageBlock,
  ImportPreview,
  InputSubmission,
  JsonObject,
  JsonValue,
  Limits,
  LiteratureResult,
  LogRecord,
  LoginChallenge,
  LoginResponse,
  LoginResult,
  MethodRecord,
  MethodUse,
  Mode,
  ModelCatalogEntry,
  ModelChoice,
  ModelMessage,
  Provenance,
  Receipt,
  ReviewAssessment,
  ReviewReport,
  ReviewRequest,
  ReviewSignal,
  ReviewThread,
  ScopeFlagName,
  SessionKind,
  SessionMeta,
  SessionState,
  SubmissionReceipt,
  TaskView,
  TextBlock,
  ThreadRef,
  TranscriptEntryView,
  WorkerPlan,
  WorkerRecord,
  WorkspacePath,
} from "@aitp/protocol";

// ---------------------------------------------------------------------------------------------------------
// Durable runtime state
// ---------------------------------------------------------------------------------------------------------

export type StateFamily =
  | "session"
  | "active-task"
  | "manifest"
  | "action"
  | "grant"
  | "card"
  | "review"
  | "worker"
  | "integration"
  | "controller"
  | "admission"
  | "method-use"
  | "proposal"
  | "manuscript-thread"
  | "request";

/** Runtime documents are global and keyed by family and key. Values are JSON objects (Pi needs object roots). */
export type StateAddress = { family: StateFamily; key: string };

export interface StateReader {
  get<T extends JsonObject>(address: StateAddress): Promise<T | undefined>;
  list<T extends JsonObject>(
    family: StateFamily,
    options?: { prefix?: string; after?: string; limit?: number },
  ): Promise<{ items: { key: string; value: T }[]; next?: string }>;
}

/**
 * One serialized transaction. Validation, grant consumption, an action transition and its audit entry happen in
 * one transaction. The callback performs no network or file effects and reads only through `tx`. Transaction
 * handles reject all operations after their callback ends.
 */
export interface StateTransaction extends StateReader {
  put(address: StateAddress, value: JsonObject): Promise<void>;
  delete(address: StateAddress): Promise<void>;
  /** Appends an immutable `aitp.audit` entry (no model messages) to the conversation, in this transaction. */
  appendAudit(conversation: Id, event: AuditEvent): Promise<void>;
  /**
   * Creates a task in this transaction, together with its idempotency binding for `requestId`. Pi rejects an
   * owner task that is completing or terminal.
   */
  startTask(spec: TaskStart): Promise<Id>;
}

export type TaskStart = {
  shell: string;
  input: JsonValue;
  owner: { conversation: Id } | { task: Id };
  requestId: string;
};

export type Transact = <T>(change: (tx: StateTransaction) => Promise<T>) => Promise<T>;

// ---------------------------------------------------------------------------------------------------------
// Tools, hooks, instruction sections
// ---------------------------------------------------------------------------------------------------------

/** JSON Schema subset accepted for tool parameters: object, properties, required, items, enum, type, description. */
export type ToolParameters = JsonObject;

export type ToolResult = {
  /** Model-visible content; images are artifact references the adapter resolves. */
  content: (TextBlock | ImageBlock)[];
  isError?: boolean;
  diagnostics?: { severity: "info" | "warn" | "error"; message: string; code?: string }[];
  /** For the workbench; never shown to the model. */
  details?: JsonValue;
  control?: { loadTools?: string[]; terminateRun?: true };
};

export type ToolContext = {
  conversation: Id;
  toolCallId: string;
  /** The Pi tool task executing this call. */
  task: Id;
  signal: AbortSignal;
  progress(text: string): void;
  transact: Transact;
  read: StateReader;
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: ToolParameters;
  /** `safe`: may rerun after a crash. `unsafe`: never reruns; startup recovery reconciles it. */
  replay: "safe" | "unsafe";
  /** Offered only after `tool_search` loads its group. */
  deferred?: boolean;
  group?: string;
  callers?: ("model" | "tools")[];
  execute(args: JsonObject, context: ToolContext): Promise<ToolResult>;
};

export type InstructionSection = {
  key: string;
  /** Rendered per request preparation; the rendering is recorded (hash) as an `instruction-rendering` audit event. */
  render(context: { conversation: Id }): Promise<string | undefined>;
};

export type CompactionInput = {
  conversation: Id;
  reason: "threshold" | "overflow" | "manual";
  /** The active entries the summary replaces, and the first entry kept verbatim. */
  entries: TranscriptEntryView[];
  /** Pi's selected, context-edited model messages for those entries: what the summary must be faithful to. */
  messages: ModelMessage[];
  firstKept: Id;
  instructions?: string;
};

export type HookSpec = {
  /** Cheap early denial only; authority is enforced inside `execute()` by the authorized-tool wrapper. */
  beforeTool?(call: { name: string; args: JsonObject; conversation: Id; parentCallId?: string }): Promise<{ block?: string } | undefined>;
  onYield?(answer: { text: string; conversation: Id }): Promise<{ continue?: string } | undefined>;
  beforeCompact?(input: CompactionInput): Promise<{ summary: string } | { decline: true } | undefined>;
};

// ---------------------------------------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------------------------------------

export type AgentConfig = {
  model: ModelChoice;
  tools: string[];
  deferredTools: string[];
  /** Instruction section keys, in order. */
  sections: string[];
  role?: string;
};

export type TaskOutcome = { task: Id; status: "ok" | "failed" | "aborted"; result?: JsonValue; error?: string };

export type TaskShellResult<S, R> =
  | { next: S }
  | { wait: { tasks: Id[]; policy: "allSettled" | "failFast" }; next: S }
  | { done: R }
  | { failed: string };

/**
 * Operations bound to the current task invocation. Request ids derive from the task id and `key`, so a phase
 * rerun after a crash gets the same conversation or child task back instead of a second one.
 */
export type TaskShellContext = {
  task: Id;
  signal: AbortSignal;
  transact: Transact;
  read: StateReader;
  createConversation(key: string, agent: AgentConfig): Promise<Id>;
  submit(conversation: Id, input: InputSubmission): Promise<SubmissionReceipt>;
  deliver(conversation: Id, delivery: DataDelivery): Promise<DeliveryReceipt>;
  startTask(key: string, shell: string, input: JsonValue): Promise<Id>;
  abortTask(task: Id): Promise<void>;
  /** Waits until a conversation this task owns has no live work (Pi's invocation-bound handle). */
  waitIdle(conversation: Id): Promise<void>;
  outcomes(tasks: Id[]): Promise<TaskOutcome[]>;
};

/** A durable task as phases over a JSON checkpoint. Each phase reruns from its start after a crash. */
export type TaskShell<I extends JsonValue = JsonValue, S extends JsonObject = JsonObject, R extends JsonValue = JsonValue> = {
  name: string;
  version: number;
  initial(input: I): S;
  phase(state: S, context: TaskShellContext): Promise<TaskShellResult<S, R>>;
  /** Default: commit an aborted outcome. */
  onAbort?(state: S, context: TaskShellContext): Promise<{ done: R } | { failed: string } | { aborted: true }>;
};

// ---------------------------------------------------------------------------------------------------------
// Models and observation
// ---------------------------------------------------------------------------------------------------------

export interface ModelsPort {
  catalog(): Promise<ModelCatalogEntry[]>;
  startLogin(
    provider: string,
    method: "oauth" | "api-key" | "device",
    onChallenge: (challenge: LoginChallenge) => void,
  ): Promise<{ login: Id; done: Promise<LoginResult> }>;
  respond(response: LoginResponse): Promise<void>;
  /** Cancel only this pending flow; retain any credentials from an earlier sign-in. */
  cancelLogin(login: Id): Promise<void>;
  logout(provider: string): Promise<void>;
  /** One bounded completion outside any conversation. */
  complete(input: {
    model: ModelChoice;
    system: string;
    content: ContentBlock[];
    maxOutputTokens: number;
    signal?: AbortSignal;
  }): Promise<{ text: string; usage: { input: number; output: number } }>;
}

/** A watch starts with a snapshot, then deltas; slow consumers may receive a replacement snapshot. */
export interface Watch<F> extends AsyncIterable<F> {
  close(): void;
}

export type ConversationFrame =
  | {
      kind: "snapshot";
      entries: TranscriptEntryView[];
      state: SessionState;
      compacting: boolean;
      live?: { text: string; thinkingSummary?: string };
    }
  | { kind: "entry"; entry: TranscriptEntryView }
  | { kind: "partial"; text?: string; thinkingSummary?: string }
  | { kind: "tool"; phase: "start" | "update" | "end"; callId: string; name: string; summary?: string; isError?: boolean }
  | { kind: "state"; state: SessionState; compacting: boolean }
  /** A submission Pi could not place, or a task it orphaned or faulted, with the reason it gave. */
  | { kind: "problem"; subject: { submission: Id } | { task: Id }; reason: string }
  | { kind: "closed"; error?: string };

export type TaskFrame =
  | { kind: "snapshot"; tasks: TaskView[] }
  | { kind: "changed"; task: TaskView }
  | { kind: "closed"; error?: string };

// ---------------------------------------------------------------------------------------------------------
// The execution port
// ---------------------------------------------------------------------------------------------------------

export interface ExecutionPort {
  /** Opens storage and registers definitions without scheduling anything. */
  open(): Promise<void>;
  /** Enables scheduling; call only after startup recovery (actions, change-set journals) has run. */
  startScheduling(): Promise<void>;
  close(): Promise<void>;

  transact: Transact;
  read: StateReader;

  /** Idempotent by `requestId`: a repeat returns the same conversation. */
  createConversation(spec: { requestId: string; owner?: { task: Id }; agent: AgentConfig }): Promise<Id>;
  configure(conversation: Id, agent: Partial<AgentConfig>): Promise<void>;
  /** Admission receipt; placement is reported by `submission()` and the conversation watch. */
  submit(conversation: Id, input: InputSubmission): Promise<SubmissionReceipt>;
  submission(conversation: Id, submission: Id): Promise<SubmissionReceipt>;
  /** One passive entry with data blocks and the edits hiding their predecessors; never awaited inside a tool round. */
  deliver(conversation: Id, delivery: DataDelivery): Promise<DeliveryReceipt>;
  abort(conversation: Id): Promise<void>;
  waitIdle(conversation: Id): Promise<void>;
  contextAt(conversation: Id, at?: Cursor): Promise<{ messages: ModelMessage[] }>;
  /** Admits a compaction; its application is a separate event (`compaction-applied`). */
  compact(conversation: Id, options: { requestId: string; instructions?: string }): Promise<{ task: Id }>;

  registerTaskShell(shell: TaskShell): void;
  startTask(spec: TaskStart): Promise<Id>;
  abortTask(task: Id): Promise<void>;
  /** Pi cannot revive a terminal task: a retry is a new task with `retryOf`. */
  retryTask(task: Id, requestId: string): Promise<{ task: Id; retryOf: Id }>;
  taskView(task: Id): Promise<TaskView | undefined>;

  registerTool(tool: ToolSpec): void;
  registerInstructionSection(section: InstructionSection): void;
  registerHooks(hooks: HookSpec): void;
  models(): ModelsPort;

  watchConversation(conversation: Id): Promise<Watch<ConversationFrame>>;
  watchTasks(): Promise<Watch<TaskFrame>>;
  /** Native entries and audit entries in cursor order, up to an optional cutoff. */
  readLog(conversation: Id, options?: { from?: Cursor; cutoff?: Cursor }): AsyncIterable<LogRecord>;
}

// ---------------------------------------------------------------------------------------------------------
// Runtime services
// ---------------------------------------------------------------------------------------------------------

/** How the authorized-tool wrapper classifies a call (S4 implements the wrapper; each tool declares this). */
export type ActionPolicy = {
  /** The action kind, or null when this call needs no authority. */
  kind(args: JsonObject): ActionKind | null;
  /** Targets and their observation metadata; content-digest checks are disabled. */
  targets(args: JsonObject, context: ToolContext): Promise<FrozenRef[]>;
  /** Redacted arguments for display. */
  display?(args: JsonObject): JsonValue;
  limits?(args: JsonObject): Limits | undefined;
};

export interface ActionService {
  /** Wraps a tool so that authority is enforced inside `execute()` (04 §6). */
  wrap(tool: ToolSpec, policy: ActionPolicy): ToolSpec;
  decide(action: Id, decision: { decision: "approve" | "deny"; scope: GrantScope; limits?: Limits; requestId: string }): Promise<ActionRecord>;
  reconcile(action: Id, requestId: string): Promise<ActionRecord>;
  /** Moves records left in `reserved` or `executing` without a receipt to `interrupted`, then onward. */
  startupScan(): Promise<ActionRecord[]>;
  list(filter?: { state?: ActionRecord["state"]; session?: Id }): Promise<ActionRecord[]>;
  get(action: Id): Promise<ActionRecord | undefined>;
  grants: {
    list(): Promise<Grant[]>;
    create(request: GrantRequest, source: Grant["source"], requestId: string): Promise<Grant>;
    revoke(grant: Id, requestId: string): Promise<void>;
  };
  /** Scope flags in force for a location or thread, after researcher overrides. */
  effectiveFlags(target: { location: WorkspacePath; thread?: ThreadRef }): Promise<ScopeFlagName[]>;
  /** Build, test, run and document-build receipts, recorded with the action that produced them. */
  recordReceipt(receipt: Receipt): Promise<void>;
  receipts(filter?: { location?: WorkspacePath; checkout?: Id }): Promise<Receipt[]>;
}

export type SandboxRun = {
  interpreter: "bash" | "python";
  /** Sent on stdin. */
  script: string;
  cwd?: Address;
  /** Granted writable roots in addition to the per-task scratch. */
  outputRoots?: string[];
  /** Files under `/work/out` to export as an artifact before teardown. */
  declaredOutputs?: string[];
  limits: Limits;
  inputs: FrozenRef[];
};

export type SandboxResult = {
  exitStatus: number | null;
  stdoutTail: string;
  stderrTail: string;
  durationMs: number;
  artifact?: ArtifactRecord;
  contained: boolean;
};

export interface SandboxService {
  selfTest(): Promise<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[] }>;
  /** Waits for admission (one heavy command at a time); `onQueued` reports the queue position. */
  run(spec: SandboxRun, signal: AbortSignal, onQueued?: (position: number) => void): Promise<SandboxResult>;
}

export interface ArtifactStore {
  create(files: { name: string; bytes: Uint8Array; mime: string }[], provenance: Provenance): Promise<ArtifactRecord>;
  get(id: Id): Promise<ArtifactRecord | undefined>;
  read(id: Id, file: string): Promise<{ file: ArtifactFile; bytes: Uint8Array }>;
  pin(id: Id, by: string): Promise<void>;
  list(filter?: { session?: Id; location?: WorkspacePath }): Promise<ArtifactRecord[]>;
}

/** Typed outward operations, run outside the sandbox with their own checks; the operation id travels outward. */
export type EffectOperation =
  | { type: "cluster-query"; cluster: string; jobs?: string[] }
  | { type: "cluster-submit"; cluster: string; script: Address; args: string[] }
  | { type: "cluster-cancel"; cluster: string; job: string }
  | { type: "git-commit"; checkout: Address; message: string; paths: string[] }
  | { type: "git-push"; checkout: Address; remote: string; branch: string }
  | { type: "fetch"; url: string; destination: Address; expectedHash?: Hash };

export interface EffectService {
  invoke(operation: EffectOperation, action: ActionRecord, signal: AbortSignal): Promise<{ details: JsonValue; evidence: FrozenRef[] }>;
  /** Looks for the effect by its operation id; inconclusive evidence leaves the action uncertain. */
  reconcile(action: ActionRecord): Promise<{ conclusive: boolean; outcome?: "done" | "failed"; evidence: FrozenRef[]; note: string }>;
}

export interface CardService {
  post(card: Card): Promise<Card>;
  respond(card: Id, response: CardResponse, requestId: string): Promise<Card>;
  list(session: Id, options?: { open?: boolean }): Promise<Card[]>;
}

export interface ContextService {
  /**
   * Prepares and records the context an input needs (task-specific data inside the input, instructions in their
   * sections); submits nothing. The session submits the returned input once. A repeat of the same request id
   * reuses the persisted preparation instead of regenerating different data.
   */
  prepare(session: Id, input: InputSubmission): Promise<{ input: InputSubmission; manifest: ContextManifest }>;
  /** Supersedes excerpts of changed notes at the next eligible placement boundary. */
  refresh(session: Id, changed: WorkspacePath[]): Promise<ContextManifest>;
  /** Re-delivers the current versions of in-scope items after an applied compaction. */
  afterCompaction(session: Id, compaction: Id): Promise<ContextManifest>;
  manifest(session: Id): Promise<ContextManifest | undefined>;
}

export interface SessionService {
  create(input: {
    location: WorkspacePath;
    kind: SessionKind;
    mode: Mode;
    title?: string;
    edition?: Id;
    checkout?: Id;
    scope?: FrozenRef[];
    thread?: ThreadRef;
    requestId: string;
  }): Promise<SessionMeta>;
  list(filter?: { location?: WorkspacePath; kind?: SessionKind; archived?: boolean }): Promise<SessionMeta[]>;
  get(session: Id): Promise<{ session: SessionMeta; activeTask?: ActiveTask } | undefined>;
  update(session: Id, change: { title?: string; mode?: Mode; archived?: boolean; seen?: true; requestId: string }): Promise<SessionMeta>;
  submit(session: Id, input: InputSubmission): Promise<SubmissionReceipt>;
  continue(session: Id, delivery: InputSubmission["delivery"], requestId: string): Promise<SubmissionReceipt>;
  abort(session: Id): Promise<void>;
  compact(session: Id, options: { instructions?: string; requestId: string }): Promise<{ task: Id }>;
  export(session: Id): AsyncIterable<string>;
}

export interface ReviewService {
  request(signal: ReviewSignal, session: Id, options?: { compaction?: Id; changeSet?: { id: Id; digest?: Hash; baselines: FrozenRef[] } }): Promise<ReviewRequest>;
  list(session?: Id): Promise<{ requests: ReviewRequest[]; reports: ReviewReport[]; assessments: ReviewAssessment[] }>;
  assess(assessment: ReviewAssessment, requestId: string): Promise<ReviewAssessment>;
  /** Whether a restructuring change set may be applied now. */
  gate(changeSet: Id, digest?: Hash): Promise<{ open: boolean; assessment?: Id; reason?: string }>;
}

export interface WorkerService {
  start(plan: WorkerPlan, owner: { session: Id }, requestId: string): Promise<{ controller: Id; workers: WorkerRecord[] }>;
  status(controller: Id): Promise<WorkerRecord[]>;
  steer(worker: Id, text: string, requestId: string): Promise<void>;
  stop(worker: Id, requestId: string): Promise<void>;
  retry(worker: Id, requestId: string): Promise<WorkerRecord>;
  reassign(worker: Id, model: ModelChoice, requestId: string): Promise<WorkerRecord>;
}

export interface MethodUseService {
  find(input: { task: string; location?: WorkspacePath; limit?: number }): Promise<{ method: MethodRecord; reasons: string[]; warnings: string[] }[]>;
  record(use: MethodUse): Promise<void>;
  uses(skill: Address): Promise<MethodUse[]>;
  proposals(filter?: { status?: DistillationProposal["status"] }): Promise<DistillationProposal[]>;
  decide(proposal: Id, decision: "apply" | "decline", requestId: string): Promise<{ proposal: DistillationProposal; result?: ApplyResult }>;
}

export interface ManuscriptReviewService {
  threads(project: Id): Promise<ReviewThread[]>;
  create(project: Id, input: { anchor: { path: WorkspacePath; span: { startLine: number; endLine: number } }; text: string; author: ReviewThread["author"]; requestId: string }): Promise<ReviewThread>;
  update(project: Id, thread: Id, change: { status?: "open" | "addressed" | "resolved"; comment?: string; requestId: string }): Promise<ReviewThread>;
  build(project: Id, requestId: string): Promise<{ action: Id }>;
}

/** Literature and cluster operations behind the API (S5, `tools/research`). Effects go through actions. */
export interface ResearchService {
  search(input: { query: string; sources: ("arxiv" | "inspire" | "crossref" | "local")[] }): Promise<{ results: LiteratureResult[] }>;
  importPreview(edition: string): Promise<ImportPreview>;
  observeCluster(name: string, jobIds: string[] | undefined, requestId: string): Promise<ClusterObservation>;
}

export interface RuntimeServices {
  core: CoreServices;
  port: ExecutionPort;
  research: ResearchService;
  actions: ActionService;
  sandbox: SandboxService;
  artifacts: ArtifactStore;
  effects: EffectService;
  cards: CardService;
  context: ContextService;
  sessions: SessionService;
  reviews: ReviewService;
  workers: WorkerService;
  methodUse: MethodUseService;
  manuscriptReview: ManuscriptReviewService;
}

/** A tool and, when it can need authority, its policy; `registry.ts` wraps the latter with `actions.wrap`. */
export type ToolDefinition = { tool: ToolSpec; policy?: ActionPolicy };

export type RuntimeDeps = {
  core: CoreServices;
  port: ExecutionPort;
  dataDir: string;
  clock: { now(): Date };
  hasher: { sha256(data: string | Uint8Array): Hash };
};

/** Every service factory receives the shared dependencies and a late accessor for the other services. */
type Factory<T> = (deps: RuntimeDeps, services: () => RuntimeServices) => T;

export type CreateActionService = Factory<ActionService>; // S4: actions/index.ts `createActionService`
export type CreateSandboxService = Factory<SandboxService>; // S4: sandbox/index.ts `createSandboxService`
export type CreateArtifactStore = Factory<ArtifactStore>; // S4: artifacts/index.ts `createArtifactStore`
export type CreateEffectService = Factory<EffectService>; // S4: effects/index.ts `createEffectService`
export type CreateCardService = Factory<CardService>; // S3: cards/index.ts `createCardService`
export type CreateContextService = Factory<ContextService>; // S3: context/index.ts `createContextService`
export type CreateSessionService = Factory<SessionService>; // S3: sessions/index.ts `createSessionService`
export type CreateReviewService = Factory<ReviewService>; // S3: review/index.ts `createReviewService`
export type CreateWorkerService = Factory<WorkerService>; // S3: controllers/index.ts `createWorkerService`
export type CreateMethodUseService = Factory<MethodUseService>; // S5: methods/index.ts `createMethodUseService`
export type CreateManuscriptReviewService = Factory<ManuscriptReviewService>; // S5: manuscripts/index.ts
export type CreateResearchService = Factory<ResearchService>; // S5: tools/research/index.ts `createResearchService`
/** Instruction sections: S3 context/index.ts `createInstructionSections`. */
export type CreateInstructionSections = Factory<InstructionSection[]>;
/** Hooks: S3 compaction/index.ts `createHooks` (compaction summary, early denial, yield). */
export type CreateHooks = Factory<HookSpec>;
/** Task shells: S3 controllers/index.ts `createControllerTaskShells`, review/index.ts `createReviewTaskShells`. */
export type CreateTaskShells = Factory<TaskShell[]>;
/** Tool factories, exported by their owners: S3 `tools/interaction`, S4 `tools/workspace`, S5 `tools/research`. */
export type CreateTools = (services: RuntimeServices) => ToolDefinition[];

/** S3: pi-adapter `createPiExecutionPort`. Only pi-adapter imports Pi packages. */
export type CreatePiExecutionPort = (options: {
  dataDir: string;
  /** Model roles and provider settings; credentials live in `<dataDir>/credentials.json` (0600). */
  models: { main: ModelChoice; reviewer?: ModelChoice; workers?: Record<string, ModelChoice> };
  /** Deterministic faux provider for tests and the demo mode. */
  faux?: boolean;
  /** Resolves image blocks; a late callback to `ArtifactStore.read`, never called during construction. */
  readArtifact(artifact: Id, file: string): Promise<{ bytes: Uint8Array; mime: string }>;
}) => ExecutionPort;
