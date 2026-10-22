// S1: the composition root and the startup order (docs/agent/02, process model; 08 §3).
// Full startup opens storage without scheduling, recovers change-set journals and action records, then starts
// scheduling. The read-only profile (milestone M1) starts fresh or reopens its own configuration-bound store.
// It refuses unknown/write-bearing stores and journals and registers only tools that need no authority.
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from "node:path";
import { createCoreServices, loadConfig, nodeHasher, systemClock } from "@aitp/core";
import { createPiExecutionPort } from "@aitp/pi-adapter";
import { createRuntime, registerRuntime } from "@aitp/runtime";
import type { RuntimeServices } from "@aitp/runtime/contracts";
import { createHttpServer } from "./app.ts";
import type { HttpServer } from "./contracts.ts";

export type StartProfile = "full" | "read-only";

export type RunningAgent = {
  services: RuntimeServices;
  server: HttpServer;
  url: string;
  profile: StartProfile;
  stop(): Promise<void>;
};

/** Existing state that requires a recognized read-only profile marker or refusal. */
export function hasWriteBearingState(dataDir: string): boolean {
  const nonEmpty = (dir: string) => existsSync(dir) && readdirSync(dir).length > 0;
  return existsSync(join(dataDir, "runtime.sqlite")) || nonEmpty(join(dataDir, "journal"));
}

export async function startAgent(options: {
  env: Record<string, string | undefined>;
  profile?: StartProfile;
  faux?: boolean;
  version: string;
  staticDir?: string;
}): Promise<RunningAgent> {
  const profile = options.profile ?? "full";
  const { config, dataDir, configPath } = await loadConfig(options.env);
  const marker = join(dataDir, 'profile.json');
  const configuration = JSON.stringify({ workspace: config.workspace, aitp: config.aitp });
  let resumable = false;
  let legacyMarker = false;
  try {
    const saved = JSON.parse(await readFile(marker, 'utf8'));
    // A legacy digest is never compared. Upgrade this local read-only marker on reopening.
    legacyMarker = saved.profile === 'read-only' && saved.configuration === undefined;
    resumable = saved.profile === 'read-only' && (legacyMarker || saved.configuration === configuration);
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Invalid startup profile marker'); }
  if (profile === 'read-only') {
    if (config.workspace.writeMode !== 'off') throw new Error('The read-only profile requires writeMode off');
    if (hasWriteBearingState(dataDir) && (!resumable || existsSync(join(dataDir, 'journal')) && readdirSync(join(dataDir, 'journal')).length > 0)) {
      throw new Error('Read-only startup refuses unknown runtime state or change-set journals');
    }
    await mkdir(dataDir, { recursive: true });
    if (!resumable || legacyMarker) await writeFile(marker, JSON.stringify({ profile, configuration }), { flag: legacyMarker ? 'w' : 'wx', mode: 0o600 });
  } else if (resumable) throw new Error('Use a separate data directory for full execution');

  let services: RuntimeServices | undefined;
  const readArtifact = async (artifact: string, file: string) => {
    if (!services) throw new Error("the artifact store was used before startup finished");
    const { file: meta, bytes } = await services.artifacts.read(artifact, file);
    return { bytes, mime: meta.mime };
  };
  const core = createCoreServices({ config, dataDir, clock: systemClock, hasher: nodeHasher }, { readArtifact });
  const port = createPiExecutionPort({ dataDir, models: config.models, faux: options.faux ?? false, readArtifact });
  const deps = { core, port, dataDir, clock: systemClock, hasher: nodeHasher };
  const composed = createRuntime(deps);
  services = composed;
  registerRuntime(deps, composed, profile);

  await port.open();
  try {
  if (profile === "full") {
    await core.documents.recover();
    await composed.actions.startupScan();
  }
  await port.startScheduling();

  const server = createHttpServer(composed, {
    host: "127.0.0.1",
    port: config.server.port,
    dataDir,
    faux: options.faux ?? false,
    version: options.version,
    configPath,
    profile,
    ...(options.staticDir ? { staticDir: options.staticDir } : {}),
  });
  const { url } = await server.listen();
  return {
    services: composed,
    server,
    url,
    profile,
    stop: async () => {
      try { await server.close(); } finally { await port.close(); }
    },
  };
  } catch (error) { await port.close(); throw error; }
}
