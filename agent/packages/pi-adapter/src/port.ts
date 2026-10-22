import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, requestBody, sameRequestBody, AuditEvent, JsonObject as JsonObjectSchema } from "@aitp/protocol";
import type { ContentBlock, Cursor, DataDelivery, DeliveryReceipt, InputSubmission, JsonObject, JsonValue, LogRecord, ModelMessage, SubmissionReceipt, TaskView, TranscriptEntryView } from "@aitp/protocol";
import type { AgentConfig, ConversationFrame, CreatePiExecutionPort, ExecutionPort, HookSpec, StateAddress, StateReader, StateTransaction, TaskFrame, TaskShell, TaskShellContext, TaskStart, Transact, Watch } from "@aitp/runtime/contracts";
import { BACKGROUND_CONTEXT as ctx } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import type { FauxProviderHandle } from "@earendil-works/pi-ai/providers/faux";
import type { ImageContent, TextContent, TSchema } from "@earendil-works/pi-ai";
import { AgentDoc, CompactionTask, createRegistry, defineDoc, defineExtension, defineTask, defineTool, GenerationTask, Harness, hook, InboxDoc, LiveDoc, section, ToolTask } from "@earendil-works/pi-durable";
import type { Conversation, ConversationId, ContextEdit, EntryId, EntryRecord, HarnessSettings, Storage, SubmissionId, SubmissionRecord, Task, TaskId, TaskRecord, Tx, Cursor as NativeCursor } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { hash, modelMessages, publicContent, toContent } from "./content.ts";
import { executionRegistry } from "./generation.ts";
import { safeModels, secretRedactor } from "./secrets.ts";
import { lockStorage } from "./lock.ts";
import { deviceId, fileCredentialStore, modelsPort } from "./models.ts";

const State = defineDoc<{ records: Record<string, JsonObject> }>({ kind: "aitp.state", version: 1, scope: "session", initial: () => ({ records: {} }) });
const Bindings = defineDoc<{ values: Record<string, JsonObject> }>({ kind: "aitp.bindings", version: 1, scope: "session", initial: () => ({ values: {} }) });
const keyOf = (a: StateAddress) => JSON.stringify([a.family, a.key]);
const json = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const stateObject = (value: JsonObject): JsonObject => JsonObjectSchema.parse(JSON.parse(JSON.stringify(value, (_key, field: unknown) => {
  if (typeof field === "number" && !Number.isFinite(field)) throw new Error("State values require finite JSON numbers");
  if (["bigint", "symbol", "function"].includes(typeof field)) throw new Error("State values must be JSON");
  return field;
})));
const now = () => new Date().toISOString();
const taskRequest = (task: TaskId, kind: string, key: string) => `${task}:${kind}:${hash(key).slice(7)}`;
const id = <T extends number>(value: string): T => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid native id");
  return Number(value) as T;
};
const itemIdentity = (b: ContentBlock) => b.type === "data" ? canonicalJson({ address: b.ref.address, locator: b.ref.locator ?? null, role: b.role }) : undefined;
type NativeTask = Task<JsonValue, { phase: "run"; state: JsonObject }, JsonValue, object>;
type Invocation = { active: boolean; signal: AbortSignal; commit<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };

export const createPiExecutionPort: CreatePiExecutionPort = options => createAdapter(options);

