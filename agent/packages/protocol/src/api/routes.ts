// The route table: every HTTP route of 07 with its schemas and the stream implementing its service.
// The server (S4) validates every request and response against it; the workbench (S6) calls through it.
import { z } from "zod";
import { ActionKind, ActionRecord, ActionState, Grant, GrantRequest, GrantScope, Limits } from "../actions.ts";
import { ArtifactRecord } from "../artifacts.ts";
import { Card, CardResponse } from "../cards.ts";
import { CheckoutRecord, FileVersion, Receipt, SymbolRecord } from "../code.ts";
import { Config } from "../config.ts";
import { ModelMessage } from "../content.ts";
import { ContextManifest } from "../context.ts";
import { ApplyResult, ChangeSet, DocumentOp, RecoverySummary, SnapshotRecord, Writer } from "../documents.ts";
import { Edition, KnowledgeArea, KnowledgeEntry, LocatorCandidate, Work } from "../knowledge.ts";
import { ManuscriptProject, ReviewThread } from "../manuscripts.ts";
import { DistillationProposal, Episode, MethodRecord, MethodUse } from "../methods.ts";
import { LoginResponse, ModelCatalogEntry, ModelChoice } from "../models.ts";
import { Hash, Id, IsoTime, RequestId, Span, StreamId, Version } from "../primitives.ts";
import { FrozenRef, ResourceRef, ThreadRef, WorkspacePath } from "../refs.ts";
import {
  Graph,
  Grouping,
  InboxItem,
  InstructionSource,
  Outline,
  ResearchLocation,
  SearchHit,
  ThreadRow,
  ThreadState,
  Use,
} from "../research.ts";
import { ReviewAssessment, ReviewReport, ReviewRequest } from "../reviews.ts";
import { CampaignCoverage, ClusterObservation, RunRecord } from "../runs.ts";
import { ActiveTask, Delivery, InputSubmission, Mode, SessionKind, SessionMeta, SubmissionReceipt } from "../sessions.ts";
import { TaskView } from "../workers.ts";
import { ErrorCode } from "./errors.ts";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** `binary`: raw bytes with their content type. `jsonl`: one `ExportLine` per line. */
export type ResponseSpec = z.ZodType | "binary" | "jsonl";

export type RouteSpec = {
  method: Method;
  path: string;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType | "multipart";
  response: ResponseSpec;
  errors: readonly ErrorCode[];
  /** Who implements the service behind the route; S4 implements every handler. */
  service: StreamId;
  /** Mutating routes carry a `requestId` (body, or query for DELETE); repeats return the original result. */
  mutating: boolean;
  auth: boolean;
};

const COMMON: readonly ErrorCode[] = ["unauthorized", "invalid", "internal"];

function route<const S extends Omit<RouteSpec, "errors" | "mutating" | "auth"> & Partial<RouteSpec>>(spec: S) {
  return {
    ...spec,
    errors: [...COMMON, ...(spec.errors ?? [])],
    mutating: spec.mutating ?? spec.method !== "GET",
    auth: spec.auth ?? true,
  } as const;
}

const pathQuery = z.object({ path: z.string().min(1) });
const idParam = z.object({ id: Id });
const withRequest = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, requestId: RequestId });
const Ok = z.object({ ok: z.literal(true) });
const csv = z.string().optional();

