// S4 (docs/agent/08 §2). Placeholder from W0; the owning stream replaces the body.
import type { CreateArtifactStore } from "../contracts.ts";
import { notImplemented } from "../not-implemented.ts";

export const createArtifactStore: CreateArtifactStore = () => notImplemented("S4 createArtifactStore");
