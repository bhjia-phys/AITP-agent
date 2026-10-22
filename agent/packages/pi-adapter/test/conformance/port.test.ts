import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ExportLine } from "@aitp/protocol";
import type { DataBlock, InputSubmission, LogRecord } from "@aitp/protocol";
import type { AgentConfig, ConversationFrame, ExecutionPort, StateTransaction, TaskShellContext, ToolContext } from "@aitp/runtime/contracts";
import type { FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createAdapter } from "../../src/port.ts";

const resources: { port: ExecutionPort; dir: string }[] = [];
afterEach(async () => { for (const { port, dir } of resources.splice(0).reverse()) { await port.close(); await rm(dir, { recursive: true, force: true }); } });
const agent = (tools: string[] = [], sections: string[] = []): AgentConfig => ({ model: { provider: "faux", modelId: "m" }, tools, deferredTools: [], sections });
const input = (text: string, requestId = `request-${text}`): InputSubmission => ({ purpose: "task", delivery: "follow-up", content: [{ type: "text", text }], requestId });
const data = (text: string, item: string): DataBlock => ({ type: "data", item, role: "location", ref: { kind: "note", address: { kind: "workspace", path: "topics/x/research.md" }, version: { observedAt: "2026-10-01T00:00:00Z" }, locator: { kind: "lines", start: 1, end: 28 } }, text });
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "aitp-port-"));
  const faux = fauxProvider({ models: [{ id: "m", input: ["text", "image"], reasoning: true }], tokensPerSecond: Infinity });
  faux.setResponses(Array.from({ length: 100 }, () => fauxAssistantMessage("answer")));
  const port = createAdapter({ dataDir: dir, models: { main: agent().model }, faux: true, readArtifact: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png" }) }, { faux });
  resources.push({ port, dir }); return { port, faux, dir };
}
const log = async (port: ExecutionPort, cid: string) => { const result: LogRecord[] = []; for await (const r of port.readLog(cid)) result.push(r); return result; };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
async function terminal(port: ExecutionPort, id: string) { for (let i = 0; i < 300; i++) { const v = await port.taskView(id); if (v?.status === "terminal") return v; await new Promise(r => setTimeout(r, 10)); } throw new Error("Task did not settle"); }

describe("Pi 1.3.0 port conformance", () => {
  it("retains provider token counters in exported messages and reopened transcript snapshots", async () => {
    const { port, faux, dir } = await setup();
    const response = fauxAssistantMessage("Measured response");
    faux.setResponses([response]);
    await port.open(); await port.startScheduling();
    const cid = await port.createConversation({ requestId: "usage-conversation", agent: agent() });
    await port.submit(cid, input("Measure usage")); await port.waitIdle(cid);
    // Faux computes its own counters from the exact request/response strings.
    const expected = { input: 5, output: 5, cacheRead: 0, cacheWrite: 5, total: 15 };
    expect((await log(port, cid)).find(r => r.type === "message" && r.role === "assistant")).toMatchObject({ usage: expected });
    await port.close();
    const reopened = createAdapter({ dataDir: dir, models: { main: agent().model }, faux: true, readArtifact: async () => { throw new Error("Unused"); } });
    resources.push({ port: reopened, dir }); await reopened.open();
    const watch = await reopened.watchConversation(cid);
    try {
      const snapshot = (await watch[Symbol.asyncIterator]().next()).value as ConversationFrame | undefined;
      expect(snapshot?.kind).toBe("snapshot");
      if (snapshot?.kind !== "snapshot") throw new Error("Expected snapshot");
      expect(snapshot.entries.find(entry => entry.kind === "assistant")).toMatchObject({ usage: expected });
    } finally { watch.close(); }
  });
  it("opens without scheduling; storage is locked and credentials are private", async () => {
    const { port, dir } = await setup(); await port.open();
    expect((await stat(join(dir, "credentials.json"))).mode & 0o777).toBe(0o600);
    const second = createAdapter({ dataDir: dir, models: { main: agent().model }, faux: true, readArtifact: async () => { throw new Error("late"); } });
    await expect(second.open()).rejects.toThrow(/locked/); await second.close();
    const cid = await port.createConversation({ requestId: "conversation-create", agent: agent() });
    await expect(port.submit(cid, input("paused"))).rejects.toThrow(/startScheduling/);
    await port.startScheduling(); await port.submit(cid, input("ready")); await port.waitIdle(cid);
    expect((await log(port, cid)).some(r => r.type === "message" && r.role === "assistant")).toBe(true);
  });
  it("harness transactions roll back document writes and audit together, and every expired operation rejects", async () => {
    const { port } = await setup(); await port.open();
    const cid = await port.createConversation({ requestId: "transaction-root", agent: agent() }); let captured!: StateTransaction;
    await expect(port.transact(async tx => { captured = tx; await tx.put({ family: "session", key: "rollback" }, { value: 1 }); await tx.appendAudit(cid, { type: "notice", at: "2026-10-01T00:00:00Z", level: "info", message: "rollback" }); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect(await port.read.get({ family: "session", key: "rollback" })).toBeUndefined(); expect(await log(port, cid)).toEqual([]);
    await expect(port.transact(tx => tx.put({ family: "request", key: "invalid-json" }, { value: Number.NaN }))).rejects.toThrow();
    expect(await port.read.get({ family: "request", key: "invalid-json" })).toBeUndefined();
    for (const op of [() => captured.get({ family: "session", key: "x" }), () => captured.list("session"), () => captured.put({ family: "session", key: "x" }, {}), () => captured.delete({ family: "session", key: "x" }), () => captured.appendAudit(cid, { type: "notice", at: "2026-10-01T00:00:00Z", level: "info", message: "late" }), () => captured.startTask({ shell: "x", input: {}, owner: { conversation: cid }, requestId: "late-task" })]) await expect(op()).rejects.toThrow(/ended/);
  });
  it("passive writes place at once when idle and superseding data preserves request and image, with historical context", async () => {
    const { port } = await setup(); await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "data-conversation", agent: agent() });
    const receipt = await port.submit(cid, { ...input("keep this request"), content: [{ type: "text", text: "keep this request" }, { type: "image", artifact: "image-id", file: "x.png", mime: "image/png" }, data("old", "old-item"), { ...data("unaffected", "other-item"), role: "material" }] }); await port.waitIdle(cid);
    const at = { conversation: cid, entry: receipt.entry!, ordinal: 0 };
    const delivered = await port.deliver(cid, { requestId: "refresh-new-data", blocks: [data("new", "new-item")], edits: [{ item: "old-item", action: "omit" }] });
    expect(delivered.status).toBe("placed");
    const text = JSON.stringify((await port.contextAt(cid)).messages);
    expect(text).toContain("keep this request"); expect(text).toContain("unaffected"); expect(text).toContain('image-id'); expect(text).not.toContain('old\\n</research-data>'); expect(text).toContain("new");
    const old = JSON.stringify((await port.contextAt(cid, at)).messages); expect(old).toContain("old"); expect(old).not.toContain('new-item');
  });
  it("A: sections record changes and removals; input data supersedes only at placement and export is stable", async () => {
    const { port, faux } = await setup(); let section: string | undefined = "kernel v1";
    port.registerInstructionSection({ key: "kernel", render: async () => section });
    const seen: string[] = []; faux.setResponses(Array.from({ length: 10 }, () => context => { seen.push(JSON.stringify(context.messages)); return fauxAssistantMessage("answer"); }));
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "probe-a-conversation", agent: agent([], ["kernel"]) });
    await port.submit(cid, { ...input("first"), content: [{ type: "text", text: "first" }, data("old", "data-first")] }); await port.waitIdle(cid);
    const cutoff = (await log(port, cid)).at(-1)!.cursor;
    section = "kernel v2";
    await port.submit(cid, { ...input("second"), content: [{ type: "text", text: "second" }, data("new", "data-second")] }); await port.waitIdle(cid);
    expect(seen[1]).toContain("new"); expect(seen[1]).not.toContain('old\\n</research-data>'); expect(seen[1]).toContain("first");
    section = undefined; await port.submit(cid, input("third")); await port.waitIdle(cid);
    const records = await log(port, cid); for (const record of records) expect(ExportLine.safeParse(record).success).toBe(true);
    expect(records.filter(r => r.type === "audit" && r.event.type === "instruction-rendering").map(r => r.type === "audit" && r.event)).toEqual(expect.arrayContaining([expect.objectContaining({ text: null, bytes: 0 })]));
    const before: LogRecord[] = []; for await (const r of port.readLog(cid, { cutoff })) before.push(r);
    expect(before).toEqual(records.filter(r => Number(r.cursor.entry) <= Number(cutoff.entry)));
  });
  it("steer places after tool round, follow-up after final answer; queued data never enters the running turn", async () => {
    const { port, faux } = await setup(); const started = deferred(); const release = deferred(); const seen: string[] = [];
    port.registerTool({ name: "slow", description: "slow read", parameters: { type: "object", properties: {} }, replay: "safe", execute: async () => { started.resolve(); await release.promise; return { content: [{ type: "text", text: "read complete" }] }; } });
    faux.setResponses([fauxAssistantMessage(fauxToolCall("slow", {}), { stopReason: "toolUse" }), ...Array.from({ length: 5 }, (): FauxResponseStep => context => { seen.push(JSON.stringify(context.messages)); return fauxAssistantMessage("final"); })]);
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "boundary-conversation", agent: agent(["slow"]) });
    await port.submit(cid, input("initial")); await started.promise;
    const steer = await port.submit(cid, { ...input("steer"), delivery: "steer" });
    const follow = await port.submit(cid, { ...input("follow"), content: [{ type: "text", text: "follow" }, data("QUEUED-ONLY", "follow-data")] });
    expect(steer.status).toBe("admitted"); expect(follow.status).toBe("admitted"); expect(JSON.stringify((await port.contextAt(cid)).messages)).not.toContain("QUEUED-ONLY");
    release.resolve(); await port.waitIdle(cid);
    expect(seen[0]).toContain("steer"); expect(seen[0]).not.toContain("QUEUED-ONLY"); expect(seen[1]).toContain("QUEUED-ONLY");
    const records = await log(port, cid); const position = (text: string) => records.findIndex(r => r.type === "message" && r.content.some(b => b.type === "text" && b.text === text));
    expect(position("steer")).toBeLessThan(position("final")); expect(position("follow")).toBeGreaterThan(position("final"));
  });
  it("B: task shells own workers, wait allSettled, cancel a sibling, commit child creation atomically and reject completing owners", async () => {
    const { port } = await setup(); let captured!: TaskShellContext; const live = deferred(); const finish = deferred();
    port.registerTaskShell({ name: "worker", version: 1, initial: () => ({}), phase: async () => { live.resolve(); await finish.promise; return { done: "worker-result" }; } });
    port.registerTaskShell({ name: "controller", version: 1, initial: () => ({ phase: "spawn" }), phase: async (state, context) => {
      captured = context;
      if (state.phase === "spawn") {
        const child = await context.createConversation("worker", agent()); await context.submit(child, input("work")); await context.waitIdle(child);
        const worker = await context.transact(tx => tx.startTask({ shell: "worker", input: {}, owner: { task: context.task }, requestId: `${context.task}:integration` }));
        return { done: { worker } };
      }
      return { done: "unreachable" };
    } });
    await port.open(); const cid = await port.createConversation({ requestId: "task-root-conversation", agent: agent() });
    const controller = await port.startTask({ shell: "controller", input: {}, owner: { conversation: cid }, requestId: "start-controller" });
    await port.startScheduling(); await live.promise;
    const owner = await port.taskView(controller); expect(owner?.status).toBe("completing");
    await expect(port.transact(tx => tx.startTask({ shell: "worker", input: {}, owner: { task: controller }, requestId: "completing-owner" }))).rejects.toThrow();
    finish.resolve(); expect((await terminal(port, controller)).outcome).toBe("ok");
    expect(await port.read.get({ family: "request", key: "unused" })).toBeUndefined();
    for (const op of [() => captured.read.get({ family: "session", key: "x" }), () => captured.startTask("late", "worker", {}), () => captured.waitIdle(cid), () => captured.outcomes([])]) await expect(op()).rejects.toThrow(/ended/);
  });
  it("C/E: hooks are barriers, deferred tools load, yield can continue, and tool handles expire", async () => {
    const { port, faux } = await setup(); let captured!: ToolContext; const order: string[] = []; let yields = 0;
    port.registerTool({ name: "read_source", deferred: true, callers: ["model"], description: "safe read", parameters: { type: "object", properties: {} }, replay: "safe", execute: async (_args, context) => { captured = context; order.push("execute"); await context.transact(tx => tx.put({ family: "request", key: "tool-write" }, { ok: true })); return { content: [{ type: "text", text: "evidence" }] }; } });
    port.registerTool({ name: "load", description: "load deferred", parameters: { type: "object", properties: {} }, replay: "safe", execute: async () => ({ content: [], control: { loadTools: ["read_source"] } }) });
    port.registerHooks({ beforeTool: async () => { await new Promise(r => setTimeout(r, 10)); order.push("hook"); return undefined; }, onYield: async () => yields++ === 0 ? { continue: "Verify the limit" } : undefined });
    faux.setResponses([fauxAssistantMessage(fauxToolCall("load", {}), { stopReason: "toolUse" }), fauxAssistantMessage(fauxToolCall("read_source", {}), { stopReason: "toolUse" }), fauxAssistantMessage("partial"), fauxAssistantMessage("FINAL")]);
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "hook-conversation", agent: { ...agent(["load"]), deferredTools: ["read_source"] } });
    await port.submit(cid, input("check")); await port.waitIdle(cid); expect(order).toEqual(["hook", "hook", "execute"]);
    expect((await log(port, cid)).some(r => r.type === "message" && r.content.some(b => b.type === "text" && b.text === "Verify the limit"))).toBe(true);
    await expect(captured.transact(async () => {})).rejects.toThrow(/ended/); await expect(captured.read.list("request")).rejects.toThrow(/ended/); expect(() => captured.progress("late")).toThrow(/ended/);
  });
});