export const Health = z.object({ ok: z.boolean(), version: z.string(), faux: z.boolean(), uptimeSec: z.number() });
export type Health = z.infer<typeof Health>;
export const DoctorReport = z.object({
  checks: z.array(z.object({ name: z.string(), ok: z.boolean(), detail: z.string() })),
  at: IsoTime,
});
export type DoctorReport = z.infer<typeof DoctorReport>;
export const FileListing = z.object({
  entries: z.array(z.object({ name: z.string(), kind: z.enum(["file", "directory", "link"]), bytes: z.number().optional() })),
  truncated: z.boolean(),
});
export type FileListing = z.infer<typeof FileListing>;
export const NoteText = z.object({ text: z.string(), version: Version, format: z.enum(["markdown", "tex", "text"]) });
export type NoteText = z.infer<typeof NoteText>;
export const GitCommit = z.object({ commit: z.string(), at: IsoTime, subject: z.string(), author: z.string().optional() });
export type GitCommit = z.infer<typeof GitCommit>;
export const ContextView = z.object({ messages: z.array(ModelMessage), manifest: ContextManifest.optional() });
export type ContextView = z.infer<typeof ContextView>;
export const SessionDetail = z.object({
  session: SessionMeta,
  activeTask: ActiveTask.optional(),
  manifest: ContextManifest.optional(),
  changedSinceSeen: z.array(z.object({ ref: ResourceRef, before: Hash.optional(), after: Hash })),
});
export type SessionDetail = z.infer<typeof SessionDetail>;
export const LiteratureResult = z.object({
  work: Work,
  editions: z.array(Edition),
  duplicates: z.array(z.string()),
  local: z.boolean(),
  source: z.enum(["arxiv", "inspire", "crossref", "local"]),
});
export type LiteratureResult = z.infer<typeof LiteratureResult>;
export const ImportPreview = z.object({
  edition: Id,
  files: z.array(z.object({ url: z.url(), destination: WorkspacePath })),
  mapStub: z.object({ path: WorkspacePath, text: z.string() }),
  action: ActionKind,
});
export type ImportPreview = z.infer<typeof ImportPreview>;
export const CodeFile = z.object({ file: FileVersion, text: z.string(), startLine: z.number().int().positive() });
export type CodeFile = z.infer<typeof CodeFile>;

