import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { JsonObject, JsonValue } from "@aitp/protocol";
import type { AgentConfig, TaskShell, TaskShellResult } from "@aitp/runtime/contracts";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createAdapter } from "../../src/port.ts";

const waitFor = async (condition: () => Promise<boolean>) => { for (let n = 0; n < 500; n++) { if (await condition()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error("Controller did not reach its boundary"); };
const defaultAgent: AgentConfig = { model: { provider: "faux", modelId: "deriver" }, tools: [], sections: [], deferredTools: [] };

it("B: three owned workers, cancellation and completion-order integration under a live controller", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aitp-controller-"));
  const faux = fauxProvider({ models: ["deriver", "checker", "reviewer"].map(id => ({ id })), tokensPerSecond: Infinity });
  faux.setResponses(Array.from({ length: 60 }, () => (messages, _options, _state, model) => {
    if (model.id === "deriver") return fauxAssistantMessage("DERIVATION: convention A");
    if (messages.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("CHECK: convention B; disagreement remains open");
    return fauxAssistantMessage(fauxToolCall("slow_read", { role: model.id }), { stopReason: "toolUse" });
  }));
  const port = createAdapter({ dataDir: dir, models: { main: defaultAgent.model }, faux: true, readArtifact: async () => { throw new Error("unused"); } }, { faux });
  let releaseChecker!: () => void; const checker = new Promise<void>(r => { releaseChecker = r; });
  const entered = new Set<string>();
  port.registerTool({ name: "slow_read", description: "Controlled read", parameters: { type: "object", properties: { role: { type: "string" } }, required: ["role"] }, replay: "safe", execute: async (args, context) => {
    const role = String(args.role); entered.add(role);
    await Promise.race([role === "checker" ? checker : new Promise<void>(() => {}), new Promise<void>(resolve => context.signal.addEventListener("abort", () => resolve(), { once: true }))]);
    return { content: [{ type: "text", text: "source inspected" }] };
  } });
  for (const role of ["deriver", "checker", "reviewer"]) port.registerInstructionSection({ key: role, render: async () => `Role: ${role}. Keep unresolved disagreement explicit.` });
  port.registerTaskShell({ name: "integration", version: 1, initial: input => ({ ...input as JsonObject, phase: "wait" }), phase: async (state, context) => {
    if (state.phase === "wait" && state.predecessor) return { wait: { tasks: [String(state.predecessor)], policy: "allSettled" }, next: { ...state, phase: "write" } };
    await context.transact(async tx => {
      const trace = await tx.get({ family: "integration", key: "trace" }) ?? { roles: [] };
      const roles = trace.roles as string[];
      if (!roles.includes(String(state.role))) await tx.put({ family: "integration", key: "trace" }, { roles: [...roles, String(state.role)] });
    });
    return { done: { integrated: state.role! } };
  } });
  port.registerTaskShell({ name: "worker", version: 1, initial: input => input as JsonObject, phase: async (state, context) => {
    const role = String(state.role); const conversation = await context.createConversation("worker", { ...defaultAgent, model: { provider: "faux", modelId: role }, tools: role === "deriver" ? [] : ["slow_read"], sections: [role] });
    await context.submit(conversation, { purpose: "task", delivery: "follow-up", requestId: "research-role-task", content: [{ type: "text", text: `Investigate as ${role}` }] });
    await context.waitIdle(conversation);
    await context.transact(async tx => {
      const existing = await tx.get({ family: "integration", key: context.task }); if (existing) return;
      const controller = await tx.get({ family: "controller", key: String(state.controller) }) ?? {};
      const task = await tx.startTask({ shell: "integration", input: { role, predecessor: controller.tail ?? null }, owner: { task: String(state.controller) }, requestId: `integration:${context.task}` });
      await tx.put({ family: "integration", key: context.task }, { task, predecessor: controller.tail ?? null, conversation });
      await tx.put({ family: "controller", key: String(state.controller) }, { ...controller, tail: task });
    });
    return { done: { role, conversation } };
  } });
  const controllerShell: TaskShell = { name: "controller", version: 1, initial: () => ({ phase: "spawn" }), phase: async (state, context): Promise<TaskShellResult<JsonObject, JsonValue>> => {
    if (state.phase === "spawn") {
      const workers: Record<string, string> = {};
      for (const role of ["deriver", "checker", "reviewer"]) workers[role] = await context.startTask(role, "worker", { role, controller: context.task });
      await context.transact(async tx => { const current = await tx.get({ family: "controller", key: context.task }) ?? {}; await tx.put({ family: "controller", key: context.task }, { ...current, workers }); });
      return { wait: { tasks: Object.values(workers), policy: "allSettled" }, next: { phase: "tail", workers } };
    }
    if (state.phase === "tail") {
      const controller = await context.read.get({ family: "controller", key: context.task });
      const outcomes = await context.outcomes(Object.values(state.workers as Record<string, string>));
      await context.transact(tx => tx.put({ family: "request", key: "controller-outcomes" }, { outcomes }));
      if (controller?.tail) return { wait: { tasks: [String(controller.tail)], policy: "allSettled" }, next: { phase: "finish" } };
    }
    return { done: { disagreement: "Convention A versus B remains open for the researcher" } };
  } };
  port.registerTaskShell(controllerShell);
  try {
    await port.open(); await port.startScheduling(); const root = await port.createConversation({ requestId: "controller-root-request", agent: defaultAgent });
    const controller = await port.startTask({ shell: "controller", input: {}, owner: { conversation: root }, requestId: "controller-start-request" });
    await waitFor(async () => entered.has("checker") && entered.has("reviewer") && ((await port.read.get({ family: "integration", key: "trace" }))?.roles as string[] | undefined)?.includes("deriver") === true);
    const record = (await port.read.get({ family: "controller", key: controller }))!;
    const workers = record.workers as Record<string, string>;
    expect((await port.taskView(controller))?.status).toBe("waiting");
    expect((await port.read.get({ family: "integration", key: "trace" }))?.roles).toEqual(["deriver"]);
    await port.abortTask(workers.reviewer!); releaseChecker();
    await waitFor(async () => (await port.taskView(controller))?.status === "terminal");
    expect((await port.taskView(controller))?.outcome).toBe("ok");
    expect((await port.read.get({ family: "integration", key: "trace" }))?.roles).toEqual(["deriver", "checker"]);
    expect((await port.read.get({ family: "request", key: "controller-outcomes" }))?.outcomes).toEqual(expect.arrayContaining([expect.objectContaining({ task: workers.reviewer, status: "aborted" })]));
    const firstLink = (await port.read.get({ family: "integration", key: workers.deriver! }))!;
    const nextLink = (await port.read.get({ family: "integration", key: workers.checker! }))!;
    expect(nextLink.predecessor).toBe(firstLink.task); expect((await port.taskView(String(nextLink.task)))?.owner).toEqual({ task: controller });
  } finally { releaseChecker(); await port.close(); await rm(dir, { recursive: true, force: true }); }
});

it("C: evidence routes a durable loop to a convention check or a numerical check and retains unresolved choices", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aitp-evidence-loop-"));
  const port = createAdapter({ dataDir: dir, models: { main: defaultAgent.model }, faux: true, readArtifact: async () => { throw new Error("unused"); } });
  port.registerTaskShell({ name: "evidence-loop", version: 1, initial: input => ({ phase: "derive", scenario: input }), phase: async (state, context) => {
    if (state.phase === "derive") {
      // Small explicit evidence policy, rather than a fixed pipeline: each next phase depends on the finding.
      const finding = state.scenario === "agree" ? "agreement" : "discrepancy";
      const next = finding === "agreement" ? "numerical" : "convention";
      return { next: { ...state, phase: next, trail: [finding, next] } };
    }
    const result: JsonObject = state.phase === "numerical" ? { decision: "bounded numerical check", stopping: "two converging steps", trail: state.trail! }
      : { decision: "waiting-researcher", options: ["Use convention A", "Use convention B", "Keep qualified disagreement"], trail: state.trail! };
    // A bounded external completion is available independently of a generation conversation.
    const reply = await port.models().complete({ model: defaultAgent.model, system: "Critique only the stated finding.", content: [{ type: "text", text: JSON.stringify(result) }], maxOutputTokens: 100 });
    await context.transact(tx => tx.put({ family: "request", key: `loop:${state.scenario}` }, { ...result, critique: reply.text }));
    return { done: result };
  } });
  try {
    await port.open(); await port.startScheduling(); const root = await port.createConversation({ requestId: "loop-root-request", agent: defaultAgent });
    for (const scenario of ["discrepancy", "agree"]) {
      const task = await port.startTask({ shell: "evidence-loop", input: scenario, owner: { conversation: root }, requestId: `evidence-loop:${scenario}` });
      await waitFor(async () => (await port.taskView(task))?.status === "terminal"); expect((await port.taskView(task))?.outcome).toBe("ok");
    }
    expect(await port.read.get({ family: "request", key: "loop:discrepancy" })).toMatchObject({ decision: "waiting-researcher", options: expect.any(Array), trail: ["discrepancy", "convention"] });
    expect(await port.read.get({ family: "request", key: "loop:agree" })).toMatchObject({ decision: "bounded numerical check", trail: ["agreement", "numerical"] });
    const records = []; for await (const r of port.readLog(root)) records.push(r); expect(records.some(r => r.type === "message" && r.role === "assistant")).toBe(false);
  } finally { await port.close(); await rm(dir, { recursive: true, force: true }); }
});

for (const execution of ["parallel", "sequential"] as const) it(`C: ${execution} tool rounds, per-step thinking and a retryable faux failure`, async () => {
  const dir = await mkdtemp(join(tmpdir(), "aitp-step-policy-"));
  const faux = fauxProvider({ models: ["careful", "fast"].map(id => ({ id, reasoning: true })), tokensPerSecond: Infinity });
  const calls: { model: string; thinking?: string }[] = []; let errors = 0;
  faux.setResponses(Array.from({ length: 30 }, () => (context, options, _state, model) => {
    calls.push({ model: model.id, thinking: options?.reasoning });
    if (model.id === "fast") return fauxAssistantMessage("Independent route checked.");
    if (errors++ === 0) return fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded" });
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Both files checked.");
    return fauxAssistantMessage([fauxToolCall("read_source", { file: "one" }), fauxToolCall("read_source", { file: "two" })], { stopReason: "toolUse" });
  }));
  const port = createAdapter({ dataDir: dir, models: { main: { provider: "faux", modelId: "careful" } }, faux: true, readArtifact: async () => { throw new Error("unused"); } },
    { faux, settings: { toolExecution: execution, retry: { enabled: true, maxRetries: 2, baseDelayMs: 1 } } });
  const spans: { start: number; end: number }[] = [];
  port.registerTool({ name: "read_source", description: "Read source", parameters: { type: "object", properties: { file: { type: "string" } }, required: ["file"] }, replay: "safe", execute: async () => {
    const span = { start: Date.now(), end: 0 }; spans.push(span); await new Promise(resolve => setTimeout(resolve, 30)); span.end = Date.now();
    return { content: [{ type: "text", text: "source convention retained" }] };
  } });
  try {
    await port.open(); await port.startScheduling();
    for (const modelId of ["careful", "fast"]) {
      const conversation = await port.createConversation({ requestId: `step-model:${modelId}`, agent: { ...defaultAgent, model: { provider: "faux", modelId, thinkingLevel: modelId === "careful" ? "high" : "low" }, tools: ["read_source"] } });
      const receipt = await port.submit(conversation, { purpose: "task", delivery: "follow-up", requestId: `step-input:${modelId}`, content: [{ type: "text", text: "Check the convention" }] });
      await port.waitIdle(conversation); expect((await port.submission(conversation, receipt.submission)).status).toBe("settled");
    }
    expect(calls.filter(c => c.model === "careful").length).toBeGreaterThanOrEqual(3);
    expect(calls).toContainEqual({ model: "careful", thinking: "high" }); expect(calls).toContainEqual({ model: "fast", thinking: "low" });
    expect(spans).toHaveLength(2);
    if (execution === "parallel") expect(spans[1]!.start).toBeLessThan(spans[0]!.end);
    else expect(spans[1]!.start).toBeGreaterThanOrEqual(spans[0]!.end);
  } finally { await port.close(); await rm(dir, { recursive: true, force: true }); }
});
