// S1: wires the core modules into CoreServices (docs/agent/08 §2).
import { createHash } from "node:crypto";
import { createCheckoutService } from "./checkouts/index.ts";
import type { Clock, CoreDeps, CoreServices, Hasher, ReadArtifact } from "./contracts.ts";
import { createDocumentService } from "./documents/index.ts";
import { createEpisodeStore } from "./episodes/index.ts";
import { createDerivedIndex } from "./index/index.ts";
import { createKnowledgeService } from "./knowledge/index.ts";
import { createWorkspaceModel } from "./locations/index.ts";
import { createManuscriptService } from "./manuscripts/index.ts";
import { createMethodIndex } from "./methods/index.ts";
import { createWorkspaceFs } from "./paths/index.ts";
import { createRunService } from "./runs/index.ts";
import { createWorksService } from "./works/index.ts";

export const systemClock: Clock = { now: () => new Date() };

export const nodeHasher: Hasher = {
  sha256: (data) => `sha256:${createHash("sha256").update(data).digest("hex")}`,
};

/** `readArtifact` is a late callback into the runtime's artifact store; nothing calls it during construction. */
export function createCoreServices(deps: CoreDeps, options: { readArtifact: ReadArtifact }): CoreServices {
  const fs = createWorkspaceFs(deps);
  const index = createDerivedIndex({ ...deps, fs });
  const workspace = createWorkspaceModel({ ...deps, fs, index });
  const documents = createDocumentService({ ...deps, fs, workspace, readArtifact: options.readArtifact });
  const knowledge = createKnowledgeService({ ...deps, fs, index });
  const works = createWorksService({ ...deps, fs, knowledge });
  const checkouts = createCheckoutService({ ...deps, fs, index, workspace });
  const runs = createRunService({ ...deps, fs, workspace });
  const methods = createMethodIndex({ ...deps, fs, index, workspace });
  const episodes = createEpisodeStore(deps);
  const manuscripts = createManuscriptService({ ...deps, fs, workspace });
  return { config: deps.config, fs, index, workspace, documents, knowledge, works, checkouts, runs, methods, episodes, manuscripts };
}
