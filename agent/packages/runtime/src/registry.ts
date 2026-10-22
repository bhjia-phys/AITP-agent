// S1: registers tools, instruction sections, hooks and task shells with the execution port.
// Tools that can need authority are wrapped so that it is enforced inside execute() (docs/agent/04 §6).
import { createHooks } from "./compaction/index.ts";
import { createInstructionSections } from "./context/index.ts";
import type { RuntimeDeps, RuntimeServices } from "./contracts.ts";
import { createControllerTaskShells } from "./controllers/index.ts";
import { createReviewTaskShells } from "./review/index.ts";
import { createInteractionTools } from "./tools/interaction/index.ts";
import { createResearchTools } from "./tools/research/index.ts";
import { createWorkspaceTools } from "./tools/workspace/index.ts";

/**
 * `read-only` (milestone M1) registers only tools that need no authority; `full` registers every tool, wrapping
 * those with a policy.
 */
export function registerRuntime(
  deps: RuntimeDeps,
  services: RuntimeServices,
  profile: "full" | "read-only" = "full",
): void {
  const get = () => services;
  for (const section of createInstructionSections(deps, get)) deps.port.registerInstructionSection(section);
  deps.port.registerHooks(createHooks(deps, get));
  for (const shell of [...createControllerTaskShells(deps, get), ...createReviewTaskShells(deps, get)]) {
    deps.port.registerTaskShell(shell);
  }
  const definitions = [...createInteractionTools(services), ...createWorkspaceTools(services), ...createResearchTools(services)];
  for (const { tool, policy } of definitions) {
    if (policy && profile === "read-only") continue;
    deps.port.registerTool(policy ? services.actions.wrap(tool, policy) : tool);
  }
}