/** Internal construction seam for scripted faux conformance tests. No provider object crosses ExecutionPort. */
export function createAdapter(options: Parameters<CreatePiExecutionPort>[0], testing?: { faux?: FauxProviderHandle; settings?: HarnessSettings }): ExecutionPort {
  const registry = createRegistry();
  const secrets = secretRedactor();
  for (const [name, value] of Object.entries(process.env)) if (value && /(?:API_KEY|TOKEN|SECRET|PASSWORD)/i.test(name)) secrets.remember({ type: "api_key", key: value });
  const definitions = new Map<string, NativeTask>();
  const invocation = new AsyncLocalStorage<Invocation>();
  let harness: Harness | undefined;
  let storage: Storage | undefined;
  let scheduling = false;
  let unlock: (() => Promise<void>) | undefined;
  let modelService: ReturnType<typeof modelsPort> | undefined;
  let effects: Promise<void> = Promise.resolve();
  const watchers = new Set<{ close(): void }>();
  const hooks: HookSpec[] = [];
  const images = new Map<string, ContentBlock>();
  const toolImages = new Map<string, ContentBlock[]>();
  const sectionNames = new Map<string, string>();
  const taskObservedAt = new Map<string, string>();
  const h = () => { if (!harness) throw new Error("Execution port is not open"); return harness; };
  const progressAllowed = () => { h(); if (!scheduling) throw new Error("Call startScheduling before requesting execution progress"); };
  const alive = () => { const scope = invocation.getStore(); if (scope && (!scope.active || scope.signal.aborted)) throw new Error("Invocation ended"); return scope; };
  const nativeCommit = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
    const scope = alive(); return scope ? scope.commit(fn) : h().commit(fn, ctx);
  };
  const conversation = async (value: string): Promise<Conversation> => {
    alive(); const c = await h().conversation(id<ConversationId>(value), ctx);
    if (!c) throw new Error("Unknown conversation"); return c;
  };
  const encode = async (blocks: ContentBlock[]) => {
    const content = await toContent(blocks, options.readArtifact);
    content.forEach((b, i) => { if (b.type === "image") images.set(b.data, blocks[i]!); });
    return content;
  };
  const readState = (tx: Tx, check: () => void): StateReader => ({
    async get<T extends JsonObject>(address: StateAddress) { check(); const state = await tx.doc(State); check(); return json(state.records[keyOf(address)]) as T | undefined; },
    async list<T extends JsonObject>(family: StateAddress["family"], opts?: { prefix?: string; after?: string; limit?: number }) {
      check(); const state = await tx.doc(State); check();
      const items = Object.entries(state.records).flatMap(([key, value]) => {
        const [f, k] = JSON.parse(key) as [string, string];
        return f === family && (!opts?.prefix || k.startsWith(opts.prefix)) && (!opts?.after || k > opts.after) ? [{ key: k, value: json(value) as T }] : [];
      }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      const limit = opts?.limit ?? 1000; if (limit < 1) throw new Error("Invalid page limit");
      return { items: items.slice(0, limit), ...(items.length > limit ? { next: items[limit - 1]!.key } : {}) };
    },
  });
  const createTask = async (tx: Tx, spec: TaskStart): Promise<string> => {
    const bindings = await tx.doc(Bindings); const binding = `task:${spec.requestId}`;
    const body = requestBody(json(spec));
    const found = bindings.values[binding];
    if (found) { if (!sameRequestBody(found.body, body)) throw new Error("request_reused"); return String(found.id); }
    const definition = definitions.get(spec.shell); if (!definition) throw new Error("Unknown task shell");
    const owner = "task" in spec.owner ? { kind: "task" as const, taskId: id<TaskId>(spec.owner.task) } : { kind: "conversation" as const };
    const task = await tx.createTask(definition, spec.input, { ownership: owner,
      ...("conversation" in spec.owner ? { conversationId: id<ConversationId>(spec.owner.conversation) } : {}) });
    bindings.values[binding] = { id: String(task), body, spec: json(spec) };
    return String(task);
  };
  const transact: Transact = async callback => nativeCommit(async tx => {
    let active = true;
    const check = () => { alive(); if (!active) throw new Error("Transaction ended"); };
    const stateTx: StateTransaction = {
      ...readState(tx, check),
      async put(address, value) { check(); const parsed = stateObject(value); const state = await tx.doc(State); check(); state.records[keyOf(address)] = parsed; },
      async delete(address) { check(); const state = await tx.doc(State); check(); delete state.records[keyOf(address)]; },
      async appendAudit(conversation, event) { check(); const parsed = AuditEvent.parse(event); await tx.appendEntry(id<ConversationId>(conversation), { kind: "aitp.audit", data: parsed }); check(); },
      async startTask(spec) { check(); const task = await createTask(tx, spec); check(); return task; },
    };
    try { return await callback(stateTx); } finally { active = false; }
  });
  const read: StateReader = {
    get: address => transact(tx => tx.get(address)),
    list: (family, opts) => transact(tx => tx.list(family, opts)),
  };
  const entries = async (c: Conversation, bounds?: { minEntryId?: EntryId; maxEntryId?: EntryId }): Promise<EntryRecord[]> => {
    const all: EntryRecord[] = []; let cursor: NativeCursor | undefined;
    do { const page = await c.entries({ ...bounds, order: "ascending" }, 200, cursor, ctx); all.push(...page.items); cursor = page.next; } while (cursor);
    for (const entry of all) rememberImages(entry);
    return all;
  };
  const rememberImages = (entry: EntryRecord) => {
    if (entry.kind === "aitp.tool-output") toolImages.set(String((entry.data as JsonObject).callId), originalBlocks(entry).filter(b => b.type === "image"));
    for (const message of entry.model ?? []) {
      if (message.role === "user" && Array.isArray(message.content)) {
        const blocks = originalBlocks(entry);
        message.content.forEach((part, index) => { if (part.type === "image" && blocks[index]?.type === "image") images.set(part.data, blocks[index]!); });
      } else if (message.role === "toolResult") {
        const refs = toolImages.get(message.toolCallId) ?? []; let index = 0;
        for (const block of message.content) if (block.type === "image") { const ref = refs[index++]; if (ref) images.set(block.data, ref); }
      }
    }
  };
  const transactionEntries = async (tx: Tx, conversationId: ConversationId): Promise<EntryRecord[]> => {
    const all: EntryRecord[] = []; let cursor: NativeCursor | undefined;
    do { const page = await tx.scanEntries({ conversationId, order: "ascending" }, 200, cursor); all.push(...page.items); cursor = page.next; } while (cursor);
    return all;
  };
  const originalBlocks = (e: EntryRecord): ContentBlock[] => {
    const data = e.data as JsonObject | undefined;
    return (data?.content ?? data?.blocks ?? []) as ContentBlock[];
  };
  const buildEdits = async (all: EntryRecord[], edits: DataDelivery["edits"], pending: DataDelivery["edits"] = []): Promise<ContextEdit[]> => {
    const applied = new Map<string, DataDelivery["edits"][number]>();
    for (const e of all) {
      const prior = (e.data as JsonObject | undefined)?.itemEdits;
      if (Array.isArray(prior)) for (const edit of prior as DataDelivery["edits"]) applied.set(edit.item, edit);
    }
    for (const edit of [...pending, ...edits]) applied.set(edit.item, edit);
    const touched = new Set(edits.map(e => e.item));
    const result: ContextEdit[] = [];
    for (const e of all) {
      const blocks = originalBlocks(e);
      if (!blocks.some(b => b.type === "data" && touched.has(b.item))) continue;
      const message = e.model?.find(m => m.role === "user");
      const original = message?.role === "user" ? typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content : [];
      const kept = blocks.flatMap((b, index): (TextContent | ImageContent)[] => {
        const edit = b.type === "data" ? applied.get(b.item) : undefined;
        if (edit) return edit.action === "replace" ? [{ type: "text", text: edit.pointer! }] : [];
        const native = original[index];
        if (!native) throw new Error("Context item has no recorded model contribution");
        return [native];
      });
      result.push(kept.length ? { target: e.id, action: "replace", messages: [{ role: "user", content: kept, timestamp: message?.timestamp ?? 0 }] } : { target: e.id, action: "omit" });
    }
    return result;
  };
  // This commit is queued synchronously from the placement publication, before a generation can read context.
  // Pi's InputEntry has no edits field; edits must be a second immutable entry after placement.
  const reconcilePlaced = async (entry: EntryRecord) => h().commit(async tx => {
    const bindings = await tx.doc(Bindings); const binding = `placed:${entry.id}`;
    if (bindings.values[binding]) return;
    const all = await transactionEntries(tx, entry.conversationId);
    if (entry.kind === "aitp.input") {
      const fresh = originalBlocks(entry).filter(b => b.type === "data");
      const itemEdits: DataDelivery["edits"] = all.filter(e => e.id < entry.id).flatMap(originalBlocks)
        .filter(b => b.type === "data" && fresh.some(n => itemIdentity(n) === itemIdentity(b) && n.item !== b.item))
        .map(b => ({ item: (b as { item: string }).item, action: "omit" }));
      if (itemEdits.length) {
        const edits = await buildEdits(all.filter(e => e.id < entry.id), itemEdits);
        await tx.appendEntry(entry.conversationId, { kind: "aitp.context-edits", data: { itemEdits }, edits });
        await tx.appendEntry(entry.conversationId, { kind: "aitp.audit", data: { type: "supersession", at: now(), items: [...new Set(itemEdits.map(e => e.item))], reason: "A newer input placed current excerpts" } });
      }
    } else if (entry.kind === "pi.compaction") {
      let compaction = String(entry.byTaskId ?? entry.id);
      let cursor: NativeCursor | undefined;
      do {
        const tasks = await tx.scanTasks({ conversationId: entry.conversationId, kind: "pi.compaction" }, 200, cursor);
        for (const task of tasks.items) {
          const submission = await tx.submissionByRequest(entry.conversationId, `compaction:${task.id}`);
          if (submission?.entry === entry.id) compaction = String(task.id);
        }
        cursor = tasks.next;
      } while (cursor);
      const prior = all.filter(e => e.id < entry.id && e.id < (entry.head ?? entry.id));
      const end = prior.at(-1)?.id ?? entry.id;
      await tx.appendEntry(entry.conversationId, { kind: "aitp.audit", data: {
        type: "compaction-applied", at: now(), compaction, summaryEntry: String(entry.id),
        covered: { conversation: String(entry.conversationId), to: { conversation: String(entry.conversationId), entry: String(end), ordinal: 0 } },
      } });
    }
    bindings.values[binding] = { done: true };
  }, ctx);
  const enqueuePlaced = (entry: EntryRecord) => {
    // Call immediately so the commit is already on Pi's mutation line before listeners return.
    const next = reconcilePlaced(entry);
    effects = Promise.all([effects, next]).then(() => {});
    void effects.catch(() => {});
  };
  const inputReceipt = (record: SubmissionRecord, at = now()): SubmissionReceipt & { reason?: string } => ({
    submission: String(record.id), requestId: record.requestId!,
    status: record.status === "queued" ? "admitted" : record.status === "placed" ? "placed" : record.status === "done" ? "settled" : record.reason === "aborted" ? "aborted" : "rejected",
    ...(record.entry ? { entry: String(record.entry) } : {}), ...(record.status === "unanswered" ? { reason: record.reason } : {}), at,
  });
  const deliveryReceipt = (record: SubmissionRecord): DeliveryReceipt => ({ requestId: record.requestId!, submission: String(record.id),
    status: record.status === "queued" ? "admitted" : record.status === "done" ? "placed" : "unanswered",
    ...(record.entry ? { entry: String(record.entry) } : {}), ...(record.status === "unanswered" ? { reason: record.reason } : {}), at: now() });
  const createConversation = async (spec: Parameters<ExecutionPort["createConversation"]>[0]) => nativeCommit(async tx => {
    const binding = `conversation:${spec.requestId}`; const bindings = await tx.doc(Bindings);
    const body = requestBody(json(spec)); const found = bindings.values[binding];
    if (found) { if (!sameRequestBody(found.body, body)) throw new Error("request_reused"); return String(found.id); }
    const created = await tx.createConversation({ ownership: spec.owner ? { kind: "task", taskId: id<TaskId>(spec.owner.task) } : { kind: "ownerless" } });
    await configureTx(tx, created.id, spec.agent);
    bindings.values[binding] = { id: String(created.id), body }; return String(created.id);
  });
  const configureTx = async (tx: Tx, cid: ConversationId, agent: Partial<AgentConfig>) => {
    const state = await tx.doc(AgentDoc, cid);
    if (agent.model) { state.model = options.faux ? { provider: "faux", modelId: agent.model.modelId } : agent.model; state.thinkingLevel = agent.model.thinkingLevel ?? "off"; }
    if (agent.tools || agent.deferredTools) {
      const previous = (await tx.doc(Bindings)).values[`agent:${cid}`] as AgentConfig | undefined;
      state.tools = [...new Set([...(agent.tools ?? previous?.tools ?? []), ...(agent.deferredTools ?? previous?.deferredTools ?? [])])];
    }
    const bindings = await tx.doc(Bindings); bindings.values[`agent:${cid}`] = json({ ...bindings.values[`agent:${cid}`], ...agent });
  };
  const submit = async (cid: string, input: InputSubmission): Promise<SubmissionReceipt> => {
    progressAllowed(); alive();
    const bindingKey = `input:${cid}:${input.requestId}`;
    const body = requestBody(json(input));
    const saved = await nativeCommit(async tx => {
      const bindings = await tx.doc(Bindings); const old = bindings.values[bindingKey];
      if (old) { if (!sameRequestBody(old.body, body)) throw new Error("request_reused"); return json(old); }
      const value = { body, at: now() }; bindings.values[bindingKey] = value; return value as JsonObject;
    });
    if (saved.receipt) return saved.receipt as SubmissionReceipt;
    const draft = { type: "input" as const, requestId: input.requestId, whenBusy: input.delivery === "follow-up" ? "followUp" as const : input.delivery,
      content: await encode(input.content), entry: { kind: "aitp.input", data: json(input) } };
    const scope = invocation.getStore();
    // Task contexts use the bound conversation handle (below); tools have no submit operation in their contract.
    if (scope && !scope.active) throw new Error("Invocation ended");
    const submission = await (await conversation(cid)).submit(draft, ctx);
    await effects;
    const receipt = inputReceipt(await submission.status(ctx), String(saved.at));
    return nativeCommit(async tx => {
      const bindings = await tx.doc(Bindings); const binding = bindings.values[bindingKey]!;
      if (!binding.receipt) binding.receipt = json(receipt);
      return json(binding.receipt) as SubmissionReceipt;
    });
  };
  const deliver = async (cid: string, delivery: DataDelivery): Promise<DeliveryReceipt> => {
    progressAllowed(); alive();
    const content = await encode(delivery.blocks);
    // ConversationHandle deliberately has no passive-write API in 1.3.0. Admit the passive write with public
    // transaction primitives, on the tool/task invocation's own commit line, without waiting for placement.
    return nativeCommit(async tx => {
      const nativeId = id<ConversationId>(cid);
      const existing = await tx.submissionByRequest(nativeId, delivery.requestId);
      const bindings = await tx.doc(Bindings); const key = `delivery:${cid}:${delivery.requestId}`;
      const body = requestBody(json(delivery)); const old = bindings.values[key];
      if (!sameRequestBody(old?.body, body)) throw new Error("request_reused");
      if (existing) { if (existing.type !== "write") throw new Error("request_reused"); return { ...deliveryReceipt(existing), at: String(old?.at ?? now()) }; }
      if (!await tx.conversation(nativeId)) throw new Error("Unknown conversation");
      const all = await transactionEntries(tx, nativeId);
      const live = await tx.doc(LiveDoc, nativeId); const inbox = await tx.doc(InboxDoc, nativeId);
      const pending = inbox.items.flatMap(item => item.mode === "write" ? (((item.entry.data as JsonObject | undefined)?.itemEdits ?? []) as DataDelivery["edits"]) : []);
      const edits = await buildEdits(all, delivery.edits, pending);
      const entry = json({ kind: "aitp.context", data: { ...delivery, itemEdits: delivery.edits }, model: [{ role: "user" as const, content, timestamp: Date.now() }], edits });
      const at = now(); bindings.values[key] = { body, at };
      if (live.run || inbox.items.length) {
        const submission = await tx.createSubmission({ conversationId: nativeId, requestId: delivery.requestId, type: "write", status: "queued" });
        inbox.items.push({ id: submission.id, mode: "write", entry: entry as unknown as JsonObject });
        return { ...deliveryReceipt(submission), at };
      }
      const placed = await tx.appendEntry(nativeId, entry);
      return { ...deliveryReceipt(await tx.createSubmission({ conversationId: nativeId, requestId: delivery.requestId, type: "write", status: "done", entry: placed.id })), at };
    });
  };
  const taskView = (record: TaskRecord<unknown, unknown, unknown>, retryOf?: string): TaskView => {
    const outcome = record.state.status === "terminal" || record.state.status === "completing" ? record.state.outcome.status : undefined;
    const kind = record.kind === "pi.generation" ? "turn" : record.kind === "pi.tool" ? "tool" : record.kind === "pi.compaction" ? "compaction" : /controller|worker|integration|review/.exec(record.kind)?.[0] ?? "other";
    return { id: String(record.id), kind: kind as TaskView["kind"], status: record.state.status,
      owner: record.owner ? { task: String(record.owner) } : { conversation: String(record.conversationId) }, conversation: String(record.conversationId),
      ...(outcome ? { outcome: outcome === "completed" ? "ok" : outcome === "aborted" ? "aborted" : "failed" } : {}),
      ...(retryOf ? { retryOf } : {}), title: record.kind,
      updatedAt: record.endedAt !== undefined ? new Date(record.endedAt).toISOString() : taskObservedAt.get(String(record.id)) ?? (record.startedAt !== undefined ? new Date(record.startedAt).toISOString() : now()) };
  };
  const taskContext = (tid: TaskId, runtime: Parameters<NativeTask["definition"]["phases"]["run"]>[1], scope: Invocation): TaskShellContext => {
    const check = () => { if (!scope.active || scope.signal.aborted) throw new Error("Invocation ended"); };
    const boundConversation = async (cid: string) => { check(); const handle = await runtime.conversation(id<ConversationId>(cid), ctx); if (!handle) throw new Error("Unknown conversation"); return handle; };
    return {
      task: String(tid), signal: runtime.signal, transact: async callback => { check(); return transact(callback); },
      read: { get: async address => { check(); return read.get(address); }, list: async (family, opts) => { check(); return read.list(family, opts); } },
      createConversation: async (key, agent) => { check(); return createConversation({ requestId: taskRequest(tid, "conversation", key), owner: { task: String(tid) }, agent }); },
      async submit(cid, input) { check(); progressAllowed(); const s = await (await boundConversation(cid)).submit({ type: "input", requestId: taskRequest(tid, "input", input.requestId),
        content: await encode(input.content), whenBusy: input.delivery === "follow-up" ? "followUp" : input.delivery, entry: { kind: "aitp.input", data: json(input) } }, ctx);
        check(); return inputReceipt(await s.status(ctx)); },
      async deliver(cid, delivery) { check(); return deliver(cid, { ...delivery, requestId: taskRequest(tid, "data", delivery.requestId) }); },
      startTask: async (key, shell, input) => { check(); return transact(tx => tx.startTask({ shell, input, owner: { task: String(tid) }, requestId: taskRequest(tid, "task", key) })); },
      async abortTask(task) { check(); await runtime.abortOwned(id<TaskId>(task), ctx); },
      async waitIdle(cid) { check(); await (await boundConversation(cid)).waitForIdle(ctx); check(); },
      async outcomes(tasks) { check(); const result = await runtime.outcomes(tasks.map(t => id<TaskId>(t)), ctx); check(); return result.map((r, i) => ({ task: tasks[i]!, status: r.status === "completed" ? "ok" : r.status === "aborted" ? "aborted" : "failed", ...("result" in r && r.result !== undefined ? { result: r.result as JsonValue } : {}), ...("error" in r && r.error ? { error: r.error.message } : "reason" in r && r.reason ? { error: r.reason } : {}) })); },
    };
  };
  const port: ExecutionPort = {
    async open() {
      if (harness) return;
      taskObservedAt.clear();
      await mkdir(options.dataDir, { recursive: true }); unlock = await lockStorage(join(options.dataDir, "runtime.lock"));
      try {
        const credentials = await fileCredentialStore(options.dataDir, secrets.remember); const installation = await deviceId(options.dataDir);
        const models = createModels({ credentials });
        if (options.faux) {
          const faux = testing?.faux ?? fauxProvider({ models: [...new Set([options.models.main.modelId, options.models.reviewer?.modelId, ...Object.values(options.models.workers ?? {}).map(m => m.modelId)].filter((v): v is string => !!v))].map(value => ({ id: value, input: ["text", "image"], reasoning: true })), tokensPerSecond: Infinity });
          // A deterministic, offline default. Scripted tests supply the handle above.
          if (!testing?.faux) faux.setResponses(Array.from({ length: 10000 }, () => fauxAssistantMessage("Faux completion.")));
          models.setProvider(faux.provider);
        } else {
          const [{ openaiProvider }, { anthropicProvider }, { deepseekProvider }, { moonshotaiProvider }] = await Promise.all([
            import("@earendil-works/pi-ai/providers/openai"), import("@earendil-works/pi-ai/providers/anthropic"), import("@earendil-works/pi-ai/providers/deepseek"), import("@earendil-works/pi-ai/providers/moonshotai"),
          ]);
          models.setProvider(openaiProvider()); models.setProvider(anthropicProvider()); models.setProvider(deepseekProvider()); models.setProvider(moonshotaiProvider());
          if ([options.models.main, options.models.reviewer, ...Object.values(options.models.workers ?? {})].some(model => model?.provider === "openai-codex")) {
            const { openaiCodexProvider } = await import("@earendil-works/pi-ai/providers/openai-codex");
            models.setProvider(openaiCodexProvider());
          }
        }
        const protectedModels = safeModels(models, secrets.redact, secrets.redactPartial);
        modelService = modelsPort(protectedModels, installation, options.readArtifact, options.faux);
        storage = await openNodeSqliteStorage(join(options.dataDir, "runtime.sqlite"));
        harness = await Harness.open(storage, { models: protectedModels, registry: executionRegistry(registry),
          settings: { ...(options.faux ? { compaction: { enabled: false, keepRecentTokens: 1 }, retry: { enabled: false } } : {}), ...testing?.settings } }, ctx);
        const savedSections = (await h().snapshot(Bindings, ctx))?.values["section-names"];
        for (const [key, name] of Object.entries(savedSections ?? {})) if (!sectionNames.has(key)) sectionNames.set(key, String(name));
        await h().commit(async tx => { (await tx.doc(Bindings)).values["section-names"] = Object.fromEntries(sectionNames); }, ctx);
        harness.subscribeCommits(publication => {
          for (const change of publication.changes) if (change.type === "task") taskObservedAt.set(String(change.value.id), now());
          for (const change of publication.changes) if (change.type === "entry" && (change.value.kind === "aitp.input" || change.value.kind === "pi.compaction")) enqueuePlaced(change.value);
        });
        // Recover an audit/edit commit interrupted after placement. This never starts the scheduler.
        let cursor: NativeCursor | undefined;
        do { const page = await h().commit(tx => tx.scanConversations({}, 200, cursor), ctx);
          for (const c of page.items) for (const entry of await entries((await h().conversation(c.id, ctx))!)) if (entry.kind === "aitp.input" || entry.kind === "pi.compaction") await reconcilePlaced(entry);
          cursor = page.next;
        } while (cursor);
      } catch (error) {
        try { if (harness) await harness.close(ctx); else if (storage) await storage.close(ctx); }
        finally { harness = undefined; storage = undefined; modelService?.close(); await unlock(); unlock = undefined; }
        throw error;
      }
    },
    async startScheduling() { h(); scheduling = true; h().resume(); },
    async close() {
      for (const w of watchers) w.close();
      try { try { await effects; } finally { modelService?.close(); if (harness) await harness.close(ctx); } }
      finally { harness = undefined; storage = undefined; scheduling = false; if (unlock) { await unlock(); unlock = undefined; } }
    },
    transact, read, createConversation,
    async configure(cid, agent) { await nativeCommit(tx => configureTx(tx, id<ConversationId>(cid), agent)); },
    submit,
    async submission(cid, value) { alive(); const s = await h().submission(id<SubmissionId>(value), ctx); if (!s) throw new Error("Unknown submission"); const record = await s.status(ctx); if (String(record.conversationId) !== cid) throw new Error("Foreign submission"); const bindings = await h().snapshot(Bindings, ctx); const binding = bindings?.values[`${record.type === "input" ? "input" : "delivery"}:${cid}:${record.requestId}`]; return inputReceipt(record, binding?.at as string | undefined); },
    deliver,
    async abort(cid) { progressAllowed(); await (await conversation(cid)).abort(ctx); },
    async waitIdle(cid) { progressAllowed(); await (await conversation(cid)).waitForIdle(ctx); await effects; },
    async contextAt(cid, at) { if (at && at.conversation !== cid) throw new Error("Foreign cursor"); const view = await (await conversation(cid)).context(ctx, at ? { at: id<EntryId>(at.entry) } : undefined); return { messages: modelMessages(view.messages, images, sectionNames) }; },
    async compact(cid, opts) {
      progressAllowed();
      return nativeCommit(async tx => {
        const bindings = await tx.doc(Bindings); const binding = `compact:${cid}:${opts.requestId}`;
        const old = bindings.values[binding];
        if (old) { if (old.instructions !== (opts.instructions ?? null)) throw new Error("request_reused"); return { task: String(old.task) }; }
        const nativeId = id<ConversationId>(cid); const live = await tx.doc(LiveDoc, nativeId);
        // Public task and document APIs, matching Conversation.compact in the installed 1.3.0 build.
        const task = await tx.createTask(CompactionTask, { reason: "manual" as const, ...(opts.instructions === undefined ? {} : { instructions: opts.instructions }) }, { conversationId: nativeId, ownership: { kind: "conversation" }, background: false });
        (live.compactions ??= []).push({ taskId: task, reason: "manual", blocking: false, attempt: 1 });
        bindings.values[binding] = { task: String(task), instructions: opts.instructions ?? null };
        return { task: String(task) };
      });
    },
    registerTaskShell(shell: TaskShell) {
      const run: NativeTask["definition"]["phases"]["run"] = async (task, runtime) => {
        const scope: Invocation = { active: true, signal: runtime.signal, commit: async () => { throw new Error("Invocation not initialized"); } };
        // Task-runtime commit returns void; carry the callback result without changing task state.
        scope.commit = async fn => { let value: Awaited<ReturnType<typeof fn>>; await runtime.commit(async tx => { value = await fn(tx); }, ctx); return value!; };
        try { await invocation.run(scope, async () => {
          const result = await shell.phase(json(task.state.checkpoint.state), taskContext(task.id, runtime, scope));
          await runtime.commit(async () => "done" in result ? { status: "terminal", outcome: { status: "completed", result: result.done } }
            : "failed" in result ? { status: "terminal", outcome: { status: "failed", error: { message: result.failed } } }
            : "wait" in result ? { status: "waiting", checkpoint: { phase: "run", state: result.next }, on: result.wait.tasks.map(t => id<TaskId>(t)), policy: result.wait.policy }
            : { status: "running", checkpoint: { phase: "run", state: result.next } }, ctx);
        }); } finally { scope.active = false; }
      };
      const definition: NativeTask = defineTask({ name: shell.name, version: shell.version, initial: input => ({ phase: "run", state: shell.initial(input) }), phases: { run },
        abort: async (task, runtime) => {
          const scope: Invocation = { active: true, signal: runtime.signal, commit: async fn => { let value: Awaited<ReturnType<typeof fn>>; await runtime.commit(async tx => { value = await fn(tx); }, ctx); return value!; } };
          try { await invocation.run(scope, async () => {
            const result = shell.onAbort ? await shell.onAbort(json(task.state.checkpoint.state), taskContext(task.id, runtime, scope)) : { aborted: true as const };
            await runtime.commit(async () => ({ status: "terminal", outcome: "done" in result ? { status: "completed", result: result.done } : "failed" in result ? { status: "failed", error: { message: result.failed } } : { status: "aborted" } }), ctx);
          }); } finally { scope.active = false; }
        } });
      definitions.set(shell.name, definition); registry.install(defineExtension({ name: `aitp.task.${shell.name}`, tasks: [definition] }));
    },
    startTask: spec => transact(tx => tx.startTask(spec)),
    async abortTask(task) { progressAllowed(); await h().abortTask(id<TaskId>(task), ctx); },
    async retryTask(task, requestId) {
      return nativeCommit(async tx => {
        const record = await tx.task(id<TaskId>(task)); if (!record || record.state.status !== "terminal") throw new Error("Task is not terminal");
        const owner = record.owner ? await tx.task(record.owner) : undefined;
        const bindings = await tx.doc(Bindings); const original = Object.values(bindings.values).find(b => b.id === task && b.spec);
        const existing = bindings.values[`retry-request:${requestId}`];
        if (existing) { if (existing.retryOf !== task) throw new Error("request_reused"); return { task: String(existing.task), retryOf: task }; }
        if (!original) throw new Error("Only registered task shells can be retried");
        const outcome = record.state.outcome.status; if (outcome === "completed") throw new Error("Successful task cannot be retried");
        const spec = original.spec as TaskStart;
        const next = await createTask(tx, { ...spec, ...(owner?.state.status === "terminal" || owner?.state.status === "completing" ? { owner: { conversation: String(record.conversationId) } } : {}), requestId });
        bindings.values[`retry:${next}`] = { retryOf: task };
        bindings.values[`retry-request:${requestId}`] = { retryOf: task, task: next }; return { task: next, retryOf: task };
      });
    },
    async taskView(task) { alive(); const record = await h().getTask(id<TaskId>(task), ctx); if (!record) return undefined; const binding = await h().snapshot(Bindings, ctx); return taskView(record, binding?.values[`retry:${task}`]?.retryOf as string | undefined); },
    registerTool(tool) {
      const definition = defineTool({ name: tool.name, description: tool.description, parameters: tool.parameters as TSchema, replay: tool.replay,
        ...(tool.deferred ? { deferred: true as const } : {}), callers: tool.callers,
        execute: async (args, api, context) => {
          const scope: Invocation = { active: true, signal: new AbortController().signal, commit: fn => api.commit(fn, context) };
          // Pi carries cancellation in Context; the adapter aborts the exported signal with that context.
          const signal = context.abortSignal ?? new AbortController().signal;
          scope.signal = signal;
          const check = () => { if (!scope.active || signal.aborted) throw new Error("Invocation ended"); };
          try { return await invocation.run(scope, async () => {
            const result = await tool.execute(args as JsonObject, { conversation: String(api.conversationId), task: String(api.taskId), toolCallId: api.callId, signal,
              progress: text => { check(); api.output(text); },
              transact: async callback => { check(); return invocation.run(scope, () => transact(callback)); },
              read: { get: async address => { check(); return invocation.run(scope, () => read.get(address)); },
                list: async (family, opts) => { check(); return invocation.run(scope, () => read.list(family, opts)); } } });
            if (result.content.some(b => b.type === "image")) await api.commit(tx => tx.appendEntry(api.conversationId, { kind: "aitp.tool-output", data: { callId: api.callId, content: result.content } }), context);
            return { output: await encode(result.content), isError: result.isError, diagnostics: result.diagnostics, details: result.details,
              ...(result.control ? { control: { addTools: result.control.loadTools, terminate: result.control.terminateRun } } : {}) };
          }); } finally { scope.active = false; }
        } });
      registry.install(defineExtension({ name: `aitp.tool.${tool.name}`, tools: [definition] }));
    },
    registerInstructionSection(value) {
      const nativeKey = value.key !== "instructions" && /^[a-z][a-z0-9_-]*$/.test(value.key) ? value.key : `aitp-section-${hash(value.key).slice(7)}`;
      sectionNames.set(nativeKey, value.key);
      if (harness) {
        const write = h().commit(async tx => { (await tx.doc(Bindings)).values["section-names"] = Object.fromEntries(sectionNames); }, ctx);
        effects = Promise.all([effects, write]).then(() => {}); void effects.catch(() => {});
      }
      registry.install(defineExtension({ name: `aitp.section.${nativeKey}`, sections: [section(nativeKey, async input => {
        const binding = await h().snapshot(Bindings, ctx); const agent = binding?.values[`agent:${input.conversationId}`] as AgentConfig | undefined;
        if (agent && !agent.sections.includes(value.key)) return undefined;
        return value.render({ conversation: String(input.conversationId) });
      }, { tag: false })] }));
    },
    registerHooks(value) {
      hooks.push(value); const index = hooks.length;
      registry.install(defineExtension({ name: `aitp.hooks.${index}`, hooks: [
        hook(ToolTask, { beforeTool: (call, api) => value.beforeTool?.({ name: call.name, args: call.arguments as JsonObject, conversation: String(api.conversationId), parentCallId: call.parent?.callId }) }),
        hook(GenerationTask, { onYield: async (answer, api) => { const r = await value.onYield?.({ conversation: String(api.conversationId), text: answer.content.flatMap(b => b.type === "text" ? [b.text] : []).join("") }); return r?.continue ? { continue: r.continue } : undefined; } }),
        hook(CompactionTask, { beforeCompact: async (input, api) => value.beforeCompact?.({ conversation: String(api.conversationId), reason: input.reason, entries: input.entries.flatMap(e => entryViews(e, images, sectionNames)), messages: modelMessages(input.messages, images, sectionNames), firstKept: String(input.firstKept), instructions: input.instructions }) }),
      ] }));
    },
    models() { h(); if (!modelService) throw new Error("Models not open"); return modelService; },
    async watchConversation(cid) {
      const c = await conversation(cid); const native = await c.watch(ctx); const stream = queueWatch<ConversationFrame>(() => { void native.stop(); detach(); watchers.delete(stream); });
      const render = (view: typeof native.value): ConversationFrame => {
        const live = view.docs["pi.live"] as { run?: unknown; compactions?: unknown[]; generation?: { message?: { content: { type: string; text?: string }[] } } } | undefined;
        return { kind: "snapshot", entries: view.entries.flatMap(e => entryViews(e, images, sectionNames)), state: live?.run ? "busy" : "idle", compacting: !!live?.compactions?.length,
          ...(live?.generation?.message ? { live: { text: live.generation.message.content.flatMap(b => b.type === "text" ? [b.text ?? ""] : []).join("") } } : {}) };
      };
      let previous = native.value;
      stream.push(render(previous)); native.start(async value => {
        const snapshot = render(value);
        if (stream.size > 100 || previous.entries.some(e => !value.entries.some(n => n.id === e.id))) {
          stream.replace(snapshot);
        } else {
          const existing = new Set(previous.entries.map(e => e.id));
          for (const entry of value.entries) if (!existing.has(entry.id)) for (const view of entryViews(entry, images, sectionNames)) stream.push({ kind: "entry", entry: view });
          const before = render(previous);
          if (snapshot.kind === "snapshot" && before.kind === "snapshot") {
            if (snapshot.state !== before.state || snapshot.compacting !== before.compacting) stream.push({ kind: "state", state: snapshot.state, compacting: snapshot.compacting });
            if (snapshot.live?.text !== before.live?.text && snapshot.live) stream.push({ kind: "partial", text: snapshot.live.text });
          }
          type Slot = { callId: string; name: string; status: string; output?: string };
          const slots = (v: typeof value) => ((v.docs["pi.live"] as { tools?: Slot[]; nestedTools?: Slot[] } | undefined)?.tools ?? [])
            .concat((v.docs["pi.live"] as { nestedTools?: Slot[] } | undefined)?.nestedTools ?? []);
          const old = new Map(slots(previous).map(s => [s.callId, s]));
          for (const slot of slots(value)) {
            const prior = old.get(slot.callId);
            if (!prior || prior.status !== slot.status || prior.output !== slot.output) stream.push({ kind: "tool", callId: slot.callId, name: slot.name,
              phase: slot.status === "done" ? "end" : !prior ? "start" : "update", ...(slot.output ? { summary: slot.output } : {}) });
          }
        }
        previous = value;
      });
      const problem = (record: SubmissionRecord | TaskRecord<unknown, unknown, unknown>) => {
        if (record.conversationId !== c.id) return;
        if ("type" in record && record.status === "unanswered") stream.push({ kind: "problem", subject: { submission: String(record.id) }, reason: record.reason });
        if ("state" in record && record.state.status === "terminal") {
          const o = record.state.outcome; if (o.status === "orphaned" || o.status === "faulted") stream.push({ kind: "problem", subject: { task: String(record.id) }, reason: o.status === "orphaned" ? o.reason : o.error.message });
        }
      };
      const detach = h().subscribeCommits(p => { for (const change of p.changes) if (change.type === "submission" || change.type === "task") problem(change.value); });
      // Historical problems are included for a late observer, not reconstructed from current documents.
      await h().commit(async tx => {
        let cursor: NativeCursor | undefined;
        do { const records = await tx.scanTasks({ conversationId: c.id }, 200, cursor); for (const r of records.items) problem(r); cursor = records.next; } while (cursor);
        do { const records = await storage!.scanSubmissions({ conversationId: c.id }, 200, cursor, ctx); for (const r of records.items) problem(r); cursor = records.next; } while (cursor);
      }, ctx);
      void native.closed.then(() => { stream.push({ kind: "closed" }); stream.close(); }); watchers.add(stream); return stream;
    },
    async watchTasks() {
      const native = await h().watchTaskGraph(ctx); const stream = queueWatch<TaskFrame>(() => { void native.stop(); watchers.delete(stream); });
      const render = async () => {
        const all = await h().commit(tx => tx.scanTasks({}, 10000), ctx);
        const binding = await h().snapshot(Bindings, ctx);
        stream.push({ kind: "snapshot", tasks: all.items.map(r => taskView(r, binding?.values[`retry:${r.id}`]?.retryOf as string | undefined)) });
      };
      await render(); native.start(async () => { await render(); }); void native.closed.then(() => { stream.push({ kind: "closed" }); stream.close(); }); watchers.add(stream); return stream;
    },
    async *readLog(cid, opts) {
      if ((opts?.from && opts.from.conversation !== cid) || (opts?.cutoff && opts.cutoff.conversation !== cid)) throw new Error("Foreign cursor");
      const c = await conversation(cid);
      const tail = opts?.cutoff ? id<EntryId>(opts.cutoff.entry) : (await c.entries({}, 1, undefined, ctx)).items[0]?.id;
      if (!tail) return;
      for (const entry of await entries(c, { ...(opts?.from ? { minEntryId: id<EntryId>(opts.from.entry) } : {}), maxEntryId: tail })) {
        const records = logRecords(entry, images, sectionNames);
        for (const record of records) if ((!opts?.from || compareCursor(record.cursor, opts.from) > 0) && (!opts?.cutoff || compareCursor(record.cursor, opts.cutoff) <= 0)) yield record;
      }
    },
  };
  return port;
}

