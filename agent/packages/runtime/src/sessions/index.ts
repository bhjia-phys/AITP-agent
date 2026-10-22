import { createHash } from "node:crypto";
import { ActiveTask, ExportLine, InputSubmission, SessionMeta } from "@aitp/protocol";
import type { LogRecord, SubmissionReceipt } from "@aitp/protocol";
import type { AgentConfig, CreateSessionService } from "../contracts.ts";
import { toolCatalog } from "../tools/interaction/catalog.ts";
import { all, fingerprint, object, requestReused, sameRequest, serialByKey } from "./state.ts";

export const SECTION_KEYS = ["aitp-identity", "aitp-kernel", "aitp-skills", "aitp-instructions", "aitp-grants", "aitp-tools"];
export const createSessionService: CreateSessionService = (deps, services) => {
  const serial = serialByKey();
  const watching = new Set<string>();
  const watchCompactions = (session: SessionMeta) => {
    if (watching.has(session.id)) return;
    watching.add(session.id);
    void (async () => {
      const watch = await deps.port.watchConversation(session.conversation);
      let cursor: LogRecord["cursor"] | undefined;
      try {
        for await (const frame of watch) {
          if (frame.kind === "closed") break;
          for await (const record of deps.port.readLog(session.conversation, cursor ? { from: cursor } : undefined)) {
            if (record.type === "audit" && record.event.type === "compaction-applied")
              await services().context.afterCompaction(session.id, record.event.compaction);
            cursor = record.cursor;
          }
        }
      } finally { watch.close(); watching.delete(session.id); }
    })().catch(() => {
      watching.delete(session.id);
      // Keep a redacted, durable failure if storage is still open. Closing storage may reject this final write.
      void deps.port.transact(tx => tx.appendAudit(session.conversation, { type: "notice", at: deps.clock.now().toISOString(), level: "error",
        message: "Context re-delivery stopped; it will retry on the next session access." })).catch(() => {});
    });
  };
  const timestamp = () => deps.clock.now().toISOString();
  const sessionFor = async (id: string) => {
    const value = await deps.port.read.get({ family: "session", key: id });
    if (!value) throw new Error("Unknown session"); return SessionMeta.parse(value);
  };
  const get: ReturnType<CreateSessionService>["get"] = async id => {
    const raw = await deps.port.read.get({ family: "session", key: id }); if (!raw) return undefined;
    const session = SessionMeta.parse(raw);
    watchCompactions(session);
    let latest: Extract<LogRecord, { type: "message" }> | undefined;
    const required = new Set<string>();
    for await (const record of deps.port.readLog(session.conversation)) {
      if (record.type === "message" && record.role === "user" && record.purpose === "task") { latest = record; required.clear(); }
      else if (record.type === 'audit' && record.event.type === 'card' && record.event.card.kind === 'required' && record.event.card.status === 'open') required.add(record.event.card.id);
      else if (record.type === 'audit' && record.event.type === 'card-response') required.delete(record.event.card);
    }
    if (!latest) return { session };
    // The log is the authority even if no watch was ever attached, or the active-task cache lags.
    const entry = latest.cursor.entry;
    let prepared: InputSubmission | undefined;
    for (const request of await all(deps.port.read, "request")) if (request.session === id && request.prepared && fingerprint((request.prepared as InputSubmission).content) === fingerprint(latest.content)) prepared = InputSubmission.parse(request.prepared);
    const candidate = latest;
    const activeTask = await deps.port.transact(async tx => {
      const cache = await tx.get({ family: "active-task", key: id });
      if (cache?.entry === entry) {
        const task = ActiveTask.parse(cache.task);
        const status = required.size && task.status === 'active' ? 'waiting-researcher' : !required.size && cache.waitingOnCards && task.status === 'waiting-researcher' ? 'active' : task.status;
        if (status === task.status) return task;
        const updated = ActiveTask.parse({ ...task, status, updatedAt: timestamp() });
        await tx.put({ family: 'active-task', key: id }, object({ entry, task: updated, waitingOnCards: required.size > 0 }));
        await tx.appendAudit(session.conversation, { type: 'active-task', at: timestamp(), task: updated });
        return updated;
      }
      const at = candidate.at ?? timestamp();
      const task = ActiveTask.parse({ id: `task:${session.conversation}:${entry}`, session: id,
        request: candidate.content.flatMap(b => b.type === "text" ? [b.text] : []).join("\n"), agreement: { source: "request" },
        scope: prepared?.scope ?? session.scope, thread: prepared?.thread ?? session.thread, status: required.size ? "waiting-researcher" : "active", placedAt: at, updatedAt: at });
      // Return the log's observation even if a cache claims a later entry. Avoid regressing a concurrently
      // installed cache, but never use it as the authority for this read.
      if (cache?.entry && Number(cache.entry) > Number(entry)) return task;
      await tx.put({ family: "active-task", key: id }, object({ entry, task, waitingOnCards: required.size > 0 }));
      await tx.appendAudit(session.conversation, { type: "active-task", at, task }); return task;
    });
    return { session, activeTask };
  };
  const submit: ReturnType<CreateSessionService>["submit"] = (session, raw) => serial(session, async () => {
    // Fingerprint the original body before enrichment, including caller-supplied data and images.
    const original = InputSubmission.parse(raw); const body = fingerprint(original); const key = `session-input:${session}:${original.requestId}`;
    const meta = await sessionFor(session);
    let saved = await deps.port.read.get({ family: "request", key });
    if (saved && !sameRequest(saved.fingerprint, body)) requestReused();
    if (saved?.receipt) return saved.receipt as SubmissionReceipt;
    if (!saved?.prepared) {
      await get(session);
      const prepared = await services().context.prepare(session, original);
      saved = object({ session, fingerprint: body, prepared: prepared.input, manifest: prepared.manifest.id });
      await deps.port.transact(async tx => {
        const existing = await tx.get({ family: "request", key });
        if (existing && !sameRequest(existing.fingerprint, body)) requestReused();
        if (!existing) await tx.put({ family: "request", key }, saved!);
      });
    }
    // If admission committed but the process died before saving its receipt, Pi's request id reuses it.
    const receipt = await deps.port.submit(meta.conversation, InputSubmission.parse(saved.prepared));
    await deps.port.transact(tx => tx.put({ family: "request", key }, object({ ...saved, receipt })));
    await get(session);
    return receipt;
  });
  return {
    async create(input) {
      const key = `session-create:${input.requestId}`; const body = fingerprint(input);
      const id = `session-${createHash("sha256").update(input.requestId).digest("hex").slice(0, 32)}`;
      const old = await deps.port.read.get({ family: "request", key });
      if (old) { if (!sameRequest(old.fingerprint, body)) requestReused(); return sessionFor(String(old.session)); }
      const catalog = toolCatalog(services()).map(d => d.tool);
      const agent: AgentConfig = { model: deps.core.config.models.main, tools: catalog.filter(t => !t.deferred).map(t => t.name),
        deferredTools: catalog.filter(t => t.deferred).map(t => t.name), sections: SECTION_KEYS };
      const conversation = await deps.port.createConversation({ requestId: `session:${id}`, agent });
      const created = await deps.port.transact(async tx => {
        const existing = await tx.get({ family: "request", key }); if (existing) { if (!sameRequest(existing.fingerprint, body)) requestReused(); return SessionMeta.parse(await tx.get({ family: "session", key: id })); }
        const session = SessionMeta.parse({ id, conversation, ...input, title: input.title ?? input.location, scope: input.scope ?? [], createdAt: timestamp(), archived: false });
        await tx.put({ family: "session", key: id }, object(session));
        await tx.put({ family: "request", key }, { fingerprint: body, session: id }); return session;
      });
      watchCompactions(created);
      return created;
    },
    async list(filter) { return (await all(deps.port.read, "session")).map(s => SessionMeta.parse(s)).filter(s => (!filter?.location || s.location === filter.location) && (!filter?.kind || s.kind === filter.kind) && (filter?.archived === undefined || s.archived === filter.archived)); },
    get,
    async update(id, change) {
      return deps.port.transact(async tx => {
        const key = `session-update:${id}:${change.requestId}`; const body = fingerprint(change); const old = await tx.get({ family: "request", key });
        if (old) { if (!sameRequest(old.fingerprint, body)) requestReused(); return SessionMeta.parse(old.session); }
        const session = SessionMeta.parse(await tx.get({ family: "session", key: id }));
        const manifest = change.seen ? await tx.get({ family: "manifest", key: id }) : undefined;
        const updated = SessionMeta.parse({ ...session, ...change, ...(manifest ? { lastSeen: { manifest: String(manifest.id), at: timestamp() } } : {}) });
        await tx.put({ family: "session", key: id }, object(updated)); await tx.put({ family: "request", key }, object({ fingerprint: body, session: updated })); return updated;
      });
    },
    submit,
    async continue(session, delivery, requestId) {
      const key = `session-continue:${session}:${requestId}`;
      const saved = await deps.port.read.get({ family: "request", key });
      if (saved) {
        if (saved.delivery !== delivery) requestReused();
        return submit(session, InputSubmission.parse(saved.input));
      }
      const current = await get(session); if (!current?.activeTask) throw new Error("No active task to continue");
      const task = current.activeTask;
      if (task.status === 'waiting-researcher' && (await services().cards.list(session, { open: true })).some(card => card.kind === 'required'))
        throw Object.assign(new Error('Answer the pending researcher decision before continuing this task'), { code: 'denied' });
      if (task.status === "done" || task.status === "stopped") throw new Error("Active task has no unfinished action");
      const input = InputSubmission.parse({ purpose: "continue", delivery, requestId, scope: task.scope, thread: task.thread,
        content: [{ type: "text", text: `Continue the authorized task: ${task.request}\n${task.nextAction ? `Resume its unfinished action: ${task.nextAction}` : "Resume its unfinished action within the existing agreement."}` }] });
      const original = await deps.port.transact(async tx => {
        const old = await tx.get({ family: "request", key });
        if (old) { if (old.delivery !== delivery) requestReused(); return InputSubmission.parse(old.input); }
        await tx.put({ family: "request", key }, object({ delivery, input })); return input;
      });
      return submit(session, original);
    },
    async abort(session) { await deps.port.abort((await sessionFor(session)).conversation); },
    async compact(session, options) { return deps.port.compact((await sessionFor(session)).conversation, options); },
    async *export(id) {
      const session = await sessionFor(id); const records: LogRecord[] = [];
      for await (const record of deps.port.readLog(session.conversation)) records.push(record);
      const cutoff = records.at(-1)?.cursor ?? { conversation: session.conversation, entry: "0", ordinal: 0 };
      yield JSON.stringify(ExportLine.parse({ schema: "aitp.workbench-log@1", session: id, location: session.location,
        conversations: [{ id: session.conversation, role: "main", cutoff }], exportedAt: timestamp(), limitations: ["Provider-private reasoning is not exported.", "Worker and reviewer conversations are not included by the S3-A session exporter.", "Large tool outputs may be truncated by Pi; full-output artifact references are not available in S3-A."] })) + "\n";
      for (const record of records) yield JSON.stringify(ExportLine.parse(record)) + "\n";
    },
  };
};
