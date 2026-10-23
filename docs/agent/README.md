# The AITP research agent

AITP grows from a protocol into a research agent with a desktop-style workbench. Two layers divide the work:

- **DeepSeek Harness** supplies the application infrastructure: plugin composition, model/tool execution, sessions, Web and Electron hosts.
- **AITP** supplies the scientific methodology, research memory, knowledge structure and workflows.

The same Skills that guide Claude Code and Codex today guide this agent. The researcher's notes remain the
scientific authority.

New contributors should start with [current.md](../../current.md) for open design and
implementation issues, then use the repository-local
[develop-aitp-agent Skill](../../.agents/skills/develop-aitp-agent/SKILL.md) for the reading
and maintenance workflow. Update relevant issues there in the same change as development
or architecture changes; the three documents below retain their existing responsibilities.

The [topic-centred redesign proposal](16-topic-centred-redesign.md) joins research philosophy, the state-change specification and navigation alternatives. Its [interactive prototype](prototype/topic-workspace/README.md) is a local simulation. The proposal requires design selection before production changes; 14 remains the owner of authorized scope and progress.

## Three maintained development documents

| Primary document | Role |
| --- | --- |
| [10 Target architecture](10-project-workspace.md) | Explain the completed product, added research value, components, connections, data ownership and coordinated workflows |
| [14 Development plan and progress](14-implementation-blueprint.md) | Own current implementation state, authorized work, dependencies, milestone evidence and the next decision |
| [13 Theoretical-physics cases](13-research-journeys.md) | Test the design against 22 concrete research situations and retain actual coverage, gaps and unsuitable behavior |

Read them together before development. [AGENTS.md](../../AGENTS.md) requires affected
architecture, progress and case passages to be updated in the same working change
when behavior or evidence changes. Do not update all three ceremonially or keep a
duplicate progress table here. The researcher requested this maintenance contract;
documentation remains part of the work, rather than a retrospective description.

For scenario-driven plugin work, start with the [cooperation map](10-project-workspace.md#scenario-plugin-map), then the [Skill applicability and feedback design](11-research-memory.md#skill-applicability) when a task involves method selection or distillation. The [independent development lines](14-implementation-blueprint.md#independent-development) own integration dependencies and implementation scope.

**Current collaboration:** Claude has delivered the UI design and [Harness-frame synthetic prototype](prototype/harness-frame/README.md). Codex owns incremental client/backend implementation and integration checks. The prototype does not establish application delivery or usability. Contributors should use the [development crosswalk](14-implementation-blueprint.md#development-crosswalk) and [single next-slice sequence](14-implementation-blueprint.md#next-implementation-slice). The [GPT reliability work](14-implementation-blueprint.md#gpt-integration-readiness) records researched failure reports and open regression targets; [case comparisons](13-research-journeys.md#comparative-evaluation) define AITP-agent versus Codex + the same AITP baseline and testing limits.

The W1/partial-W2 Pi implementation is preserved under `agent/`; active Harness development uses `packages/` and `apps/`. The researcher selected this host while retaining the scientific design. [14](14-implementation-blueprint.md#harness-migration) owns current authorized fork/naming/GPT work and the remaining research scope. [Harness evidence](../../agent/notes/harness-integration.md) records new checks. The retained [Pi integration notes](../../agent/notes/integration.md)
retain original test/live-pilot evidence and limitations. A schema, prototype or
reviewer's favorable verdict does not establish production or researcher acceptance.

## Supporting specifications and design evidence

| Document | Role |
| --- | --- |
| [11 Research memory](11-research-memory.md) | Source format, research objects, identity, relationships and migration limits |
| [12 Desktop interface](12-desktop-interface.md) | Screens, layout, navigation, selection and accessibility contracts |
| [Prototype](prototype/README.md) | Isolated synthetic interaction demonstration, screenshots and tested limits |
| [15 Design review](15-design-review.md) | Initial Astra critique, revisions and the evidence it actually covered |

## Earlier implementation references

01–09 retain valuable design and implementation detail. Use them through the current
architecture and plan: 10/14 supersede conflicting target/sequence decisions; their protocol schemas describe the retained Pi API, not the active Harness API. Consult [Harness architecture](../architecture.md) and [AITP service mapping](10-project-workspace.md#harness-service-mapping) for new implementation. None of these references
re-enables the disabled hash-related checks.

| Document | What it settles |
| --- | --- |
| [01 Vision and principles](01-vision-and-principles.md) | What the agent is, which AITP commitments it keeps, what version 1 must do, non-goals |
| [02 Earlier architecture](02-architecture.md) | Original package/runtime design and history; current target is 10 |
| [03 Research model](03-research-model.md) | How the workspace is read: locations, notes, Current work, instructions and plans, board, knowledge, works and editions, code, runs and campaigns, methods, episodes, documents |
| [04 Agent](04-agent.md) | Sessions and active tasks, instructions versus data, context assembly, tools, authorization and actions, external effects, cards, workers, review, compaction |
| [05 Workflows and learning](05-workflows-and-learning.md) | How reusable research workflows are found at the point of decision, used, corrected and internalized |
| [06 Workbench UX](06-workbench-ux.md) | Layout, views (derivation, formula–implementation–experiment, campaign, reader, literature, knowledge, manuscripts …), agent dock, interactions, the visual design system |
| [07 API](07-api.md) | The local HTTP and WebSocket interface between workbench and runtime |
| [08 Earlier implementation plan](08-implementation-plan.md) | Original W/M sequence, retained stream ownership and technical conventions; current plan is 14 |
| [09 Contracts](09-contracts.md) | A guide to the contract code (`agent/packages/protocol`, the `contracts.ts` modules) and the execution port's mapping onto pi-durable 1.3.0 |

Design history:

- The earlier runtime review is in the handoff package `aitp-workbench-handoff/docs/design/aitp-workbench/` on
  the researcher's machine. It chose route D: pi-ai and pi-durable under an AITP-owned runtime. The probes that
  support it are also there.
- Design round 1 with GPT-6 Astra raised twenty findings, all accepted. Round 2 required the contracts to become
  reviewed code before fan-out. The review records are kept privately.
- A private survey of the researcher's projects informed every requirement. It is not part of this
  repository, because it describes unpublished research; requirements cite it as "the survey".

## Repository layout

```text
aitp/               pinned AITP-Research-Protocol submodule; Skills under aitp/plugins/aitp/
packages/, apps/    active Harness application and plugin implementation
agent/             retained Pi npm workspace, fixtures and historical evidence
docs/agent/          this design
current.md          design holes and implementation gaps
.agents/skills/     repository-local development guidance
```

See the [root README](../../README.md) for cloning, active profiles and upstream ownership. The existing GitHub address is retained; an `upstream` Git remote and preserved official history do not by themselves change GitHub's fork-network metadata.