export const ROUTES = {
  // Authentication, health, configuration
  authExchange: route({
    method: "POST", path: "/api/auth/exchange", body: z.object({ token: z.string().min(32) }), response: Ok,
    service: "S4", auth: false, mutating: false,
  }),
  health: route({ method: "GET", path: "/api/health", response: Health, service: "S4", auth: false }),
  getConfig: route({ method: "GET", path: "/api/config", response: Config, service: "S4" }),
  putConfig: route({
    method: "PUT", path: "/api/config", body: withRequest({ config: Config }), response: Config, service: "S4",
  }),
  doctor: route({ method: "GET", path: "/api/doctor", response: DoctorReport, service: "S4" }),

  // Research model
  locations: route({ method: "GET", path: "/api/locations", response: z.array(ResearchLocation), service: "S2" }),
  graph: route({ method: "GET", path: "/api/graph", response: Graph, service: "S2" }),
  groupings: route({ method: "GET", path: "/api/groupings", response: z.array(Grouping), service: "S2" }),
  outline: route({
    method: "GET", path: "/api/locations/outline", query: pathQuery, response: Outline, service: "S2",
    errors: ["not_found", "forbidden_path"],
  }),
  instructions: route({
    method: "GET", path: "/api/instructions", query: z.object({ path: z.string(), checkout: z.string().optional() }),
    response: z.array(InstructionSource), service: "S2",
  }),
  board: route({
    method: "GET", path: "/api/board",
    query: z.object({ state: ThreadState.optional(), grouping: z.string().optional(), owner: z.string().optional() }),
    response: z.array(ThreadRow), service: "S2",
  }),
  inbox: route({ method: "GET", path: "/api/inbox", response: z.array(InboxItem), service: "S4" }),
  search: route({
    method: "GET", path: "/api/search",
    query: z.object({ q: z.string().min(1), scope: z.enum(["notes", "knowledge", "all"]).optional(), limit: z.coerce.number().int().positive().max(200).optional() }),
    response: z.array(SearchHit), service: "S2",
  }),
  whereUsed: route({
    method: "GET", path: "/api/where-used", query: z.object({ path: z.string(), anchor: z.string().optional() }),
    response: z.object({ uses: z.array(Use) }), service: "S2",
  }),
  fileRaw: route({
    method: "GET", path: "/api/files/raw", query: pathQuery, response: "binary", service: "S4",
    errors: ["not_found", "forbidden_path"],
  }),
  fileList: route({
    method: "GET", path: "/api/files/list", query: z.object({ path: z.string(), force: z.enum(["0", "1"]).optional() }),
    response: FileListing, service: "S4", errors: ["not_found", "forbidden_path"],
  }),
  note: route({
    method: "GET", path: "/api/notes", query: pathQuery, response: NoteText, service: "S2",
    errors: ["not_found", "forbidden_path"],
  }),
  noteHistory: route({
    method: "GET", path: "/api/notes/history", query: pathQuery,
    response: z.object({ snapshots: z.array(SnapshotRecord), git: z.array(GitCommit) }), service: "S2",
  }),
  snapshot: route({
    method: "GET", path: "/api/snapshots/:hash", params: z.object({ hash: Hash }),
    response: z.object({ record: SnapshotRecord, text: z.string() }), service: "S2", errors: ["not_found"],
  }),

  // Change sets
  previewChanges: route({
    method: "POST", path: "/api/changes/preview",
    body: withRequest({ ops: z.array(DocumentOp).min(1), reason: z.string(), writer: Writer, restructure: z.boolean().optional() }),
    response: ChangeSet, service: "S2", errors: ["forbidden_path", "conflict", "ambiguous_anchor", "denied"],
  }),
  applyChanges: route({
    method: "POST", path: "/api/changes/:id/apply", params: idParam, body: withRequest({}), response: ApplyResult,
    service: "S2", errors: ["not_found", "stale_version", "review_required", "denied", "request_reused"],
  }),
  changeSet: route({
    method: "GET", path: "/api/changes/:id", params: idParam,
    response: z.object({ changeSet: ChangeSet, recovery: RecoverySummary.optional() }), service: "S2", errors: ["not_found"],
  }),

  // Knowledge, works and literature
  knowledgeAreas: route({ method: "GET", path: "/api/knowledge/areas", response: z.array(KnowledgeArea), service: "S5" }),
  knowledgeEntries: route({
    method: "GET", path: "/api/knowledge/entries",
    query: z.object({ area: csv, kind: csv, support: csv, review: csv, readingDepth: csv }),
    response: z.array(KnowledgeEntry), service: "S5",
  }),
  knowledgeEntry: route({
    method: "GET", path: "/api/knowledge/entry", query: pathQuery, response: KnowledgeEntry, service: "S5",
    errors: ["not_found"],
  }),
  work: route({ method: "GET", path: "/api/works/:key", params: z.object({ key: Id }), response: Work, service: "S5", errors: ["not_found"] }),
  edition: route({ method: "GET", path: "/api/editions/:id", params: idParam, response: Edition, service: "S5", errors: ["not_found"] }),
  resolveLocator: route({
    method: "GET", path: "/api/locators/resolve", query: z.object({ edition: Id, locator: z.string().min(1) }),
    response: z.array(LocatorCandidate), service: "S5",
  }),
  literatureSearch: route({
    method: "POST", path: "/api/literature/search", mutating: false,
    body: z.object({ query: z.string().min(1), sources: z.array(z.enum(["arxiv", "inspire", "crossref", "local"])).min(1) }),
    response: z.object({ results: z.array(LiteratureResult) }), service: "S5", errors: ["unavailable"],
  }),
  importPreview: route({
    method: "POST", path: "/api/literature/import-preview", mutating: false,
    body: z.object({ edition: z.string().min(1) }), response: ImportPreview, service: "S5", errors: ["unavailable"],
  }),

  // Methods and distillation
  methods: route({ method: "GET", path: "/api/methods", response: z.array(MethodRecord), service: "S5" }),
  methodDetail: route({
    method: "GET", path: "/api/methods/detail", query: pathQuery,
    response: z.object({ record: MethodRecord, uses: z.array(MethodUse), proposals: z.array(DistillationProposal) }),
    service: "S5", errors: ["not_found"],
  }),
  proposals: route({ method: "GET", path: "/api/proposals", response: z.array(DistillationProposal), service: "S5" }),

  // Code, runs, campaigns, artifacts, episodes
  checkouts: route({
    method: "GET", path: "/api/checkouts", query: z.object({ location: z.string().optional() }),
    response: z.array(CheckoutRecord), service: "S5",
  }),
  checkoutState: route({ method: "GET", path: "/api/checkouts/state", query: pathQuery, response: CheckoutRecord, service: "S5" }),
  codeTree: route({
    method: "GET", path: "/api/code/tree", query: z.object({ checkout: Id, path: z.string().optional() }),
    response: FileListing, service: "S5",
  }),
  codeFile: route({
    method: "GET", path: "/api/code/file",
    query: z.object({ checkout: Id, path: z.string(), from: z.coerce.number().int().positive().optional(), to: z.coerce.number().int().positive().optional() }),
    response: CodeFile, service: "S5", errors: ["not_found", "forbidden_path"],
  }),
  codeSearch: route({
    method: "GET", path: "/api/code/search", query: z.object({ checkout: Id, q: z.string().min(1) }),
    response: z.array(SearchHit), service: "S5",
  }),
  codeLog: route({
    method: "GET", path: "/api/code/log", query: z.object({ checkout: Id, path: z.string().optional(), limit: z.coerce.number().int().positive().max(500).optional() }),
    response: z.array(GitCommit), service: "S5",
  }),
  codeDiff: route({
    method: "GET", path: "/api/code/diff", query: z.object({ checkout: Id, path: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
    response: z.object({ diff: z.string() }), service: "S5",
  }),
  codeSymbols: route({
    method: "GET", path: "/api/code/symbols", query: z.object({ checkout: Id, path: z.string().optional(), q: z.string().optional() }),
    response: z.array(SymbolRecord), service: "S5",
  }),
  receipts: route({
    method: "GET", path: "/api/receipts", query: z.object({ location: z.string().optional(), checkout: Id.optional() }),
    response: z.array(Receipt), service: "S4",
  }),
  runs: route({ method: "GET", path: "/api/runs", query: z.object({ location: z.string().optional() }), response: z.array(RunRecord), service: "S5" }),
  runDetail: route({ method: "GET", path: "/api/runs/detail", query: pathQuery, response: RunRecord, service: "S5", errors: ["not_found"] }),
  campaigns: route({
    method: "GET", path: "/api/campaigns", query: z.object({ location: z.string().optional() }),
    response: z.array(CampaignCoverage), service: "S5",
  }),
  campaignDetail: route({ method: "GET", path: "/api/campaigns/detail", query: pathQuery, response: CampaignCoverage, service: "S5", errors: ["not_found"] }),
  observeCluster: route({
    method: "POST", path: "/api/clusters/:name/observe", params: z.object({ name: z.string().min(1) }),
    body: withRequest({ jobIds: z.array(z.string()).optional() }), response: ClusterObservation, service: "S5",
    errors: ["denied", "unavailable", "request_reused"],
  }),
  artifacts: route({
    method: "GET", path: "/api/artifacts", query: z.object({ session: Id.optional(), location: z.string().optional() }),
    response: z.array(ArtifactRecord), service: "S4",
  }),
  artifact: route({ method: "GET", path: "/api/artifacts/:id", params: idParam, response: ArtifactRecord, service: "S4", errors: ["not_found"] }),
  artifactFile: route({
    method: "GET", path: "/api/artifacts/:id/file", params: idParam, query: z.object({ name: z.string().min(1) }),
    response: "binary", service: "S4", errors: ["not_found"],
  }),
  episodes: route({
    method: "GET", path: "/api/episodes", query: z.object({ location: z.string().optional(), q: z.string().optional() }),
    response: z.array(Episode), service: "S5",
  }),

  // Manuscripts
  manuscripts: route({ method: "GET", path: "/api/manuscripts", response: z.array(ManuscriptProject), service: "S5" }),
  manuscript: route({ method: "GET", path: "/api/manuscripts/:id", params: idParam, response: ManuscriptProject, service: "S5", errors: ["not_found"] }),
  manuscriptThreads: route({
    method: "GET", path: "/api/manuscripts/:id/threads", params: idParam, response: z.array(ReviewThread), service: "S5",
  }),
  createManuscriptThread: route({
    method: "POST", path: "/api/manuscripts/:id/threads", params: idParam,
    body: withRequest({ anchor: z.object({ path: WorkspacePath, span: Span }), text: z.string().min(1), author: z.enum(["researcher", "agent", "external"]) }),
    response: ReviewThread, service: "S5", errors: ["stale_version", "request_reused"],
  }),
  updateManuscriptThread: route({
    method: "PATCH", path: "/api/manuscripts/:id/threads/:thread", params: z.object({ id: Id, thread: Id }),
    body: withRequest({ status: z.enum(["open", "addressed", "resolved"]).optional(), comment: z.string().optional() }),
    response: ReviewThread, service: "S5", errors: ["not_found", "request_reused"],
  }),
  buildManuscript: route({
    method: "POST", path: "/api/manuscripts/:id/build", params: idParam, body: withRequest({}),
    response: z.object({ action: Id }), service: "S5", errors: ["denied", "busy", "request_reused"],
  }),

  // Sessions and tasks
  sessions: route({
    method: "GET", path: "/api/sessions",
    query: z.object({ location: z.string().optional(), kind: SessionKind.optional(), archived: z.enum(["0", "1"]).optional() }),
    response: z.array(SessionMeta), service: "S3",
  }),
  createSession: route({
    method: "POST", path: "/api/sessions",
    body: withRequest({
      location: WorkspacePath, kind: SessionKind, mode: Mode, title: z.string().optional(), edition: Id.optional(),
      checkout: Id.optional(), scope: z.array(FrozenRef).optional(), thread: ThreadRef.optional(),
    }),
    response: SessionMeta, service: "S3", errors: ["not_found", "request_reused"],
  }),
  session: route({ method: "GET", path: "/api/sessions/:id", params: idParam, response: SessionDetail, service: "S3", errors: ["not_found"] }),
  updateSession: route({
    method: "PATCH", path: "/api/sessions/:id", params: idParam,
    body: withRequest({ title: z.string().optional(), mode: Mode.optional(), archived: z.boolean().optional(), seen: z.literal(true).optional() }),
    response: SessionMeta, service: "S3", errors: ["not_found", "request_reused"],
  }),
  submit: route({
    method: "POST", path: "/api/sessions/:id/messages", params: idParam, body: InputSubmission,
    response: SubmissionReceipt, service: "S3", errors: ["not_found", "busy", "stale_version", "request_reused"],
  }),
  continueTask: route({
    method: "POST", path: "/api/sessions/:id/continue", params: idParam, body: withRequest({ delivery: Delivery }),
    response: SubmissionReceipt, service: "S3", errors: ["not_found", "busy", "request_reused"],
  }),
  abortSession: route({
    method: "POST", path: "/api/sessions/:id/abort", params: idParam, body: withRequest({}), response: Ok, service: "S3",
  }),
  contextAt: route({
    method: "GET", path: "/api/sessions/:id/context", params: idParam, query: z.object({ at: z.string().optional() }),
    response: ContextView, service: "S3", errors: ["not_found"],
  }),
  compact: route({
    method: "POST", path: "/api/sessions/:id/compact", params: idParam,
    body: withRequest({ instructions: z.string().optional() }), response: z.object({ task: Id }), service: "S3",
  }),
  exportLog: route({ method: "GET", path: "/api/sessions/:id/export", params: idParam, response: "jsonl", service: "S3" }),
  respondToCard: route({
    method: "POST", path: "/api/sessions/:id/cards/:card/respond", params: z.object({ id: Id, card: Id }),
    body: withRequest({ response: CardResponse }), response: z.object({ card: Card }), service: "S3",
    errors: ["not_found", "stale_version", "request_reused"],
  }),
  attach: route({
    method: "POST", path: "/api/attachments", body: "multipart",
    response: z.object({ attachment: Id, artifact: Id }), service: "S4",
  }),
  tasks: route({ method: "GET", path: "/api/tasks", response: z.array(TaskView), service: "S3" }),
  steerTask: route({
    method: "POST", path: "/api/tasks/:id/steer", params: idParam, body: withRequest({ text: z.string().min(1) }),
    response: Ok, service: "S3", errors: ["not_found", "busy"],
  }),
  stopTask: route({ method: "POST", path: "/api/tasks/:id/stop", params: idParam, body: withRequest({}), response: Ok, service: "S3" }),
  retryTask: route({
    method: "POST", path: "/api/tasks/:id/retry", params: idParam, body: withRequest({}),
    response: z.object({ task: Id, retryOf: Id }), service: "S3", errors: ["not_found", "uncertain_effect"],
  }),

  // Actions, grants, reviews
  actions: route({
    method: "GET", path: "/api/actions", query: z.object({ state: ActionState.optional(), session: Id.optional() }),
    response: z.array(ActionRecord), service: "S4",
  }),
  action: route({ method: "GET", path: "/api/actions/:id", params: idParam, response: ActionRecord, service: "S4", errors: ["not_found"] }),
  decideAction: route({
    method: "POST", path: "/api/actions/:id/decide", params: idParam,
    body: withRequest({ decision: z.enum(["approve", "deny"]), scope: GrantScope, limits: Limits.optional() }),
    response: ActionRecord, service: "S4", errors: ["not_found", "stale_version", "request_reused"],
  }),
  reconcileAction: route({
    method: "POST", path: "/api/actions/:id/reconcile", params: idParam, body: withRequest({}),
    response: ActionRecord, service: "S4", errors: ["not_found", "unavailable"],
  }),
  grants: route({ method: "GET", path: "/api/grants", response: z.array(Grant), service: "S4" }),
  createGrant: route({
    method: "POST", path: "/api/grants", body: withRequest({ grant: GrantRequest }), response: Grant, service: "S4",
    errors: ["request_reused"],
  }),
  revokeGrant: route({
    method: "DELETE", path: "/api/grants/:id", params: idParam, query: z.object({ requestId: RequestId }),
    response: Ok, service: "S4", errors: ["not_found"],
  }),
  reviews: route({
    method: "GET", path: "/api/reviews", query: z.object({ session: Id.optional() }),
    response: z.object({
      requests: z.array(ReviewRequest),
      reports: z.array(ReviewReport),
      assessments: z.array(ReviewAssessment),
    }),
    service: "S3",
  }),

  // Models and sign-in
  models: route({
    method: "GET", path: "/api/models",
    response: z.object({
      catalog: z.array(ModelCatalogEntry),
      roles: z.object({ main: ModelChoice, reviewer: ModelChoice.optional(), workers: z.record(z.string(), ModelChoice).optional() }),
    }),
    service: "S3",
  }),
  login: route({
    method: "POST", path: "/api/auth/login",
    body: withRequest({ provider: z.string().min(1), method: z.enum(["oauth", "api-key", "device"]) }),
    response: z.object({ login: Id }), service: "S3", errors: ["unavailable", "request_reused"],
  }),
  loginRespond: route({
    method: "POST", path: "/api/auth/login/:id/respond", params: idParam,
    body: LoginResponse.extend({ requestId: RequestId }), response: Ok, service: "S3", errors: ["not_found"],
  }),
  loginCancel: route({
    method: "POST", path: "/api/auth/login/:id/cancel", params: idParam,
    body: withRequest({}), response: Ok, service: "S3",
  }),
  logout: route({
    method: "POST", path: "/api/auth/logout", body: withRequest({ provider: z.string().min(1) }), response: Ok, service: "S3",
  }),
} as const satisfies Record<string, RouteSpec>;

export type RouteName = keyof typeof ROUTES;
