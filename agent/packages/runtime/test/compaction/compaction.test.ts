import { afterEach, expect, it } from "vitest";
import type { InputSubmission, ModelMessage } from "@aitp/protocol";
import { scriptedPort } from "../../../pi-adapter/test/scripted.ts";
import { fixture, branch } from "../conformance/fixture.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
const options = (dataDir: string) => ({ dataDir, models: { main: { provider: "faux", modelId: "faux-1" } }, faux: true, readArtifact: async () => { throw new Error("Unused image"); } });
const input = (text: string, requestId: string, purpose: InputSubmission["purpose"] = "task"): InputSubmission => ({ purpose, requestId, delivery: "follow-up", content: [{ type: "text", text }] });
const until = async (test: () => Promise<boolean>) => { for (let i = 0; i < 300; i++) { if (await test()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error("Condition did not become true"); };

it("AITP summary uses CompactionInput.messages, keeps control state, and automatically redelivers only after application", async () => {
  const summaryRequests: ModelMessage[][] = [];
  const f = await fixture(dir => scriptedPort(options(dir), messages => {
    if (messages.some(m => m.role === "system" && m.text.startsWith("Summarize the selected"))) { summaryRequests.push(messages); return "Decision retained; action waiting; follow the owning note pointers."; }
    return "Observed with the stated conditions.";
  })); cleanup.push(f.cleanup);
  await f.services.sessions.submit(f.session.id, input("Compare the authorized alternatives", "summary-first-task")); await f.port.waitIdle(f.session.conversation);
  await f.services.sessions.submit(f.session.id, input("I choose definition A", "summary-decision-id", "interjection")); await f.port.waitIdle(f.session.conversation);
  await f.port.transact(tx => tx.put({ family: "action", key: "summary-action" }, { id: "summary-action", session: f.session.id, state: "approved", targets: [branch] }));
  await f.bump(); await f.services.context.refresh(f.session.id, [branch]);
  await f.services.sessions.submit(f.session.id, input("What remains?", "summary-more-context", "interjection")); await f.port.waitIdle(f.session.conversation);
  const compact = await f.services.sessions.compact(f.session.id, { requestId: "summary-compact-id", instructions: "Keep decisions and pending action states" });
  await until(async () => (await f.services.context.manifest(f.session.id))?.afterCompaction === compact.task);
  expect(summaryRequests).toHaveLength(1);
  const source = JSON.stringify(summaryRequests[0]); expect(source).toContain("VERSION-TWO");
  const records = []; for await (const r of f.port.readLog(f.session.conversation)) records.push(r);
  const summary = records.find(r => r.type === "compaction-summary"); expect(summary).toBeDefined();
  expect(JSON.stringify(summary)).toContain("Compare the authorized alternatives"); expect(JSON.stringify(summary)).toContain("I choose definition A"); expect(JSON.stringify(summary)).toContain("approved");
  const applied = records.findIndex(r => r.type === "audit" && r.event.type === "compaction-applied");
  expect(applied).toBeGreaterThanOrEqual(0);
  const manifest = (await f.services.context.manifest(f.session.id))!; const deliveryIds = new Set(manifest.items.filter(i => i.channel === "data" && i.status !== "superseded").map(i => i.id));
  const reDelivered = records.findIndex((r, i) => i > applied && r.type === "message" && r.content.some(b => b.type === "data" && deliveryIds.has(b.item)));
  expect(reDelivered).toBeGreaterThan(applied);
  const once = manifest.id; expect((await f.services.context.afterCompaction(f.session.id, compact.task)).id).toBe(once);
});

it("status mode and analyticOnly deny execution before a tool invocation", async () => {
  let attempts = 0;
  const f = await fixture(dir => scriptedPort(options(dir), messages => messages.at(-1)?.role === "tool" ? "Execution was blocked." : { tool: "run", args: {} })); cleanup.push(f.cleanup);
  f.port.registerTool({ name: "run", description: "Execution probe", replay: "unsafe", parameters: { type: "object", properties: {} }, execute: async () => { attempts++; return { content: [{ type: "text", text: "executed" }] }; } });
  await f.port.configure(f.session.conversation, { tools: ["run"] });
  await f.services.sessions.update(f.session.id, { mode: "status", requestId: "status-mode-update" });
  await f.services.sessions.submit(f.session.id, input("Status", "status-execution-probe", "interjection")); await f.port.waitIdle(f.session.conversation);
  expect(attempts).toBe(0);
  await f.services.sessions.update(f.session.id, { mode: "continue", requestId: "continue-mode-update" });
  const outline = f.outlines.get(branch)!;
  outline.scope = [{ flag: "analyticOnly", location: branch, source: { kind: "note", address: { kind: "workspace", path: branch }, version: outline.version } }];
  await f.services.sessions.submit(f.session.id, input("Continue analysis", "scope-execution-probe")); await f.port.waitIdle(f.session.conversation);
  expect(attempts).toBe(0);
  expect(JSON.stringify((await f.port.contextAt(f.session.conversation)).messages)).toContain("Execution is excluded");
});
