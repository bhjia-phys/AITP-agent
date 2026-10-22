// S1: wires the runtime services (docs/agent/08 §2).
import { createActionService } from "./actions/index.ts";
import { createArtifactStore } from "./artifacts/index.ts";
import { createCardService } from "./cards/index.ts";
import { createContextService } from "./context/index.ts";
import type { RuntimeDeps, RuntimeServices } from "./contracts.ts";
import { createWorkerService } from "./controllers/index.ts";
import { createEffectService } from "./effects/index.ts";
import { createManuscriptReviewService } from "./manuscripts/index.ts";
import { createMethodUseService } from "./methods/index.ts";
import { createReviewService } from "./review/index.ts";
import { createSandboxService } from "./sandbox/index.ts";
import { createSessionService } from "./sessions/index.ts";
import { createResearchService } from "./tools/research/index.ts";

export function createRuntime(deps: RuntimeDeps): RuntimeServices {
  let services: RuntimeServices | undefined;
  const get = (): RuntimeServices => {
    if (!services) throw new Error("runtime services are used before composition finished");
    return services;
  };
  services = {
    core: deps.core,
    port: deps.port,
    actions: createActionService(deps, get),
    sandbox: createSandboxService(deps, get),
    artifacts: createArtifactStore(deps, get),
    effects: createEffectService(deps, get),
    cards: createCardService(deps, get),
    context: createContextService(deps, get),
    sessions: createSessionService(deps, get),
    reviews: createReviewService(deps, get),
    workers: createWorkerService(deps, get),
    methodUse: createMethodUseService(deps, get),
    manuscriptReview: createManuscriptReviewService(deps, get),
    research: createResearchService(deps, get),
  };
  return services;
}
