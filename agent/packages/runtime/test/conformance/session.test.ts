import { afterEach, describe, expect, it } from "vitest";
import { ExportLine, ContextManifest, CardResponse } from "@aitp/protocol";
import type { InputSubmission, ModelMessage } from "@aitp/protocol";
import { createPiExecutionPort } from "@aitp/pi-adapter";
import { scriptedPort } from "../../../pi-adapter/test/scripted.ts";
import { fixture, branch } from "./fixture.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const options = (dataDir: string) => ({ dataDir, models: { main: { provider: "faux", modelId: "faux-1" } }, faux: true, readArtifact: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png" }) });
const input = (text: string, requestId: string, purpose: InputSubmission["purpose"] = "task"): InputSubmission => ({ content: [{ type: "text", text }], purpose, delivery: "follow-up", requestId });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

describe("sessions and aitp-memory@1 with explicit core fakes", () => {
  it("separates instructions from branch and parent data, persists preparation once and supersedes on the next input", async () => {
    const seen: ModelMessage[][] = [];
    const f = await fixture(dir => scriptedPort(options(dir), messages => { seen.push(messages); return "Answer."; })); cleanups.push(f.cleanup);
    const first = input("Explain the static map", "first-request-id");
    const receipt = await f.services.sessions.submit(f.session.id, first); await f.port.waitIdle(f.session.conversation);
    expect(seen).toHaveLength(1);
    const system = seen[0]!.filter(m => m.role === "system").map(m => m.text).join("\n");
    expect(system).toContain("## The research cycle"); expect(system).toContain("## Timing and recovery"); expect(system).toContain("## Close the task visibly"); expect(system).toContain(f.instructions[0]!.text);
    const user = JSON.stringify(seen[0]!.filter(m => m.role === "user"));
    expect(user).toContain('<research-data source=\\"topics/spectra/selfconsistent/stability/research.md'); expect(user).toContain("Alternative static definitions"); expect(user).toContain("Parent 1 uses"); expect(user).toContain("Parent 2 uses");
    const manifest = (await f.services.context.manifest(f.session.id))!; expect(ContextManifest.safeParse(manifest).success).toBe(true);
    expect(manifest.items.filter(i => i.channel === "data").every(i => i.ref.version?.observedAt)).toBe(true); expect(manifest.omitted).toContainEqual(expect.objectContaining({ reason: "unavailable" }));
    await f.bump();
    const repeated = await f.services.sessions.submit(f.session.id, first); expect(repeated).toEqual(receipt); expect(seen).toHaveLength(1);
    await expect(f.services.sessions.submit(f.session.id, input("different", first.requestId))).rejects.toMatchObject({ code: "request_reused" });
    await f.services.sessions.submit(f.session.id, input("Now what follows?", "second-request-id")); await f.port.waitIdle(f.session.conversation);
    const second = JSON.stringify(seen[1]!.filter(m => m.role === "user")); expect(second).toContain("VERSION-TWO");
    expect(second).not.toContain("Three of three"); expect(second).toContain("Explain the static map");
    const old = JSON.stringify((await f.port.contextAt(f.session.conversation, { conversation: f.session.conversation, entry: receipt.entry!, ordinal: 0 })).messages); expect(old).not.toContain("VERSION-TWO");
    const current = (await f.services.context.manifest(f.session.id))!; expect(current.items.some(i => i.status === "superseded")).toBe(true);
    expect(current.items.filter(i => i.channel === "data" && i.status !== "superseded").every(i => i.delivery?.entry)).toBe(true);
  });
  it("placed log entries are active-task authority through status, queued follow-up and continue", async () => {
    const entered = deferred(); const release = deferred(); let calls = 0;
    const f = await fixture(dir => scriptedPort(options(dir), async () => { if (++calls === 2) { entered.resolve(); await release.promise; } return "answer"; })); cleanups.push(f.cleanup);
    await f.services.sessions.submit(f.session.id, input("Study the authorized branch", "active-task-first")); await f.port.waitIdle(f.session.conversation);
    const active = (await f.services.sessions.get(f.session.id))!.activeTask!;
    await f.services.sessions.submit(f.session.id, input("Status please", "active-status-ask", "interjection")); await entered.promise;
    await f.bump(); const follow = await f.services.sessions.submit(f.session.id, input("New task after status", "active-task-follow")); expect(follow.status).toBe("admitted");
    expect((await f.services.sessions.get(f.session.id))!.activeTask).toEqual(active);
    expect(JSON.stringify((await f.port.contextAt(f.session.conversation)).messages)).not.toContain("VERSION-TWO");
    release.resolve(); await f.port.waitIdle(f.session.conversation);
    // Deliberately regress the cache; no watcher repairs it for this assertion.
    await f.port.transact(tx => tx.put({ family: "active-task", key: f.session.id }, { entry: "1", task: active }));
    const latest = (await f.services.sessions.get(f.session.id))!.activeTask!; expect(latest.request).toBe("New task after status");
    const placed = await f.port.submission(f.session.conversation, follow.submission);
    await f.port.transact(tx => tx.put({ family: "active-task", key: f.session.id }, { entry: placed.entry!, task: { ...latest, nextAction: "Check the remaining limiting condition" } }));
    await f.services.sessions.continue(f.session.id, "follow-up", "continue-request-id"); await f.port.waitIdle(f.session.conversation);
    const context = JSON.stringify((await f.port.contextAt(f.session.conversation)).messages); expect(context).toContain("Check the remaining limiting condition");
    expect((await f.services.sessions.get(f.session.id))!.activeTask!.id).toBe(latest.id);
  });
  it("exports schema-valid historical records with a stable cutoff", async () => {
    const f = await fixture(dir => createPiExecutionPort(options(dir))); cleanups.push(f.cleanup);
    await f.services.sessions.submit(f.session.id, input("Investigate", "export-request-id")); await f.port.waitIdle(f.session.conversation);
    const exportOnce = async () => { const lines: unknown[] = []; for await (const line of f.services.sessions.export(f.session.id)) lines.push(ExportLine.parse(JSON.parse(line))); return lines; };
    const first = await exportOnce(); const second = await exportOnce(); expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ schema: "aitp.workbench-log@1", location: branch });
    expect(first.some(l => (l as { event?: { type: string } }).event?.type === "context-delivery")).toBe(true);
    expect(first.some(l => (l as { event?: { type: string } }).event?.type === "instruction-rendering")).toBe(true);
  });
  it("posts a close report retaining a versioned source read from the workspace", async () => {
    let calls = 0;
    const f = await fixture(dir => scriptedPort(options(dir), () => ++calls === 1 ? { tool: "close_report", args: {
      supported: "The fixture condition is retained", retained: [{ kind: "note", address: { kind: "workspace", path: branch }, version: f.outlines.get(branch)!.version }], next: "Wait for the researcher",
    } } : "Reported with its frozen source.")); cleanups.push(f.cleanup);
    await f.services.sessions.submit(f.session.id, input("Retain the cited source", "close-frozen-ref")); await f.port.waitIdle(f.session.conversation);
    expect(calls).toBe(2);
    const card = (await f.services.cards.list(f.session.id)).find(card => card.type === "close");
    expect(card?.payload).toMatchObject({ retained: [{ version: f.outlines.get(branch)!.version }] });
  });
  it("required choice cards terminate the run; duplicate responses are idempotent and different responses fail", async () => {
    let calls = 0;
    const f = await fixture(dir => scriptedPort(options(dir), () => ++calls === 1 ? { tool: "ask_researcher", args: { question: "Which definition?", options: [{ id: "a", label: "A", consequence: "Use A" }, { id: "b", label: "B", consequence: "Use B" }] } } : "Researcher decision received.")); cleanups.push(f.cleanup);
    await f.services.sessions.submit(f.session.id, input("Resolve the choice", "card-task-request")); await f.port.waitIdle(f.session.conversation);
    expect(calls).toBe(1); const [card] = await f.services.cards.list(f.session.id, { open: true }); expect(card?.kind).toBe("required");
    expect((await f.services.sessions.get(f.session.id))?.activeTask?.status).toBe('waiting-researcher');
    await expect(f.services.sessions.continue(f.session.id, 'follow-up', 'choice-continue-without-answer')).rejects.toMatchObject({ code: 'denied' });
    const response = CardResponse.parse({ type: "choice", option: "a" });
    const answered = await f.services.cards.respond(card!.id, response, "card-response-id"); await f.port.waitIdle(f.session.conversation);
    expect((await f.services.sessions.get(f.session.id))?.activeTask?.status).toBe('active');
    expect(await f.services.cards.respond(card!.id, response, "card-response-id")).toEqual(answered);
    await expect(f.services.cards.respond(card!.id, { type: "choice", option: "b" }, "card-response-id")).rejects.toMatchObject({ code: "request_reused" });
    const events = []; for await (const r of f.port.readLog(f.session.conversation)) if (r.type === "audit" && r.event.type === "card-response") events.push(r);
    expect(events).toHaveLength(1);
  });
});

