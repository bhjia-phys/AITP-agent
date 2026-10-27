# 14. Development plan and implementation progress

This is the maintained owner of **what is implemented, what is being developed, what comes next and what
evidence would justify moving on**. The [target architecture](10-project-workspace.md) explains how the
completed product works; the [physics cases](13-research-journeys.md) test whether those capabilities serve
actual research. Detailed execution and test receipts stay in the
[Pi integration account](../../agent/notes/integration.md) and [Harness integration evidence](../../agent/notes/harness-integration.md), linked here when they change a development judgment.
The documents have different jobs; this plan is not a second session log or a copy of the architecture.

**Current stage, 2026-10-23:** the application base is official DeepSeek Harness, retaining the design and research principles, named **aitp-agent**, with the bounded GPT foundation fixes integrated. The migration and evidence are described [below](#harness-migration). The repository keeps its `bhjia-phys/AITP-agent` address; the Harness-derived branch retains official ancestry and the previous Pi repository history. Promotion to `main` as the integration/default branch is complete. The former Pi head remains in the history at `4eaa9eaf44`; obsolete merged branches have been deleted while worktree files and their original commits are preserved. [README](../../README.md) owns remotes, branch layout and startup; the [Harness receipt](../../agent/notes/harness-integration.md) owns executed checks and limits.

The host selection is settled. Modular core services, independently developable domains, editable rules, selective UI and portable AITP Skill ownership remain requirements. [10](10-project-workspace.md#harness-service-mapping) maps these domains onto Harness. The [development lines](#independent-development) separate work ownership from the P0–P5 research acceptance groups. They do not authorize all proposed features or real-note writing. The old Pi pilot and P0 prototype remain evidence only for their original scopes; no research case is automatically accepted on Harness.

**Current work:** the [comprehensive workbench UI review](#workbench-ui-review) extends the implemented three-library presentation across Research, reading, study notes and discussion. Its current checks and remaining limits are recorded separately from the earlier passes; researcher visual acceptance remains pending. The formal frontend and asynchronous fixture are integrated into main. The optional Markdown research-memory and browser transport plugins were merged into remote `main` through [PR #14](https://github.com/bhjia-phys/AITP-agent/pull/14), commit `c6ea6dead23a72fa811ef31c8505dc6fddcb599e`, with scoped context, existing-Session recovery and configured scratch writing; [B1–B6](#memory-backend-work) owns its evidence and limits. Codex owns the completed UI-1 reuse and shared client integration; backend work retains its separate packages and source/context responsibilities. The original HTML prototype remains design evidence. The [GPT work package](#gpt-integration-readiness) and [receipt](../../agent/notes/harness-integration.md#gpt-reliability-slice) distinguish fixed regressions, local protocol tests, live authorization and unresolved reports. Per-feature scientific comparisons still follow [13](13-research-journeys.md#comparative-evaluation); no research-quality advantage has been established.

The requested bounded real GPT acceptance is also complete: two paired instances each of C08 and C16, with both products meeting the specified finite checks and setup failures retained. The [live receipt](../../agent/notes/harness-integration.md#gpt-live-acceptance) owns outcomes and limits. The coordinated record preserves these results; the next GPT evidence gap is static-catalog versus native context-capacity calibration and near-pressure recovery. The first optional research-memory backend is implemented within the bounded scope below; wider research integration follows the development sequence. This does not authorize real-note writes or claim a comparative quality advantage.

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
owns contract, dependency and upgrade boundaries. Harness/Cordis is selected; the shared interface and first backend slice are implemented within the scope recorded below; wider scientific workflows remain proposed. The authorized host/GPT work does not by itself start the full P1 redesign or approve every proposed module split.

The P0–P5 groups describe capability acceptance. The [single next-slice statement](#next-implementation-slice) and the dependency cells below own the current development sequence; the earlier linear reader/desktop order is superseded as a planning dependency. This does not claim researcher acceptance of the product or settle every authoring policy. The complete reviewed-authoring route requires assessed review; configured B5 scratch writes follow the selected task's review requirements. The old [W0–W6 sequence](08-implementation-plan.md#3-waves-and-milestones) and M1 results remain Pi history, not Harness release gates.

<a id="topic-onboarding"></a>
## Native project setup and topic creation

**Implemented and locally verified, 2026-10-24:** the researcher requested implementing the missing new-topic entry rather than requiring handwritten files and environment configuration. This increment adds authenticated owner enrollment of an existing Harness Workspace, a persisted read/write choice, and real topic/subdirection creation through the existing Research adapter. Browsing never enrolls a directory. Explicit operator-configured roots retain their limits. Runtime enrollment and retry records belong outside the scientific files; no content hashes are introduced.

Initialization preserves an existing project account; writable initialization creates one only when absent, while read-only enrollment writes no scientific files. Topic creation writes an authored question and optional scope into a fresh account, establishes explicit parent/child links, refreshes the map and opens the created topic. It does not fabricate a conclusion or send a model request. The next submitted question uses the ordinary scoped Session path. The [engineering receipt](../../agent/notes/harness-integration.md#native-topic-onboarding) records actual source readback, duplicate submission, read-only access, failure/unknown outcomes, persisted enrollment and the first model-visible context. The complete 326-case related cohort and three real Chromium paths pass; Chinese/dark/compact presentation is included. All seven artifact gates and all five typecheck gates pass through the documented resource-bounded equivalent routes. All 37 non-hash documentation gates and the full lint rules on the 35 changed code files pass; repository-wide typed lint was SIGKILLed and is not reported as passed. Tests use private temporary projects and do not modify original research notes. The implementation and reviewed follow-up updates are integrated through [PR #17](https://github.com/bhjia-phys/AITP-agent/pull/17); the [integration receipt](../../agent/notes/harness-integration.md#reviewed-pr-integration) owns the final publication evidence.

### Qualitative distance from portable AITP

The application pin, maintained AITP repository and installed protocol currently contain the same Skills at `c2e7e3d0ddc386a2dafae244ccd71ff2d70adff3`; the remaining gap is not explained by older Skill text. The runtime supplies attributed context, original-input recovery and bounded source-write mechanisms. The original Skills additionally require sufficiently deep reading, selective writing, repair of actual using passages, preservation of supported reasoning and assessment of independent review. The completed finite comparison below now supports specific instances of those reading/writing judgments. It does not establish general reliability, equivalence or superiority in research, and no percentage distance is warranted.

The requested comparison is complete within its bounded scope: 32 stage attempts across independent nested copies of the portable protocol's integral, commutator and weighted-readout cases, including 16 initial attempts plus separately recorded controls, retries and continuation. The initial pairs provide the same pinned Skills and requested `gpt-6.1-sol` / medium; actual memory-body delivery is verified. Both hosts correctly handle status without writing, a changed child continuation, and correction of known parent/dependent uses. The first implicit-return pair gives correct chat without repairing files, failing the original on-use persistence expectation while honestly treating the wording as status; the alternate wording/premise pair repairs both. This does not isolate the cause or establish a stochastic failure rate. Explicit-writing controls produce correct saved accounts, six file-only new Sessions recover them without edits, and supplied-review controls reject an invalid remedy. The final natural material-entry pair selects the pinned Skills without explicit Skill naming; its differing edit extent is assessed separately from the original strict preservation reference.

Thirty attempts complete; the original Codex no-response timeout and application external-request-cap stop remain recorded. The latter's successful edits are verified, followed by a separately bounded same-Session read-only continuation; neither original non-completion is relabelled. [The owning comparison receipt](../../agent/notes/harness-integration.md#research-behavior-comparison) retains exact controls, prompt and budget differences, imperfect blinding, source-read limits, actual changes and the independent packet/trace assessment. The [comparative protocol](13-research-journeys.md#comparative-evaluation) still governs broader work. No original scientific record or portable Skill was edited; this evaluation changes documentation and an operator-facing bound comment, with no runtime behavior change.

The three independently reproduced recovery gaps were authorized for correction and are now implemented: original unanswered timed questions/options are delivered with reopenable Session references; matching-topic selection precedes the prior-session limit; and a selected deep file can be read when bounded discovery is incomplete. The unchanged default caps remain. Transient history classification avoids replaying unrelated live logs, with identity/revision/lifecycle invalidation for cold observations. Cold event work, first directory discovery and incomplete incoming relationships remain explicit limits. The 353-case related cohort passes, including actual Loader/JSONL, native/PTC settlement, 25-history cold persistence and deep-topic hierarchy/ownership regressions. Three real Chromium paths, all seven artifact checks, all five complete typechecks through the documented equivalent route, and all 37 selected non-hash documentation checks have passing evidence; initial fixture-type diagnostics and the killed site build remain recorded alongside their successful corrections. [The repair receipt](../../agent/notes/harness-integration.md#research-recovery-fixes) owns the frozen negative control, final engineering checks and measurement scope. These checks do not extend the earlier live-model comparison or establish scientific equivalence. The independent research-review workflow remains a separate unimplemented capability; broader Skill discovery/adoption remains a later increment, as the researcher requested. No fixed action gates replace scientific judgment.

**Published, 2026-10-25:** [PR #17](https://github.com/bhjia-phys/AITP-agent/pull/17) integrates this work and all eleven previously open PRs into `main` as `e2b19e1189…`. The [integration receipt](../../agent/notes/harness-integration.md#reviewed-pr-integration) retains the original heads, valid review repairs, Node-minimum decision, full successful pre-push and hosted AITP/addon checks, plus failed auxiliary publication checks and unavailable Copilot review. Post-merge verification confirms all original PRs merged and local main synchronized. This does not authorize scientific writes or broaden the finite research comparison.

<a id="topic-redesign-review"></a>
## Topic-centred redesign review

The 2026-10-23 request authorizes critical assessment, design alternatives, an interactive prototype, README/design updates and a proposed implementation sequence. [16](16-topic-centred-redesign.md) owns that review package and its proposed phases; [prototype evidence](prototype/topic-workspace/README.md) owns the simulation’s tested behavior and limits. Codex resumes Claude’s interrupted design task in the isolated design worktree. UI-1 is preserved; its historical package checks and incomplete host typecheck remain distinct. The design package was published in PR #11. That publication excluded the separate UI-1 implementation commits and implemented no production services or real research-note writes.

The researcher subsequently clarified the design target: immediately legible topics/subtopics, click-through details, tidy operation and convenient AI organization/read-write, with explicit freedom to go beyond the existing research-memory format. The design/prototype/interface package was merged through [PR #11](https://github.com/bhjia-phys/AITP-agent/pull/11) on 2026-10-23. The researcher then authorized completing the formal frontend and asynchronous mock adapter while the backend proceeds independently. Codex owns this client slice on `feat/topic-workspace-client`: reuse UI-1, integrate project overview → child detail → material → return, and display loading, disconnected, stale, unsupported and conflicting outcomes. The formal client and mock adapter are implemented; the assembled Harness browser route and both complete type programs have passed, with the remaining validation boundaries recorded in the [application receipt](../../agent/notes/harness-integration.md#topic-workspace-client). This completes the frontend/mock slice, not full UI-1 acceptance with real providers or researcher acceptance of a research case. [16](16-topic-centred-redesign.md#decisions) defines the topic/document/resource semantics and serializable edit intents. Backend storage, note mapping, persistence and actual model-context delivery remain separate work; this client slice does not implement those services or import real notes.

The researcher then judged the implemented views too dense and authorized redesigning the interaction model in the owning plugin. Claude implemented the [research map](12-desktop-interface.md#research-map) in `ui-aitp-research` on `claude/research-map`. It comprises a directions overview, a branch focus with a qualified summary, a sectioned topic page and a material reader, connected by a location trail and Back that restore position. It adds two optional provider fields, `Project.summary` and `TopicSummary.parentContribution`, with no-display fallbacks. The fixture now covers four levels, long titles, alternative and superseded routes, substantial documents, paged and partial lists and an unreadable branch. The package unit tests, the assembled Web browser test in refresh and replay modes, the client UI i18n, export JSDoc and package README gates, package typecheck and lint pass. Claude's initial fixture-slice coverage report reached full line, branch and function coverage for the files written or rewritten in that slice; this is not a coverage claim for the later backend integration. Pre-existing gaps remain in unchanged modules (`TopicHome`, `TopicNavigator`, `workspace-edit-state`, `workspace-resources`, `workspace-service`, the plugin entries and the fixture adapter's validation paths). The researcher then requested continuing that work together with the real research-memory backend. The combined map uses the shared backend types, scoped question submission and source-preserving scratch edits. Project summaries and explicit research-question sections come from authored Markdown; absent directions and parent-contribution classifications remain absent. The actual browser route now verifies source readback and material-origin delivery to a captured model request, while the existing runtime tests own compaction/restart evidence. [The combined receipt](../../agent/notes/harness-integration.md#research-memory-backend) retains the browser activation and section-heading defects found and corrected during integration. Cross-topic scientific graphs, unrecorded relation labels and durable navigation-position recovery across browser reloads remain unavailable. This does not establish researcher acceptance of the interaction model.

**Topic-page visual pilot, 2026-10-26 — implemented and running-app validation passed; researcher visual acceptance pending.** The researcher requested one representative redesign before extending it to the other pages. The [pilot design](12-desktop-interface.md#topic-page-pilot) follows the actual Harness Plugin manager/detail layout and host primitives, improves topic hierarchy and material rows, and retains the connected services and normal Session path. Cross-library returns now restore scroll, focus and section state without duplicate Back history; PDF viewing-page retention remains separate from source selection. Focused client regressions pass. The actual application passes topic → material → explicit question → return, keyboard menu/focus, dark theme, a 390px window, long titles, empty content and delayed reading. Eleven screenshots and the source-preservation checks are recorded in the [pilot receipt](../../agent/notes/harness-integration.md#topic-page-pilot). The deterministic model verifies selected-source and topic delivery, not research quality. The researcher subsequently authorized [three-library presentation](#library-ui). Its current checks remain separate from the earlier pilot evidence.

<a id="library-ui"></a>
## Three-library presentation

**Native library dock correction, 2026-10-27 — implemented; six running-application scenarios pass.** The researcher explicitly requested keeping all three catalogues on the left and opening details through the complete native document sidebar. The previous increment reused native bodies inside a custom central reader; that was insufficient. The owning Harness sidebar now provides root-scoped document surfaces using the same native frame, tabs and controls as ordinary Sessions, while source-root authority remains independent. An explicit discussion occupies the left area beside the document; catalogue entry and topic return preserve its Session and draft. [12](12-desktop-interface.md#layout-and-navigation) owns the updated layout, and the [new receipt](../../agent/notes/harness-integration.md#native-library-dock) records tests and screenshot comparisons. Retained root tabs currently survive in-app navigation, not whole-page reloads; earlier checks below remain evidence for their own increments.

**Earlier three-library increment, 2026-10-26: implemented and running-app checks passed; researcher visual acceptance pending.** The researcher requested a unified internal UI for literature, code and knowledge, drawing on Zotero, simplified GitHub and wiki reading. This extends the earlier topic-page pilot and the completed [topic discussion workbench](#topic-discussion-workbench). The [interface owner](12-desktop-interface.md#library-presentation) records the design choices; the implementation preserves the real providers, source-set saving, scope, native conversation and return behavior.

The common library frame and reader controls now host domain-owned literature/knowledge/code presentations through typed keyed slots. Actual-app acceptance covers desktop, dark and 390px windows, long titles, empty/loading content, keyboard use, real source metadata and links, repository folders and Git comparisons, exact PDF pages, saved source sets and topic → material → question → return. Existing workbench save/refresh/restart scenarios also pass. [Validation and screenshots](../../agent/notes/harness-integration.md#library-ui) retain the bounded evidence: a deterministic external model verifies delivery, not scientific quality. No scientific source migration, new persistence format, model runtime or real-note editing was introduced. Complete Zotero-style collection management, Git editing and semantic knowledge relationships remain outside this presentation increment.

<a id="workbench-ui-review"></a>
### Comprehensive workbench UI review

The subsequent request authorizes a complete UI review and direct implementation while preserving the dirty worktree, real services, independent plugins, native readers and scientific files. The active branch is `feat/local-research-libraries`. Shared typography/spacing, progressive disclosure and compact source/discussion controls are implemented across the existing Research/material/study components. The [interface owner](12-desktop-interface.md#workbench-ui-review) records the reusable rules and page/state inventory. No new model loop, research format or permission bypass is introduced.

Implementation and bounded validation are complete; researcher visual acceptance remains pending. The topic-return callback now retains its captured reading point across renders; creation recovery, catalog return, retained study drafts and read-failure copy are verified. All 360 affected AITP/theme checks, seven artifact gates and both full aggregate typechecks pass. The final application run passes the library presentation, native Markdown/image/code, multi-session workbench and study/failure scenarios; its PDF scenario exposed a shared reader defect at the bottom scroll limit. Explicit last-page choices now survive clamping; the rebuilt native-PDF scenario and ordinary DSH document-reader regression both pass. The broad GUI run retains seven failures in four unchanged Harness test files after the owned style violation was corrected. The [execution receipt](../../agent/notes/harness-integration.md#workbench-ui-review) owns exact outcomes, screenshots and limitations. All submitted questions and writes belong to isolated fixtures; researcher visual acceptance and scientific answer quality remain separate.

<a id="native-source-readers"></a>
### Native source reader adaptation

The researcher requested native Harness content-opening behavior after the three-library redesign. The PDF implementation shares the ordinary document reader: continuous pages, native text selection and zoom, current-page reporting, and scope-local page/zoom/scroll restoration. A guarded binary read removes the old inline-embedding limitation without expanding root access or the existing file-size bound. Current-page observations support quotation beyond the first four extracted pages; cross-page or ambiguous selections remain explicit. [The application receipt](../../agent/notes/harness-integration.md#native-source-readers) records the completed PDF validation.

The subsequent request extends this adaptation to Markdown, images and linked files, avoiding abrupt changes of library. The implementation routes linked content by its actual format inside the current reading frame, reuses native Markdown and image readers, and retains the topic, right-hand discussion and reading history. Authored relative links and local illustrations resolve through existing source-root permissions; inline images use native enlargement, while standalone images retain zoom and scroll position. Code continues to use Harness source rendering. The new application scenario validates relative Markdown, uniquely located sections, local images, native enlargement/zoom, narrow windows, code links, and return to the same discussion with reading position and draft retained. Existing library and ordinary document-reader regressions also pass; [the receipt](../../agent/notes/harness-integration.md#native-source-readers) distinguishes these checks from the prior PDF evidence. This increment adds no Office research provider, OCR, annotation persistence, editor or automatic image delivery to the model.

<a id="topic-discussion-workbench"></a>
## Topic discussion workbench — implemented with bounded application validation

The 2026-10-26 request authorizes implementing the unified [topic discussion frame](12-desktop-interface.md#application-frame-on-harness) and completing its validation as an explicit goal. Conversations must appear directly beneath their subdirection, open on the right beside the reading surface, switch, start or rename there, and retain context when sources change. Actual saved records must refresh the related UI and provide a **View changes** action with the recorded before/after text; partial and unknown outcomes remain distinct. The application acceptance must exercise both rename and this actual-save feedback. This supersedes the earlier main-column alternation for topic-scoped research work; ordinary Session and unscoped library paths remain supported.

The implementation is divided into four cooperating parts:

1. **Topic navigation and shared discussion:** direct topic-owned Session rows, a full embedded native Conversation, switch/New/rename/expand/collapse controls, and retained drafts and reading positions.
2. **Scoped continuation:** recoverable Session listings and attributed submissions to the selected Session, using the normal attachment, permission, queue/steer and retry mechanisms. Browsing creates no model request, and an in-flight request keeps its submitted origin.
3. **Materials and saved records:** independent library readers share the discussion presentation; source citations return to the centre, exact selections remain distinguishable from viewing position, and completed writes explicitly invalidate relevant observations. The original writer receipt supplies bounded before/after text, confirmed and uncertain outcomes, and separately observed current-file drift.
4. **Application acceptance:** an isolated project with two directions and several conversations exercises creation, switching, source questions, native controls, busy navigation, source changes and save/readback, together with narrow windows, keyboard operation, errors and restart/recovery boundaries. Tests, builds, screenshots and finite evidence belong in the existing integration receipt.

All four parts have bounded engineering evidence in the [workbench receipt](../../agent/notes/harness-integration.md#topic-discussion-workbench). Actual-app tests use ordinary Sessions, source readers, tools, writes and restart recovery; only the external model is deterministic. They establish interface and context delivery behavior, not scientific reasoning quality or researcher visual acceptance. The complete artifact build and Client aggregate pass; the full Host aggregate exceeds the shared machine's available memory. A focused Host program preserves the existing strict options and all project references and checks all affected Host/API/research tests and application scenarios; its pass is not reported as a whole-repository Host pass.

Unscoped global-library questions retain the existing handoff. View selection, unsent draft association and reading positions remain client-local; admitted discussions and confirmed source changes survive Host restart. Generic external edits rely on the existing file watcher and lack writer receipts. Browser-timezone attribution retains the previous Host fallback. No real research-note mutation, new scientific conclusion, automatic commit, push or merge is authorized by this implementation goal. The prior visual-pilot and provider-connection evidence retain their original scope.

<a id="harness-migration"></a>
## Authorized Harness migration and GPT adaptation

**Authorized foundation scope:** establish the official Harness-derived `harness` branch in the existing AITP repository, retain the old Pi implementation/history and portable `aitp/` submodule, apply aitp-agent product naming through supported application configuration, and adapt the selected GPT route using existing model/credential services. Use the normal Harness launcher/profile flow. Internal upstream package identities may remain unchanged to keep upgrades tractable; product naming is not a request to rewrite every package scope.

GPT work includes checking the provider and model route, API-key/OAuth capability distinctions, the credential login consumer, streamed responses/tool calls/cancellation, and the previously reported compaction behavior. Reuse fixes already present upstream instead of assuming the earlier symptom is still present. Source inspection, recorded/mock tests, actual login and live model calls are separate evidence. Do not claim a working login or live GPT run from a registered provider or passing unit test. Credentials stay local and absent from committed records.

**Current evidence:** the imported official source and fork were checked at the same revision, version `0.2.1-rc.2`. Product configuration, brand and terminal-auth plugins are implemented; artifact construction and aggregate type checks passed for the earlier branding/auth baseline. The current GPT slice is validated separately below. Focused tests cover provider routes, synthetic authorization, terminal secret handling, launcher shutdown, same-mode sandbox escalation and nonshrinking summaries. The [Harness receipt](../../agent/notes/harness-integration.md) owns commands, counts and remaining checks. Fresh ChatGPT browser authorization, bounded live GPT text/tool requests and the SSE scratch read/edit/run smoke now pass; the [first hosted GPT validation](https://github.com/bhjia-phys/AITP-agent/actions/runs/39954328920) passes artifact construction, full Host/Client typing, documentation and keyless regressions. Native packaged applications remain unverified. The current slice’s final build/test status is in its [receipt](../../agent/notes/harness-integration.md#gpt-reliability-slice). Loading AITP Skills establishes method discovery only; the separate bounded Markdown runtime integration is implemented in [B1–B6](#memory-backend-work), with open defects and wider research work recorded there.

**Preserved limits:** this work does not migrate Pi runtime stores, modify real research notes, adopt a new note format, authorize scientific computations, enable unrestricted research-writing tools, or claim completion of P1–P5. Generic Harness tools may have effects under its own configuration; the imported application is not yet an accepted read-only AITP research profile. Use isolated synthetic/scratch work for adaptation checks. A future research profile must make its actual tools, memory delivery and applicable user instructions clear before use on research roots; it does not add a fixed scientific action order.

**Handoff:** report the actual route evidence through the [GPT work package](#gpt-integration-readiness), then follow the [next implementation slice](#next-implementation-slice). Re-run the four old counterexamples against the new runtime when the corresponding research services exist; host replacement alone closes none of them. Scientific qualifications and exact-source citations remain requirements; later writing policy remains undecided and must not be generalized into a ceremony for ordinary research actions.

<a id="gpt-integration-readiness"></a>
## GPT reliability before research-quality claims

The researcher reports bugs and poor results with earlier GPT use in Harness. Treat this as an engineering and behavioral investigation with reproducible examples, not a promise that a new preset improves the underlying model. Preserve the actual failing task, provider/route, selected model, reasoning setting, tool availability and failure stage. Diagnose authentication, request conversion, model-visible instructions/context, tool handling, retries and research judgment separately. Reuse an applicable upstream correction before adding another workaround. A symptom without a retained example remains reported or unverified until reproduced; the current execution evidence is recorded in the [GPT reliability slice](../../agent/notes/harness-integration.md#gpt-reliability-slice).

**Recorded baseline:** the [existing receipt](../../agent/notes/harness-integration.md#gpt-validation-boundary) records fixes for secret-input history and launcher child cleanup, and passing focused regressions for escalation and nonshrinking-summary handling. Those checks do not close every tool-family parameter combination or repeated compaction across later steps. Fresh browser sign-in and bounded live `openai-codex/gpt-6.1-sol` text/tool calls pass; the subsequent [paired acceptance](../../agent/notes/harness-integration.md#gpt-live-acceptance) covers bounded C08/C16 behavior. Near-full-window sessions, expired-grant refresh and broader scientific comparisons remain unverified; offline recovery coverage is recorded below. The [real-provider cases](../../packages/llm/llm-pi-ai/tests/provider-api-cases.ts) and [live suite](../../packages/llm/llm-pi-ai/tests/provider-apis.e2e.ts) now include an explicit credential-store opt-in for `openai-codex`; a passing API-key or synthetic OAuth case cannot supply live OAuth evidence.

The following primary-source investigation was checked on 2026-10-22 against the imported `0.2.1-rc.2` source. Reports retain their original host, route and plugin versions. Source inspection identifies candidate regressions; it does not reproduce their runtime effects.

| Report and original scope | Current source assessment | Regression target |
| --- | --- | --- |
| [Same-mode escalation, #5847](https://github.com/deepseek-ai/deepseek-harness/discussions/5847), September 7: GPT-5.6 Sol under full access; [#4021](https://github.com/deepseek-ai/deepseek-harness/discussions/4021), August 22: `0.1.1-rc.2`, Azure Responses | The shared [approval resolver](../../packages/sandbox/sandbox/src/escalation.ts) now accepts the effective mode; bash also bypasses its justification check for that case. The [filesystem resolver](../../packages/fs/tool-fs/src/sandbox.ts) and PowerShell now recognize the effective mode before validating a widening request; missing/blank reasons are covered by regression tests. This is not a Windows execution acceptance | Test bash, PowerShell, write and edit separately: same mode with absent, blank and valid justification; narrower, unknown and genuinely wider requests. Preserve ordinary execution and legitimate approval semantics |
| [Repeated compaction, #8733](https://github.com/deepseek-ai/deepseek-harness/discussions/8733), October 3: `0.2.0-rc.2` plus third-party `dsh-plugin-subscriptions 0.9.7`, GPT-6 Luna/GPT-6.1 Sol; related [checkpoint-only report #7212](https://github.com/deepseek-ai/deepseek-harness/discussions/7212) uses OpenRouter DeepSeek | Current [range selection](../../packages/compaction/compaction-basic/src/region.ts) excludes the previous checkpoint when it is the entire candidate span; a deterministic reproduction failed before this correction. The [engine](../../packages/compaction/compaction-basic/src/index.ts) now also suppresses a failed unchanged automatic attempt during its service lifetime and bounds oversized passes by admitted source windows. Tiny reductions and explicit manual recovery have regressions; the original third-party deployment is not reproduced | Repeated pre-steps over an unchanged checkpoint, small reductions, output reservation and fixed overhead, bounded total wasted attempts, visible recovery and cancellation; preserve scientific qualifications independently of token reduction |
| [Smaller-window switch, #9814](https://github.com/deepseek-ai/deepseek-harness/discussions/9814), October 15: `0.2.0-rc.2`, initially a third-party provider; later GPT-6.1 Sol report | The [summarizer](../../packages/compaction/compaction-basic/src/summarizer.ts) now admits the complete summary request against the selected route's declared capacity; whole balanced prefixes fit that route without implicit provider substitution. Real-loop tests cover a restored transcript switching to a smaller model; indivisible spans and fixed overhead fail visibly | Large-to-small model switch and stale/deleted route; show the actual compaction failure and a usable recovery. Do not silently send research material to another provider |
| [Tool-argument reparsing, Pi #9265](https://github.com/earendil-works/pi/issues/9265), September 7: pi-ai `0.85.1`; Harness [#3923](https://github.com/deepseek-ai/deepseek-harness/discussions/3923) reports a relay route | The installed pi-ai patch and [streaming tests](../../packages/llm/llm-pi-ai/tests/tool-argument-streaming.spec.ts) address repeated parsing. Additional large interleaved, truncated and cancelled streams pass on Chat Completions and Responses; no new parsing defect was found. This does not establish the cause of every gateway 500 | Large and truncated streamed arguments, parallel calls, prompt cancellation and responsiveness of another session; retain coverage when upgrading pi-ai |
| [Resume pressure, #5662](https://github.com/deepseek-ai/deepseek-harness/discussions/5662), September 4: Windows `0.1.2-alpha.4`, Codex GPT-5.6 Sol | The reported Windows cause remains a hypothesis. Loader + AgentLoop tests now verify restored request headers, same-route first-step pressure and changed-route overflow recovery. Middleware-only route changes and absent adapter capacity remain stated limits; this is not a native Windows reproduction | Restart above the pressure threshold and inspect the first new request, effective route and actual compaction events |
| [Transient overload, #5377](https://github.com/deepseek-ai/deepseek-harness/discussions/5377), September 2, corrected September 3: `0.1.1-rc.2`, Codex GPT-5.6 Sol | The reporter withdrew the deterministic incompatibility explanation. A separate local defect lost Codex error classifications; the adapter now retains bounded HTTP and Responses-event error facts for the existing retry policy. Local-wire tests cover bounded recovery, auth/quota rejection and cancellation; external overload remains possible | Distinguish provider capacity, authorization, request rejection and local tool failure; preserve actual retry evidence instead of adding an unsupported wire workaround |

The actual AITP trials additionally exposed headless credential composition and outside-checkout loader resolution failures, both corrected. A deterministic concurrent-connection test reproduced the remaining WebSocket leak: two requests for one session/account could overwrite cache ownership while connecting, leaving one socket open after disposal. The dependency patch preserves the first cache entry and closes a later retired entry. The local race and actual headless title/main concurrency checks pass; new real scratch tasks exit naturally with both auto (19.67 seconds) and explicit WebSocket (18.92 seconds). The AITP overlay retains its tested SSE compatibility default; explicit transport overrides remain available. This remains a documented compatibility default with explicit overrides, not closure of every transport issue. See the [executed receipt](../../agent/notes/harness-integration.md#gpt-reliability-slice) for failed trials, local regression coverage and the subsequently successful hosted full Host/Client typechecks.

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
| Harness base and GPT reliability | Explicit migration/GPT request, reaffirmed as a priority | GPT fixes and bounded live text/tool/transport checks pass; hosted artifacts, full Host/Client typing, documentation and keyless GPT regressions pass | [GPT work package](#gpt-integration-readiness), [execution evidence](../../agent/notes/harness-integration.md) | Local Host memory exhaustion is resolved by hosted full-program evidence. Live scientific continuity, API-key calls and research-quality comparison remain open |
| Headless research-memory continuity | Source/working-item interfaces and isolated fixture profile; no P0/UI acceptance dependency | Implemented with deterministic model and real Harness loop/persistence | [B1–B6 evidence](#memory-backend-work); C01/C06/C16; later paired live behavior remains separate | Cold historical IO is not strictly paginated; live scientific-quality comparison remains open |
| P0: coherent design and inspectable prototype | Recovered design request and source audit | Claude design and Harness-frame prototype handed off; recorded synthetic checks only; researcher acceptance pending | [Current design](12-desktop-interface.md), [prototype check and limits](prototype/harness-frame/README.md#browser-check); [P0 acceptance](#p0). Earlier [review](15-design-review.md) retains its original scope | Combined Markdown client/backend behavior is tested on scratch data; human usability acceptance remains open; the standalone shell is superseded as the target frame |
| P1 / UI-1: topic → note → Session → context | Research-root/topic/note resources with Session-independent read authority, origin metadata, working-item and observation projections | Formal client plus optional Markdown backend implemented; full human UI-1 acceptance pending | [UI-1 route](12-desktop-interface.md#increments), [P1 demo and acceptance](#p1), C01/C16; W1 and the note part of W2 in the running application | Read, question origin and working context are connected; broader material readers, native attachment and researcher usability assessment remain open |
| P2a: notes and source-backed knowledge wiki | Research-record/source interfaces and view callbacks | Local provider and Client plugin implemented; actual application path passes with deterministic model transport; researcher acceptance pending | [Local-library slice](#local-libraries); [child gate](#child-gates), [C05](13-research-journeys.md#c05), [C07](13-research-journeys.md#c07), [C19](13-research-journeys.md#c19) | Local global browsing and source reading are implemented; complete where-used relationships and researcher acceptance remain open |
| P2b: literature library and actual PDF reading | Resource/selection definitions, bounded binary access and view callbacks | Local PDF/text provider and Client plugin implemented; real PDF canvas and citation path pass; researcher acceptance pending | [Local-library slice](#local-libraries); [child gate](#child-gates), [C04](13-research-journeys.md#c04), [C21](13-research-journeys.md#c21) | Local physical-page reading and source selection have application evidence; formal work/edition management, C03 discovery/import and researcher acceptance remain open |
| P2c: local code, diff and history | Checkout identity, bounded source/Git access and view callbacks | Read-only checkout/source/diff/history provider and Client plugin implemented; actual application path passes; researcher acceptance pending | [Local-library slice](#local-libraries); [child gate](#child-gates), [C08](13-research-journeys.md#c08) | Authored topic links and local bounded reading are implemented; formula-to-implementation semantics and researcher acceptance remain open |
| P2d: native research workspace and WSL attachment | Existing host/client/auth services and explicit root mapping | Carrier selected; research attachment unverified | [Attachment checks](#child-gates), [C18](13-research-journeys.md#c18) | Reuse Electron; actual Windows–WSL lifecycle and research attachment need real-host checks |
| P3a: complete proposal on scratch copies | Source/agreement observations and minimal proposal view; no full P2 dependency | Scratch proposals implemented in B4; independent review UI remains separate | [B4 evidence](#memory-backend-work), [child gate](#child-gates), [C15](13-research-journeys.md#c15) | No-change, pending and exact passage proposals are available; source writes require explicit scratch configuration |
| P3b: actual independent review and assessment | Existing entry or proposal revision, observations and bounded subagent tools | Planned; actual review integration missing | The old Pi queue/export is not Harness reviewer execution; [child gate](#child-gates), [C15](13-research-journeys.md#c15), [C20](13-research-journeys.md#c20) | Reviewer runtime, coverage, existing-entry inspection without an edit proposal, and revised-proposal handling unavailable |
| P3c: controlled scratch apply and recovery | Explicit scratch root and current execution authority; independent review when selected | B5 cooperative writer implemented and tested | [B5 evidence](#memory-backend-work); [P3 policy](#p3), [C15](13-research-journeys.md#c15), [C16](13-research-journeys.md#c16) | No arbitrary external-editor transaction or named real-source pilot; scientific review remains task-dependent |
| P4: one named real authoring pilot; separately chosen bounded workflow | P3 accepted and named paths/actions approved | Proposed; pilot not selected | [P4 acceptance](#p4); selected cases must be named when the pilot is chosen | No real authoring, run/build or manuscript action authorized by this plan |
| P5: selected orchestration and wider research workflows | P4 accepted and chosen capability approved | Proposed; capability not selected | [P5 acceptance](#p5), e.g. [C09](13-research-journeys.md#c09), [C10](13-research-journeys.md#c10), [C17](13-research-journeys.md#c17) | Controllers, execution adapters and resource admission remain unavailable; cases are not all promised by P5 |

<a id="next-implementation-slice"></a>
### One implementation sequence, with parallel UI and readers

The bounded GPT reliability fixes and their hosted validation are integrated into `main`; [the work package](#gpt-integration-readiness) retains their tested scope and unresolved reports. The map and first Markdown backend are integrated into `main` through PR #14. The stabilization work below is implemented and verified; remaining scientific and usability assessment, and later capabilities, retain their separate scopes and dependencies. Changes continue through task branches and relevant validation before publication. Ordinary implementation, repairs and checks within the agreed scope do not require repeated milestone permission. Material product-policy choices and real research writes retain their stated boundaries.

The first [local-library and Notebook-style study slice](#local-libraries) and [topic-page visual pilot](12-desktop-interface.md#topic-page-pilot) retain their bounded engineering evidence. The latest UI authorization selects [three-library presentation](#library-ui), preserving the implemented [topic discussion workbench](#topic-discussion-workbench), connected services and original AITP knowledge semantics. The earlier recovery repair and its comparisons remain their own evidence. Reuse existing portable Skills; this application task does not modify or publish the upstream protocol or establish actual independent-review execution.

1. **GPT foundation implemented; broader reliability remains bounded.** Follow the [GPT work package](#gpt-integration-readiness): reproduce the relevant public reports against the actual route, preserve already-correct behavior and fix reproducible failures with focused regressions. Confirm the selected live route when access permits. A missing live credential blocks that evidence, not offline implementation or the independently developed client. Login alone cannot complete this work.
2. **Headless memory continuity implemented on isolated scratch roots.** B1–B3 supply the note/source resolver, non-blocking working-item tool, bounded request context and existing-Session recovery. Original human inputs stay distinct from provisional model items. Origin-diagnostic and supported rendered-selection counterexamples are repaired with regressions; scientific usefulness and near-capacity behavior require separate evaluation.
3. **Local libraries and Notebook-style study, first version, workbench and three-library presentation implemented.** Shared sources, independent knowledge/literature/code plugins, ordinary scoped conversations, citations and retained drafts have bounded engineering evidence. The topic-page pilot and topic discussion workbench have bounded application evidence; [three-library presentation](#library-ui) now has its own running-app evidence. [The work package](#local-libraries) owns library capability limits; [the redesign status](#topic-redesign-review) owns the pilot.
4. **Skill discovery and actual use.** Expose sources and shadowed candidates, the portable manifests' declared method roots, and loaded/still-visible/changed status. Then exercise C22's full use, partial borrowing and rejected same-topic method through a model-authored use item. Candidate retrieval supplies conditions; the main model judges fit. Extend the registry/consumer where its current winner-only, name-only API cannot supply that evidence. Portable borrowing guidance is a separately coordinated AITP change.
5. **Map and Markdown workspace connected; complete the remaining client bridges and readers.** The formal map and asynchronous fixture are integrated with configured topic/material reads, source-preserving scratch edits and scoped questions. The task-card and Sources & memory bridge is implemented from existing Session observations. Full [UI-1](12-desktop-interface.md#increments) still requires the remaining note projections and researcher assessment. UI-2–UI-6 and knowledge, literature/PDF and code/history providers proceed independently when their named dependencies exist; their numbering is not a serial prerequisite chain. Test browsing separately from model attachment. Desktop/Windows–WSL attachment remains its own environment-dependent increment.
6. **Scratch proposals implemented; independent review and distillation remain separate.** B4 retains exact-passage proposals and pending/no-change outcomes. A real bounded reviewer and method-use/distillation integration still need implementation. A first distilled draft remains transfer-untested. A later increment delivers it directly as scoped instructions to a subagent on a changed instance, with a named reviewer or researcher assessing the trial; installation is unnecessary for that experiment. This work does not wait for every reader or the native host.
7. **Scratch apply implemented; broader authoring and execution remain scoped.** B5 uses the cooperative non-hash policy below and does not require an independent reviewer for every authorized scratch edit. The reviewed-authoring workflow still needs proposal → review → assessment → apply integration. Select a named real-source pilot before real note writes. Rule saving, richer code editing, research-linked execution and cluster workflows need their explicit scope and available adapters, rather than every preceding reader.

The connected map and headless backend do not complete every UI-1 view. Full UI-1 acceptance still requires its remaining production resource bridges and researcher assessment, without depending on the later Skill slice. [12’s increments](12-desktop-interface.md#increments) own the UI routes: UI-2 consumes literature/knowledge providers (W2), UI-3 the all-candidate Skill/use interfaces (W4), UI-4 rule save/adoption (W6), UI-5 checkout/comparison resources (W3), and UI-6 proposal/evaluation records (W5). A later UI number does not imply a dependency on every earlier view. The original walkthroughs remain synthetic evidence; implemented subsets have their own application checks. Researcher acceptance remains separate.

For the headless slice, deterministic acceptance includes Chinese and English corrections followed by two compactions and a restart; failed-route/reopening-condition preservation; a deleted source producing an honest omission while the turn continues; identical reconstruction of the active block from logged events; and opening the session with the AITP plugin disabled. Model-authored items never become researcher decisions. Generated summaries remain distinguishable from original instructions and provisional items. Test required-context delivery as priority, not elevated instruction authority.

Once the selected GPT route works, run a few paired C01/C06/C16 trials against Codex + the same AITP revision using [13's protocol](13-research-journeys.md#comparative-evaluation). Repeat relevant comparisons as each capability arrives, and review the combined results at the end; report regressions, ties, failures and unavailable comparisons. Offline replay establishes mechanism correctness, not research benefit.

The fixture explicitly declares its root, tool permissions and task lifetime. This does not silently settle the product defaults for permission mode, same-name Skill precedence, restriction duration, saved-rule ownership or session-independent resource access. Keep those choices visible in [current.md](../../current.md); they need a decision before dependent product behavior is released.

<a id="local-libraries"></a>
#### Local libraries and source study

The 2026-10-25 request authorizes incremental implementation of local knowledge, literature and code libraries, direct global overviews, subdirection material links and Notebook-style study. Knowledge follows the [portable collection](11-research-memory.md#knowledge-collection). The first version has completed its bounded engineering validation; researcher usability and scientific-answer quality remain open. Implementation uses controlled fixtures and explicitly configured source roots; no existing collection is reorganized or copied merely to connect it. This section owns its dependencies and progress.

One `research-resources` service owns registered local roots, bounded discovery/reading, root-qualified source identities and domain contributions. Independent `research-knowledge`, `research-literature` and `research-code` providers interpret those sources. A shared Materials client supplies reading and selection, with separate client plugins for the three libraries. Existing research-memory supplies actual topic context, human originals and normal Harness Session recovery. Neither a domain provider nor a saved source set creates another conversation loop or scientific memory authority.

| Slice | Inspectable result | Current state |
| --- | --- | --- |
| L1 Shared local sources | One root grant and scan, distinct identities for same-named files, bounded reads and explicit missing/partial states; provider and root withdrawal preserve other contributions | Implemented with authorization, lifecycle, source-set persistence and bounded-read tests; actual application path passes; researcher usability acceptance remains open |
| L2 Three libraries and topic links | Real knowledge-index projection, local PDF/edition reading, bounded checkout/source/diff/history, global overviews and subdirection material links preserving the selected question | Implemented as independent providers and Client plugins; actual topic-entry, return and browser validation passes |
| L3 Selected-source conversations | Several located sources enter the actual normal Session request; citations reopen exact observations, human corrections recover after compaction/restart, unavailable sources remain explicit | Actual AgentLoop cross-root delivery and bounded source-read tests pass; Global recovery after two compactions and cold restart passes; actual PDF/Git citation path passes |
| L4 Saved sets and reading drafts | Runtime-owned source sets and attributed drafts survive restart; scientific-file integration uses the existing scoped writer and original knowledge rules | Host persistence, actual completed-answer capture and independent Loader restore tests pass; actual save/reopen, process restart and draft reuse path passes |
| L5 Text and structured study outputs | Cited comparisons, assumptions/symbol tables, reading/derivation outlines, reports, learning questions/cards and optional concept maps generated through available Harness models | Editable prompts and attributed provisional text drafts implemented; generation uses ordinary Harness Sessions; final product quality remains model-dependent |
| L6 Optional import and media | Actual external discovery, OCR/transcription, audio/video, slides or other exports through individually configured providers | Capability-dependent; unavailable providers remain explicit, and scripts/outlines do not count as finished media |

The [official source guide](https://support.google.com/gemininotebook/answer/16215270?hl=en), [chat/citation guide](https://support.google.com/gemininotebook/answer/16179559?hl=en) and [notes guide](https://support.google.com/gemininotebook/answer/16262519?hl=en) establish the reference source-selection, grounded-answer and reusable-note interactions. [Reports](https://support.google.com/gemininotebook/answer/18323649?hl=en), [mind maps](https://support.google.com/gemininotebook/answer/16212283) and [cards/quizzes](https://support.google.com/gemininotebook/answer/16958963?hl=en) inform L5. [Audio](https://support.google.com/gemininotebook/answer/16212820) and [video](https://support.google.com/gemininotebook/answer/16454555?hl=en) require real generation capabilities in L6. These are reference behaviors, not a claim that the application implements the entire product.

Google documents [Enterprise notebook/source APIs](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks-sources) and a [Preview audio API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview?hl=en), which require their own product and Cloud identity. They are not assumed local dependencies. The separate [Podcast API is deprecated and closed to new allowlist customers](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/podcast-api). Local implementation instead reuses available Harness models and replaceable domain/generation providers.

Each slice must prove its real source, plugin-lifecycle and application path before its status changes. The [local-library execution receipt](../../agent/notes/harness-integration.md#local-libraries) records the bounded engineering proof and remaining scientific and media limits. Initial acceptance includes a shared material maintained elsewhere but opened under the intended subdirection, equal filenames in different roots, original-source changes, partial discovery, a missing PDF, a dirty checkout, source selection versus actual delivery, and a corrected human instruction recovered after restart. Do not replace these checks with a static file list or synthetic answer.

<a id="memory-backend-work"></a>
#### Backend work: scoped recovery and accurate writeback

After the positioning and B1–B6 breakdown, the researcher explicitly requested implementation and a rebase onto main on 2026-10-23. This branch was rebased onto `768bc6783e`. The implementation uses two optional Harness plugins: [research-memory](../../packages/research/research-memory/README.md) and [ui-aitp-backend](../../packages/client/ui-aitp-backend/README.md). The first storage adapter reads existing AITP Markdown notes without migration or a mandatory new format. Write application is implemented for explicitly configured scratch roots; original research-note writes remain outside this task. The subsequent publication request authorizes committing, pushing and merging this implementation into remote `main` through its PR checks. [11](11-research-memory.md#scoped-topic-backend) owns the behavior and [its writeback section](11-research-memory.md#memory-writeback) owns editorial scope.

| Task | Implemented first slice | Open defects and remaining validation |
| --- | --- | --- |
| B1. Resolve owners and index existing notes | Markdown owners, explicit relationships, bounded rebuildable index with selected deep-source admission under partial discovery; unique rendered-to-source intervals and honest directory/missing-link omissions | Unsupported mathematical/cross-source selections, unknown renames and broader formats remain outside this slice ([Q05](../../current.md#q05)) |
| B2. Prepare and deliver scoped context | Origin-bound questions, original human inputs, qualified source context and actual Harness request delivery; browser material-question regression | Missing/ambiguous-origin diagnostics now reach actual requests ([Q02](../../current.md#q02)); text-only automatic topic discovery and scientific sufficiency remain unestablished |
| B3. Recover questions, decisions and unfinished work | Existing Session/interaction/tool projection, original versus provisional attribution, exact unanswered question/options, topic-first bounded history, two compactions, cold restore and same-topic pending integration | Real task-card/Sources & memory bridge implemented; bounded live-copy continuation is recorded separately, while near-capacity scientific continuation and paginated cold history remain open |
| B4. Decide and prepare the scientific edit | Reviewable exact-passage proposals, no-change/pending outcomes, rationale/source references and declared remaining uses | Nested-field changes reconcile once or reject divergent edits ([Q06](../../current.md#q06)); independent review and general model editorial quality remain unvalidated |
| B5. Apply and recover scratch writes | One UI/model writer, current authority, durable retry identities, per-file publish/readback and partial/unknown recovery | Cooperative single-writer scope only; no arbitrary external-editor transaction, automatic complete affected-use repair or original-note write pilot |
| B6. Connect refresh and measure the complete path | Source invalidation and rereads, reconnect, browser read/edit/question path, child plus explicit parent repair/restart test and 10/100/1000-topic benchmark | Original counterexamples repaired with regression coverage; no human usability acceptance, complete research-case acceptance or comparative scientific-quality claim |

The dependency order remains B1 → B2 → B3 for read/recovery; B4 uses the owner/context semantics, B5 closes the write loop, and B6 verifies integration. The frontend can continue to use its async mock adapter independently. Shared work is limited to topic/resource identity, question origin, observed revisions, missing-source states, change outcomes and notification/reconnect behavior. Keep source parsing out of view components; do not introduce a second source store or agent loop.

The original acceptance requirements remain: shared materials, duplicate headings, missing owners and multiple topics in one folder must resolve or report ambiguity; rebuilding must preserve notes and identities. Inspect actual requests under tight budgets and missing sources. Recovery must preserve Chinese/English originals, unanswered choices and pending outcomes without importing another task's permissions, including when reading a Session with the plugin disabled. A child continuation edit leaves the parent unchanged; a changed conclusion requires explicit repair of affected uses while unrelated siblings stay intact. Scratch tests must retain external edits, partial/unknown outcomes, duplicate submissions and older-revert limits. After restart, saved owners, views and the next request must agree. Engineering examples and declared remaining uses do not establish complete scientific integration.

**Current status:** B1–B6 have a running, tested first implementation; they are not six fully accepted research workflows. Pre-merge review added counterexamples for core question/answer delivery, BOM preservation, encoded-alias serialization and watcher-fallback pagination. Their repairs, runtime cancellation/root isolation, material-owner navigation, the joining-refresh boundary, 295 combined memory/UI regressions and the real browser checks are retained in the same receipt; they do not establish wider scientific acceptance. The latest [review receipt](../../agent/notes/harness-integration.md#research-memory-backend) retains the three original reproduced failures and their repairs in selection mapping, origin diagnostics and nested qualification previews. Additional real-browser focus and real-note directory-link failures are preserved with their dispositions. Passing mechanism checks remain bounded evidence.

The researcher subsequently authorized the stabilization goal: repair the three reproduced defects, connect the task card and Sources & memory to real Session observations, and perform a bounded live-model trial on isolated copies of existing research notes. Those changes and their targeted regressions are complete. The live-copy trial passed source write, real compaction, cold restart and fresh same-topic recovery, preserving the initial budget-limited attempt and repaired integration failures. Browser paths, seven artifact gates, 264 focused regressions, complete Client typing and the related API/locale/link checks passed. The complete Host program passed on a disposable Windows copy whose current input bytes, full 6882-file graph, 2258 roots, 296 references and compiler options were independently verified against the original checkout. Earlier Linux memory failures and the failed direct WSL-share attempt remain failures; they are not relabelled as passed. This completes the requested first-version stabilization within its stated scope, not general scientific or human usability acceptance. [The existing receipt](../../agent/notes/harness-integration.md#research-memory-backend) owns the proof and remaining broader limitations. That stabilization stage wrote no original research notes, started no numerical jobs, and performed no automatic commit, push or merge. The later explicit publication request was completed through PR #14; the existing receipt retains the actual merge, review findings, validation and platform limits.

**Implementation evidence:** [Executed commands and outcomes](../../agent/notes/harness-integration.md#research-memory-backend) retain the tested scope. B1 source ownership and bounds are exercised by `research-memory/tests/markdown.spec.ts`; B2/B3 actual request delivery, native/PTC replay, two production compactions and disk restart by `runtime.spec.ts`, `runtime-loader.spec.ts` and `recovery.spec.ts`; B4/B5 scratch editing and current-authority enforcement by `writer.spec.ts`, `write-tools.spec.ts` and the production `service-loader.spec.ts`. `service.spec.ts` isolates question admission. The browser adapter tests exercise generated transport, source invalidation, cancellation and plugin disposal; the existing workspace UI suite now checks material-origin submission and failure retention. These deterministic model substitutes prove delivery and IO behavior, not scientific judgment or live-model quality. The optional deployment overlay is `apps/cli/config/aitp-memory.cordis.patch.yml`; real-source use remains separately scoped.

The first end-to-end example is a synthetic parent with two child directions and a shared report. Ask about a selected report passage from one child, recover that child's previous failed route, record a human correction and a still-unanswered choice, compact twice and restart. The actual next request must retain those distinctions. Then integrate a newly supported result into the correct scratch owner, repair the affected parent use, reopen the material and start a fresh conversation. Inspect the saved text, source links and actual model input. Repeat with no durable change, an ambiguous origin, a deleted source, concurrent editing and interruption; a plausible answer or a green write result alone cannot pass.

The implemented B5 scratch policy uses unique nonempty literal-passage replacement against a fresh source read, preserves unrelated text and serializes calls through the owning writer. Complete operation receipts live outside scientific sources; per-file atomic publication and readback retain partial and unknown outcomes. Observation tokens are not content hashes or authorization. This is cooperative single-writer behavior, not protection against arbitrary external races or a multi-file transaction. Model execution rechecks the current Session sandbox and target paths; UI mutations require the authenticated owner. No per-edit approval ceremony is added within this explicitly configured scratch scope. Real-note access and automatic multi-file reconciliation remain unselected.

Performance work starts with B1 measurements and is judged with B6 accuracy cases: increasing synthetic topic counts, bounded reads, cache invalidation and full reconstruction. Record files/bytes/tokens and preparation latency independently of model time. First demonstrate correct ownership, retained choices and qualifications; only then compare optimizations. [The reproducible benchmark and retained output](../../agent/notes/harness-integration.md#research-memory-backend) provide the current comparison point. The first synthetic measurement used 10/100/1000 topics: cold preparation 47.38/195.21/1286.59 ms; seven warm reads had median 2.01/1.54/1.41 ms. Each warm read freshly read two source files, respectively 536/3058/30060 UTF-8 bytes; returned context JSON was 1139/1155/1171 characters. The parser reuses parsed text only after an identical fresh read. The earlier pre-optimization timing was exploratory and is not retained as a controlled speedup claim. Cold timings varied under parallel load; no cold speedup, token cost, model latency or scientific-quality improvement is claimed. Prior-session recovery separately limits candidates and projected events; its existing query provider can still load an entire cold log before those limits are applied.

**Settled design choice:** on 2026-10-21 the researcher selected autonomous routine next actions within
jointly established goals and boundaries, with discussion before material changes to core assumptions,
algorithms or research direction. The [architecture](10-project-workspace.md#research-control) owns this
default and per-task delegation semantics. This is acceptance of that policy only; P0/P1 implementation
acceptance remains pending. The first runtime projection and source-reading path are implemented and
checked on actual requests in [B1–B6](#memory-backend-work). Those checks establish selected input
delivery and preservation, not that the model chooses a scientifically appropriate next action.

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

The researcher requires disciplined collaborative development and selected `main` as the integration/default branch. [Contributing](../../CONTRIBUTING.md) owns the contributor procedure: a bounded task branch, declared file ownership, focused validation, affected-document maintenance and a pull request to `main`. Codex continues the formal frontend and shared client interfaces; GPT and research-memory/backend work proceed in separately owned packages. A shared interface/composition has one integrator; a reviewer or passing test cannot grant scientific acceptance.

The 2026-10-22 audit distinguishes written rules and local checks from remotely enforced policy:

| Area | Evidence and remaining work |
| --- | --- |
| Architecture, ownership and evidence | Repository Skill, this plan, current issues and cases specify the process. Each increment still needs actual review and case evidence; documentation alone does not enforce it |
| Local commit/push checks | The active development checkout has Lefthook configured; staged whitespace and applicable code/vendor checks run on commit, typecheck on push. These do not run every behavior test or establish research validity |
| Shared branch policy | `main` is the integration target, with task-branch PRs as the contributor route. At inspection, `main` and `harness` had no protection and no rulesets; required checks/reviews are not yet remotely enforced |
| Remote CI | The [first hosted push run](https://github.com/bhjia-phys/AITP-agent/actions/runs/39954328920) passed. This publication scopes the inherited enterprise-runner matrix to its upstream repository. The [AITP validation workflow](../../.github/workflows/aitp-validation.yml) retains ordinary hosted Ubuntu, full Git history, artifacts, sequential complete Host/Client typing, documentation and keyless GPT regressions, and adds research-memory/UI suites plus both Chromium paths. Ordinary documentation commands retain non-hash checks while excluding pairing and persistence digests; the archive baseline used only for hash checks is removed. [PR 14](https://github.com/bhjia-phys/AITP-agent/pull/14) has exercised artifacts, both complete type programs, 37 documentation gates and the documentation/memory/UI regressions successfully; the Chromium-install ownership error and a subsequently reproduced Tab-selection race have focused repairs, and the complete later outcome is tracked in that PR and the existing receipt. The [final source run](https://github.com/bhjia-phys/AITP-agent/actions/runs/40071585112) passed the complete hosted pipeline, including 295 memory/UI cases and both Chromium paths. Required-check enforcement, inherited App policies and published-payload compatibility remain open |
| Imported automation | Issue/App policies and preview jobs still refer to upstream accounts or credentials; observed Issue runs fail. Replace or explicitly scope those integrations before promising them to collaborators. The live DeepSeek E2E workflow is scoped so this fork requires an explicit manual dispatch plus `AITP_ENABLE_LIVE_E2E=true`; no automatic main push or PR starts a live API trial |
| Scientific readiness | Bounded live C08/C16 pairs with Codex + AITP pass their specified finite checks, with retained setup qualifications. Real research, human usability, the other cases and comparative advantage remain unestablished; see the [live receipt](../../agent/notes/harness-integration.md#gpt-live-acceptance) |

Contributor onboarding is corrected in this promotion, but the remote CI/review work remains open in [Q17](../../current.md#q17). Before broad implementation fan-out, establish a portable check set, remove assumptions about upstream App/runner access, observe a real PR run, then choose applicable required checks and review policy. Do not require permanently queued checks or enable hash-related AITP gates. This is collaboration infrastructure, not a new scientific action pipeline or another first research slice.

<a id="independent-development"></a>
## Independent development workstreams

The former P2a → P2b → P2c → P2d → P3 chain mixed product ordering with technical dependencies.
An independently developable component has a bounded responsibility, agreed inputs/outputs,
an owned implementation and a useful behavior check. It can be built against a controlled
implementation of a dependency; product acceptance still requires connecting real services.
Keep P0–P5 as user-visible capability/acceptance groups while using the workstreams below
to organize development. Use Harness service/provider/consumer packages and client contributions as the implementation homes; no new repository or process is required per line. Implement the selected sequence incrementally; the table does not activate every future capability at once.

Follow the confirmed [plugin ownership and assembly principle](10-project-workspace.md#plugin-owned-implementation) for every selected slice. Before implementation, record the plugin to extend or create, provided/consumed interfaces, data owner and composition entry in this plan’s [development crosswalk](#development-crosswalk), including when the package does not yet exist. Package READMEs document the implemented contracts; task/PR scope links back to this account.

Assign feature logic to the plugin and wiring to the profile/bundle; shared definitions and composition retain one integrator. Independent plugin checks and a real assembled-route check establish different things. This requirement governs maintainable implementation; it does not activate all proposed plugins or prescribe the agent’s scientific actions.

The implemented client contributions include [research views](../../packages/client/ui-aitp-research/README.md), [Session research views](../../packages/client/ui-aitp-session/README.md), the [development provider](../../packages/client/ui-aitp-fixtures/README.md) and [branding/theme](../../packages/client/ui-brand-aitp/README.md). The AITP Web overlay composes the views with existing Harness services; the synthetic fixture is enabled separately. The optional [research-memory service](../../packages/research/research-memory/README.md) and [browser transport](../../packages/client/ui-aitp-backend/README.md) connect configured Markdown roots through the same workspace adapter. These are AITP-agent additions using upstream mechanisms, not contributions supplied by unmodified upstream Harness or independently published packages.

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

The entries below define work ownership, including implemented first slices and proposed extensions; current progress remains in the tables above.
The [scenario-to-plugin map](10-project-workspace.md#scenario-plugin-map) groups user-facing functions; the architecture's shared services supply their interfaces. This table maps both to assignable work, rather than adding another decomposition. A domain plugin can own Host and optional Client entries; one row need not become one package, process or repository.

**Owners:** Claude completed the [UI design](12-desktop-interface.md) and [synthetic Harness-frame prototype](prototype/harness-frame/README.md). Codex continues its client contributions and shared interfaces; core/backend work, GPT fixes and research-memory integration remain independently developable lines. Other contributors can take a bounded client/provider or regression case after declaring its files. The handoff does not establish integrated application behavior or human usability. Keep task/context, method-use records, proposals and initial distillation under one integration owner until the first slices work. They share state and are not safe independent schema-design tasks.

**File boundary:** use existing owner packages for GPT fixes. The first runtime integration is `packages/research/research-memory/`, which owns Markdown source/context, working-state recovery and scratch proposals/writing with owner-local tests; `packages/client/ui-aitp-backend/` owns its browser transport. Independent knowledge/literature/code providers can be split into their own Harness packages when their interface is exercised. The frontend slice owns `packages/client/ui-aitp-research`, `ui-aitp-session` and the opt-in `ui-aitp-fixtures`; the workspace contract is owned by `research-memory/src/types.ts` and re-exported type-only by the research client. `ui-aitp-resources`, `ui-aitp-materials` and `ui-aitp-rules` remain possible future packages under [12’s implementation handoff](12-desktop-interface.md#implementation-handoff). Keep backend source/context and persistent services separate from these client files. The integrator alone updates shared contracts and composition under `packages/bundle/` and `scripts/aitp-agent.ts`. Keep the existing auth/brand plugins in their current homes. Portable methodology stays in `aitp/` and requires a separate upstream change.

| Line | Bounded deliverable and implementation home | Minimum dependency; what it need not wait for | Local check and eventual case |
| --- | --- | --- | --- |
| **GPT integration** | Existing LLM/auth/compaction/tool packages; the [GPT work package](#gpt-integration-readiness) owns issue routes and regression targets | Minimal failing input and actual effective route; no research UI or note writer required | Provider/tool/permission/compaction regressions followed by available live-route checks; prerequisite for attributing research-quality differences |
| **Task, agreement and working items** | AITP task-memory provider, explicit model-item tool and projection/replay using existing Harness events; maps the architecture's working-memory service and evidence feedback to one owner | Agreed input/lifecycle semantics; no reader UI or desktop host required | Correction and provisional failed route → queued input → two compactions → restart/Continue retains meaning, provenance and reopening condition; C02/C06/C16 |
| **Context and observations** | AITP source/context contributors plus request, read-tool and compaction integration; renders active items and declares observed omissions | Guarded source reads and task/working-item interface; complete wiki/PDF views can be substituted locally | Deleted selection yields partial context; selected text beats background; dropped text cannot remain available; unmet declared method prerequisites remain visible; C06/C16/C22 |
| **Research records and topic home** | Main/subnote providers and a topic-home view of qualified conclusions, open questions, branches, relevant resources and next useful work, derived from owned notes | Filesystem service, conservative parsers and resource definitions; no PDF, code browser or live model required | Main note → detailed argument → original owner; missing links and unverified conclusions remain visible without a second editable project truth; C01/C07/C16 |
| **Knowledge library** | Provider and view of the existing [portable collection](11-research-memory.md#knowledge-collection), with its [entry and reading routes](12-desktop-interface.md#knowledge); consumes the research-record link resolver for bounded affected uses | Research-record/source interfaces; fixtures can stand in for topic home and other readers | Existing index → story/reading/atom → source or affected use; retain ambiguity, search-coverage limits, provisional research pointers and separate support/review/coverage; C05/C07/C19/C20 |
| **Literature and PDF** | Literature provider and client reader: work/edition metadata, PDF, page/selection locators | Resource/selection definitions and bounded binary access; shared bibliographic lookup through a narrow interface, no wiki UI dependency | Actual test PDF, edition/page distinction and located selection; C04/C21 |
| **Code and history** | Checkout provider and source/diff/history view using preview/LSP; generic Harness editing/execution already exists, while research-linked receipts and richer editing/debugging need named increments | Checkout identity, bounded Git/source access; no PDF or execution required for the initial reader | Same-named checkouts and dirty fixture preserve target/scope; selection links to the claim; execution success does not establish independent scientific validation; C08 |
| **Research client — Codex** | Research/Session client packages and their opt-in fixture; asynchronous workspace adapter, Harness contextual sidebar, shared readers and selective information display | UI-1 requires root/topic/note resources, Session-independent read authority, origin and memory/observation projections; later reader panels need only their own providers | UI-1 W1/note-W2 in the running application; no Session from browsing, pane-local selection, truthful compaction/missing-source states and reconnect; C01/C04/C16 |
| **Skill catalog, candidate retrieval and use view** | Extend/consume `ctx.skills` or add an AITP candidate provider to expose source-qualified and shadowed entries; package relevant conditions, then show the main model's attributed method-use item | Registry/provider work beyond the current winner-only name lookup; source observations and task-owned use records; no distillation writer required | Existing Skills without added metadata remain usable; full load differs from full applicability, partial reuse retains dependencies, changed/compacted instructions are reported accurately; C22 |
| **Distillation, initially shared with Skill use/proposals** | Invoke portable `aitp-distill` on concrete use/failure/correction evidence and propose a focused addition/revision; no separate initial state store or team | Method-use observations and proposal service; later transfer evaluation also needs bounded subagent delivery and a named assessor | First demo ends with transfer untested; a changed-instance trial preserves failure and does not install/publish the candidate; C14 |
| **Collaboration rules** | Rule-source provider and editor for writing/memory/collaboration guidance, with source ownership, inheritance and saved-versus-adopted visibility | Source/rule resolution and document-change service for persistent edits; a read-only inspector can precede writing | UI edit preview identifies the owning source and target session; saving does not falsely claim current adoption or silently modify portable Skills; C16/C22 |
| **Proposal and pending integration** | AITP document preview provider, proposal records and logged pending/no-change outcomes | Sources and agreement; no completed reviewer, resource suite or apply engine required | Full argument/caveats retained and visibly unapplied after restart; C15/C16 |
| **Independent review** | AITP review provider over Harness subagents, with bounded read-only tools and original logs | Entry or proposal revision, sources/agreement and actual subagent execution; no apply engine required | Dropped caveat, unread premise and existing-entry review produce real coverage/findings; C15/C20 |
| **Controlled apply and recovery** | Implemented B5 scratch writer and current Session/owner authority checks; later reviewed-authoring integration | Explicit scratch configuration and unique target; independent assessment when required by the selected task | External edit, ambiguity and interrupted multi-file apply preserve evidence; C15/C16 |
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

The [child table](#child-gates) uses actual capability dependencies. Readers and desktop attachment can advance independently; Markdown proposal/review needs its real source/task services. Preserve the selected task's review requirements and the named real-source boundary; the implemented scratch writer does not make independent review a mandatory step for every edit.

## Delivery agreement

Codex continues the formal client slice; backend implementation and GPT integration retain their independent owners and tests under the [crosswalk](#development-crosswalk). Shared contracts and composition changes have one integrator. Independent review has access to the original material and session evidence, not only the implementer's account. Use the actual selected model/settings and record them when they affect evidence; this plan does not mandate a particular implementation model.

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
arguments from the currently disabled hash-based checks. These remain **proposed semantics for broader reviewed authoring**. The separately selected B5 cooperative scratch policy is implemented; it does not authorize a general replacement version/conflict policy or real-note writing.

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

The [shared study interface](12-desktop-interface.md#source-study) adds direct library destinations, topic-filtered materials, mixed-source selection and runtime-held source sets or answer drafts. Their persistence uses the existing operational owner and must survive the promised reconnect/restart route without changing source files. Integrating a draft into an existing reading or knowledge owner uses the scratch authoring increments; original collections require the existing named P4 pilot. P2 read-only acceptance and later scientific-file writing remain separate.

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

### Scratch implementation and later reviewed-authoring semantics

- Proposal revisions are immutable records containing the actual operations and displayed text. Revisions
  carry opaque IDs, not content hashes. Reviewer findings and the main assessment refer to that record.
- Before application, reread the target and resolve the intended explicit anchor or exact text range. The
  B5 scratch writer stops when the selected original passage is missing or ambiguous and retains the
  outcome for a newly prepared proposal. This is direct passage matching, not a revived checksum or digest
  check. Broader scientific-review invalidation below remains a later integration, not a claim of this writer.
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
| P2a Notes and knowledge | Actual mathematical note/source views and global [portable-collection navigation](12-desktop-interface.md#knowledge), with bounded where-used | Research-record/source interfaces and view callbacks; argument→premise→knowledge plus global index→story/reading/atom→source→return; preserve provisional pointers, support/review and reading coverage under C19 |
| P2b Library and reader | Global collection/work browsing, actual local PDF viewer, editions, page locators and optional selection-to-session | resource/selection and bounded-source services; library→edition→reading note→return, wrong/missing editions and incomplete index |
| P2c Code and Git | Actual bounded source/diff/history for attached local checkouts, no mutation | checkout/source and resource interfaces; formula→exact checkout→dirty diff, unrelated change attribution unknown |
| P2d Desktop host | Existing Harness carrier with explicit research host/root attachment and measured lifecycle | host/client/auth services; actual Windows↔WSL identity, open-in-editor, close/reopen, disconnected-host behavior; no added filesystem authority |
| P3a Scratch proposal | Editable copied note, full diff, source/argument observations and preservation diagnostics; apply disabled | Agreement/source observations, preview and minimal note/proposal view; missing/ambiguous locator and changed premise; no dependency on the complete P2 readers |
| P3b Actual independent review | Real read-only reviewer for proposals and existing entries, coverage, author assessment, stale/missing review states; apply disabled | Existing entry or proposal revision, source/task observations and bounded subagent tools; intentionally dropped caveat and changed dependency outside the edit range, plus a bounded entry review with no proposed edit and unread dependencies |
| P3c Controlled scratch apply | Approved non-hash policy, scoped authority, apply/read-back, concurrency and recovery | The complete reviewed-authoring route depends on P3b; configured B5 scratch follows its selected task-dependent review policy. Test external scratch edits and interrupted multi-file application; no real roots writable |

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
