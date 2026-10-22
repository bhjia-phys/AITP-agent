import type { RuntimeServices, ToolDefinition } from "../../contracts.ts";
import { createWorkspaceTools } from "../workspace/index.ts";
import { createResearchTools } from "../research/index.ts";
import { createInteractionTools } from "./index.ts";

/** The same factories the S1 registry installs; discovery never invents unavailable tool names. */
export function toolCatalog(services: RuntimeServices): ToolDefinition[] {
  return [...createInteractionTools(services), ...createWorkspaceTools(services), ...createResearchTools(services)];
}