describe("compaction and observation", () => {
  it("summarizes selected edited messages and records application only after the queued summary is placed", async () => {
    const { port, faux } = await setup(); const started = deferred(); const release = deferred(); let summarized = "";
    port.registerTool({ name: "hold", description: "hold", replay: "safe", parameters: { type: "object", properties: {} }, execute: async () => { started.resolve(); await release.promise; return { content: [{ type: "text", text: "finished" }] }; } });
    port.registerHooks({ beforeCompact: async input => { summarized = JSON.stringify(input.messages); expect(input.firstKept).toBeTruthy(); expect(input.reason).toBe("manual"); return { summary: "Active task: compare. Researcher decision: use A. Action: waiting." }; } });
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "compact-conversation", agent: agent(["hold"]) });
    await port.submit(cid, { ...input("earlier"), content: [{ type: "text", text: "earlier" }, data("old", "compact-old")] }); await port.waitIdle(cid);
    await port.deliver(cid, { requestId: "compact-refresh-new", blocks: [data("new", "compact-new")], edits: [{ item: "compact-old", action: "omit" }] });
    await port.submit(cid, input("some more discussion")); await port.waitIdle(cid);
    faux.setResponses([fauxAssistantMessage(fauxToolCall("hold", {}), { stopReason: "toolUse" }), fauxAssistantMessage("final")]);
    await port.submit(cid, input("now hold")); await started.promise;
    const compact = await port.compact(cid, { requestId: "compact-request-id", instructions: "preserve decisions" });
    expect((await terminal(port, compact.task)).outcome).toBe("ok");
    expect(summarized).toContain("new"); expect(summarized).not.toContain('old\\n</research-data>');
    expect((await log(port, cid)).some(r => r.type === "audit" && r.event.type === "compaction-applied")).toBe(false);
    release.resolve(); await port.waitIdle(cid);
    const records = await log(port, cid); const applied = records.filter(r => r.type === "audit" && r.event.type === "compaction-applied"); expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ event: { compaction: compact.task } });
    expect(await port.compact(cid, { requestId: "compact-request-id", instructions: "preserve decisions" })).toEqual(compact);
    expect(JSON.stringify((await port.contextAt(cid)).messages)).toContain("Researcher decision: use A");
  });
  it("watches begin with snapshots, retain a fault reason, and stop on close", async () => {
    const { port } = await setup(); port.registerTaskShell({ name: "broken", version: 1, initial: () => ({}), phase: async () => { throw new Error("explicit task failure reason"); } });
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "watch-conversation", agent: agent() });
    const watch = await port.watchConversation(cid); const iterator = watch[Symbol.asyncIterator](); expect((await iterator.next()).value).toMatchObject({ kind: "snapshot", state: "idle", compacting: false });
    const task = await port.startTask({ shell: "broken", input: {}, owner: { conversation: cid }, requestId: "watch-broken-task" }); await terminal(port, task);
    let problem;
    for (let i = 0; i < 30; i++) { const frame = (await iterator.next()).value; if (frame?.kind === "problem") { problem = frame; break; } }
    expect(problem).toMatchObject({ kind: "problem", subject: { task }, reason: "explicit task failure reason" });
    watch.close(); while (!(await iterator.next()).done) { /* drain committed snapshots */ }
    const tasks = await port.watchTasks(); const snapshots = tasks[Symbol.asyncIterator](); expect((await snapshots.next()).value).toMatchObject({ kind: "snapshot", tasks: expect.arrayContaining([expect.objectContaining({ id: task, outcome: "failed" })]) }); tasks.close(); await snapshots.return?.();
  });
  it("shell wait joins allSettled, abort defaults to an aborted outcome, and retry creates a new retained task", async () => {
    const { port } = await setup(); const parked = deferred(); const release = deferred();
    port.registerTaskShell({ name: "short", version: 1, initial: input => ({ input }), phase: async state => state.input === "fail" ? { failed: "domain failure" } : { done: "evidence" } });
    port.registerTaskShell({ name: "join-controller", version: 1, initial: () => ({ phase: "spawn" }), phase: async (state, context) => {
      if (state.phase === "spawn") {
        const a = await context.startTask("a", "short", "fail"); const b = await context.startTask("b", "short", "ok");
        return { wait: { tasks: [a, b], policy: "allSettled" }, next: { phase: "join", tasks: [a, b] } };
      }
      const outcomes = await context.outcomes(state.tasks as string[]); await context.transact(tx => tx.put({ family: "request", key: "joined" }, { outcomes })); return { done: outcomes };
    } });
    port.registerTaskShell({ name: "park", version: 1, initial: () => ({}), phase: async (_state, context) => { parked.resolve(); await Promise.race([release.promise, new Promise<void>(resolve => context.signal.addEventListener("abort", () => resolve(), { once: true }))]); return { done: "parked" }; } });
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "join-conversation", agent: agent() });
    const owner = await port.startTask({ shell: "join-controller", input: {}, owner: { conversation: cid }, requestId: "join-controller-start" }); expect((await terminal(port, owner)).outcome).toBe("ok");
    expect(await port.read.get({ family: "request", key: "joined" })).toMatchObject({ outcomes: [expect.objectContaining({ status: "failed" }), expect.objectContaining({ status: "ok" })] });
    const task = await port.startTask({ shell: "park", input: {}, owner: { conversation: cid }, requestId: "park-task-start" }); await parked.promise; await port.abortTask(task); expect((await terminal(port, task)).outcome).toBe("aborted");
    release.resolve(); const retry = await port.retryTask(task, "park-task-retry"); expect(retry.retryOf).toBe(task); expect(retry.task).not.toBe(task); expect((await terminal(port, retry.task)).retryOf).toBe(task);
  });
});

