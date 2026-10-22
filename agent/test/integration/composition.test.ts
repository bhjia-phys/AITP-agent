// Composition exposes every service whatever the streams have implemented, and the read-only profile refuses
// existing write-bearing state (docs/agent/08 §3).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCoreServices, isNotImplemented, nodeHasher, notImplemented, systemClock } from "@aitp/core";
import { createRuntime, registerRuntime } from "@aitp/runtime";
import type { ExecutionPort, ToolSpec } from "@aitp/runtime/contracts";
import { hasWriteBearingState } from "@aitp/server";
import { createFixtureWorkspace } from "@aitp/test-support";
import { describe, expect, it } from "vitest";

function recordingPort() {
  const registered = { tools: [] as string[], sections: [] as string[], shells: [] as string[], hooks: 0 };
  const port = new Proxy({} as ExecutionPort, {
    get: (_target, property) => {
      switch (property) {
        case "registerTool":
          return (tool: ToolSpec) => registered.tools.push(tool.name);
        case "registerInstructionSection":
          return (section: { key: string }) => registered.sections.push(section.key);
        case "registerTaskShell":
          return (shell: { name: string }) => registered.shells.push(shell.name);
        case "registerHooks":
          return () => (registered.hooks += 1);
        default:
          return undefined;
      }
    },
  });
  return { port, registered };
}

const RUNTIME_SERVICES = [
  "core", "port", "research", "actions", "sandbox", "artifacts", "effects", "cards", "context", "sessions",
  "reviews", "workers", "methodUse", "manuscriptReview",
];
const CORE_SERVICES = ["config", "fs", "index", "workspace", "documents", "knowledge", "works", "checkouts", "runs", "methods", "episodes", "manuscripts"];

describe("composition", () => {
  it("exposes every core and runtime service and registers hooks once", async () => {
    const ws = await createFixtureWorkspace();
    try {
      const deps = { config: ws.config, dataDir: ws.dataDir, clock: systemClock, hasher: nodeHasher };
      const core = createCoreServices(deps, {
        readArtifact: async () => {
          throw new Error("not used during construction");
        },
      });
      expect(Object.keys(core).sort()).toEqual([...CORE_SERVICES].sort());
      const { port, registered } = recordingPort();
      const runtimeDeps = { core, port, dataDir: ws.dataDir, clock: systemClock, hasher: nodeHasher };
      const services = createRuntime(runtimeDeps);
      expect(Object.keys(services).sort()).toEqual([...RUNTIME_SERVICES].sort());
      registerRuntime(runtimeDeps, services, "read-only");
      expect(registered.hooks).toBe(1);
    } finally {
      await ws.cleanup();
    }
  });


});

describe("stand-ins", () => {
  it("fail on use with a recognizable error naming the missing member", () => {
    const stub = notImplemented<{ grants: { list(): Promise<unknown> } }>("S4 createActionService");
    let thrown: unknown;
    try {
      void stub.grants.list();
    } catch (error) {
      thrown = error;
    }
    expect(isNotImplemented(thrown)).toBe(true);
    expect(String(thrown)).toMatch(/not implemented: S4 createActionService\.grants\.list/);
  });

  it("are not thenable, so awaiting a stub does not hang", async () => {
    const stub = notImplemented<object>("S9 example");
    await expect(Promise.resolve(stub)).resolves.toBe(stub);
  });
});

describe("read-only profile", () => {
  it("refuses a data directory holding a runtime store or journals", async () => {
    const ws = await createFixtureWorkspace();
    try {
      mkdirSync(ws.dataDir, { recursive: true });
      expect(hasWriteBearingState(ws.dataDir)).toBe(false);
      mkdirSync(join(ws.dataDir, "journal"));
      expect(hasWriteBearingState(ws.dataDir)).toBe(false);
      writeFileSync(join(ws.dataDir, "journal", "cs-1.json"), "{}");
      expect(hasWriteBearingState(ws.dataDir)).toBe(true);
    } finally {
      await ws.cleanup();
    }
  });
});
