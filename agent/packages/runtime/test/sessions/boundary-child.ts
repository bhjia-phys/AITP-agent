import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureWorkspace } from "@aitp/test-support";
import { scriptedPort } from "../../../pi-adapter/test/scripted.ts";
import { fixture, branch } from "../conformance/fixture.ts";

const [descriptor, phase, boundary] = process.argv.slice(2) as [string, string, "before" | "after"];
const workspace = JSON.parse(await readFile(descriptor, "utf8")) as FixtureWorkspace;
workspace.cleanup = async () => {};
const dir = workspace.dataDir; let release!: () => void; const released = new Promise<void>(r => { release = r; });
try {
  const f = await fixture(dataDir => {
    const port = scriptedPort({ dataDir, models: { main: workspace.config.models.main }, faux: true, readArtifact: async () => { throw new Error("unused"); } }, messages => {
      const last = messages.at(-1);
      if (last?.role === "tool") return "Turn complete";
      const user = [...messages].reverse().find(m => m.role === "user");
      const text = JSON.stringify(user);
      return text.includes(boundary === "before" ? "HOLD-BASELINE" : "NEW-TASK") ? { tool: "slow", args: {} } : "Initial complete";
    });
    port.registerTool({ name: "slow", replay: "safe", parameters: { type: "object", properties: {} }, description: "Boundary crash read", execute: async () => {
      await appendFile(join(dir, "tool-attempts"), `${phase}\n`); await writeFile(join(dir, "tool-entered"), "ready"); await released;
      return { content: [{ type: "text", text: "read completed" }] };
    } });
    return port;
  }, workspace);
  await f.port.configure(f.session.conversation, { tools: ["slow"] });
  const original = { purpose: "task" as const, delivery: "follow-up" as const, requestId: "boundary-new-task-request", content: [{ type: "text" as const, text: "NEW-TASK: compare definitions" }] };
  if (phase === "run") {
    await f.services.sessions.submit(f.session.id, { purpose: "task", delivery: "follow-up", requestId: "boundary-first-task", content: [{ type: "text", text: "BASELINE: recover the branch" }] }); await f.port.waitIdle(f.session.conversation);
    if (boundary === "before") {
      await f.services.sessions.submit(f.session.id, { purpose: "interjection", delivery: "follow-up", requestId: "boundary-hold-input", content: [{ type: "text", text: "HOLD-BASELINE" }] });
      while (true) { try { await readFile(join(dir, "tool-entered")); break; } catch { await new Promise(r => setTimeout(r, 5)); } }
    }
    await f.bump();
    const receipt = await f.services.sessions.submit(f.session.id, original);
    if (boundary === "after") while (true) { try { await readFile(join(dir, "tool-entered")); break; } catch { await new Promise(r => setTimeout(r, 5)); } }
    const active = (await f.services.sessions.get(f.session.id))!.activeTask;
    const requests = await f.port.read.list("request", { prefix: `session-input:${f.session.id}:` });
    await writeFile(join(dir, "before.json"), JSON.stringify({ receipt, active, requests })); await writeFile(join(dir, "ready"), "admission boundary reached");
    await new Promise(() => {});
  } else {
    // The recovering tool remains blocked while we inspect the committed boundary and repeat the request.
    const before = (await f.services.sessions.get(f.session.id))!.activeTask;
    const requests = await f.port.read.list("request", { prefix: `session-input:${f.session.id}:` });
    await f.bump();
    const receipt = await f.services.sessions.submit(f.session.id, original);
    release(); await f.port.waitIdle(f.session.conversation);
    const active = (await f.services.sessions.get(f.session.id))!.activeTask;
    const records = []; for await (const r of f.port.readLog(f.session.conversation)) records.push(r);
    await writeFile(join(dir, "after.json"), JSON.stringify({ receipt, before, active, requests, records })); await f.port.close();
  }
} catch (error) { await writeFile(join(dir, "error.txt"), String(error)); process.exitCode = 1; }
