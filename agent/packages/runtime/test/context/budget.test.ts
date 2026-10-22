import { afterEach, expect, it } from "vitest";
import { createPiExecutionPort } from "@aitp/pi-adapter";
import { fixture, branch } from "../conformance/fixture.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
const make = (dataDir: string) => createPiExecutionPort({ dataDir, models: { main: { provider: "faux", modelId: "faux-1" } }, faux: true, readArtifact: async () => { throw new Error("Unused"); } });
it("budgets instructions, tools, history, data and reserve, and uses a pointer for oversized data", async () => {
  const f = await fixture(make); cleanup.push(f.cleanup);
  const outline = f.outlines.get(branch)!; outline.opening.text = "Long evidence. ".repeat(100000);
  const result = await f.services.context.prepare(f.session.id, { purpose: "task", delivery: "follow-up", requestId: "budget-pointer-request", content: [{ type: "text", text: "Inspect the branch" }] });
  const budget = result.manifest.budget;
  expect(budget.instructions).toBeGreaterThan(0); expect(budget.tools).toBeGreaterThan(0); expect(budget.reserve).toBeGreaterThan(0);
  expect(budget.instructions + budget.tools + budget.history + budget.data + budget.reserve).toBeLessThanOrEqual(budget.limit);
  expect(result.manifest.items.some(i => i.status === "pointer")).toBe(true);
  expect(JSON.stringify(result.input)).toContain("Read current source");
  const records = []; for await (const r of f.port.readLog(f.session.conversation)) records.push(r);
  expect(records.some(r => r.type === "message")).toBe(false); // prepare submits nothing.
});
it("reports unavailable sources, never replacing them with an empty successful result", async () => {
  const f = await fixture(make); cleanup.push(f.cleanup);
  await f.services.sessions.update(f.session.id, { mode: "theory", requestId: "budget-theory-mode" });
  const result = await f.services.context.prepare(f.session.id, { purpose: "task", delivery: "follow-up", requestId: "unavailable-source-request", content: [{ type: "text", text: "Derive the limiting case" }] });
  expect(result.manifest.omitted).toContainEqual(expect.objectContaining({ ref: expect.objectContaining({ kind: "knowledge" }), reason: "unavailable" }));
  expect(result.manifest.items.some(i => i.role === "knowledge")).toBe(false);
});