it("a required card terminates a parallel round containing other calls and an unavailable call", async () => {
  let calls = 0;
  const f = await fixture(dir => scriptedPort(options(dir), () => ++calls === 1 ? { tools: [
    { tool: "read_skill", args: { name: "aitp-memory" } },
    { tool: "ask_researcher", args: { question: "Choose the convention", options: [{ id: "a", label: "A", consequence: "Use A" }, { id: "b", label: "B", consequence: "Use B" }] } },
    { tool: "not_a_tool", args: {} },
  ] } : "Must not request another completion before the researcher responds.")); cleanups.push(f.cleanup);
  await f.services.sessions.submit(f.session.id, input("Stop at the decision", "parallel-card-request")); await f.port.waitIdle(f.session.conversation);
  expect(calls).toBe(1); expect((await f.services.cards.list(f.session.id, { open: true }))[0]?.kind).toBe("required");
  const records = []; for await (const r of f.port.readLog(f.session.conversation)) records.push(r);
  expect(records.filter(r => r.type === "tool-result")).toHaveLength(3);
  expect(records.some(r => r.type === "tool-result" && r.isError)).toBe(true);
});

it("plan and close tools validate their payloads and distinguish a required decision from an informational report", async () => {
  let calls = 0;
  const plan = { id: "plan-one", title: "Bounded comparison", steps: [{ id: "step-one", description: "Read both definitions" }], methods: [], cost: "one read", stopping: "Identify the deciding condition", grants: [] };
  const f = await fixture(dir => scriptedPort(options(dir), () => ++calls === 1 ? { tool: "propose_plan", args: plan }
    : calls === 2 ? { tool: "close_report", args: { supported: "The condition remains qualified", retained: [], next: "No further work is warranted" } } : "Reported.")); cleanups.push(f.cleanup);
  await f.services.sessions.submit(f.session.id, input("Propose the bounded plan", "plan-tool-request")); await f.port.waitIdle(f.session.conversation);
  expect(calls).toBe(1); const [card] = await f.services.cards.list(f.session.id, { open: true }); expect(card).toMatchObject({ type: "plan", kind: "required", payload: { plan } });
  await f.services.cards.respond(card!.id, { type: "plan", decision: "approve" }, "plan-response-id"); await f.port.waitIdle(f.session.conversation);
  expect(calls).toBe(3); expect((await f.services.cards.list(f.session.id)).find(c => c.type === "close")).toMatchObject({ kind: "informational", payload: { next: "No further work is warranted" } });
});
