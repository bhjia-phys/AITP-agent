import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { child, marker } from "../process.ts";

describe("SIGKILL recovery on native SQLite with faux", () => {
  for (const [replay, controller] of [["safe", ""], ["unsafe", ""], ["safe", "controller"]] as const) it(`${replay} tool ${controller} has the correct replay rule and submission is not duplicated`, async () => {
    const dir = await mkdtemp(join(tmpdir(), `aitp-crash-${replay}-`)); const script = fileURLToPath(new URL("./crash-child.ts", import.meta.url));
    const run = await child(script, [dir, "run", replay, controller]); let resume: Awaited<ReturnType<typeof child>> | undefined;
    try {
      await marker(join(dir, "ready"), join(dir, "error.txt"));
      await marker(join(dir, "receipt.json"), join(dir, "error.txt"));
      expect(run.process.kill("SIGKILL")).toBe(true); expect((await run.done).signal).toBe("SIGKILL");
      resume = await child(script, [dir, "resume", replay, controller]); expect(await resume.done).toEqual({ code: 0, signal: null });
      expect((await readFile(join(dir, "hooks"), "utf8")).trim().split("\n")).toHaveLength(1);
      const attempts = (await readFile(join(dir, "attempts"), "utf8")).trim().split("\n"); expect(attempts).toHaveLength(replay === "safe" ? 2 : 1);
      const result = JSON.parse(await readFile(join(dir, "result.json"), "utf8"));
      expect(result.receipt.submission).toBe(result.first.submission);
      if (controller) { expect(result.controller).toMatchObject({ status: "terminal", outcome: "ok" }); expect((await readFile(join(dir, "controller-attempts"), "utf8")).trim().split("\n")).toHaveLength(2); }
      expect(result.records.filter((r: { type: string; purpose?: string }) => r.type === "message" && r.purpose === "task")).toHaveLength(1);
      expect(JSON.stringify(result.records)).toMatch(replay === "safe" ? /read reran and completed/ : /interrupted/i);
    } finally {
      if (run.process.exitCode === null && run.process.signalCode === null) run.process.kill("SIGKILL"); await run.done;
      if (resume) { if (resume.process.exitCode === null && resume.process.signalCode === null) resume.process.kill("SIGKILL"); await resume.done; }
      await rm(dir, { recursive: true, force: true });
    }
  }, 15000);
});
