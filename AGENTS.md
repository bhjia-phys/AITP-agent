# Working on AITP-agent

This independent repository owns the research application under `agent/` and its
design under `docs/agent/`. The portable protocol is maintained upstream in
[AITP-Research-Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol), linked
by the pinned `aitp/` Git submodule. Its Skills are at `aitp/plugins/aitp/skills/`.
Application features do not become requirements for using those portable Skills.
Change protocol guidance upstream; do not maintain a second application-owned copy.

Keep the product simple. A substantive research-note revision requires knowing
its complete argument; ordinary recall reads the opening, Current work and only the
links it needs. Record
consequential changes, useful failures and corrected assumptions. No durable
change means no write. Teach reusable procedures directly as focused Skills.
Use ordinary relative links. README explains established material locations;
the main note develops the argument through linked detailed notes and assets.
Reuse those locations rather than imposing a directory template.

For changes here, read the applicable Skill. Keep README and manifests consistent
with the actual active surface. Validate affected Skill frontmatter, manifest
names and links. When a behavior changes, use a small concrete task that could
expose its failure; distinguish a walkthrough from an independent session.
Do not add a runtime or an evaluation framework merely to check Markdown.
Never infer scientific correctness or superiority from packaging checks.

Preserve unrelated changes, original research outputs and archived trial
observations. Public examples must be small, generic and self-contained. Keep
private research and its evaluation records outside the published tree and
outgoing commit history. Core Skills must not depend on workstation assets.

## AITP-agent development contract

For application design, development, review or resumption in this repository, start with
the repository-local [develop-aitp-agent Skill](.agents/skills/develop-aitp-agent/SKILL.md).
It explains the reading route through [current.md](current.md), the current plan and
task-relevant specifications/source. Reuse current reads; do not load every document
for each small task. This Skill is for this repository, not part of the portable
`aitp/plugins/aitp` research protocol.

Maintain these existing documents as the three primary development references:

- [Target architecture](docs/agent/10-project-workspace.md): component responsibilities,
  cooperation, data ownership, interfaces and the intended completed behavior.
- [Development plan and progress](docs/agent/14-implementation-blueprint.md): current
  authorized scope, milestone state, dependencies, acceptance evidence and remaining work.
- [Theoretical-physics cases](docs/agent/13-research-journeys.md): concrete user tasks,
  expected outcomes, actual coverage, failure examples and suitability review.

Before implementation, read the affected architecture and case plus the current plan.
Follow the agreed boundaries. When behavior, interfaces, scope, implementation status
or acceptance evidence changes, update the affected passages in the same working
change, before handoff or a completion claim. A behavior-changing contribution is
incomplete while its relevant documentation describes the old behavior. Do not add
ritual edits to unaffected documents or create a second progress ledger.

The researcher also requires [current.md](current.md) as the maintained entry for
design holes, implementation gaps and correction evidence. When development or a
design/architecture change alters those issues or their evidence, update its affected
passages in the same working change, before handoff. Explain the resolved scope and
remaining limits with links to the owning documents/code; do not mark an issue closed
from a mock or an unrelated passing test. Keep stage/progress ownership in 14.
Read-only work and changes that leave this account unaffected require no ceremonial edit.

If implementation needs a different architecture, resolve the consequential choice
and revise its owner before dependent work; documentation edits do not retrospectively
authorize scope expansion. Keep ordinary fixes within an authorized stage moving.
The plan owns stage priority and permission boundaries; an old W/M wave or a passing
test does not authorize the next stage. The repository extraction and publication
authorized on 2026-10-22 do not start P1; consult the plan and the current user request.

Protocol schemas and service contracts describe the implemented API; architecture
proposals describe the target. Record their gap explicitly until an approved change
updates both. Earlier design documents 01–09 and existing implementation notes remain
supporting references, not competing current plans. Detailed test receipts belong in
`agent/notes/`; link them from the plan and affected cases.

Distinguish inspected code, recorded checks, synthetic prototypes, executed reviews
and researcher acceptance. A stub, mock, queued review or successful job cannot mark
a research case accepted. Preserve the standing prohibition on all hash-related
checks. Preserve unrelated dirty work; no commit, push, reset, restore, migration or
real-note write is implied by updating these documents.
