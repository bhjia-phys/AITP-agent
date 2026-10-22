# 14. Development plan and implementation progress

This is the maintained owner of **what is implemented, what is being developed, what comes next and what
evidence would justify moving on**. The [target architecture](10-project-workspace.md) explains how the
completed product works; the [physics cases](13-research-journeys.md) test whether those capabilities serve
actual research. Detailed execution and test receipts stay in the
[Pi integration account](../../agent/notes/integration.md) and [Harness integration evidence](../../agent/notes/harness-integration.md), linked here when they change a development judgment.
The documents have different jobs; this plan is not a second session log or a copy of the architecture.

**Current stage, 2026-10-22:** the researcher authorized moving the application base to official DeepSeek Harness, retaining the design and research principles, naming the product **aitp-agent**, and addressing GPT adaptation. The active migration is described [below](#harness-migration). The repository keeps its `bhjia-phys/AITP-agent` address; the Harness-derived branch retains official ancestry and the previous Pi repository history. The original Pi `main` and dirty worktrees remain preserved. [README](../../README.md) owns remotes, branch layout and startup; the [Harness receipt](../../agent/notes/harness-integration.md) owns executed checks and limits.

The host selection is settled. Modular core services, independently developable domains, editable rules, selective UI and portable AITP Skill ownership remain requirements. [10](10-project-workspace.md#harness-service-mapping) maps these domains onto Harness. The [development lines](#independent-development) separate work ownership from the P0–P5 research acceptance groups. They do not authorize all proposed features or real-note writing. The old Pi pilot and P0 prototype remain evidence only for their original scopes; no research case is automatically accepted on Harness.

The researcher also requires UI-editable writing/memory/collaboration rules and selective
information display. [10](10-project-workspace.md#editable-rules) owns rule provenance,
resolution and adoption; [12](12-desktop-interface.md#progressive-disclosure) owns the
three-entrance interface and disclosure behavior. The read-only slice can expose actual
rules and critical gaps. Persistent rule editing needs a separately bounded implementation
scope and real source-save/adoption path; adding controls cannot silently enable note or
upstream Skill writes. [C16](13-research-journeys.md#c16) retains the continuation checks.

**Confirmed architectural requirement:** the researcher explicitly requires modularity
for independent optimization and upgrade of core parts. This is no longer an open choice
between modular and inseparable implementation. The [architecture](10-project-workspace.md#plugin-composition)
owns contract, dependency and upgrade boundaries. Harness/Cordis is selected; concrete research-service interfaces, file ownership and the first research slice still need specification. The authorized host/GPT work does not by itself start the full P1 redesign or approve every proposed module split.

The P0–P5 groups retain their scientific acceptance meaning and the earlier proposed product ordering below. Independently selecting readers/desktop and bringing Markdown proposal/review forward remains the recommended sequencing alternative, not a researcher-approved reorder. Its technical dependencies are described in the development lines. Controlled apply still follows assessed review and the selected authoring policy. The old [W0–W6 sequence](08-implementation-plan.md#3-waves-and-milestones) and M1 results remain Pi history, not Harness release gates.

<a id="harness-migration"></a>
## Authorized Harness migration and GPT adaptation

**Scope in progress:** establish the official Harness-derived `harness` branch in the existing AITP repository, retain the old Pi implementation/history and portable `aitp/` submodule, apply aitp-agent product naming through supported application configuration, and adapt the selected GPT route using existing model/credential services. Use the normal Harness launcher/profile flow. Internal upstream package identities may remain unchanged to keep upgrades tractable; product naming is not a request to rewrite every package scope.

GPT work includes checking the provider and model route, API-key/OAuth capability distinctions, the credential login consumer, streamed responses/tool calls/cancellation, and the previously reported compaction behavior. Reuse fixes already present upstream instead of assuming the earlier symptom is still present. Source inspection, recorded/mock tests, actual login and live model calls are separate evidence. Do not claim a working login or live GPT run from a registered provider or passing unit test. Credentials stay local and absent from committed records.

**Current evidence:** the imported official source and fork were checked at the same revision, version `0.2.1-rc.2`. Product configuration, brand and terminal-auth plugins are implemented; artifact construction and aggregate type checks pass. Focused tests cover provider routes, synthetic authorization, terminal secret handling, launcher shutdown, same-mode sandbox escalation and nonshrinking summaries. The [Harness receipt](../../agent/notes/harness-integration.md) owns commands, counts and remaining checks. Actual ChatGPT authorization, live GPT requests and native packaged application checks remain unverified. Loading AITP Skills establishes method discovery only; the required research runtime integration below remains design work.

**Preserved limits:** this work does not migrate Pi runtime stores, modify real research notes, adopt a new note format, authorize scientific computations, enable unrestricted research-writing tools, or claim completion of P1–P5. Generic Harness tools may have effects under its own configuration; the imported application is not yet an accepted read-only AITP research profile. Use isolated synthetic/scratch work for adaptation checks. A future research profile must make its actual tools, memory delivery and applicable user instructions clear before use on research roots; it does not add a fixed scientific action order.

**Handoff and next research scope:** demonstrate startup/naming and the actually tested GPT path, retain any credential/platform limits, then select the bounded agreement/context/source integration needed for C01/C06/C16. Re-run the four old counterexamples against the new runtime when those services exist; host replacement alone closes none of them. Scientific qualifications and exact-source citations remain requirements; later writing policy remains undecided and must not be generalized into a ceremony for ordinary research actions.

<a id="runtime-integration-plan"></a>
## Development dependencies for runtime research memory

The researcher requires AITP integration into the underlying runtime and clarified that the central function is to prioritize useful research memory/context, with flexible agent-selected actions. A fixed action-constraint engine, mandatory reading-readiness gate or prescribed literature/derivation/code sequence is not the selected design. The [architecture](10-project-workspace.md#aitp-runtime-integration) owns the source-backed integration points. This section plans development; it does not authorize all research features or claim that loading Skills implements memory.

| Work area | Independently owned implementation | Dependency and integration evidence |
| --- | --- | --- |
| Memory/source access | Main/subnote reader, knowledge/paper/code adapters, locators, observed passages and missing-source information | Can develop against ordinary fixture files independently of models/UI. Preserve unknown structures and owner links; no required note migration |
| Working-memory continuity | Actual request and corrections, relevant prior results/failed routes, current gap and suggested next step | Use existing typed events/projections. Recover after compaction/restart without promoting a model summary to a user decision or making its next-step suggestion binding |
| Context selection and delivery | Configurable importance/relevance selection, explicit material choices, budget allocation, actual delivery and later availability | Consumes sources and working memory. Evaluate which useful facts reach the real request, including conditions easily lost during compaction; missing context is surfaced rather than a general action lock |
| Evidence feedback and maintenance | Feed reads/results back into observations, identify relevant corrections and candidate note updates, retain pending/no-change outcomes | The model/Skills decide whether to search, derive, compare, implement, review or write. No per-tool decision card or mandatory planning document |
| Collaboration UI | Inspect/edit remembered choices and guidance, adjust included sources, show consequential omissions and pending updates | Uses the same runtime projection as terminal work; optional technical details remain secondary. Does not turn every preference into an enforcement switch |
| Domain extensions | Literature, knowledge, Skill catalog/distillation and later code/run/manuscript views | Develop against shared resource/context/document APIs; richer readers and the native carrier need not define how memory works |

One integrator owns the minimum shared source/observation/task/projection definitions needed by the next example. Source access, working-memory continuity and UI can then develop against fixtures in parallel; context selection integrates their real outputs. Avoid a universal framework or permanent phase machine before this small path works.

**Proposed first runtime slice:** one main note and linked source in synthetic/scratch roots, with a critical assumption, a previously failed route and an explicit user correction. Verify that relevant facts reach the model before its next inference, survive two compactions/restart or are correctly reread, and remain distinguishable from generated suggestions. Remove a source and show the gap while the agent can choose useful follow-up work. Compare actual context and behavior with the same task lacking the contextual support: did it notice the limitation, avoid repeating the failed route and choose a sensible next step? No automatic success label follows from a metadata flag. The first demonstration stays read-only; writing policy and real-note access remain separate unresolved implementation scope.

The earlier inspection of tool-guard timing and filesystem-hook coverage is engineering reference if an explicit task needs a hard execution restriction. It is not a dependency of the selected memory slice, and it does not authorize introducing a research-action policy engine. Existing host permissions and actual user instructions remain applicable. Product acceptance groups below organize development and evidence, not the order in which an AI must conduct research.

## Current progress and the next decision

States in this table describe product development. **Implemented** requires working application behavior;
**recorded validation** identifies a prior receipt, not a check repeated today; **prototype-checked** applies
only to synthetic interactions; **accepted** requires the researcher's decision on the stated scope.
**Proposed** and **awaiting approval** are not implementation states. During future approved work, use
**in progress**, **implemented; acceptance pending** or **blocked**, with the specific gap and evidence.
Do not infer a completion percentage or scientific validity from the number of passing tests.

| Slice and usable result | Dependencies | Current state | Evidence or acceptance route | Outstanding decision or gap |
| --- | --- | --- | --- | --- |
| Harness base and GPT adaptation | Explicit 2026-10-22 user request | Authorized; in progress | [Bounded scope](#harness-migration), [execution evidence](../../agent/notes/harness-integration.md) | Complete and report actual startup/provider/login checks; no research workflow or live success inferred |
| P0: coherent design and inspectable prototype | Recovered design request and source audit | Designed and prototype-checked; researcher acceptance pending | [Review and limitations](15-design-review.md), [prototype checks](prototype/README.md#browser-check-and-screenshots); [P0 acceptance](#p0) | Researcher accepts or revises the architecture, workflow and P1 scope; no human usability acceptance yet |
| P1: read-only project, source and session workspace | P0 acceptance | Proposed; awaiting approval | No P1 application evidence; [P1 demo and acceptance](#p1), [C01](13-research-journeys.md#c01), [C16](13-research-journeys.md#c16) | Shared editors, global context home, exact delivered citations and revised source projection are not implemented |
| P2a: notes and source-backed knowledge wiki | P1 accepted | Proposed | No slice acceptance evidence; [child gate](#child-gates), [C05](13-research-journeys.md#c05), [C07](13-research-journeys.md#c07), [C19](13-research-journeys.md#c19) | Global wiki navigation, knowledge adapter and dedicated where-used views remain unavailable; current note-link lookup is only a foundation |
| P2b: literature library and actual PDF reading | P2a accepted in the prior ordering | Proposed; independent scheduling recommended, not selected | No slice acceptance evidence; [child gate](#child-gates), [C04](13-research-journeys.md#c04), [C21](13-research-journeys.md#c21) | Global collection/work/edition browsing, real reader and selection integration required; discovery/import in C03 remains separate |
| P2c: local code, diff and history | P2b accepted in the prior ordering | Proposed; independent scheduling recommended, not selected | No slice acceptance evidence; [child gate](#child-gates), [C08](13-research-journeys.md#c08) | Research source/checkout links and bounded comparison required; inherited code tools are not case acceptance |
| P2d: native research workspace and WSL attachment | P2c accepted in the prior ordering; independent scheduling proposed | Carrier selected; AITP attachment acceptance proposed | [Attachment checks](#child-gates), [C18](13-research-journeys.md#c18) | Reuse existing Electron carrier; actual Windows–WSL lifecycle and research attachment unverified |
| P3a: complete proposal on scratch copies | P2 accepted in the prior ordering; earlier Markdown route proposed | Proposed; earlier scheduling not selected | No authoring evidence; [child gate](#child-gates), [C15](13-research-journeys.md#c15) | Implement research proposal/pending outcomes through Harness; apply stays disabled |
| P3b: actual independent review and assessment | P3a accepted | Proposed | Queue/export exists, not reviewer execution; [child gate](#child-gates), [C15](13-research-journeys.md#c15), [C20](13-research-journeys.md#c20) | Reviewer runtime, coverage, existing-entry inspection without an edit proposal, and revised-proposal handling unavailable |
| P3c: controlled scratch apply and recovery | P3b accepted and authoring policy approved | Proposed; policy undecided | No apply/recovery acceptance evidence; [P3 policy](#p3), [C15](13-research-journeys.md#c15), [C16](13-research-journeys.md#c16) | Explicit non-hash comparison policy needs approval; authority and recovery services unavailable |
| P4: one named real authoring pilot; separately chosen bounded workflow | P3 accepted and named paths/actions approved | Proposed; pilot not selected | [P4 acceptance](#p4); selected cases must be named when the pilot is chosen | No real authoring, run/build or manuscript action authorized by this plan |
| P5: selected orchestration and wider research workflows | P4 accepted and chosen capability approved | Proposed; capability not selected | [P5 acceptance](#p5), e.g. [C09](13-research-journeys.md#c09), [C10](13-research-journeys.md#c10), [C17](13-research-journeys.md#c17) | Controllers, execution adapters and resource admission remain unavailable; cases are not all promised by P5 |

The current authorized implementation is the Harness/GPT migration above. The next research implementation proposal is a bounded **P1** slice after its scope is selected. It should deliver
one connected task: return to a project, read its qualified state, open the owning argument beside a source,
start or resume the correctly scoped session, and inspect the exact material delivered to the model.
Implement the project/reference/context contracts and shared editor behavior together so this route works in
the application. Include a global source session, an unresolved anchor, a critical context omission and a
restart; these expose failures that a polished happy-path screen would hide. P1 is useful evidence for C01,
C06 and C16, not completion of every analytic or interruption case. The material adapters then proceed in
the selected ordering. The recommended alternative makes them independent and brings Markdown scratch proposal/review before the full reader set; it still requires a scope/sequence decision. Apply remains a separate P3 decision.

**Settled design choice:** on 2026-10-21 the researcher selected autonomous routine next actions within
jointly established goals and boundaries, with discussion before material changes to core assumptions,
algorithms or research direction. The [architecture](10-project-workspace.md#research-control) owns this
default and per-task delegation semantics. This is acceptance of that policy only; P0/P1 implementation
acceptance remains pending. Its runtime projection, source-reading requirements and decision behavior
remain proposed. Current request/choice persistence and context manifests are a foundation, not proof that
important research context is delivered, actual user choices survive, or the agent chooses a scientifically appropriate next action.

### Keep this record useful during implementation

The repository-local [development Skill](../../.agents/skills/develop-aitp-agent/SKILL.md)
defines the entry reading route. [current.md](../../current.md) records design holes,
implementation gaps and correction evidence. Update affected issues there in the same
working change when design, behavior or evidence changes; it does not duplicate this
plan's stage/progress table or supply authorization to implement a proposed correction.

When a change alters behavior, boundaries, dependencies or case coverage, update the affected
**architecture, plan and cases in the same change**. Revise the architecture when components or contracts
change; revise this plan when the active scope, implementation state, acceptance evidence or next dependency
changes; revise each affected case when its usable route, gap or observed failure changes. Unchanged files
do not need ritual edits. A conflict with the architecture is resolved explicitly in the affected design and
implementation, not left as an undocumented exception or a false claim that the code already complies.

At the start of an approved slice, replace its proposed state with the actual authorized scope and relevant
case links. While implementing, record material results and blockers where they change the next action;
ordinary command output stays in its execution evidence. Before reporting completion, link the running
demonstration and relevant validation, state untested limits, and update the affected cases. Researcher
acceptance is recorded only after it occurs, with its scope; the implementer and reviewer cannot grant it.
If a planned capability is dropped or deferred, remove the promise from the active plan and amend its uses.
Preserve useful old evidence without maintaining competing current progress tables.

<a id="independent-development"></a>
## Independent development workstreams

The former P2a → P2b → P2c → P2d → P3 chain mixed product ordering with technical dependencies.
An independently developable component has a bounded responsibility, agreed inputs/outputs,
an owned implementation and a useful behavior check. It can be built against a controlled
implementation of a dependency; product acceptance still requires connecting real services.
Keep P0–P5 as user-visible capability/acceptance groups while using the workstreams below
to organize development. Use Harness service/provider/consumer packages and client contributions as the implementation homes; no new repository or process is required per line. These are research slices still to select, not ten simultaneously authorized tasks.

### Small shared preparation

The integrator and affected owners first agree the next slice of four interfaces, using
the preserved research semantics, Harness extension APIs and concrete successful and failing examples:

1. **Sources and observations:** configured host/root identity, resource/edition/locator,
   guarded resolution, missing/ambiguous/unavailable outcomes, the actual observed text and
   its delivery/current-availability state. Browsing a resource does not attach it to a model.
2. **Tasks and agreements:** original input and choice meaning, effective agreement revision,
   its scope and source, plus queue placement, continuation, cancellation and compaction events.
   Restriction duration and ambiguous changes remain explicit design choices; a fixture can
   supply a stated duration without choosing the product's default on the researcher's behalf.
3. **Proposals and review:** opaque proposal/revision references, baseline and relevant premise
   observations, review target (an existing entry or a proposal), inspected/unread coverage,
   author assessment and pending/no-change/applied outcomes. A review of one revision cannot
   authorize a later proposal. Hash-related checks remain disabled.
4. **UI and host callbacks:** open a resolved resource in a specific pane, attach a selection
   from that pane, show the backend's task/context state, and invoke explicitly available host
   capabilities. Authentication, path guards and instruction authority remain backend-owned.

Do this incrementally for the chosen work, rather than freeze the whole future system before
any demonstration. A UI task does not need final writeback semantics; enabling writes does.
The common fixture/contracts are examples of agreed semantics, not an additional scientific
record or evaluation framework.

### Ten development lines

All entries below are proposed work boundaries; this table does not duplicate the progress table.
Their final file ownership should follow the selected plugin/service boundaries in 10.
In particular, the combined notes/knowledge line can have separate domain providers;
Skill discovery and distillation require their own bounded slices under the existing C14
scope rather than being assumed implemented by this table or by the upstream Skill file.

| Line | Bounded deliverable and implementation home | Minimum dependency; what it need not wait for | Local check and eventual case |
| --- | --- | --- | --- |
| **Task and agreement** | AITP task-memory provider using Harness session events/projections, lifecycle and actual interaction sources; existing host permissions retain their owner | Agreed input/lifecycle semantics; no reader UI or desktop host required | Restriction → queued input → two compactions → restart/Continue retains applicable original meaning and attribution; C02/C16 |
| **Context and observations** | AITP source/context contributors plus request, read-tool and compaction integration | Guarded source reads and supplied agreement; task internals and complete wiki/PDF views can be substituted locally | Deleted selection yields partial context; required selected text beats background; dropped text cannot remain available; C06/C16 |
| **Notes and knowledge** | Research-record/knowledge providers and client views: owner/main-note projection, wiki, source links and bounded where-used | Filesystem service, applicable parsers and resource definitions; no PDF, code browser or model session required | Synthetic Markdown index → entry → prerequisite/source → return with missing links and coverage limits; C01/C07/C19 |
| **Literature and PDF** | Literature provider and client reader: work/edition metadata, PDF, page/selection locators | Resource/selection definitions and bounded binary access; shared bibliographic lookup through a narrow interface, no wiki UI dependency | Actual test PDF, edition/page distinction and located selection; C04/C21 |
| **Code and history** | Read-only checkout provider and client comparison view | Checkout identity, bounded Git/source access; no PDF or command execution required | Same-named checkouts and dirty fixture preserve target and comparison scope; C08 |
| **Workbench shell** | Harness client slots, shared resource navigation, selection and session views | Resource/event callbacks and one real note route; other panels can use isolated fixtures | Same source in two panes, anchors, reconnect and deliberate attachment; C01/C06/C16 |
| **Proposal and pending integration** | AITP document preview provider, proposal records and logged pending/no-change outcomes | Sources and agreement; no completed reviewer, resource suite or apply engine required | Full argument/caveats retained and visibly unapplied after restart; C15/C16 |
| **Independent review** | AITP review provider over Harness subagents, with bounded read-only tools and original logs | Entry or proposal revision, sources/agreement and actual subagent execution; no apply engine required | Dropped caveat, unread premise and existing-entry review produce real coverage/findings; C15/C20 |
| **Controlled apply and recovery** | AITP document writer and authority provider integrated with Harness tool/fs services on scratch roots | Approved non-hash policy, proposal and assessed review before operational use | External edit, ambiguity and interrupted multi-file apply preserve evidence; C15/C16 |
| **Desktop attachment** | Existing Harness Electron/host services plus explicit research host/root mapping | Authenticated host connection and lifecycle decision; no complete resource suite required | Actual Windows–WSL attach, unavailable host, close/reconnect and open-in-editor; C18 |

Computation, cluster submissions, manuscript builds and broader multi-agent orchestration remain
separately selected P4/P5 slices. They need the task/authority/observation boundaries and relevant
execution adapters, not completion of every reader or the native host. Browsing code does not
authorize executing it; a native window does not add filesystem authority.

### Combine useful behavior early

Development can start on separate lines once their own interface slice and scope are agreed.
Do not make the complete P1 UI a prerequisite for a headless task/context test or Markdown review.
Equally, a fake callback or a static paper illustration cannot complete an integrated capability.

- First connect **task + context + a small note/session view**: the user's restriction and selected
  source remain correctly attributed and available, or visibly missing, through continuation.
- In parallel, connect each **real notes/PDF/code adapter + its reader** to the shared shell when
  ready. Test source → locator → explicit selection → runtime receipt for model attachment;
  independent browsing can be useful before that attachment route is complete.
- Connect **source/agreement + proposal + actual reviewer + author assessment** on Markdown
  copies with apply disabled. Use the existing note view and a minimal proposal/report display;
  this does not wait for the full wiki, library, code browser or desktop. A host-level rehearsal
  using existing Codex/Claude Code is also possible before implementation if selected; it checks
  scientific preservation/reviewer inputs, not enforcement by the application.
- Enable **scratch apply** only after the preceding real services and the approved write policy
  pass their joint checks. A fake review gate is acceptable inside an isolated component test,
  never as the operational review prerequisite. Real-source authoring stays in a named P4 pilot.

These are demonstrations composed from development lines, not a second P0–P5 status ledger.
The proposed priority is to start task/context correctness, the minimal shell and the required
source-adapter slices together, then assemble the Markdown proposal/review route early. Remaining
readers and desktop attachment advance independently as capacity and the selected goals allow.

### Keep shared edits and activation under control

The retained `agent/streams.json` describes only the old S1–S6 Pi ownership. Before research implementation fan-out, assign concrete Harness files/tests for the selected providers and consumers; keep shared definitions, event declarations, composition, manifests and central client contributions under one integrator until interfaces are settled. Do not direct a Harness task to old Pi ownership paths.

Use documented Harness service/events and explicit read-only projections. Inspect request admission, tool execution, compaction and restart consumers before registering listeners; avoid recursive state mutation, duplicate delivery ownership or a second generic event bus. Registration effects must dispose with the plugin. Cross-module schema changes include providers, consumers, fixtures and persistence implications together.

An approved line can perform its ordinary edits and checks without repeatedly asking permission.
Its approval does not activate unrelated lines, a new writing policy, real-note writes or outward
effects. Component behavior, actual integration and researcher/scientific acceptance remain
distinct. Shared heavy-process limits still apply even when development is concurrent.

The child table retains the prior proposed product order. If the researcher selects the independent sequence, revise those dependency cells together: readers/desktop become independently selectable, and Markdown proposal/review depends on its real services. Host adoption alone does not choose that reorder or authorize every development line. Preserve proposal → assessed review → controlled apply and the P4 real-source boundary.

## Delivery agreement

P0–P5 are researcher-visible milestones. GPT-6.1 Sol with reasoning **high** implements each approved
milestone. Shared contracts and composition changes have one integrator. Independent review runs in a
separate reviewer session with access to the original material, not just the implementer's account.

At the end of **every** milestone, show the working result, changes, measured limitations and the four gates
below, then **stop and obtain the researcher's explicit approval before starting the next milestone**.
Passing tests or receiving an agent review does not supply that approval. Ordinary work within an approved
milestone proceeds without repeated permission requests. This staged approval rule is part of this proposed
delivery agreement, rather than a rule that every research action or file read needs confirmation.

| Gate | Evidence the researcher receives |
| --- | --- |
| Scientific | Source claims, qualifications, unresolved questions, ownership and stopping conditions remain faithful to the example; execution success and scientific support remain distinct |
| UI | The demonstrated screens implement the selected design, preserve source/context distinctions and expose errors without misleading success states |
| Usability | The researcher can complete the milestone's named task in the running product; report observed friction and assistance needed, not a claim that a scripted walkthrough proves usability |
| Technical | Relevant contract, behavior, recovery and boundary checks pass; report skipped, mocked and live checks separately |

Each gate may be accepted, returned for correction, or explicitly reduced in scope. A waived item and its
consequence remain visible in the milestone's existing implementation note. There is no additional approval
database, session diary or parallel completion ledger. The agreed scope is retained in the design owner;
implementation evidence belongs in [the existing integration note](../../agent/notes/integration.md).

## Retained Pi baseline and reuse

The retained `agent/` application is a **W1 read-only integration with a partial W2 UI/server**, not the active Harness application or P1 redesign.
Current source inspection establishes the implementation boundaries below. The
[integration account](../../agent/notes/integration.md) retains detailed earlier checks and failures; its old
W2/M1 acceptance language does not determine the new product sequence. The earlier design-only work
did not rerun the application suite or live pilot. Standalone packaging checks are recorded separately
in the integration account and do not constitute P1 or scientific acceptance.

| Evidence class | What can presently be said | What it cannot establish |
| --- | --- | --- |
| Observed application source | Read/outline/search/board tools, location-bound durable sessions, context preparation, sign-in, local server and current topic/note UI exist | New shared resource editors, global sessions, actual independent reviewer, authoring or research execution are not delivered |
| Recorded application validation | The [integration receipts](../../agent/notes/integration.md#validation-evidence) include typechecks, synthetic tests, browser checks and a read-only real-model pilot/replay with restart and compaction | A prior receipt is not a current rerun, independent scientific validation, human usability acceptance or a completed comparison against ordinary Codex |
| Synthetic design validation | [P0 review](15-design-review.md) records the prototype interaction checks and independent design critique | Deterministic demo replies, static paper pages and review labels do not implement model reasoning, a PDF adapter or a reviewer |

The full application profile is not a hidden working alternative: startup reaches document recovery and
action scanning whose methods still throw; the CLI exposes the read-only profile. The required session
`location` and server origin validation still exclude the proposed global resource workflow. Those are
implementation gaps with specific homes, not merely switches to enable.

| Surface | Existing implementation to reuse | Limit relevant to this plan |
| --- | --- | --- |
| Sources and research structure | `packages/core/src/{paths,notes,locations,board,instructions,plans,index}/` | Current work parsing and title-derived thread keys reflect the earlier format; projects and flexible detail views need a revised projection |
| Sessions and context | `packages/runtime/src/{sessions,context,compaction,cards}/`, `tools/interaction/` | Durable sessions, task/interjection/continue, manifests and choice cards exist; context currently centers on one main-note path. A rewrite-intent heuristic does not prove admission of the whole scientific account |
| Model execution | `packages/pi-adapter/src/{port,models,content,generation,lock,secrets}.ts` | Historical provider/login behavior and tests inform acceptance; Harness uses its own adapters, credentials and session state |
| Local server | `packages/server/src/{app,compose,cli}.ts` | Authentication, path guarding, protocol validation and read-only startup exist; unsupported routes must remain visibly unavailable |
| Workbench | `apps/workbench/src/{App,AgentDock,Markdown,ModelSignIn}.tsx`, `api.ts`, `source-link.ts` | Current topic/note pages and a location-bound dock exist; shared tabs, splits, selected-object actions and dedicated readers are new work |
| Documents and authority | `core/src/documents/`, `runtime/src/actions/` | Factories are placeholders; schemas and route declarations are not working authoring services |
| Independent review | `runtime/src/review/` | Requests and actual log exports are retained; reviewer execution and assessments are unavailable, and the application gate remains closed |
| Research adapters and execution | `core/src/{knowledge,works,checkouts,runs,methods,episodes,manuscripts}/`, `runtime/src/{sandbox,artifacts,effects,controllers}/` | Factories remain placeholders; do not present their designed API as a delivered feature. Existing where-used reads parsed note links, not semantic dependencies |

Paths in this baseline table are relative to `agent/`; they identify retained evidence only. New implementation follows [Harness development](../development.md), its root pnpm workspace and the [service mapping](10-project-workspace.md#harness-service-mapping). Research-source interpretation stays independent of models; UI consumes host APIs; composition owns dependencies. No retained Pi API is automatically a Harness API. Rebind any reusable parser/type/test to these roles before importing it; do not link the two application dependency trees.

### Shared semantic decisions

1. **The project is the working context, not a new copy of the research record.** Project membership is derived
   from configured homes and explicit map links. The workspace root may connect projects. A directory, an open
   tab or a newly created session does not by itself establish scientific parentage or create a branch.
2. **The main note supports two reading depths.** Its concise state gives the question, qualified current
   answer and live threads; its detailed account develops the argument in the same note and/or established
   linked material. Supporting filenames remain flexible. Do not mandate a second summary, a fixed folder
   tree or the extraction of every paragraph into an object. Root summaries point to owners rather than copy
   each child's jobs and next actions.
3. **Identity is conservative.** Reuse an optional, human-readable explicit anchor when present. Otherwise use
   the source path and the current parsed locator, with visible resolution uncertainty. Never invent an ID in
   a real note during discovery. A moved path, deleted anchor or ambiguous duplicate must not silently attach
   a session or approval to a different thread. Repair requires an explicit mapping or a newly selected target.
4. **Tabs are presentation; context is deliberate.** Opening a source does not automatically attach it to the
   model. Ask about a selection or Attach to conversation makes that selection explicit. Existing source reads
   inside configured roots need no generic project access prompt. A conversation keeps its project, task and
   attached sources when another tab becomes active.
5. **Caches are disposable projections.** Projects, boards, search results and knowledge views can be rebuilt
   from files. Layout preferences and session execution records are separate application state. A cache never
   becomes the owner of a scientific conclusion or the only place holding a researcher's decision.
6. **All hash-related checks remain disabled.** No file hashing, content-addressed snapshot requirement,
   checksum freshness check, digest-bound approval, digest equality test or hash-based cache invalidation is
   introduced. Legacy fields may be read as optional historical metadata; they do not certify or authorize
   anything. Existing provider authentication and opaque identifiers are a separate concern.

The authoring proposals in P3 distinguish optional text-anchor matching and equality of explicit approved
arguments from the currently disabled hash-based checks. These are **new authoring semantics for approval**,
not a claim that the researcher has already authorized a replacement version/conflict policy.

<a id="p0"></a>
## P0 — Agree the design through an inspectable prototype

**Usable result.** An interactive project workspace prototype and readable sample notes demonstrate the
core project-to-source-to-conversation route before application code changes. The researcher can navigate a project, open
related material in tabs/splits, start or resume a contextual conversation, inspect a change proposal and see
where a decision interrupts work. Simulated runs, reviews and conversations are explicitly labelled.

**Work and interfaces.** The new design pages describe the selected navigation, source format and interaction
contracts. `docs/agent/prototype/` can reuse its existing synthetic data and visual assets, but the current
`build-data.ts` depends on the old parser and is only a baseline. Prototype-specific adapters may illustrate
the proposed format; they do not establish parser support in the application. Format trials use disposable
copies, retain the original text for comparison and demonstrate a short state view alongside a coherent
detailed account. Private copy trials and screenshots stay outside the published tree.

**Demo.** Follow one thread from project state to its detailed argument and a supporting note. Place the two
sources side by side, attach a precise passage to a conversation, inspect a proposed edit, then return to the
original project without losing the conversation. Show an unresolved target and a waiting decision as well
as the normal route.

**Acceptance.** Scientific: compare the complete example before and after the format trial, including negative
results, qualifications, dependencies and next action. UI: demonstrate both wide and constrained layouts with
realistic long mathematics and titles. Usability: the researcher identifies where to resume, read details and
find a pending decision without a tour of hidden controls. Technical: prototype links and interactions work;
public data are synthetic; real source files and application code are untouched. A prototype screenshot is
neither a production browser test nor evidence that an adapter or reviewer exists.

**Risk, rollback and scope.** A polished mock can conceal unsupported behavior; label every simulated action
at the action/result itself. Retain the prior prototype alongside the proposal while comparing designs.
Deleting or replacing the prototype is unnecessary to reject a design. P0 does not migrate notes, change
runtime contracts, install packages, run real research jobs or enable writes.

**Stop:** the researcher approves the format, screen behavior, implementation sequence and P1 scope.

<a id="p1"></a>
## P1 — A usable read-only project workspace

**Usable result.** The running agent opens projects with the approved concise state and detailed account,
shared tabs and split panes. The researcher can resume a thread, attach a source, continue a conversation and
inspect what context reached the model. Everything in this milestone is read-only with respect to research
files. Backend contracts are delivered with these working interactions, not as a separate invisible milestone.

| Module | Concrete change and proposed interface |
| --- | --- |
| AITP research/source definitions | Derived project home, explicit member/source references, observed time, optional anchor and resolution status; version research projections without relabelling old manifests or editing upstream Session fields casually |
| Research-record provider | Parse concise state and account pointers, retain complete raw spans/warnings, report duplicate/missing/moved targets and conservative legacy note formats |
| Source/index and rule providers | Reread bounded owners, derive indexes and distinguish authored instructions from research prose; index loss never loses source content or task authority |
| Agreement/context providers and Harness events | Record explicit decisions, scope and adoption; resolve parent-use/plan/selected passages; retain required observations and omissions at actual request admission and through compaction/restart |
| Harness host API contributions | Expose project/source/context projections with validated unavailable/ambiguous responses; use the authenticated host/client transport |
| Harness client plugins | Shared research/resource/session views and presentation-only tab/split state; selections carry resource/locator identity; reuse existing client primitives where behavior fits |

P1 includes the explicit global/note context-home union, server-resolved authority rules, configured host/root
identities and delivery-bound citation contract in
[10](10-project-workspace.md#p1-contract-decisions-origins-authority-and-citations).
Old Pi `location` sessions stay in the retained profile/export; importing those stores is outside this scope. New global resources require no fake note path. Draft preview and actual request admission are separate operations, with captured delivered excerpts available before P3 snapshot authoring. Global resolution must load applicable workspace instructions; avoid the retained resolver's location-only assumption. Context budgets must distinguish omitted critical premises from optional background:
test a partial manifest and visible missing material without falsely labeling the source coverage complete. A reference-only pointer is not a read. Missing material informs the agent's next choice and does not impose an authoring/research-action readiness gate.
Exercise both Chinese and English task requests: detecting a rewrite keyword is not a substitute for
explicitly identifying and admitting the complete required argument.

The [memory/context contract](11-research-memory.md#context-reading) and
[adaptive research loop](10-project-workspace.md#research-control) add a bounded P1 responsibility:
preserve the effective agreement and source coverage, explain the current gap and recommend or perform a
useful **available read-only** step. Use existing task/context/event records; do not build a separate planning
service or require a new file for each decision. Explicit choice answers update only the scope they change;
queued work is checked against the current agreement at dispatch. A status interjection keeps the task and
pending choices. Distinguish an ordinary plan draft from a required-choice card: preparing an already
authorized next step must not reproduce the old Pi `propose_plan` behavior that always creates a blocking card.

P1 preserves actual user choices and distinguishes them from preferences and generated interpretations; its selected read-only tools use existing host permissions. It does not implement a fixed research-action policy. Context coverage describes observed input, not scientific correctness. If budget or relevance changes omit important material, retain the omission and its reason so the model can retrieve it or qualify its answer.
No agent can claim all hidden premises have been detected. P1 does not deliver real literature retrieval,
code execution, document writes or a universal autonomous research controller.

Assign concrete UI files inside the selected Harness client plugin packages before parallel implementation. Reuse its slot, routing, state and panel primitives where they satisfy the named behavior. Layout persistence has a local schema version and a reset-to-default route; it contains no scientific claims.

**Tests and demo.** Add owner-local provider tests with synthetic examples of both formats,
optional IDs, duplicate titles, multiple parents, a missing detail link and an unresolved move. Extend
Harness-integrated agreement/context tests for a selected thread, an unrelated tab switch, queued input,
status interjection, waiting decision, restart and compaction. Browser checks exercise opening/closing and
splitting tabs, changing projects, reconnecting a session and keyboard focus. In the demo, resume two
conversations in one project while reading a third source; the active task and context must remain identifiable.

Add the P1 portions of the [cross-case exercises](13-research-journeys.md#adaptive-research-checks): one
critical hypothesis missing from a summary, one sufficient local derivation, one remembered failed route,
and an explicit scope change followed by queued work/status/compaction. Separate deterministic checks of
coverage, dispatch and persistence from model evaluation of source fidelity and action relevance. The model
may choose different sound actions; it must retain the scientific limitation and avoid repeated questions
for already delegated routine steps. Record actual omissions/failures, not just an average success score.

Do not port the old Markdown navigation unchanged: its `skipHtml` discards explicit HTML anchors and global
DOM lookup cannot distinguish the same note in two panes. Recognize only safe anchor nodes, retain cross-file
locators in open calls and namespace DOM targets by pane. Add browser cases for two panes of the same note,
cross-note explicit anchors, missing anchors, and source mutation after delivery: a citation must open the
retained delivered excerpt with its observation label while current source remains a separate choice.
Selection tests pair two different resources as well as two panes of one note: the action must resolve in its
own pane and reject a selection whose endpoints or origin belong elsewhere. Compact-layout checks require
visible editor content and usable controls, not just a document without horizontal overflow.

**Acceptance.** Scientific: state and detail point to the same owning account, and inferred suggestions remain
labelled. UI: project navigation, tabs, split reader and conversation coexist at the approved widths without
truncating the only copy of evidence. Usability: the researcher can return to an interrupted task and explain
which sources are attached. Technical: affected typechecks, contracts and behavior tests pass; note writes and
commands remain absent from the read-only tool registry; sign-in and server boundary regressions still pass.

**Risk, rollback and scope.** Path/title identities in existing sessions may not resolve after a redesigned
format or external move. Preserve the session and display the unresolved reference; never silently retarget.
Keep the existing read-only projection available during adoption and back up application state before any
explicit store migration. A new profile can be abandoned without rewriting notes or resetting the worktree.
P1 excludes dedicated PDF/code/knowledge adapters and all authoring.

**Handoff:** show the selected P1 route and its actual evidence; choose the next bounded reader, desktop or scratch proposal/review slice from its dependencies.

<a id="p2"></a>
## P2 — Browse and relate global and project materials

**Usable result.** Notes, literature/PDFs, knowledge and code/git each have a useful view inside the shared
tabs/splits. Global Knowledge and Library work without a selected project or conversation. The researcher can
move between an argument, its cited paper and the implementation it discusses, and optionally start a
conversation tied to the chosen material. These views read existing sources and show missing
metadata honestly; they do not create paper maps, knowledge entries, commits or annotations in real files.

| Module | Concrete change and interface reuse |
| --- | --- |
| Knowledge/literature/checkout providers | Adapt existing research metadata and links into bounded source reads. Git observations name checkout, branch, dirty paths and time; commit IDs are repository references, not a content-integrity requirement |
| Research-resource definitions | Preserve work/edition/locator distinctions and support labels. Ambiguous printed/PDF pages and missing editions remain unresolved |
| Search/context providers | Bounded search and where-used; explicitly selected paper/note/code observations enter context through recorded admission |
| Harness fs/host API consumers | Bound served sources to configured roots; typed Git reads stay within the requested checkout with optional locks disabled and no implicit fetch |
| Client reader contributions | Actual notes, PDFs, library, knowledge and source/history/diff views using shared resource/selection interfaces; select reader libraries through normal package ownership |

The proposed `ResourcePane` boundary accepts a `ResourceRef`, its resolved observation and callbacks for
opening another reference or attaching a selection. It does not receive authority to write. A separate
resolver returns `resolved`, `missing`, `ambiguous` or `unsupported`, preserving the original requested
reference. This keeps edition/page handling, anchor handling and file opening consistent across resource views.

**Tests and demo.** Use a synthetic paper, notes with equations, a tiny local git fixture with committed and
dirty files, and knowledge passages with differing labels. Test citation-to-page navigation, ambiguous
locators, a dirty working-tree diff, source-only fallback, large-file limits and unknown metadata. Browser
checks cover PDF keyboard navigation, selection-to-conversation, code range citations and moving a resource
between splits. Demonstrate one complete argument-to-paper-to-code reading route and a second route from a
knowledge passage to its source. Measure loading on a representative bounded local collection.

Also demonstrate [C19](13-research-journeys.md#c19) and [C21](13-research-journeys.md#c21) from their global
entry points: index/search → concept or paper → prerequisite/edition/source → return with filters and position
preserved. Include same-title works, multiple editions, a missing PDF and partial indexing. Keep the paper's
source-ordered reading route visible alongside concept links. Human comparison and existing scoped review
findings support [C20](13-research-journeys.md#c20); they do not execute a new independent model review.

**Acceptance.** Scientific: source-derived, derived and unchecked support remain distinct; AI-read does not
become researcher-read; a working-tree observation does not claim a validated numerical result. UI: actual
resource panes, citations and selection states work. Usability: the researcher finds and attaches the intended
passage without reconstructing paths by hand. Technical: adapter, API and browser tests pass; no network fetch,
research-file write, git mutation or execution tool is introduced by a read-only view.

**Risk, rollback and scope.** PDF text extraction and approximate symbols can miss the selected meaning; retain
the original page/file and label approximations. Preserve existing files and caches can be discarded. Keep
plain source opening as a fallback when a reader fails. P2 excludes literature import/download, editable code,
knowledge promotion, bibliographic/collection edits, duplicate merging or deletion, manuscript builds,
remote git operations and cluster submissions. C20 review execution starts in P3b. C21 curation changes
require scratch authoring first and a named P4 pilot; P2 browsing does not authorize a library reorganization.

**Handoff:** accept or revise the demonstrated reader slice and select another independent capability as needed. Controlled authoring still requires the P3 policy; an unfinished unrelated reader does not block Markdown-only proposal/review.

<a id="p3"></a>
## P3 — Independent review and complete authoring on scratch copies

**Usable result.** On a clearly identified copied workspace, the researcher can edit a note or ask for an edit,
inspect the proposed diff, receive an actual independent review, see the main agent's assessment and apply the
result. An external scratch edit, an ambiguous target and an interrupted application have inspectable recovery
outcomes. Real research roots remain read-only.

**Independent review is an early dependency.** Implement reviewer execution here, before any authority-bearing
real write becomes available. A queued request, an export or a faux reviewer does not meet this dependency.
The reviewer uses a separate session, receives original relevant logs where available and source material,
plus the complete proposal/baseline when reviewing a change, and has no write or outward-effect tools.
Its output is a process/scientific assessment with
evidence and explicit coverage limits, not proof by agreement between models.

The same reviewer must accept a selected existing knowledge passage or bounded collection for inspection
without requiring an edit proposal ([C20](13-research-journeys.md#c20)). Its report binds to observed sources
and inspected scope; a useful no-change result is allowed. Any resulting correction becomes a separate
proposal with the same revision/assessment rules below. This adds no whole-library audit promise.

Keep process fidelity and scientific validity explicit in review scope. A process review checks preservation,
source coverage and the actual work; a scientific check examines specified hypotheses, inference or numerical
evidence. One does not imply the other. Scratch writeback follows [11's owner rules](11-research-memory.md#memory-writeback),
including a no-durable-change outcome, pending integration and a correction with known uninspected uses.
Do not mark a completion card or unapplied proposal as an updated research note.

| Module | Concrete work and proposed contract changes |
| --- | --- |
| Proposal/review/action definitions | Opaque observation/proposal revisions; existing-entry and proposal review targets; explicit unavailable/failed states; review/assessment/apply refer to the actual immutable revision, with no hash address |
| Document provider | Read/preview/apply/history/recover on scratch roots; unique anchors, preserved mathematics/links/labels, serialized AITP writers and per-file recovery outcomes |
| Agreement/authority provider | Check paths, operation and actual arguments inside tool execution; consume/revoke grants as applicable; changed scope cannot inherit unrelated authorization |
| Review provider over Harness subagents | Separate read-only reviewer, original logs/sources, actual reports and main assessment; required completed review binds to the proposal revision and coverage |
| Harness tools/preset composition | Expose proposal/apply only in the selected scratch profile; actual choice/review/change interactions; read-only research profile omits writing tools |
| Lifecycle and host API contributions | Reconcile document recovery and pending actions before affected scheduling; expose actual progress and recovery failures |
| Client authoring/review views | Editable source, rendered preview, diff, explicit target, assessment and recovery; Save/Apply states whether the target is a scratch copy or research source |

### Proposed authoring semantics to approve at this stage

- Proposal revisions are immutable records containing the actual operations and displayed text. Revisions
  carry opaque IDs, not content hashes. Reviewer findings and the main assessment refer to that record.
- Before application, reread the target and resolve the intended explicit anchor or exact text range. The
  proposed policy is to stop when the relevant baseline text differs or the target is ambiguous, then show a
  newly prepared proposal. This is direct text matching, not a revived checksum or digest check. It requires
  approval as the new authoring policy; it is not currently implemented behavior.
- Approval matching compares the explicit permitted operation, paths and arguments. It does not compare a
  digest, silently expand the approved scope or ask for blanket project read permission.
- A review revision records the exact observed argument and premise passages it relied on, including
  applicable scope/decisions and affected using passages, not only the edited range. Under the proposed
  non-hash policy, reread and compare those reviewed text observations before application. Any difference,
  unresolved locator or unavailable required premise marks the review stale and creates a new proposal/
  review decision; do not use an unchanged edit anchor as proof that the scientific argument is unchanged.
  This is a declared dependency set, not a guarantee to detect an unrecorded dependency or an arbitrary
  external-editor race. The reviewer must report incomplete coverage. Include an adversarial test that
  changes a premise outside the edit anchor and verifies that the old review cannot authorize application.
- Keep the proposal's baseline, the content observed on reread and the intended result as separate retained
  observations. Serialize AITP writers. External editors remain outside those locks; a final reread and an
  atomic single-file rename do not establish a transaction across several files or eliminate every race.
- Recovery preserves uncertain outcomes and requests inspection when it cannot safely establish what to
  do. Undo is a new previewed change against the current file. It never blindly restores an older snapshot
  over an external edit. If the researcher rejects the proposed non-hash matching policy, keep authoring
  unavailable and revise this design rather than enabling an unchecked overwrite path.

**Tests and demo.** Add focused suites in `core/test/documents/`, `runtime/test/{actions,review}/` and server
integration tests. Cover unique/ambiguous anchors, an explicit anchor with a changed heading, move/link repair
as separately previewed edits, missing destinations, two once-grant consumers, revocation on restart, failed
review, incomplete coverage, a revised proposal after review, duplicate submissions and interruption between
two file writes. Test direct text comparisons only if the proposed policy is approved; do not add hash checks.
Run at least one actual independent reviewer through the configured provider on synthetic/scratch material.
The demo deliberately proposes a change that drops a caveat: the reviewer must identify it from the source,
the main agent must assess it, and the corrected revision must receive the required review before application.
Then inject an external save in the scratch copy and demonstrate the stated conflict/recovery boundary.

**Acceptance.** Scientific: the preserved argument and review findings are checked against the original
material by the researcher; reviewer agreement alone does not pass the gate. UI: editing, proposal, assessment,
application and recovery are distinguishable and source targets are visible. Usability: the researcher can
understand and correct the proposed change and recover from the demonstrated interruption. Technical: reviewer
execution is real, failure blocks the affected apply path, grants are enforced inside execution and recovery
does not run scheduling first. The separate read-only profile still passes its relevant regressions.

**Risk, rollback and scope.** Multi-file edits cannot promise atomic visibility to external tools. Evidence
preservation and honest recovery states are required. Keep each scratch experiment in its own data/workspace
profile; abandoning it leaves real notes and the existing application profile intact. P3 excludes writes to
real notes, broad format migration, arbitrary shell execution, publication and worker orchestration.

**Stop:** show real reviewer execution and scratch recovery; obtain approval for P4's named pilot and actions.

<a id="p4"></a>
## P4 — A small authorized real pilot and bounded workflows

**Usable result.** The researcher uses the workbench for one explicitly selected real task: inspect evidence,
prepare a scoped note change, receive independent review, apply the authorized result and follow the resulting
source links. A separately approved bounded computation or build may produce a visible receipt and retained
artifact. This is a small pilot with named files/actions, not permission to migrate the workspace.

For that selected task, demonstrate the complete decision-to-memory route: recover the effective scope and
sources, choose an informative authorized action, assess what it establishes, integrate only a durable
change at its owner, and resume from the resulting record. Include a possible material method choice and
show that routine work continues without repeated permission while dependent changes wait. Use the relevant
[cross-case exercise](13-research-journeys.md#adaptive-research-checks); broader scientific reliability remains
unestablished by one pilot.

**Implementation.** Reuse `Config.workspace.writeMode = pilot` and `pilotTopics`, but enforce the narrower
agreed paths/actions in the action and document services. The default remains off outside that pilot. Make the
P3 reviewer dependency a runtime prerequisite: its absence, failure or unresolved required findings prevents
the affected authority-bearing real write. The first real application and every substantial restructuring
must have the completed review and main assessment for its proposal. Routine edit review cadence within an
accepted pilot is explicitly agreed; it must not be inferred from a successful initial preflight.

For the selected bounded workflow, implement only the required slices of `runtime/src/{sandbox,artifacts}/`,
`tools/research/` and the corresponding `core/src/{runs,manuscripts,checkouts}/` adapter. The typed action states,
receipts and artifacts already have protocol homes in `actions.ts`, `artifacts.ts`, `runs.ts` and `code.ts`.
Amend those records to refer to observed inputs and opaque artifact IDs without requiring provenance hashes.
No general shell execution is enabled merely because one build/run works. Typed external operations in
`effects/` remain unavailable unless specifically included in the pilot and tested for uncertainty/recovery.

**Tests and demo.** First repeat the selected workflow on a scratch copy with the real runtime profile and
denied targets outside the pilot. Check read/write separation, output limits, cancellation and preservation of
preexisting dirty code. For execution, verify sandbox containment and its fail-closed behavior before any run;
test the exact chosen interpreter/toolchain rather than every future workflow. Then conduct the explicitly
authorized real pilot. Demo the source before/after, reviewer report and assessment, resulting note links,
receipt and artifact, and the remaining scientific uncertainty. Do not count a zero exit status as validation
of the computation's interpretation.

**Acceptance.** Scientific: the researcher independently checks the consequential conclusion and its retained
limits. UI: the pilot's edit/run state, evidence and unanswered choices are visible in the project workspace.
Usability: the task can be resumed after interruption without manually reconstructing its account. Technical:
outside-scope actions are denied; the reviewer prerequisite works; sandbox/admission controls for the selected
workflow pass; restart preserves or explicitly marks uncertain actions. Report live model/cost/latency data
separately from correctness.

**Risk, rollback and scope.** Real-source mistakes now matter. Narrow scope and preview are meaningful here;
new broad authority is not. A correction uses a new reviewed proposal against current files. Switching the
profile to read-only blocks new writes but does not erase already performed effects; retain receipts and
reconcile uncertainty. Never reset a checkout, discard dirty work or restore notes automatically. P4 excludes
bulk migration, unattended campaigns, implicit git commits/pushes, installation and publication.

**Stop:** the researcher accepts or rejects the pilot and explicitly chooses any P5 capabilities to pursue.

<a id="p5"></a>
## P5 — Advanced orchestration and wider workflow coverage

**Usable result.** Only the selected advanced workflows are added: for example a controller coordinating
independent analytic and code workers, a campaign view distinguishing scheduler state from accepted coverage,
or a literature/knowledge/manuscript task with retained evidence. Independent reviewer execution is already a
prerequisite from P3; this stage expands orchestration and coverage rather than introducing review for the
first time.

**Implementation.** Add selected orchestration/effect/method/manuscript providers and views through Harness services. Reuse its subagent, job, tool, session and cancellation machinery with explicit research task/retry ownership. The retained Pi worker/review schemas are design input, not directly callable services. The integrator remains the single writer of shared
research notes. Workers receive explicit objectives, source scopes, limits and tool sets; they do not derive
write authority from controller membership. Extend owned durable events and task views for running, waiting,
cancelled, interrupted and uncertain states. Method suggestions remain linked to Skills; installing or
publishing a Skill is a distinct authorized operation.

**Tests and demo.** For each selected workflow, test cancellation propagation, resource admission, restart,
duplicate requests, partial failure and a task that finishes execution without meeting its scientific
criterion. For an outward effect, test the operation ID, missing receipt and reconciliation; never replay an
uncertain submission automatically. Run a small complete user task with realistic failure injection before
wider coverage. Show each worker's contribution, source evidence, unresolved disagreements and the
integrator's final retained change, with reviews performed at the applicable boundaries.

**Acceptance.** Scientific: coverage and numerical/analytic acceptance remain separate from task completion;
unresolved worker disagreement is preserved. UI: a researcher can identify who is doing what, the shared
owner, the next decision and any uncertain effect. Usability: the workflow reduces reconstruction work without
adding a compulsory metadata ritual. Technical: resource limits, one-writer integration, task cancellation,
review coverage and effect reconciliation pass for the exact selected features.

**Risk, rollback and scope.** More parallelism creates more opportunities to confuse authorization and stale
context. Keep each new capability off until its accepted demo and retain the P4 single-session route. Disabling
a controller stops new admissions; it does not erase workers' results or resolve uncertain external effects.
No remote hosting, multi-user system, vector database, unrestricted autonomous campaign or wholesale note
migration is included. Those would require a separate product decision.

**Stop:** review the delivered scope with the researcher before another implementation cycle or release.

<a id="child-gates"></a>
## Mandatory child gates inside broad phases

P2 and P3 group capability acceptance. This table retains the earlier proposed product sequence; the independent-development section identifies the technical dependencies and recommended alternative. Harness selection does not itself approve that reorder. Neither grouping supplies permission to implement every resource or all authoring in one pass.
The four review dimensions and evidence requirements above apply at each child gate below. Stop for explicit
researcher continuation between child gates. Routine fixes/tests within an approved child slice proceed
without repeated permission questions.

| Child gate | Inspectable result and scope | Dependency and demonstration |
| --- | --- | --- |
| P2a Notes and knowledge | Actual mathematical note/source views, global wiki navigation, source-backed knowledge and where-used | P1 accepted; argument→premise→knowledge comparison plus global index→entry→source→return, with source and reading labels |
| P2b Library and reader | Global collection/work browsing, actual local PDF viewer, editions, page locators and optional selection-to-session | Prior proposal: P2a accepted; technical need: resource/selection and bounded-source services; library→edition→reading note→return, wrong/missing editions and incomplete index |
| P2c Code and Git | Actual bounded source/diff/history for attached local checkouts, no mutation | Prior proposal: P2b accepted; technical need: checkout/source and resource interfaces; formula→exact checkout→dirty diff, unrelated change attribution unknown |
| P2d Desktop host | Existing Harness carrier with explicit research host/root attachment and measured lifecycle | Prior proposal: P2c accepted; technical need: host/client/auth services; actual Windows↔WSL identity, open-in-editor, close/reopen, disconnected-host behavior; no added filesystem authority |
| P3a Scratch proposal | Editable copied note, full diff, source/argument observations and preservation diagnostics; apply disabled | Prior proposal: P2 accepted; technical need: agreement/source observations, preview and minimal note/proposal view; missing/ambiguous locator and changed premise. Earlier Markdown scheduling remains proposed |
| P3b Actual independent review | Real read-only reviewer for proposals and existing entries, coverage, author assessment, stale/missing review states; apply disabled | P3a accepted; intentionally dropped caveat and changed dependency outside the edit range, plus a bounded entry review with no proposed edit and unread dependencies |
| P3c Controlled scratch apply | Approved non-hash policy, scoped authority, apply/read-back, concurrency and recovery | P3b accepted; external scratch edit and interrupted multi-file application; no real roots writable |

P2d reuses Harness Electron, as specified in [10](10-project-workspace.md#windows-wsl-and-the-desktop-host). Its local carrier owns startup/shutdown according to upstream design; separately identify an independent WSL/remote backend's lifecycle. Test selected host/root, authentication, missing host and reconnect on the actual Windows–WSL system. The old attach-only Pi cookie/bootstrap prescription is not the Harness implementation. Automatic WSL start is a separate capability.

The carrier choice is settled; research attachment and actual-host acceptance remain to be selected and tested. Browser-only acceptance can be retained as a development profile, but must not be labelled completion of native desktop/Windows–WSL acceptance. If a child fails or the
researcher redirects the design, preserve its evidence and revise the owning design before the next child.
No deadline or successful earlier test automatically advances a child gate.

## Cross-milestone implementation discipline

**Contracts before crossing boundaries, behavior in the same milestone.** The integrator revises service definitions, event declarations, persistence implications, host/client APIs and fixtures together. Assign bounded active-tree paths before parallel work; `agent/streams.json` is historical. Requests to another owner are integration requests, not competing interfaces. Port relevant Pi scenario semantics to Harness tests without treating old port-conformance results as new-runtime evidence. Use documented extension points before changing the agent loop.

**Compatibility is explicit.** New projection fields need legacy fixtures and a schema version where stored
state changes. Existing sessions are retained; unsupported old references display their original path/name
and resolution problem. Proposed snapshot IDs require a corresponding route/service change; do not pass an
opaque ID through the old `/snapshots/:hash` contract and pretend it has the same meaning. Source format
adoption starts on copies and is separate from application-store migration. Neither is authorized by merely
opening an old project.

**Relevant regressions, not an inherited breadth gate.** Reuse the old M1 scenarios for source-faithful status,
a waiting-thread continuation and parent-use context, plus sign-in, restart, a status interjection and
compaction. Run external-note-change exercises on copies. Retain the old 38/40 result as historical evidence;
the subsequent private inventory audit found the threshold included provenance copies. A revised project
model needs an explicitly specified expected/missing/excluded inventory and a reviewed test change, not a
silently relaxed number or an assertion that the old gate passed. A matched usual-Codex comparison may inform quality evaluation;
report it as outstanding until performed, without making it block the redesigned read-only resource views.

**Testing respects the workspace.** Unit and integration tests use temporary directories and synthetic
fixtures. Any read-only check of actual projects must be separately identified, bounded and free of retained
private excerpts in this repository. No real files are modified to test refresh or recovery. Only affected
typechecks and meaningful behavior tests are repeated; final integration checks are matched to the milestone.
Follow the active Harness [testing policy](../testing.md) and coordinate heavy processes across developers; the old `agent/` commands and memory defaults apply only when explicitly testing that retained implementation.
No hash test or before/after hashing is part of any gate.

**Rollback preserves work.** Use isolated profiles, source-preserving copies and explicit schema migrations.
Application rollback must not run destructive git commands or restore research files. Keep the previous
working read-only route while a replacement is evaluated. A rejected design, failed test or denied write
leaves the original material and its history available for the next decision.

Complete the authorized Harness/GPT scope, then choose the first bounded research integration slice. Maintain architecture, progress and cases as behavior and evidence change. Host adoption does not authorize real-note migration or imply full P1 acceptance.
