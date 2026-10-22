import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureWorkspace } from "@aitp/test-support";
import { createFixtureWorkspace } from "@aitp/test-support";
import type { CoreServices } from "@aitp/core/contracts";
import type { Hash, InstructionSource, Outline, ResearchLocation, ResourceRef } from "@aitp/protocol";
import type { ExecutionPort, RuntimeDeps, RuntimeServices } from "../../src/contracts.ts";
import { createSessionService } from "../../src/sessions/index.ts";
import { createContextService, createInstructionSections } from "../../src/context/index.ts";
import { createCardService } from "../../src/cards/index.ts";
import { createHooks } from "../../src/compaction/index.ts";
import { createInteractionTools } from "../../src/tools/interaction/index.ts";
import { NotImplementedError } from "../../src/not-implemented.ts";

export const branch = "topics/spectra/selfconsistent/stability/research.md";
const parents = ["topics/spectra/selfconsistent/research.md", "topics/spectra/continuation/research.md"];
export const sha256 = (data: string | Uint8Array) => `sha256:${createHash("sha256").update(data).digest("hex")}` as Hash;
const at = "2026-10-01T00:00:00Z";
export async function fixture(makePort: (dataDir: string) => ExecutionPort, existing?: FixtureWorkspace) {
  const workspace = existing ?? await createFixtureWorkspace();
  const source = async (path: string) => { const text = await readFile(join(workspace.root, path), "utf8"); return { text, version: { observedAt: at } }; };
  const outlines = new Map<string, Outline>();
  // Explicit hand-built outlines; this fake never imports or invokes a core implementation.
  for (const path of [branch, ...parents]) {
    const file = await source(path); const lines = file.text.split("\n"); const end = lines.findIndex(l => l === "## Current work");
    outlines.set(path, { location: path, version: file.version, format: "markdown", title: lines[0]!.slice(2), opening: { span: { startLine: 1, endLine: end - 1 }, text: lines.slice(0, end - 1).join("\n") }, headings: [], anchors: [],
      currentWork: path === branch ? { span: { startLine: 8, endLine: 16 }, entries: [] } : null, links: [], plans: [], scope: [], warnings: [] });
  }
  const locations: ResearchLocation[] = [...outlines.values()].map(o => ({ id: o.location, kind: o.location === branch ? "branch" : "topic", format: "markdown", title: o.title, parents: o.location === branch ? parents : [], children: [], groupings: [], scope: [], source: "link", version: o.version }));
  const instructionFile = await source("topics/AGENTS.md");
  const instructions: InstructionSource[] = [{ kind: "workspace", appliesTo: { location: branch }, ref: { kind: "file", address: { kind: "workspace", path: "topics/AGENTS.md" }, version: instructionFile.version }, text: instructionFile.text }];
  const unavailable = () => { throw new NotImplementedError("Explicit unavailable core fake"); };
  const core = {
    config: workspace.config,
    fs: { readText: async (address: ResourceRef["address"]) => {
      if (address.kind !== "absolute" && address.kind !== "workspace") throw new Error("fake only supports files");
      const text = await readFile(address.kind === "workspace" ? join(workspace.root, address.path) : address.path, "utf8");
      return { text, version: { observedAt: at } };
    } },
    workspace: { outline: async (path: string) => { const o = outlines.get(path); if (!o) throw new Error(`Unknown fake outline ${path}`); return structuredClone(o); }, locations: async () => locations,
      instructions: async () => instructions,
      whereUsed: async () => parents.map((path, i) => ({ relation: "pointer", passage: `Parent ${i + 1} uses the static stability branch with the stated condition.`, user: { kind: "note", address: { kind: "workspace", path }, version: outlines.get(path)!.version, locator: { kind: "lines", start: 1, end: 2 } } })),
    },
    methods: { list: unavailable, read: unavailable },
    knowledge: { areas: unavailable, indexExcerpt: unavailable },
    episodes: { query: unavailable }, works: { edition: unavailable }, checkouts: { list: unavailable },
  } as unknown as CoreServices;
  const port = makePort(workspace.dataDir);
  const deps: RuntimeDeps = { core, port, dataDir: workspace.dataDir, clock: { now: () => new Date(at) }, hasher: { sha256 } };
  let services!: RuntimeServices; const get = () => services;
  services = { core, port, sessions: createSessionService(deps, get), context: createContextService(deps, get), cards: createCardService(deps, get) } as RuntimeServices;
  for (const section of createInstructionSections(deps, get)) port.registerInstructionSection(section);
  port.registerHooks(createHooks(deps, get));
  for (const definition of createInteractionTools(services)) port.registerTool(definition.tool);
  await port.open(); await port.startScheduling();
  const session = await services.sessions.create({ location: branch, kind: "research", mode: "continue", requestId: "fixture-session-create" });
  return { ...workspace, core, port, services, session, deps, outlines, instructions,
    async bump() {
      const old = outlines.get(branch)!; const text = (await source(branch)).text.replace("Two of three", "VERSION-TWO: Two of three");
      await writeFile(join(workspace.root, branch), text); const version = { observedAt: at };
      outlines.set(branch, { ...old, version, opening: { ...old.opening, text: old.opening.text.replace("Two of three", "VERSION-TWO: Two of three") } });
    },
    async cleanup() { await port.close(); await workspace.cleanup(); },
  };
}
