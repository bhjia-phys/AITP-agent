# 14. Development plan and implementation progress

This is the maintained owner of **what is implemented, what is being developed, what comes next and what
evidence would justify moving on**. The [target architecture](10-project-workspace.md) explains how the
completed product works; the [physics cases](13-research-journeys.md) test whether those capabilities serve
actual research. Detailed execution and test receipts stay in the
[Pi integration account](../../agent/notes/integration.md) and [Harness integration evidence](../../agent/notes/harness-integration.md), linked here when they change a development judgment.
The documents have different jobs; this plan is not a second session log or a copy of the architecture.

**Current stage, 2026-10-22:** the researcher authorized moving the application base to official DeepSeek Harness, retaining the design and research principles, naming the product **aitp-agent**, and addressing GPT adaptation. The active migration is described [below](#harness-migration). The repository keeps its `bhjia-phys/AITP-agent` address; the Harness-derived branch retains official ancestry and the previous Pi repository history. The researcher now requests promotion to `main` as the integration/default branch. The former Pi head is preserved at `legacy/pi-foundation`, and existing dirty worktrees stay untouched. [README](../../README.md) owns remotes, branch layout and startup; the [Harness receipt](../../agent/notes/harness-integration.md) owns executed checks and limits.

The host selection is settled. Modular core services, independently developable domains, editable rules, selective UI and portable AITP Skill ownership remain requirements. [10](10-project-workspace.md#harness-service-mapping) maps these domains onto Harness. The [development lines](#independent-development) separate work ownership from the P0–P5 research acceptance groups. They do not authorize all proposed features or real-note writing. The old Pi pilot and P0 prototype remain evidence only for their original scopes; no research case is automatically accepted on Harness.

**Current task:** integrate the completed Claude UI design/prototype handoff, maintain the coordinated architecture and plan, and publish the main-branch collaboration entry. **Claude has completed the UI design and synthetic Harness-frame prototype; Codex now owns client and backend implementation, integration tests and documentation maintenance.** The prototype is design evidence, not delivered application UI or researcher acceptance. GPT reliability is an explicit priority, and each implemented research capability needs a corresponding comparison with **Codex + AITP**, with difficult or unavailable tests reported plainly. This promotion publishes documentation/prototype artifacts and a bounded CI trigger correction; it performs no live model trial, research-runtime implementation or real-note write. The [scenario-to-plugin map](10-project-workspace.md#scenario-plugin-map) owns functional responsibilities; this plan owns work assignment and sequence, and [13](13-research-journeys.md#comparative-evaluation) owns the comparison protocol.

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
owns contract, dependency and upgrade boundaries. Harness/Cordis is selected; the shared interface slice, proposed file ownership and first research example are specified below; they remain to be implemented. The authorized host/GPT work does not by itself start the full P1 redesign or approve every proposed module split.

The P0–P5 groups describe capability acceptance. The [single next-slice statement](#next-implementation-slice) and the dependency cells below own the current development sequence; the earlier linear reader/desktop order is superseded as a planning dependency. This does not claim researcher acceptance of the product or settle the authoring policy. Controlled apply still depends on the selected policy and assessed review. The old [W0–W6 sequence](08-implementation-plan.md#3-waves-and-milestones) and M1 results remain Pi history, not Harness release gates.

<a id="topic-redesign-review"></a>
## Topic-centred redesign review

The 2026-10-23 request authorizes critical assessment, design alternatives, an interactive prototype, README/design updates and a proposed implementation sequence. [16](16-topic-centred-redesign.md) owns that review package and its proposed phases; [prototype evidence](prototype/topic-workspace/README.md) owns the simulation’s tested behavior and limits. Codex resumes Claude’s interrupted design task in the isolated design worktree. UI-1 is preserved; its historical package checks and incomplete host typecheck remain distinct. The researcher has now authorized publishing this design/prototype/interface package to remote main. Its publication excludes the separate UI-1 implementation commits and does not implement production services or write real research notes.

The researcher subsequently clarified the design target: immediately legible topics/subtopics, click-through details, tidy operation and convenient AI organization/read-write, with explicit freedom to go beyond the existing research-memory format. The latest clarification narrows this side to the frontend and reserved interfaces, because the backend is being developed separately. [16](16-topic-centred-redesign.md#decisions) defines topic/document/resource read models and serializable edit intents; the proposed TypeScript contract lives with the prototype. The frontend path is project overview → child detail → material → edit feedback using synthetic data. Backend storage, note mapping, persistence and real model integration are separate work; production API changes and real-note import remain outside this design task. Once selected, integrate the proposal into the existing owners 10–14 and this plan’s single implementation sequence.

<a id="harness-migration"></a>
## Authorized Harness migration and GPT adaptation

**Scope in progress:** establish the official Harness-derived `harness` branch in the existing AITP repository, retain the old Pi implementation/history and portable `aitp/` submodule, apply aitp-agent product naming through supported application configuration, and adapt the selected GPT route using existing model/credential services. Use the normal Harness launcher/profile flow. Internal upstream package identities may remain unchanged to keep upgrades tractable; product naming is not a request to rewrite every package scope.

GPT work includes checking the provider and model route, API-key/OAuth capability distinctions, the credential login consumer, streamed responses/tool calls/cancellation, and the previously reported compaction behavior. Reuse fixes already present upstream instead of assuming the earlier symptom is still present. Source inspection, recorded/mock tests, actual login and live model calls are separate evidence. Do not claim a working login or live GPT run from a registered provider or passing unit test. Credentials stay local and absent from committed records.

**Current evidence:** the imported official source and fork were checked at the same revision, version `0.2.1-rc.2`. Product configuration, brand and terminal-auth plugins are implemented; artifact construction and aggregate type checks pass. Focused tests cover provider routes, synthetic authorization, terminal secret handling, launcher shutdown, same-mode sandbox escalation and nonshrinking summaries. The [Harness receipt](../../agent/notes/harness-integration.md) owns commands, counts and remaining checks. Actual ChatGPT authorization, live GPT requests and native packaged application checks remain unverified. Loading AITP Skills establishes method discovery only; the required research runtime integration below remains design work.

**Preserved limits:** this work does not migrate Pi runtime stores, modify real research notes, adopt a new note format, authorize scientific computations, enable unrestricted research-writing tools, or claim completion of P1–P5. Generic Harness tools may have effects under its own configuration; the imported application is not yet an accepted read-only AITP research profile. Use isolated synthetic/scratch work for adaptation checks. A future research profile must make its actual tools, memory delivery and applicable user instructions clear before use on research roots; it does not add a fixed scientific action order.

**Handoff:** report the actual route evidence through the [GPT work package](#gpt-integration-readiness), then follow the [next implementation slice](#next-implementation-slice). Re-run the four old counterexamples against the new runtime when the corresponding research services exist; host replacement alone closes none of them. Scientific qualifications and exact-source citations remain requirements; later writing policy remains undecided and must not be generalized into a ceremony for ordinary research actions.

<a id="gpt-integration-readiness"></a>
## GPT reliability before research-quality claims

The researcher reports bugs and poor results with earlier GPT use in Harness. Treat this as an engineering and behavioral investigation with reproducible examples, not a promise that a new preset improves the underlying model. Preserve the actual failing task, provider/route, selected model, reasoning setting, tool availability and failure stage. Diagnose authentication, request conversion, model-visible instructions/context, tool handling, retries and research judgment separately. Reuse an applicable upstream correction before adding another workaround. A symptom without a retained example remains reported or unverified until reproduced; this planning pass runs no regression or live request.

**Recorded baseline:** the [existing receipt](../../agent/notes/harness-integration.md#gpt-validation-boundary) records fixes for secret-input history and launcher child cleanup, and passing focused regressions for escalation and nonshrinking-summary handling. Those checks do not close every tool-family parameter combination or repeated compaction across later steps. Actual sign-in and live GPT behavior remain unverified. The current [real-provider cases](../../packages/llm/llm-pi-ai/tests/provider-api-cases.ts) and [live suite](../../packages/llm/llm-pi-ai/tests/provider-apis.e2e.ts) do not cover the `openai-codex` OAuth route; a passing OpenAI API-key case cannot supply that missing evidence.

The following primary-source investigation was checked on 2026-10-22 against the imported `0.2.1-rc.2` source. Reports retain their original host, route and plugin versions. Source inspection identifies candidate regressions; it does not reproduce their runtime effects.

| Report and original scope | Current source assessment | Regression target |
| --- | --- | --- |
| [Same-mode escalation, #5847](https://github.com/deepseek-ai/deepseek-harness/discussions/5847), September 7: GPT-5.6 Sol under full access; [#4021](https://github.com/deepseek-ai/deepseek-harness/discussions/4021), August 22: `0.1.1-rc.2`, Azure Responses | The shared [approval resolver](../../packages/sandbox/sandbox/src/escalation.ts) now accepts the effective mode; bash also bypasses its justification check for that case. The [filesystem resolver](../../packages/fs/tool-fs/src/sandbox.ts) still validates parameter pairing first. Partial correction, not closure of all reported variants | Test bash, PowerShell, write and edit separately: same mode with absent, blank and valid justification; narrower, unknown and genuinely wider requests. Preserve ordinary execution and legitimate approval semantics |
| [Repeated compaction, #8733](https://github.com/deepseek-ai/deepseek-harness/discussions/8733), October 3: `0.2.0-rc.2` plus third-party `dsh-plugin-subscriptions 0.9.7`, GPT-6 Luna/GPT-6.1 Sol; related [checkpoint-only report #7212](https://github.com/deepseek-ai/deepseek-harness/discussions/7212) uses OpenRouter DeepSeek | Current [range selection](../../packages/compaction/compaction-basic/src/region.ts) can select the previous checkpoint alone. The [engine](../../packages/compaction/compaction-basic/src/index.ts) bounds one invocation and rejects nonshrinking output, but those protections do not establish progress across later steps. Lowering output reservation is a mitigation | Repeated pre-steps over an unchanged checkpoint, small reductions, output reservation and fixed overhead, bounded total wasted attempts, visible recovery and cancellation; preserve scientific qualifications independently of token reduction |
| [Smaller-window switch, #9814](https://github.com/deepseek-ai/deepseek-harness/discussions/9814), October 15: `0.2.0-rc.2`, initially a third-party provider; later GPT-6.1 Sol report | The current [summarizer](../../packages/compaction/compaction-basic/src/summarizer.ts) still selects configured, latest-request or agent target without a capacity-aware alternative. Current runtime failure remains untested | Large-to-small model switch and stale/deleted route; show the actual compaction failure and a usable recovery. Do not silently send research material to another provider |
| [Tool-argument reparsing, Pi #9265](https://github.com/earendil-works/pi/issues/9265), September 7: pi-ai `0.85.1`; Harness [#3923](https://github.com/deepseek-ai/deepseek-harness/discussions/3923) reports a relay route | The installed pi-ai patch and [streaming tests](../../packages/llm/llm-pi-ai/tests/tool-argument-streaming.spec.ts) address repeated parsing. This supports a scoped CPU-cost correction, not the report's inferred cause of every gateway 500 | Large and truncated streamed arguments, parallel calls, prompt cancellation and responsiveness of another session; retain coverage when upgrading pi-ai |
| [Resume pressure, #5662](https://github.com/deepseek-ai/deepseek-harness/discussions/5662), September 4: Windows `0.1.2-alpha.4`, Codex GPT-5.6 Sol | The reported first-resumed-turn cause was a hypothesis. Current automatic compaction returns early without a routed request target; the interaction with restored sessions needs a dedicated check | Restart above the pressure threshold and inspect the first new request, effective route and actual compaction events |
| [Transient overload, #5377](https://github.com/deepseek-ai/deepseek-harness/discussions/5377), September 2, corrected September 3: `0.1.1-rc.2`, Codex GPT-5.6 Sol | The reporter resumed the same session successfully without the proposed protocol shim and withdrew the deterministic incompatibility explanation | Distinguish provider capacity, authorization, request rejection and local tool failure; preserve actual retry evidence instead of adding an unsupported wire workaround |

Community implementations are references, not installed dependencies or acceptance evidence for this fork. The [GPT preset proposal](https://github.com/deepseek-ai/deepseek-harness/discussions/3429) strips several classes of escalation fields; inspect each semantic change before reusing it. [pi2dsh's subscription example](https://github.com/weijiafu14/pi2dsh/blob/main/examples/subscription-login/README.md) reports a dated OAuth-to-live-response check on `0.1.0-rc.8`, which is useful as an acceptance sequence but does not validate this application's route. [dsh-llm-codex](https://github.com/NOirBRight/dsh-llm-codex/blob/main/README.md#remote-compaction-not-enabled) leaves remote compaction disabled pending durable opaque-item replay; a future alternative must be checked through the next wire request, restart and branch, not just a successful compaction response or an apparent cache hit.

| Work item | Implementation/test home | Evidence needed before claiming the item works |
| --- | --- | --- |
| Reproduce symptoms and resolve effective configuration | Existing `llm-pi-ai` model/config/adapter code, profile composition and launcher | A minimal case and effective provider/model/protocol/effort; user overrides preserved. Separate a known fixed regression from a currently failing example; never silently substitute another model |
| Validate API-key and Codex OAuth separately | Existing auth/login services and `apps/cli/src/aitp-auth.ts`; extend route-specific live tests where missing | Fresh login where required, reopening credentials, cancellation and refresh/failure handling; actual model request through each tested route. Report inaccessible routes separately and keep secrets out of evidence |
| Preserve request and streamed tool semantics | `llm-pi-ai` context/stream/replay and protocol-roundtrip/tool-streaming tests | Text and supported reasoning items, tool declarations, parallel call IDs/arguments/results, tool errors and interrupted streams survive conversion; a partial call is neither completed nor executed twice |
| Bound retries, permission handling and cancellation | Existing retry, sandbox escalation and launcher/session lifecycle code | Rate limit, timeout, interrupted transport, invalid model/setting and denied operation have distinguishable outcomes; retries are bounded and observable, cancellation settles actual work, and denial does not create a repeated same-mode escalation loop |
| Verify context and continuation | Provider conversion, compaction and the selected AITP memory slice | Actual requests preserve operative corrections, useful failed routes and declared method scope; a missing source is visible. Run deterministic failure injection and then live behavior checks; neither replaces the other |
| Observe cost, latency and route limits | Existing token-meter, request/session records and trial output | Actual route/model/effort, attempts, elapsed time and reported usage with unknown categories explicit. Subscription access is not zero cost; estimates and unavailable billing stay labelled. Native packaging/Windows behavior require their own later checks |

For Responses-based routes, inspect preservation of model-produced reasoning items and associated tool calls/results using the [official reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning). This is protocol handling, not a request to expose private reasoning. Distinguish Harness summary compaction from [API-native compaction](https://developers.openai.com/api/docs/guides/compaction); verify what the selected route actually supports instead of assuming the mechanisms are interchangeable. These sources define audit targets, not evidence that the current adapter is defective or supports every documented API feature.

First validate the actual source-launched aitp-agent composition on isolated fixtures. Carry each observed defect through minimal reproduction, scoped fix, focused regression and a relevant live check when possible. Use the [case comparison](13-research-journeys.md#comparative-evaluation) to assess the resulting research behavior. An unavailable credential, inaccessible model, unobservable setting or platform dependency gets a precise blocker and a useful remaining offline check; skipped tests never count as passes. Offline parser/context work and client implementation against the completed UI design can proceed while a live route is unavailable, but research-quality conclusions must retain that limitation.

<a id="runtime-integration-plan"></a>
## Development dependencies for runtime research memory

The researcher requires AITP integration into the underlying runtime and clarified that the central function is to prioritize useful research memory/context, with flexible agent-selected actions. A fixed action-constraint engine, mandatory reading-readiness gate or prescribed literature/derivation/code sequence is not the selected design. The [architecture](10-project-workspace.md#aitp-runtime-integration) owns the source-backed integration points. This section plans development; it does not authorize all research features or claim that loading Skills implements memory.

The [development crosswalk](#development-crosswalk) is the single assignment table for these responsibilities. Architecture owns their conceptual separation; this plan assigns sources, working items, actual delivery, model feedback and dependent views to concrete work. Task memory, context, method use and proposal state share one integrator initially. Independent readers can use the agreed resource/observation interface without waiting for one another.

One integrator owns the minimum shared source/observation/task/projection definitions needed by the next example. Source access, working-memory continuity and UI can then develop against fixtures in parallel; context selection integrates their real outputs. Avoid a universal framework or permanent phase machine before this small path works.

The inherited [Skill registry](../../packages/skill/skill/README.md) already provides discovery and loading. Its [filesystem provider](../../packages/skill/skill-filesystem/README.md#roots-and-priority) uses the nearest Git project root and configured directories, not the research topic/branch relationships; nested Skill bundles are not automatically discovered. Its [model tool](../../packages/skill/tool-skill/src/index.ts) loads full instructions, and explicit `/name` also injects the full body. Topic relevance, applicability judgments and selective methodological reuse therefore require new integration, without replacing the registry or treating partial borrowing as permission to discard relevant instructions. [11](11-research-memory.md#skill-applicability) owns those semantics. No universal metadata migration is required for existing Skills.

Harness also supplies [dock/split machinery](../../packages/client/ui-sidebar-right/README.md#what-lives-here-and-what-does-not), [document previews](../../packages/client/ui-sidebar-documentpreview/README.md) and [read-only LSP navigation](../../packages/lsp/lsp/README.md). These are reusable foundations, not a complete research library or VS Code-equivalent editor. Previewing a PDF/code file does not deliver it to the model; the current previews use Session file addresses. Research-wide browsing, edition/page/range attachment, editable code and scientific argument links require their own named integrations. The new workbench should reuse renderers and layout primitives while making resources accessible without inventing a conversation merely to browse them.

The [next implementation slice](#next-implementation-slice) owns the single first-runtime specification and its acceptance examples. The source, working-memory and context providers can be tested headlessly; P0 UI acceptance is not a prerequisite. Keep actual context fidelity, observed model behavior and scientific interpretation as separate results.

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
| Harness base and GPT reliability | Explicit migration/GPT request, reaffirmed as a priority | Host/auth foundation implemented with recorded checks; live GPT acceptance outstanding | [GPT work package](#gpt-integration-readiness), [execution evidence](../../agent/notes/harness-integration.md) | Reproduce reported symptoms; validate selected API-key and OAuth routes independently; no live success or quality improvement inferred |
| Headless research-memory continuity | Source/working-item interfaces and isolated fixture profile; no P0/UI acceptance dependency | Planned first research slice; not implemented | [Single next-slice definition](#next-implementation-slice); C01/C06/C16; engineering replay plus later paired live behavior | Model-authored working-item producer/recovery, meaningful source omissions and actual request delivery missing |
| P0: coherent design and inspectable prototype | Recovered design request and source audit | Claude design and Harness-frame prototype handed off; recorded synthetic checks only; researcher acceptance pending | [Current design](12-desktop-interface.md), [prototype check and limits](prototype/harness-frame/README.md#browser-check); [P0 acceptance](#p0). Earlier [review](15-design-review.md) retains its original scope | No integrated client/backend or human usability acceptance; the standalone shell is superseded as the target frame |
| P1 / UI-1: topic → note → Session → context | Research-root/topic/note resources with Session-independent read authority, origin metadata, working-item and observation projections | Design handed off to Codex; application implementation and acceptance pending | [UI-1 route](12-desktop-interface.md#increments), [P1 demo and acceptance](#p1), C01/C16; W1 and the note part of W2 in the running application | Resource/projection integrations, exact delivered citations and model-writable working items remain missing; no complete UI-1 claim from a partial read-only view |
| P2a: notes and source-backed knowledge wiki | Research-record/source interfaces and view callbacks | Planned independent provider/reader | No slice acceptance evidence; [child gate](#child-gates), [C05](13-research-journeys.md#c05), [C07](13-research-journeys.md#c07), [C19](13-research-journeys.md#c19) | Global wiki navigation, knowledge adapter and dedicated where-used views remain unavailable; current note-link lookup is only a foundation |
| P2b: literature library and actual PDF reading | Resource/selection definitions, bounded binary access and view callbacks | Planned independent reader; not implemented as a research route | No slice acceptance evidence; [child gate](#child-gates), [C04](13-research-journeys.md#c04), [C21](13-research-journeys.md#c21) | Global collection/work/edition browsing and selection integration required; discovery/import in C03 remains separate |
| P2c: local code, diff and history | Checkout identity, bounded source/Git access and view callbacks | Planned independent reader | No slice acceptance evidence; [child gate](#child-gates), [C08](13-research-journeys.md#c08) | Research source/checkout links and bounded comparison required; generic agent editing/execution already exists under Harness permissions |
| P2d: native research workspace and WSL attachment | Existing host/client/auth services and explicit root mapping | Carrier selected; research attachment unverified | [Attachment checks](#child-gates), [C18](13-research-journeys.md#c18) | Reuse Electron; actual Windows–WSL lifecycle and research attachment need real-host checks |
| P3a: complete proposal on scratch copies | Source/agreement observations and minimal proposal view; no full P2 dependency | Planned early Markdown route; not implemented | [Child gate](#child-gates), [C15](13-research-journeys.md#c15) | Implement proposal/pending outcomes through Harness; apply stays disabled |
| P3b: actual independent review and assessment | Existing entry or proposal revision, observations and bounded subagent tools | Planned; actual review integration missing | The old Pi queue/export is not Harness reviewer execution; [child gate](#child-gates), [C15](13-research-journeys.md#c15), [C20](13-research-journeys.md#c20) | Reviewer runtime, coverage, existing-entry inspection without an edit proposal, and revised-proposal handling unavailable |
| P3c: controlled scratch apply and recovery | P3b accepted and authoring policy approved | Proposed; policy undecided | No apply/recovery acceptance evidence; [P3 policy](#p3), [C15](13-research-journeys.md#c15), [C16](13-research-journeys.md#c16) | Explicit non-hash comparison policy needs approval; authority and recovery services unavailable |
| P4: one named real authoring pilot; separately chosen bounded workflow | P3 accepted and named paths/actions approved | Proposed; pilot not selected | [P4 acceptance](#p4); selected cases must be named when the pilot is chosen | No real authoring, run/build or manuscript action authorized by this plan |
| P5: selected orchestration and wider research workflows | P4 accepted and chosen capability approved | Proposed; capability not selected | [P5 acceptance](#p5), e.g. [C09](13-research-journeys.md#c09), [C10](13-research-journeys.md#c10), [C17](13-research-journeys.md#c17) | Controllers, execution adapters and resource admission remain unavailable; cases are not all promised by P5 |

<a id="next-implementation-slice"></a>
### One implementation sequence, with parallel UI and readers

The current deliverable is the researched plan and its publication. Subsequent implementation follows the sequence below under the researcher's instruction to proceed incrementally; ordinary implementation, repairs and relevant checks do not require repeated milestone permission. Material product-policy choices and real research writes retain their stated boundaries.

1. **Establish GPT reliability.** Follow the [GPT work package](#gpt-integration-readiness): reproduce the relevant public reports against the actual route, preserve already-correct behavior and fix reproducible failures with focused regressions. Confirm the selected live route when access permits. A missing live credential blocks that evidence, not offline implementation or the client work handed to Codex. Login alone cannot complete this work.
2. **First research slice: headless memory continuity on an isolated scratch root.** Read the main note's opening, current work and useful failed-route passages with locations. Provide the explicit, non-blocking working-item producer and bounded context projection from [11](11-research-memory.md#working-memory-items), including attributed user corrections, model-provisional gaps/next steps and failed routes with reopening conditions. Derive source availability from actual observations and visible history. Replay existing session records before introducing a new event type. This slice does not wait for P0/P1 UI acceptance and does not write scientific notes.
3. **Skill discovery and actual use.** Expose sources and shadowed candidates, the portable manifests' declared method roots, and loaded/still-visible/changed status. Then exercise C22's full use, partial borrowing and rejected same-topic method through a model-authored use item. Candidate retrieval supplies conditions; the main model judges fit. Extend the registry/consumer where its current winner-only, name-only API cannot supply that evidence. Portable borrowing guidance is a separately coordinated AITP change.
4. **Implement the handed-off UI and connect domain readers.** Codex implements [UI-1](12-desktop-interface.md#increments): topic → note → Session → context, consuming the headless contracts and explicit Session-independent read authority. Research records supply verbatim topic-home content and affected-use links. UI-2–UI-6 and knowledge, literature/PDF and code/history providers proceed independently when their named dependencies exist; their numbering is not a serial prerequisite chain. Test browsing separately from model attachment. Desktop/Windows–WSL attachment remains its own environment-dependent increment.
5. **Proposals, actual review and a distillation draft.** Connect sources and working state to unapplied Markdown proposals, pending/no-change outcomes and a real bounded reviewer. A first distilled draft remains transfer-untested. A later increment delivers it directly as scoped instructions to a subagent on a changed instance, with a named reviewer or researcher assessing the trial; installation is unnecessary for that experiment. This work does not wait for every reader or the native host.
6. **Writing and broader execution by their actual dependencies.** Enable scratch apply after choosing the non-hash comparison/recovery policy and checking proposal → review → assessment → apply together. Select a named real-source pilot before real note writes. Rule saving, richer code editing, research-linked execution and cluster workflows need their explicit scope and available adapters, rather than every preceding reader.

UI-1 client work can proceed against explicit source/projection fixtures while the headless slice is built; complete UI-1 acceptance requires the real providers and does not require the later Skill slice. [12’s increments](12-desktop-interface.md#increments) own the UI routes: UI-2 consumes literature/knowledge providers (W2), UI-3 the all-candidate Skill/use interfaces (W4), UI-4 rule save/adoption (W6), UI-5 checkout/comparison resources (W3), and UI-6 proposal/evaluation records (W5). A later UI number does not imply a dependency on every earlier view. Every walkthrough remains synthetic and unaccepted until its named application checks and researcher assessment occur.

For the headless slice, deterministic acceptance includes Chinese and English corrections followed by two compactions and a restart; failed-route/reopening-condition preservation; a deleted source producing an honest omission while the turn continues; identical reconstruction of the active block from logged events; and opening the session with the AITP plugin disabled. Model-authored items never become researcher decisions. Generated summaries remain distinguishable from original instructions and provisional items. Test required-context delivery as priority, not elevated instruction authority.

Once the selected GPT route works, run a few paired C01/C06/C16 trials against Codex + the same AITP revision using [13's protocol](13-research-journeys.md#comparative-evaluation). Repeat relevant comparisons as each capability arrives, and review the combined results at the end; report regressions, ties, failures and unavailable comparisons. Offline replay establishes mechanism correctness, not research benefit.

The fixture explicitly declares its root, tool permissions and task lifetime. This does not silently settle the product defaults for permission mode, same-name Skill precedence, restriction duration, saved-rule ownership or session-independent resource access. Keep those choices visible in [current.md](../../current.md); they need a decision before dependent product behavior is released.

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

<a id="development-readiness"></a>
### Development standards and automation readiness

The researcher requires disciplined collaborative development and selected `main` as the integration/default branch. [Contributing](../../CONTRIBUTING.md) owns the contributor procedure: a bounded task branch, declared file ownership, focused validation, affected-document maintenance and a pull request to `main`. Claude supplied the completed UI design/prototype; Codex owns the client/backend implementation handoff. A shared interface/composition has one integrator; a reviewer or passing test cannot grant scientific acceptance.

The 2026-10-22 audit distinguishes written rules and local checks from remotely enforced policy:

| Area | Evidence and remaining work |
| --- | --- |
| Architecture, ownership and evidence | Repository Skill, this plan, current issues and cases specify the process. Each increment still needs actual review and case evidence; documentation alone does not enforce it |
| Local commit/push checks | The active development checkout has Lefthook configured; staged whitespace and applicable code/vendor checks run on commit, typecheck on push. These do not run every behavior test or establish research validity |
| Shared branch policy | `main` is the integration target, with task-branch PRs as the contributor route. At inspection, `main` and `harness` had no protection and no rulesets; required checks/reviews are not yet remotely enforced |
| Remote CI | Imported PR CI queues its main jobs on upstream enterprise runner labels; the push matrix targets `master`. This fork has no configured self-hosted runners. Select portable, keyless checks for `main`/PR and observe them pass before requiring them |
| Imported automation | Issue/App policies and preview jobs still refer to upstream accounts or credentials; observed Issue runs fail. Replace or explicitly scope those integrations before promising them to collaborators. The live DeepSeek E2E workflow is scoped so this fork requires an explicit manual dispatch plus `AITP_ENABLE_LIVE_E2E=true`; no automatic main push or PR starts a live API trial |
| Scientific readiness | GPT live-route and Codex + AITP comparisons remain outstanding as specified above; remote green checks cannot stand in for them |

Contributor onboarding is corrected in this promotion, but the remote CI/review work remains open in [Q17](../../current.md#q17). Before broad implementation fan-out, establish a portable check set, remove assumptions about upstream App/runner access, observe a real PR run, then choose applicable required checks and review policy. Do not require permanently queued checks or enable hash-related AITP gates. This is collaboration infrastructure, not a new scientific action pipeline or another first research slice.

<a id="independent-development"></a>
## Independent development workstreams

The former P2a → P2b → P2c → P2d → P3 chain mixed product ordering with technical dependencies.
An independently developable component has a bounded responsibility, agreed inputs/outputs,
an owned implementation and a useful behavior check. It can be built against a controlled
implementation of a dependency; product acceptance still requires connecting real services.
Keep P0–P5 as user-visible capability/acceptance groups while using the workstreams below
to organize development. Use Harness service/provider/consumer packages and client contributions as the implementation homes; no new repository or process is required per line. Implement the selected sequence incrementally; the table does not activate every future capability at once.

### Small shared preparation

The integrator and affected owners first agree the needed slice of five interfaces, using
the preserved research semantics, Harness extension APIs and concrete successful and failing examples:

1. **Sources and observations:** configured host/root identity, resource/edition/locator,
   guarded resolution, missing/ambiguous/unavailable outcomes, the actual observed text and
   its delivery/current-availability state. Record why an item is needed for the present operation: researcher-selected, explicitly required by an owning source passage, declared by the model, or optional background. A missing item in the first three groups is a consequential declared omission; an ordinary link alone declares no requirement. Unknown dependencies cannot be certified as present. Browsing a resource does not attach it to a model.
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
5. **Working items and feedback:** the Task line owns explicitly reported model items, attributed researcher input/choices and references to source observations, with lifecycle, provenance and current relevance as defined in [11](11-research-memory.md#working-memory-items). A non-blocking model tool adds, revises or retires provisional gaps/next steps, failed routes/reopening conditions, method uses/borrowed scope and outcomes awaiting integration. The context line renders a bounded active projection; Skill use, proposals and distillation consume it. These are inspectable working records, not private chain of thought or model-generated researcher decisions.

Do this incrementally for the chosen work, rather than freeze the whole future system before
any demonstration. A UI task does not need final writeback semantics; enabling writes does.
The common fixture/contracts are examples of agreed semantics, not an additional scientific
record or evaluation framework. Initially reconstruct state from existing user/choice messages, accepted tool calls/results, runtime-context snapshots and visible history. Distinguish durable logged evidence from transient state. If an input has no adequate existing carrier, use the smallest compatible owned event with all readers and persistence acknowledgements checked; disabling the plugin must not make a session unreadable. Best-effort/ignorable experimental plugin records can carry dispensable state, but cannot solely own facts whose recovery is promised. Do not create a parallel memory database or let each domain invent its own session event vocabulary.

<a id="development-crosswalk"></a>
### Development ownership and plugin crosswalk

All entries below are proposed work boundaries; this table does not duplicate the progress table.
The [scenario-to-plugin map](10-project-workspace.md#scenario-plugin-map) groups user-facing functions; the architecture's shared services supply their interfaces. This table maps both to assignable work, rather than adding another decomposition. A domain plugin can own Host and optional Client entries; one row need not become one package, process or repository.

**Owners:** Claude completed the [UI design](12-desktop-interface.md) and [synthetic Harness-frame prototype](prototype/harness-frame/README.md). Codex implements its client contributions and the core/backend work, GPT fixes, shared definitions, tests and implementation evidence. Other contributors can take a bounded client/provider or regression case after declaring its files. The handoff does not establish integrated application behavior or human usability. Keep task/context, method-use records, proposals and initial distillation under one integration owner until the first slices work. They share state and are not safe independent schema-design tasks.

**File boundary:** use existing owner packages for GPT fixes. Reserve `packages/experimental/aitp-research/` for the first research integration package, with separate `task`, `context`, `sources`, `methods` and `proposals` modules and owner-local tests; this is a proposed path, not an existing implementation. Independent knowledge/literature/code providers can be split into their own Harness packages when their interface is exercised. Codex owns the proposed `packages/client/ui-aitp-resources`, `ui-aitp-research`, `ui-aitp-session`, `ui-aitp-materials` and `ui-aitp-rules` contributions, with responsibilities in [12’s implementation handoff](12-desktop-interface.md#implementation-handoff). These are reservations, not existing packages; agree exact files before concurrent edits. The integrator alone updates shared contracts and composition under `packages/bundle/` and `scripts/aitp-agent.ts`. Keep the existing auth/brand plugins in their current homes. Portable methodology stays in `aitp/` and requires a separate upstream change.

| Line | Bounded deliverable and implementation home | Minimum dependency; what it need not wait for | Local check and eventual case |
| --- | --- | --- | --- |
| **GPT integration** | Existing LLM/auth/compaction/tool packages; the [GPT work package](#gpt-integration-readiness) owns issue routes and regression targets | Minimal failing input and actual effective route; no research UI or note writer required | Provider/tool/permission/compaction regressions followed by available live-route checks; prerequisite for attributing research-quality differences |
| **Task, agreement and working items** | AITP task-memory provider, explicit model-item tool and projection/replay using existing Harness events; maps the architecture's working-memory service and evidence feedback to one owner | Agreed input/lifecycle semantics; no reader UI or desktop host required | Correction and provisional failed route → queued input → two compactions → restart/Continue retains meaning, provenance and reopening condition; C02/C06/C16 |
| **Context and observations** | AITP source/context contributors plus request, read-tool and compaction integration; renders active items and declares observed omissions | Guarded source reads and task/working-item interface; complete wiki/PDF views can be substituted locally | Deleted selection yields partial context; selected text beats background; dropped text cannot remain available; unmet declared method prerequisites remain visible; C06/C16/C22 |
| **Research records and topic home** | Main/subnote providers and a topic-home view of qualified conclusions, open questions, branches, relevant resources and next useful work, derived from owned notes | Filesystem service, conservative parsers and resource definitions; no PDF, code browser or live model required | Main note → detailed argument → original owner; missing links and unverified conclusions remain visible without a second editable project truth; C01/C07/C16 |
| **Knowledge library** | Source-backed wiki provider and view: concepts, conditions and prerequisite/source links; consumes the research-record link resolver for bounded affected uses | Research-record/source interfaces; fixtures can stand in for topic home and other readers | Synthetic entry → prerequisite/source → affected use, with ambiguity and search-coverage limits retained; C05/C07/C19/C20 |
| **Literature and PDF** | Literature provider and client reader: work/edition metadata, PDF, page/selection locators | Resource/selection definitions and bounded binary access; shared bibliographic lookup through a narrow interface, no wiki UI dependency | Actual test PDF, edition/page distinction and located selection; C04/C21 |
| **Code and history** | Checkout provider and source/diff/history view using preview/LSP; generic Harness editing/execution already exists, while research-linked receipts and richer editing/debugging need named increments | Checkout identity, bounded Git/source access; no PDF or execution required for the initial reader | Same-named checkouts and dirty fixture preserve target/scope; selection links to the claim; execution success does not establish independent scientific validation; C08 |
| **Research client — Codex, from Claude’s design** | Proposed client packages from the [UI handoff](12-desktop-interface.md#implementation-handoff); Harness frame contributions, shared readers and selective information display | UI-1 requires root/topic/note resources, Session-independent read authority, origin and memory/observation projections; later reader panels need only their own providers | UI-1 W1/note-W2 in the running application; no Session from browsing, pane-local selection, truthful compaction/missing-source states and reconnect; C01/C04/C16 |
| **Skill catalog, candidate retrieval and use view** | Extend/consume `ctx.skills` or add an AITP candidate provider to expose source-qualified and shadowed entries; package relevant conditions, then show the main model's attributed method-use item | Registry/provider work beyond the current winner-only name lookup; source observations and task-owned use records; no distillation writer required | Existing Skills without added metadata remain usable; full load differs from full applicability, partial reuse retains dependencies, changed/compacted instructions are reported accurately; C22 |
| **Distillation, initially shared with Skill use/proposals** | Invoke portable `aitp-distill` on concrete use/failure/correction evidence and propose a focused addition/revision; no separate initial state store or team | Method-use observations and proposal service; later transfer evaluation also needs bounded subagent delivery and a named assessor | First demo ends with transfer untested; a changed-instance trial preserves failure and does not install/publish the candidate; C14 |
| **Collaboration rules** | Rule-source provider and editor for writing/memory/collaboration guidance, with source ownership, inheritance and saved-versus-adopted visibility | Source/rule resolution and document-change service for persistent edits; a read-only inspector can precede writing | UI edit preview identifies the owning source and target session; saving does not falsely claim current adoption or silently modify portable Skills; C16/C22 |
| **Proposal and pending integration** | AITP document preview provider, proposal records and logged pending/no-change outcomes | Sources and agreement; no completed reviewer, resource suite or apply engine required | Full argument/caveats retained and visibly unapplied after restart; C15/C16 |
| **Independent review** | AITP review provider over Harness subagents, with bounded read-only tools and original logs | Entry or proposal revision, sources/agreement and actual subagent execution; no apply engine required | Dropped caveat, unread premise and existing-entry review produce real coverage/findings; C15/C20 |
| **Controlled apply and recovery** | AITP document writer and authority provider integrated with Harness tool/fs services on scratch roots | Approved non-hash policy, proposal and assessed review before operational use | External edit, ambiguity and interrupted multi-file apply preserve evidence; C15/C16 |
| **Desktop attachment** | Existing Harness Electron/host services plus explicit research host/root mapping | Authenticated host connection and lifecycle decision; no complete resource suite required | Actual Windows–WSL attach, unavailable host, close/reconnect and open-in-editor; C18 |
| **Scenario comparison** | Existing focused tests, scoped case fixtures and integration receipts; [13](13-research-journeys.md#comparative-evaluation) owns the paired-run protocol | An implemented capability and actual access to both comparison routes; offline checks proceed independently | AITP-agent versus Codex + identical AITP, per-case evidence and limits, failures retained; no universal scientific score or new evaluation database |

Computation, cluster submissions, manuscript builds and broader multi-agent orchestration remain
separately selected P4/P5 slices. They need the task/authority/observation boundaries and relevant
execution adapters, not completion of every reader or the native host. Browsing code does not
authorize executing it; a native window does not add filesystem authority.

### Integrate real capabilities as they become available

The [single implementation sequence](#next-implementation-slice) owns which combined example comes next. Independent providers can be built against controlled fixtures; acceptance requires connecting their real services. A static illustration, callback stub or queued review cannot establish a working PDF adapter, model attachment or independent reviewer. A rehearsal using Codex/Claude Code on Markdown copies can test scientific preservation and reviewer inputs before the application path exists, but cannot verify the application's mechanisms.

### Keep shared edits and activation under control

The retained `agent/streams.json` describes only the old S1–S6 Pi ownership. Before research implementation fan-out, assign concrete Harness files/tests for the selected providers and consumers; keep shared definitions, event declarations, composition, manifests and central client contributions under one integrator until interfaces are settled. Do not direct a Harness task to old Pi ownership paths.

Use documented Harness service/events and explicit read-only projections. Inspect request admission, tool execution, compaction and restart consumers before registering listeners; avoid recursive state mutation, duplicate delivery ownership or a second generic event bus. Registration effects must dispose with the plugin. Cross-module schema changes include providers, consumers, fixtures and persistence implications together.

An approved line can perform its ordinary edits and checks without repeatedly asking permission.
Its approval does not activate unrelated lines, a new writing policy, real-note writes or outward
effects. Component behavior, actual integration and researcher/scientific acceptance remain
distinct. Shared heavy-process limits still apply even when development is concurrent.

The [child table](#child-gates) uses actual capability dependencies. Readers and desktop attachment can advance independently; Markdown proposal/review needs its real source/task services. Preserve proposal → assessed review → controlled apply and the named real-source boundary.

## Delivery agreement

Claude’s completed design/prototype is the UI handoff; Codex owns client and core/backend implementation and relevant tests under the [crosswalk](#development-crosswalk). Shared contracts and composition changes have one integrator. Independent review has access to the original material and session evidence, not only the implementer's account. Use the actual selected model/settings and record them when they affect evidence; this plan does not mandate a particular implementation model.

For each bounded increment, implement, run relevant checks, inspect the result and update the affected architecture, cases, current issues and implementation evidence. Continue ordinary authorized work without requesting a new approval after every passing test or numbered group. Report material blockers and decisions before dependent work: changing core research assumptions, choosing unsettled product authority defaults, real-note authoring or new external effects remain bounded by actual user instructions. Publishing this coordinated documentation is explicitly authorized.

| Acceptance dimension | Evidence the researcher receives |
| --- | --- |
| Scientific | Claims, qualifications, unresolved questions and ownership stay faithful to the example; execution success and scientific support remain distinct |
| UI | Delivered screens implement the selected design, preserve source/context distinctions and expose errors; ownership assignment is not implementation evidence |
| Usability | A person completes the named task and reports friction/assistance; scripted walkthroughs cannot establish usability |
| Technical and comparative | Relevant behavior/recovery checks plus the corresponding [AITP-agent versus Codex + AITP comparison](13-research-journeys.md#comparative-evaluation); report failed, skipped, mocked and live evidence separately |

Researcher acceptance is recorded only when it occurs, with its scope. An unavailable test stays unavailable with the reason and useful alternative; it does not halt unrelated work or turn into a pass. Keep detailed executed evidence in the [Harness integration account](../../agent/notes/harness-integration.md) or its scoped linked receipt, with this plan owning the resulting development judgment. No parallel approval database or completion ledger is needed.

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

**Work and interfaces.** [12](12-desktop-interface.md) and the [Harness-frame prototype](prototype/harness-frame/README.md) now own the navigation and interaction handoff. Harness supplies the frame; AITP contributes Research, Materials and Rules global panels plus Session actions and dock readers. The earlier standalone prototype and its Pi parser remain historical evidence. Current public fixtures/screenshots are synthetic; private format trials and screenshots stay outside the published tree. The recorded prototype browser check establishes only its stated mock interactions, not parser, provider, model or application behavior.

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

**UI acceptance:** the researcher assesses the format and screen behavior for the chosen P1 integration. Headless memory work and independent provider development do not wait for this UI decision.

<a id="p1"></a>
## P1 — A usable read-only project workspace

**Usable result.** UI-1 implements topic → note → Session → context within the [Harness frame](12-desktop-interface.md#layout-and-navigation). Harness Workspaces remain the sole project list. Research reads notes in its own regions without a Session; later Materials/Rules increments use the same global-panel frame. The main column alternates a panel with the conversation. The right dock exists only for a displayed Session and allows at most two panes. UI-5 later adds a comparison tab containing two resources beside the conversation without inventing a third dock pane. The researcher can resume a thread, attach a source, continue a conversation and inspect what context reached the model. Everything in this milestone is read-only with respect to research
files. P1 connects the headless memory/source contracts to working interactions; its UI integration does not delay the earlier headless slice.

| Module | Concrete change and proposed interface |
| --- | --- |
| AITP research/source definitions | Derived project home, explicit member/source references, observed time, optional anchor and resolution status; version research projections without relabelling old manifests or editing upstream Session fields casually |
| Research-record provider | Parse concise state and account pointers, retain complete raw spans/warnings, report duplicate/missing/moved targets and conservative legacy note formats |
| Source/index and rule providers | Reread bounded owners, derive indexes and distinguish authored instructions from research prose; index loss never loses source content or task authority |
| Agreement/context providers and Harness events | Record explicit decisions, scope and adoption; resolve parent-use/plan/selected passages; retain required observations and omissions at actual request admission and through compaction/restart |
| Harness host API contributions | Expose project/source/context projections with validated unavailable/ambiguous responses; use the authenticated host/client transport |
| Harness client plugins | UI-1 Research panel, topic/note reader, Session hover/origin, task card and Sources & memory page; shared readers render in global-panel regions and Session dock tabs; navigation state contains no scientific claims |

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
No agent can claim all hidden premises have been detected. P1 does not add literature retrieval, research-linked execution receipts, document writes or a universal autonomous research controller. Generic Harness execution already exists under host permissions; it is outside the read-only research workspace demo.

Use the [proposed client reservations](12-desktop-interface.md#implementation-handoff) and [required backend data](12-desktop-interface.md#harness-integration-map-and-missing-backend-information) before parallel implementation. UI-1 requires a research-root/topic projection, a note resource with Session-independent read authority, Session origin metadata, working-memory/observation projections and the model-writable working-item producer. A partial reader/task view may show only supported researcher items and source states with the agent section absent; it must not claim complete UI-1. Harness owns frame widths, Workspace grouping and Session dock state; AITP owns global-panel navigation history. Any added local layout persistence needs a version and reset route, and contains no scientific claims.

**Tests and demo.** Add owner-local provider tests with synthetic examples of both formats,
optional IDs, duplicate titles, multiple parents, a missing detail link and an unresolved move. Extend
Harness-integrated agreement/context tests for a selected thread, an unrelated tab switch, queued input,
status interjection, waiting decision, restart and compaction. Browser checks exercise [W1 and the note part of W2](12-desktop-interface.md#scenario-walkthroughs) at 1440 × 900 and 1024 × 768 in both themes, including panel-to-Session navigation, opening/closing dock tabs, reconnect and keyboard focus. Browse without creating a Session; then open the intended Session before opening its dock resource. Switching between two Sessions and a global reader preserves the displayed origin, task, source position and actual context state.

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
labelled. UI: one Workspace list, global panels and the Session dock follow the handed-off frame at the stated widths without truncating the only copy of evidence. A source condensed out of history is not shown as available; a missing source stays visible without locking unrelated work. Topic-home prose comes from attributed source passages. Usability: the researcher can return to an interrupted task and explain
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

**Handoff:** review delivered behavior and unresolved choices; continue the authorized sequence. A release or newly expanded capability follows its own explicit scope.

<a id="child-gates"></a>
## Capability acceptance inside broad phases

P2 and P3 group capability acceptance; the [single sequence](#next-implementation-slice) owns development order. The dependencies below supersede the earlier serial reader/desktop proposal. Each bounded result receives the four acceptance dimensions from the delivery agreement. Continue authorized development without a mandatory pause between reader slices; controlled apply and real-source pilots retain their own policy/scope decisions.

| Child gate | Inspectable result and scope | Dependency and demonstration |
| --- | --- | --- |
| P2a Notes and knowledge | Actual mathematical note/source views, global wiki navigation, source-backed knowledge and where-used | Research-record/source interfaces and view callbacks; argument→premise→knowledge comparison plus global index→entry→source→return, with source and reading labels |
| P2b Library and reader | Global collection/work browsing, actual local PDF viewer, editions, page locators and optional selection-to-session | resource/selection and bounded-source services; library→edition→reading note→return, wrong/missing editions and incomplete index |
| P2c Code and Git | Actual bounded source/diff/history for attached local checkouts, no mutation | checkout/source and resource interfaces; formula→exact checkout→dirty diff, unrelated change attribution unknown |
| P2d Desktop host | Existing Harness carrier with explicit research host/root attachment and measured lifecycle | host/client/auth services; actual Windows↔WSL identity, open-in-editor, close/reopen, disconnected-host behavior; no added filesystem authority |
| P3a Scratch proposal | Editable copied note, full diff, source/argument observations and preservation diagnostics; apply disabled | Agreement/source observations, preview and minimal note/proposal view; missing/ambiguous locator and changed premise; no dependency on the complete P2 readers |
| P3b Actual independent review | Real read-only reviewer for proposals and existing entries, coverage, author assessment, stale/missing review states; apply disabled | Existing entry or proposal revision, source/task observations and bounded subagent tools; intentionally dropped caveat and changed dependency outside the edit range, plus a bounded entry review with no proposed edit and unread dependencies |
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
silently relaxed number or an assertion that the old gate passed. The requested [Codex + AITP comparison](13-research-journeys.md#comparative-evaluation) accompanies the relevant implemented research capabilities; report it as outstanding until performed. An unavailable comparison does not block unrelated reader development or justify a quality claim.

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

Follow the [single implementation sequence](#next-implementation-slice) and [development ownership](#development-crosswalk). Maintain architecture, progress and cases as behavior and evidence change. Documentation publication is authorized; host adoption and a passing headless slice do not authorize real-note migration or imply full P1 acceptance.