describe("boundary regressions", () => {
  it("preserves arbitrary section names and artifact references across reopen, with stable input receipts", async () => {
    const { port, dir } = await setup();
    port.registerInstructionSection({ key: "aitp.kernel@1", render: async () => "Kernel body" });
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "reopen-identity-request", agent: agent([], ["aitp.kernel@1"]) });
    const original = { ...input("image request"), content: [{ type: "text" as const, text: "image request" }, { type: "image" as const, artifact: "persisted-image", file: "image.png", mime: "image/png" as const }, data("old", "reopen-data")] };
    const receipt = await port.submit(cid, original); await port.waitIdle(cid); expect(await port.submit(cid, original)).toEqual(receipt);
    await expect(port.submit(cid, { ...original, content: [{ type: "text", text: "different" }] })).rejects.toThrow("request_reused");
    await port.close();
    const reopened = createAdapter({ dataDir: dir, models: { main: agent().model }, faux: true, readArtifact: async () => { throw new Error("Reopen must use recorded image bytes"); } });
    resources.push({ port: reopened, dir }); await reopened.open(); await reopened.startScheduling();
    expect(await reopened.submit(cid, original)).toEqual(receipt);
    await reopened.deliver(cid, { requestId: "reopen-data-refresh", blocks: [data("new", "reopen-new")], edits: [{ item: "reopen-data", action: "omit" }] });
    const context = JSON.stringify((await reopened.contextAt(cid)).messages); expect(context).toContain("persisted-image"); expect(context).toContain("image request"); expect(context).not.toContain('old\\n</research-data>');
    expect((await log(reopened, cid)).some(r => r.type === "audit" && r.event.type === "instruction-rendering" && r.event.section === "aitp.kernel@1")).toBe(true);
  });
  it("passive delivery from a tool awaits admission, while queued edits to the same entry accumulate", async () => {
    const { port, faux } = await setup(); const entered = deferred(); const release = deferred(); let admission = "";
    port.registerTool({ name: "refresh", description: "refresh from a tool", replay: "safe", parameters: { type: "object", properties: {} }, execute: async (_args, context) => {
      const receipt = await port.deliver(context.conversation, { requestId: "inside-tool-delivery", blocks: [data("inside", "inside-data")], edits: [{ item: "first-old", action: "omit" }] });
      admission = receipt.status; entered.resolve(); await release.promise; return { content: [{ type: "text", text: "tool finished" }] };
    } });
    faux.setResponses([fauxAssistantMessage(fauxToolCall("refresh", {}), { stopReason: "toolUse" }), fauxAssistantMessage("final")]);
    await port.open(); await port.startScheduling(); const cid = await port.createConversation({ requestId: "inside-tool-conversation", agent: agent(["refresh"]) });
    await port.submit(cid, { ...input("preserve request"), content: [{ type: "text", text: "preserve request" }, data("old", "first-old"), { ...data("other old", "second-old"), role: "material" }] }); await entered.promise;
    expect(admission).toBe("admitted");
    await port.deliver(cid, { requestId: "second-queued-delivery", blocks: [{ ...data("other new", "second-new"), role: "material" }], edits: [{ item: "second-old", action: "replace", pointer: "Second item superseded; see current version" }] });
    release.resolve(); await port.waitIdle(cid);
    const context = JSON.stringify((await port.contextAt(cid)).messages); expect(context).toContain("preserve request"); expect(context).toContain("Second item superseded"); expect(context).not.toContain('old\\n</research-data>'); expect(context).not.toContain('other old\\n</research-data>');
  });
  it("task creation and its binding roll back together; failFast aborts unfinished siblings", async () => {
    const { port } = await setup();
    port.registerTaskShell({ name: "fail-child", version: 1, initial: () => ({}), phase: async () => ({ failed: "expected failure" }) });
    port.registerTaskShell({ name: "sleep-child", version: 1, initial: () => ({}), phase: async (_state, context) => { await new Promise<void>(r => context.signal.addEventListener("abort", () => r(), { once: true })); return { done: "unexpected" }; } });
    port.registerTaskShell({ name: "fail-fast", version: 1, initial: () => ({ phase: "spawn" }), phase: async (state, context) => {
      if (state.phase === "spawn") { const a = await context.startTask("a", "fail-child", {}); const b = await context.startTask("b", "sleep-child", {}); return { wait: { tasks: [a, b], policy: "failFast" }, next: { phase: "finish", tasks: [a, b] } }; }
      const outcomes = await context.outcomes(state.tasks as string[]); await context.transact(tx => tx.put({ family: "request", key: "fail-fast-results" }, { outcomes })); return { done: "joined" };
    } });
    await port.open(); const cid = await port.createConversation({ requestId: "atomic-task-conversation", agent: agent() }); let rolledBack = "";
    const spec = { shell: "fail-child", input: {}, owner: { conversation: cid }, requestId: "atomic-task-create" };
    await expect(port.transact(async tx => { rolledBack = await tx.startTask(spec); await tx.appendAudit(cid, { type: "notice", level: "info", at: "2026-10-01T00:00:00Z", message: "must roll back" }); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect(await port.taskView(rolledBack)).toBeUndefined(); expect(await log(port, cid)).toEqual([]);
    const committed = await port.startTask(spec); expect(await port.startTask(spec)).toBe(committed); expect(committed).not.toBe(rolledBack);
    await port.startScheduling(); const owner = await port.startTask({ shell: "fail-fast", input: {}, owner: { conversation: cid }, requestId: "fail-fast-controller" }); expect((await terminal(port, owner)).outcome).toBe("ok");
    expect((await port.read.get({ family: "request", key: "fail-fast-results" }))?.outcomes).toEqual([expect.objectContaining({ status: "failed" }), expect.objectContaining({ status: "aborted" })]);
  });
});
