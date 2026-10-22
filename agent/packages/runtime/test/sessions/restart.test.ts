import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createFixtureWorkspace } from "@aitp/test-support";
import { child, marker } from "../../../pi-adapter/test/process.ts";

for (const boundary of ["before", "after"] as const) it(`restart ${boundary} placement preserves preparation, receipt, active task and a single input`, async () => {
  const f = await createFixtureWorkspace(); await mkdir(f.dataDir, { recursive: true });
  const descriptor = join(f.dataDir, "fixture.json"); await writeFile(descriptor, JSON.stringify(f));
  const script = fileURLToPath(new URL("./boundary-child.ts", import.meta.url));
  const run = await child(script, [descriptor, "run", boundary]); let resume: Awaited<ReturnType<typeof child>> | undefined;
  try {
    await marker(join(f.dataDir, "ready"), join(f.dataDir, "error.txt"));
    run.process.kill("SIGKILL"); expect((await run.done).signal).toBe("SIGKILL");
    resume = await child(script, [descriptor, "resume", boundary]);
    await marker(join(f.dataDir, "after.json"), join(f.dataDir, "error.txt"));
    expect(await resume.done).toEqual({ code: 0, signal: null });
    const before = JSON.parse(await readFile(join(f.dataDir, "before.json"), "utf8")); const after = JSON.parse(await readFile(join(f.dataDir, "after.json"), "utf8"));
    expect(before.receipt.status).toBe(boundary === "before" ? "admitted" : "placed");
    expect(after.receipt).toEqual(before.receipt); expect(after.before.request).toContain(boundary === "before" ? "BASELINE" : "NEW-TASK"); expect(after.active.request).toContain("NEW-TASK");
    const prepared = (r: typeof before) => r.requests.items.find((v: { key: string }) => v.key.endsWith(":boundary-new-task-request")).value.prepared;
    expect(prepared(after)).toEqual(prepared(before));
    expect(after.records.filter((r: { type: string; purpose?: string; content?: { type: string; text?: string }[] }) => r.type === "message" && r.purpose === "task" && r.content?.some(b => b.type === "text" && b.text?.startsWith("NEW-TASK")))).toHaveLength(1);
  } finally {
    if (run.process.exitCode === null && run.process.signalCode === null) run.process.kill("SIGKILL"); await run.done;
    if (resume) { if (resume.process.exitCode === null && resume.process.signalCode === null) resume.process.kill("SIGKILL"); await resume.done; }
    await f.cleanup();
  }
}, 20000);
