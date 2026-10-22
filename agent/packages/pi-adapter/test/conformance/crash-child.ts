import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { createAdapter } from "../../src/port.ts";

const [dir, phase, replay, controllerMode] = process.argv.slice(2) as [string, string, "safe" | "unsafe", string | undefined];
const faux = fauxProvider({ models: [{ id: "m" }], tokensPerSecond: Infinity });
faux.setResponses(Array.from({ length: 30 }, () => context => {
  const last = context.messages.at(-1);
  return last?.role === "toolResult" ? fauxAssistantMessage(`After tool: ${JSON.stringify(last.content)}`) : fauxAssistantMessage(fauxToolCall("slow_read", {}), { stopReason: "toolUse" });
}));
const port = createAdapter({ dataDir: dir, models: { main: { provider: "faux", modelId: "m" } }, faux: true, readArtifact: async () => { throw new Error("Unused image"); } }, { faux });
port.registerTool({ name: "slow_read", replay, description: "Read-only crash probe", parameters: { type: "object", properties: {} },
  async execute(_args, context) {
    await appendFile(join(dir, "attempts"), `${phase}\n`);
    if (phase === "run") {
      await writeFile(join(dir, "ready"), "tool entered");
      await new Promise<void>(resolve => context.signal.addEventListener("abort", () => resolve(), { once: true }));
    }
    return { content: [{ type: "text", text: "read reran and completed" }] };
  } });
port.registerHooks({ beforeTool: async () => { await appendFile(join(dir, "hooks"), `${phase}\n`); return undefined; } });
const agent = { model: { provider: "faux", modelId: "m" }, tools: ["slow_read"], deferredTools: [], sections: [] };
const request = { purpose: "task" as const, delivery: "follow-up" as const, requestId: "crash-input-request", content: [{ type: "text" as const, text: "read slowly" }] };
let worker = ""; let workerReceipt: unknown;
if (controllerMode) port.registerTaskShell({ name: "crash-controller", version: 1, initial: () => ({}), phase: async (_state, context) => {
  await appendFile(join(dir, "controller-attempts"), `${phase}\n`);
  worker = await context.createConversation("worker", agent);
  workerReceipt = await context.submit(worker, request);
  if (phase === "run") await writeFile(join(dir, "receipt.json"), JSON.stringify(workerReceipt));
  await context.waitIdle(worker);
  return { done: { worker } };
} });
try {
  await port.open();
  const conversation = await port.createConversation({ requestId: "crash-root-create", agent: { model: { provider: "faux", modelId: "m" }, tools: ["slow_read"], deferredTools: [], sections: [] } });
  let receipt;
  let controller: string | undefined;
  if (controllerMode) {
    controller = await port.startTask({ shell: "crash-controller", input: {}, owner: { conversation }, requestId: "crash-controller-start" });
    await port.startScheduling(); await port.waitIdle(conversation); receipt = workerReceipt;
  } else {
    await port.startScheduling(); receipt = await port.submit(conversation, request);
    if (phase === "run") await writeFile(join(dir, "receipt.json"), JSON.stringify(receipt));
    await port.waitIdle(conversation);
  }
  if (phase !== "run") {
    const first = JSON.parse(await readFile(join(dir, "receipt.json"), "utf8"));
    const records = []; for await (const record of port.readLog(controllerMode ? worker : conversation)) records.push(record);
    await writeFile(join(dir, "result.json"), JSON.stringify({ first, receipt, records, ...(controller ? { controller: await port.taskView(controller) } : {}) }));
  }
  await port.close();
} catch (error) { await writeFile(join(dir, "error.txt"), String(error)); process.exitCode = 1; }