function compareCursor(a: Cursor, b: Cursor) { return Number(a.entry) - Number(b.entry) || a.ordinal - b.ordinal; }
function logRecords(entry: EntryRecord, images: Map<string, ContentBlock> = new Map(), sectionNames: Map<string, string> = new Map()): LogRecord[] {
  const records: LogRecord[] = []; const cid = String(entry.conversationId);
  const cursor = () => ({ conversation: cid, entry: String(entry.id), ordinal: records.length });
  if (entry.kind === "aitp.audit") { const event = AuditEvent.parse(entry.data); records.push({ type: "audit", cursor: cursor(), at: event.at, event }); return records; }
  for (const message of entry.model ?? []) {
    if (message.role === "system") {
      for (const [section, text] of Object.entries(message.sections ?? {})) {
        const event: AuditEvent = { type: "instruction-rendering", at: new Date(message.timestamp).toISOString(), section: sectionNames.get(section) ?? section, text, hash: null, bytes: text === null ? 0 : Buffer.byteLength(text) };
        records.push({ type: "audit", cursor: cursor(), at: event.at, event });
      }
    } else if (message.role === "user") {
      if (entry.kind === "pi.compaction") records.push({ type: "compaction-summary", cursor: cursor(), summary: publicContent(message.content).map(b => b.type === "text" ? b.text : "").join("") });
      else {
        const data = entry.data as InputSubmission | undefined;
        records.push({ type: "message", cursor: cursor(), at: new Date(message.timestamp).toISOString(), role: "user", content: (data as { content?: ContentBlock[]; blocks?: ContentBlock[] })?.content ?? (data as { blocks?: ContentBlock[] })?.blocks ?? publicContent(message.content),
          ...(entry.kind === "aitp.input" && data ? { purpose: data.purpose, delivery: data.delivery } : {}) });
      }
    } else if (message.role === "assistant") {
      const { input, output, cacheRead, cacheWrite, totalTokens } = message.usage;
      records.push({ type: "message", cursor: cursor(), at: new Date(message.timestamp).toISOString(), role: "assistant", content: publicContent(message.content),
        usage: { input, output, cacheRead, cacheWrite, total: totalTokens } });
      for (const b of message.content) if (b.type === "toolCall") records.push({ type: "tool-call", cursor: cursor(), id: b.id, name: b.name, args: b.arguments as JsonValue });
    } else {
      const mapped = modelMessages([message], images)[0]!;
      records.push({ type: "tool-result", cursor: cursor(), at: new Date(message.timestamp).toISOString(), id: message.toolCallId, isError: message.isError, content: mapped.role === "tool" ? mapped.content : [] });
    }
  }
  return records;
}
function entryViews(entry: EntryRecord, images: Map<string, ContentBlock> = new Map(), sectionNames: Map<string, string> = new Map()): TranscriptEntryView[] {
  return logRecords(entry, images, sectionNames).map((r): TranscriptEntryView => {
    const base = { id: String(entry.id), conversation: String(entry.conversationId), ordinal: r.cursor.ordinal, ...(r.at ? { at: r.at } : {}) };
    if (r.type === "message") return { ...base, kind: entry.kind === "aitp.context" ? "data" : r.role, content: r.content, purpose: r.purpose, delivery: r.delivery, ...(r.usage ? { usage: r.usage } : {}) };
    if (r.type === "tool-call") return { ...base, kind: "tool-call", content: [{ type: "text", text: JSON.stringify(r.args) }], tool: { callId: r.id, name: r.name } };
    if (r.type === "tool-result") return { ...base, kind: "tool-result", content: r.content, tool: { callId: r.id, name: (entry.model?.[0] as { toolName?: string })?.toolName ?? "tool", isError: r.isError } };
    if (r.type === "compaction-summary") return { ...base, kind: "summary", content: [{ type: "text", text: r.summary }] };
    return { ...base, kind: "audit", content: [] };
  });
}
function queueWatch<T>(stop: () => void): Watch<T> & { push(frame: T): void; replace(snapshot: T): void; readonly size: number } {
  const queue: T[] = []; let closed = false; let wake: (() => void) | undefined;
  return {
    get size() { return queue.length; },
    replace(snapshot) {
      if (closed) return;
      const problems = queue.filter(frame => (frame as { kind?: string }).kind === "problem");
      queue.splice(0, queue.length, snapshot, ...problems); wake?.(); wake = undefined;
    },
    push(frame) { if (!closed) { queue.push(frame); wake?.(); wake = undefined; } },
    close() { if (!closed) { closed = true; stop(); wake?.(); wake = undefined; } },
    async *[Symbol.asyncIterator]() {
      try { while (!closed || queue.length) { if (queue.length) yield queue.shift()!; else await new Promise<void>(resolve => { wake = resolve; }); } }
      finally { this.close(); }
    },
  };
}
