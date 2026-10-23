# 13. Theoretical-physics cases and implementation coverage

This is the living account of which research situations the product serves, how its
parts should cooperate, and what the implementation actually supports. It is the
case-based counterpart to the [architecture](10-project-workspace.md) and
[development plan](14-implementation-blueprint.md). Initial coverage assessment:
2026-10-21. The examples are generic descriptions derived from the design survey;
public fixtures and prototype records are synthetic. No physics result is asserted
or independently validated by writing this document.

The intended benefit over using a general coding assistant is less repeated work
recovering the scientific question, finding its evidence, remembering instructions and
integrating a qualified outcome. Codex and Claude Code can already perform research
with the same files and Skills. AITP-agent must earn its value through usable,
recoverable coordination of those steps; a specialized screen or an extra agent is
not evidence of better reasoning.

The selected runtime direction prioritizes important research memory and actual source
context. These cases describe useful outcomes and counterexamples; they do not prescribe
a fixed literature/derivation/code/review sequence or make missing context an automatic
action ban. The model chooses its next step adaptively. Explicit researcher instructions,
actual tool permissions and honest scientific qualifications remain applicable. P1–P5
references below locate implementation work; they are not phases every research task must
pass through. Read/write policies remain to be specified for the selected authoring scope.

[16’s three case walkthroughs](16-topic-centred-redesign.md#cases) assess theory/code/evidence, competing routes and an exploratory seed against read-only inspection of actual records. They specify correction, recovery and failure acceptance routes. The revised overview must expose each child’s own answer, decisive limit and materials through direct navigation. A work label or completed child control must not make the parent claim appear accepted. The linked prototype tests synthetic interactions only; these are not passed application workflows on real research.

## Read the coverage honestly

**Host migration, 2026-10-22:** the researcher selected Harness and authorized fork/naming/GPT work. The table and existing source links below retain **Pi-specific baseline evidence**; they are not a statement that the active Harness application has those research workflows or the same reproduced failures. Generic Harness tools, subagents and Electron are available platform machinery, but each research case needs its own integration and checks. No case is promoted by the host switch; [14](14-implementation-blueprint.md#harness-migration) and the [Harness receipt](../../agent/notes/harness-integration.md) own new implementation evidence. Treat every “Current support and gap” paragraph citing `agent/` as the retained baseline until actual Harness case evidence replaces it.

**Read-only foundation** means inspected application code supplies a bounded part
of a case. **Recorded live** refers to the prior pilot and recovery observations in
the [integration account][integration], not a new run. **Mock** means an interaction
in the [isolated prototype][prototype] using synthetic data. **Specification only**
means a proposed contract or screen. **Unavailable** means the necessary adapter,
executor or write path does not work in the application. These are evidence labels,
not an ordered maturity score. None of the cases below has been accepted as a
complete researcher-operated workflow in the redesigned application.

**UI handoff, 2026-10-22:** Claude completed the [Harness-frame design](12-desktop-interface.md) and [synthetic prototype](prototype/harness-frame/README.md); Codex owns application implementation. W1–W6 below identify proposed acceptance routes, not passed research workflows. The recorded prototype check exercises fixed synthetic states only. Harness Workspaces remain the sole project list; Research, Materials and Rules are global panels that need no Session. Their readers use panel regions; the right dock belongs to a displayed Session and has at most two panes, with a comparison tab when two sources must remain beside the conversation. No case gains application or researcher acceptance from this handoff.

The retained Pi model-facing workspace tools are [read, search, outline and board][reader].
[Sessions][sessions], [context delivery][context] and [compaction][compaction] are
implemented; sessions still require a note location. Dedicated material adapters,
review execution, scientific writes and command execution are not supplied by that
foundation. The [existing workbench][ui] and the redesigned prototype are different
programs. A source file, type declaration, mock button or successful model reply
cannot close the missing parts of a case.

| Case | Retained evidence and research gap to requalify | Planned implementation reference |
| --- | --- | --- |
| [C01 Return to a project](#c01) | Pi read-only/recovery evidence retained; Harness topic and continuation route has synthetic design evidence only | Headless continuity; P1 / UI-1, W1 |
| [C02 Idea to scoped question](#c02) | Discussion and choice-card foundation; idea lifecycle and approved branch creation unavailable | P1 context; P3–P4 authoring |
| [C03 Discover and import literature](#c03) | Existing text can be searched; literature retrieval/import and edition adapter unavailable | P2b local library; separately approved retrieval |
| [C04 Close reading across editions](#c04) | Note reading foundation; W2 page/edition states are synthetic; actual research PDF/edition route unavailable | UI-1 note selection; P2b / UI-2, W2 |
| [C05 Learn a framework](#c05) | Learning Skill/context foundation; dedicated knowledge/story view unavailable | P2a; P3–P4 retained writing |
| [C06 Analytic derivation](#c06) | Source reading and model discussion foundation; no accepted analytic workflow or reviewed authoring | P1 scope; P2a; P3–P4 |
| [C07 Cross-topic transfer](#c07) | Parent-use/source lookup foundation; full condition-aware relation view and integration unavailable | P2a; P3–P4 |
| [C08 Formula, code and debugging](#c08) | Pi retained text reading/mock; Harness generic preview/navigation/editing/execution exists. W3 checkout/formula comparison is synthetic; research-linked execution remains unverified | P2c / UI-5, W3; P4 bounded execution |
| [C09 Numerical campaign](#c09) | Retained text can be inspected; run adapter, scheduler and campaign controller unavailable | P4 bounded run; P5 orchestration |
| [C10 Convergence and acceptance](#c10) | Qualified-answer recovery recorded live; material/run comparison and execution unavailable | P2a/P2c; P4 |
| [C11 Raw data and matched diagnostics](#c11) | Notes can describe coverage; data/plot analysis and run provenance unavailable | P2 views; P4 analysis |
| [C12 Manuscript, figures and citations](#c12) | Text reading foundation; proposal mock; document/manuscript/build paths unavailable | P3 scratch; P4 real pilot |
| [C13 Reusable knowledge](#c13) | Knowledge text may be read/searched; knowledge service and promotion writes unavailable | P2a; P3–P4 |
| [C14 Distill a procedure](#c14) | Distillation Skill can be read; W5 draft/evaluation/file states are synthetic; actual proposal/evaluation integration unavailable | Proposal/Skill-use slice; UI-6, W5; P4 named actual Skill-write pilot |
| [C15 Independent review](#c15) | Requests and real log exports exist; review execution/assessment unavailable | P3b–c |
| [C16 Interrupt and resume](#c16) | Pi recovery evidence retained; W1/W6 memory/adoption states are synthetic; Harness research continuity and effect reconciliation unverified | Headless continuity; UI-1 W1; UI-4 W6; P3c/P4 effects |
| [C17 Delegate and hand off](#c17) | Export/retained-note foundation; application worker execution unavailable | P3 review; P5 research workers |
| [C18 Desktop, hosts and interoperability](#c18) | Local server and portable Markdown foundation; native attachment and fresh cross-host continuation unverified | P2d; explicit compatibility exercise |
| [C19 Browse a knowledge wiki](#c19) | Existing text/link reading foundation; global wiki index, entry navigation and knowledge adapter unavailable | P2a |
| [C20 Review knowledge against sources](#c20) | Source inspection and review-request foundation; scoped knowledge review execution and correction workflow unavailable | P2a/P2b inspection; P3 review; P4 selected correction |
| [C21 Browse and curate the literature library](#c21) | Existing file reading foundation; collection/work/edition views and curation unavailable | P2b browsing; P3–P4 selected curation |
| [C22 Select and adapt an applicable Skill](#c22) | Harness discovers configured Skill sources; W4/W5 matching and feedback states are synthetic; applicability and partial-use integration remain proposed | Read-only context/catalog slice; UI-3 W4; C14 / UI-6 W5 |

## Scenarios choose cooperating plugins

The [plugin map](10-project-workspace.md#scenario-plugin-map) owns responsibilities; this table identifies the collaboration each user task needs. A domain contributes sources and optional views to the same workbench. Shared source/observation, context/working-memory and document-change services keep those views connected. The combinations below are proposed routes, not an ordered workflow or proof that the plugins are implemented.

| Research situation | Cooperating areas and visible result | Distinguishing case |
| --- | --- | --- |
| Return to a topic or develop an idea | Research records supplies the main/subnote argument and topic home; Workbench presentation opens its linked sources; Collaboration rules and shared memory retain the actual task | C01/C02/C16: topic state and a current session do not replace each other |
| Read a paper and repair an unfamiliar prerequisite | Literature supplies the edition and locator; Knowledge supplies the linked explanation; Skill catalog supplies a relevant reading/learning method; shared context retains the selected passages | C03/C04/C05/C21: a useful explanation cannot substitute for an unread source |
| Derive or transfer an argument | Research records and Knowledge show premises and affected uses; Literature supplies the cited argument; the Skill candidate provider supplies methods and conditions for the main model's applicability judgment | C06/C07/C13/C22: shared terminology does not establish compatible assumptions |
| Compare equations, code and numerical evidence | Code supplies the actual checkout, source and diff; Research records supplies the equation and limitation; separately selected run/analysis providers supply actual outputs | C08/C09/C10/C11: code agreement, job completion and scientific acceptance remain distinct |
| Write, review or correct an existing account | Research records or Knowledge supplies the owner; Literature and Code expose relevant sources; Review supplies inspected findings; shared document changes retain proposed and actual edits | C12/C15/C20: an unopened dependency or unapplied correction stays visible |
| Reuse or improve a research method | Skill catalog exposes actual instructions; the main model records its provisional applicability judgment in shared working memory; Distillation connects observed use with existing methods and proposed changes | C14/C22: partial borrowing, complete use and a successful test have different meanings |
| Browse without an active AI task | Literature, Knowledge, Code or Skill catalog contributes a standalone view; Workbench presentation retains navigation and intentional selections | C19/C21/C22: browsing does not create a task, attach context or modify a source |
| Coordinate work across agents and hosts | Shared working memory and Harness execution integrate scoped contributions; Research records retains scientific implications; Desktop host carries the same views and explicit host identity | C17/C18: a worker or window does not create another scientific owner |

The Skill-related route adds a distinct C22 because deciding whether an existing procedure fits the present problem has different success and failure conditions from C14's creation or revision of a procedure. Complete use, partial reuse and reference use can all be appropriate; no case requires a Skill to be chosen when none fits.

## Keep cases useful during development

Before an implementation slice, name its cases and the particular failure it will
remove in [14](14-implementation-blueprint.md). At that slice's review, update the
affected **Current support and gap** paragraphs here from the actual behavior,
linking the implementation and the relevant evidence in the existing integration
account. Retain skipped, failed, simulated and untested boundaries. A fixed defect
changes its case; it does not promote every case using the same module.

For each implemented feature, select the corresponding [comparison with Codex +
AITP](#comparative-evaluation), or state why that comparison cannot yet be made.
Feature checks and paired research trials provide different evidence; report both
before claiming an advantage for the new workbench.

After researcher use, record consequential friction and what it changes in the
affected case: the task could not be completed, required manual path explanation,
lost a scientific condition, or introduced an unnecessary step. Revise the desired
behavior when the product assumption was wrong. Architecture changes belong in 10,
sequence and current work in 14, and implementation measurements in the integration
account. This document owns the scenario and suitability judgment, with links to
those owners; do not add a parallel case ledger or a diary of every run.

Each case below names an observable output and a concrete counterexample. Use an
authorized real read or scratch fixture containing that counterexample. Check task
success, source fidelity and researcher friction separately from model quality.
Unchanged cases need no ritual rewrite. Keep C01–C22 anchors stable for incoming
development links; split or extend a case only when it represents a distinct user
task with different acceptance.

<a id="c01"></a>
## C01. Return to a project after weeks away

**Task and cooperation.** The researcher opens a self-consistency or symmetry
project and asks where to resume. Projects resolves its actual main note or family
README; the source projection shows the qualified answer, decisive gap and live
threads. A thread opens its argument, retained failure and operative plan alongside
associated sessions. The researcher can recover the question before starting a
conversation. A family map need not invent an umbrella physical conclusion.

**Useful output.** One recoverable next action, or a named pending researcher
choice, with links to its owner and limiting evidence. The parent carries the
branch's implication, not a duplicate queue of child jobs. A status-only visit
correctly produces no source edit.

**Current support and gap.** [Location discovery][locations], [note parsing][notes],
[board tools][reader] and [context preparation][context] support bounded recovery.
The [recorded live pilot][integration] recovered qualified conclusions and stopped
at a choice. Shared editors, source-backed project overview and the closed-thread
outcome lifecycle remain [mock][prototype]/[specification][memory]. This is not a
completed project-return journey.

**Harness UI acceptance route — W1 / UI-1 (design only).** Open Research without creating a Session, follow verbatim topic and failed-route passages, then open the intended Session and inspect its task card and Sources & memory. The [W1 walkthrough](12-desktop-interface.md#scenario-walkthroughs) includes two compactions and a disconnected view; real recovery must preserve instructions, provisional items and last-observed labels. Headless continuity can be implemented and tested before this UI exists.

**Acceptance and counterexample.** Return with no memorized path; locate the
current owner and explain the limitation. Close a scratch thread, then open its old
session: its anchor must reach the outcome without recreating Current work or old
execution authority. Failure: the most recent chat replaces the scientific state,
or a completed control becomes the project's accepted conclusion. **Implementation reference:**
[P1][p1], including family maps, ambiguous anchors and historical citations.

<a id="c02"></a>
## C02. Turn an idea into a scoped research question

**Task and cooperation.** While reading a long-range spin-chain note, the researcher
suggests a possible symmetry or diagnostic. An Explore session starts from that
passage and the existing failed routes. It compares the idea with related work,
states what a discriminating argument would settle, and exposes consequential
choices of model, scope and cost. An idea can remain a seed, be rejected with a
useful reason, or become an explicitly approved branch.

**Useful output.** A question with assumptions, first discriminating step and
stopping condition, retained only where it changes durable understanding. Creating
a session, clicking a relation or selecting a project does not authorize a new
numerical campaign or create a scientific branch.

**Current support and gap.** [AITP brainstorming][brainstorming] provides the
procedure; [interaction cards][cards] can retain a required choice and
[sessions][sessions] preserve task/interjection distinctions. A choice answer
currently re-enters the conversation as its option ID only, so its meaning depends
on the earlier tool call or a compaction summary
([reproduction](../../agent/notes/review-2026-10-22.md)). Dedicated idea
objects and global work origins are specification only. [Document writes][documents]
and [action authority][actions] are unavailable, so branch creation cannot be
presented as an application feature.

**Acceptance and counterexample.** Discuss two alternatives, ask an unrelated
status question, then return: the original idea remains uncommitted and the pending
choice is intact. Failure: a speculative heading becomes an authorized thread, or
cheap execution is treated as permission. **Implementation reference:** [P1][p1] for origins and
choice preservation; [P3][p3] scratch and [P4][p4] approved real authoring.

<a id="c03"></a>
## C03. Discover, assess and import literature

**Task and cooperation.** Starting from global Literature or a project's gap, the
researcher looks for work on a particular model and observable. Search results
retain source, identifier, edition and access state. An item may contain metadata
only, accessible full text, an existing local copy or an unresolved duplicate.
The library resolves those distinctions before an authorized import places one
primary copy and links it to the established paper map or project.

**Useful output.** A short source-supported candidate set and an explicit reason
each item may matter; after an authorized import, a resolvable edition with its
location and access limitations. Discovery, downloading, agent reading and
researcher reading remain different observations. A discovery result is not proof
of novelty or comprehensive literature coverage.

**Current support and gap.** [Workspace search][reader] can find indexed existing
text. It is not web or bibliographic retrieval. [WorksService][works] is a throwing
placeholder; import, edition registration and external retrieval are unavailable.
The [library mock][prototype] supplies interaction examples only. No current
application connector or import path is established by this design.

**Acceptance and counterexample.** Present two editions with similar filenames,
a metadata-only item and an inaccessible source; preserve all distinctions and
show the retrieval failure at its actual stage. Failure: the first local PDF is
silently substituted, or download advances a reading label. **Implementation reference:**
[P2b][p2] for local library/edition resolution. Automated external retrieval/import
needs its own approved adapter and write scope; P2b does not promise it.

<a id="c04"></a>
## C04. Close-read an equation across editions

**Task and cooperation.** Open a chosen edition at an equation beside its reading
note. The reader shows PDF page and printed page separately when their mapping is
known. Select a passage and choose Discuss; the draft carries edition, locator,
excerpt and purpose, with Global or a deliberately selected project. Follow the
cited source in a second pane and compare conventions without replacing the first
argument. Browsing alone creates no conversation.

**Useful output.** A source-faithful explanation or a precisely located unresolved
step. If a locator is corrected, the original observed passage remains inspectable
in the session and the current source is a separate choice. One global paper may
serve several projects without duplicated PDFs or reading notes.

**Current support and gap.** [Text reads][reader] can inspect existing reading
notes. The [prototype][prototype] demonstrates a two-page synthetic paper, named
and native-text selection, and rejected cross-pane provenance. It is not a PDF
parser or real library. [WorksService][works] and edition selection are unavailable;
delivery-bound source citations and pane-local anchors remain P1 requirements.

**Harness UI acceptance route — W2 / UI-2 (design only).** In Materials, open the intended edition and compare its knowledge prerequisite without a Session. Ask about a located selection to create a Global draft with no inherited topic; distinguish attached, sent and currently available text. A missing edition offers explicit candidates without substitution. [W2](12-desktop-interface.md#scenario-walkthroughs) is synthetic; UI-1 first exercises only its note-selection part, while actual PDF/edition behavior needs the literature provider.

**Acceptance and counterexample.** Restart and recover the page and task; select
from one of two panes and verify that the attached source is that pane's edition.
Wrong or ambiguous locators remain unresolved. Failure: an equation from edition A
is attributed to B, or today's source is shown as exactly what an earlier answer
read. **Implementation reference:** [P1][p1] provenance, then [P2b][p2] actual PDF reading;
[P3–P4][p3] for a specifically selected reading-note authoring pilot. Persistent PDF
annotations need their own scoped adapter and are not promised by those stages.

<a id="c05"></a>
## C05. Learn an unfamiliar framework

**Task and cooperation.** From Knowledge, open a learning story about operator
algebras or a field-theory construction independently of a research project. The
current conceptual question, requested depth, source section and prerequisite
explanation prepare a Learn session. Source and explanation remain independently
scrollable. A side question can repair a missing prerequisite without replacing
the learning objective or forcing a compulsory quiz.

**Useful output.** A coherent explanation with assumptions, one worked step and a
named remaining difficulty; when useful, a linked revision of the existing story.
On a later visit the researcher can recover the intellectual question without
reading the whole transcript. An agent-produced explanation, agent review and
learner-confirmed understanding are different facts.

**Current support and gap.** [Learning instructions][learning], [Skill-aware
context][context] and ordinary note reads exist. [KnowledgeService][knowledge] is
unavailable; the knowledge/story screen and independent learning origin are
specification/mock, and no learner usability study is recorded. Instruction
availability does not establish teaching quality or mastery.

**Acceptance and counterexample.** Resume with the same difficulty after
compression and a side question; find the exact source and prerequisite. Failure:
the UI marks a subject mastered because a response finished, or silently shortens
away the crucial assumption. **Implementation reference:** [P2a][p2] knowledge/notes and source
selection; [P3–P4][p3] retained writing, with actual learner feedback.

<a id="c06"></a>
## C06. Derive analytically and identify an obstruction

**Task and cooperation.** The researcher explicitly asks for analytic work only
on a symmetry or perturbative-algebra branch. Read the unresolved implication, conventions and earlier
failed route; place the derivation beside its source reading. Derive or Verify
prioritizes these premises and relevant earlier checks. The work may produce an analytic
step, isolate a resonant obstruction, or identify missing physical input. A new
route can be explored within that request; changing an explicitly fixed model or
the requested scope calls for a concrete discussion.

**Useful output.** An inspectable argument whose premises support exactly its
conclusion, or the specific blocked step and why the tried route fails. Algebraic
closure, a matching number and a physical construction remain distinguishable.
A paused branch stays paused after a status or learning conversation.

**Current support and gap.** [Research][research] and [verification][verify] Skills,
[source reads][reader] and [context instructions][context] provide a discussion
foundation. The current read-only tool registry incidentally excludes execution;
this does not establish how future effect-capable tools honor the user's instruction.
The derivation view itself should impose no automatic tool restriction. Reviewed
derivation editing and the dedicated work area are unavailable.

**Acceptance and counterexample.** Include a misleading algebraic match and an
explicit analytic-only instruction in the fixture. Recover the physical gap and
refuse to close it with that match; do not run numerical or symbolic computation
when the agreed scope excludes computation. Failure: the interface treats a mode
label or a second scientific parent as overriding the constraint. **Implementation reference:**
[P1][p1] task/context; [P2a][p2] paired arguments; [P3–P4][p3] reviewed writing.

<a id="c07"></a>
## C07. Transfer a result across topics without losing conditions

**Task and cooperation.** A topology project wants to use a Green-function
invariant in an account of measurable response. Open the invariant derivation,
response statement and their source passages together. The knowledge/where-used
view shows which passages use the result and which assumptions are stated there.
Compare asks what additional conditions connect the two claims, including what
remains unestablished for a material calculation.

**Useful output.** A qualified implication, a missing bridge or a corrected use of
the result. Imported theorem, reconstructed algebra, finite check and material
prediction retain their different support. A reusable pointer cites the owner;
it does not duplicate the entire project argument. Changed implications are
proposed at both the owner and affected using passages.

**Current support and gap.** [Location relationships][locations] and [parent-use
context][context] provide partial source recovery. Existing where-used results
are links found within discovered main notes, not a semantic support or
invalidation graph. [KnowledgeService][knowledge] and the full relation/condition
inspector remain unavailable. The [relationship
contract][memory] specifies that `cites` is not `proves`; the application has not
validated an end-to-end transfer or dependency update.

**Acceptance and counterexample.** One using passage omits a decisive condition.
Find the omission without changing unrelated users; preserve competing sourced
interpretations. Missing material evidence stays missing. Failure: a topological
integer becomes an experimentally accepted coefficient, or a link is treated as
logical support. **Implementation reference:** [P2a][p2] comparison; [P3–P4][p3] reviewed updates.

<a id="c08"></a>
## C08. Compare a formula with code and debug a discrepancy

**Task and cooperation.** From a failed run receipt, open the scientific formula,
retained failure and the actual checkout. Code identifies branch, dirty paths and
relevant revision; another checkout of the same repository remains distinct.
Review or Implement compares indexing, units, normalization and numerical route
with the stated equation. A bounded test is selected to distinguish the suspected
defect from a changed physical model.

**Useful output.** A located implementation mismatch or a justified explanation;
when execution is available and within the request, an inspectable diff with command, inputs, exit status
and output. Code history stays in its repository; the scientific consequence and
limitation are linked from the owning research thread. A side question about
upstream does not replace the fix task. A local test does not grant permission to
submit a job, install software, push code or publish; each uses the existing
agreement for that action.

**Current support and gap.** The retained Pi [text reader][reader], unavailable
[CheckoutService][checkouts] and [code diff mock][prototype] describe the earlier
implementation. Harness supplies [file previews](../../packages/client/ui-sidebar-documentpreview/README.md),
[read-only language-server navigation](../../packages/lsp/lsp/README.md), and
[generic file editing](../../packages/fs/tool-fs/README.md) plus command execution
in its [base composition](../../packages/bundle/base/cordis.patch.yml), subject to
the selected configuration and permissions. These are three distinct scopes:
code inspection, generic agent editing/execution, and the research integration
that connects a specific checkout, equation, operation and scientific implication.
The latter has no integrated case evidence here; an existing tool does not establish
the proposed code workspace or scientific acceptance. [14](14-implementation-blueprint.md)
owns the current UI/runtime work allocation and implementation progress. This case
does not verify UI work performed in another development task.

**Harness UI acceptance route — W3 / UI-5 (design only).** Read the checkout and retained log in Materials, then compare the formula and code in one comparison tab beside the Session. Respect the two-pane dock limit and keep checkout identity, unknown dirty-edit attribution and provisional residual derivation visible. [W3](12-desktop-interface.md#scenario-walkthroughs) supplies a synthetic mismatch; its fixed reply and file log do not establish an actual tool run or convergence of the physical system.

**Acceptance and counterexample.** Use two checkouts and pre-existing dirty edits;
select the intended one and separate observed diff from known session actions.
Reproduce the retained failure and test the repair without changing the equation
to make it pass. Failure: a unit test accepts the material result, unrelated edits
are overwritten, or a different worktree silently substitutes for the requested
one. **Implementation reference:** [P2c][p2] inspection; [P4][p4] explicitly bounded test/write pilot.

<a id="c09"></a>
## C09. Run a bounded numerical campaign

**Task and cooperation.** A quantum-chain branch has an agreed model, matched
parameter grid, observables and compute limit. A run owner records inputs and
acceptance boundaries before execution. The host/run adapter submits only the
approved work, reads the actual scheduler state and retains receipts and outputs.
The project shows the branch's scientific contribution; the run account owns job
details. A proposed grid expansion or changed route remains a decision when
outside the existing agreement.

**Useful output.** Separately reported planned, submitted, running, failed,
computed, read-back and scientifically accepted coverage, plus agent/queue delay
when known. Missing counts remain “not recorded.” Worker and numerical-library
threads together obey the configured aggregate resource limit; nominal worker
count alone is insufficient.

**Current support and gap.** [Source reads][reader] can inspect retained textual
reports. [RunService][runs], [sandbox][sandbox] and [controllers][controllers] are
unavailable. There is no functioning scheduler/HPC or resource-enforcement
capability in the application, and this document launches no campaign.

**Acceptance and counterexample.** Exercise a failed job, a completed job with
missing output and a still-running job with one usable observation. Do not
resubmit an unknown external outcome automatically. Failure: scheduler completion
becomes scientific acceptance, or workers plus BLAS threads exceed the limit.
**Implementation reference:** [P4][p4] a named bounded run; [P5][p5] separately approved campaign
and distributed-worker orchestration.

<a id="c10"></a>
## C10. Decide convergence and scientific acceptance

**Task and cooperation.** Open an electronic-structure self-consistency thread,
its map definition and run-owner evidence. Compare the original starts, selector
constraints, tolerances and observable with the actual checkout and retained
convergence table. Verify prepares these materials and the operative plan. Read-only
work can end by naming the missing test; an authorized later calculation supplies
only the evidence its acceptance criterion measures.

**Useful output.** A justified distinction between iteration stopping, numerical
solution, independent verification and the physical claim. Solver and independent
verification costs remain separate. A successful small-system control does not
establish a universal solver; a small damped step or smooth outer iteration does
not establish the required root or physical acceptance.

**Current support and gap.** [Recorded live source recovery][integration] retained
qualified conclusions and a pending choice. [Context][context] can gather the
opening, plan and selected files, but lacks the proposed prioritization of important
premises and accurate request-specific reading coverage. [Run][runs] and [checkout][checkouts] adapters and execution are
unavailable. A recovered qualification is not an independent numerical validation.

**Acceptance and counterexample.** Supply a run with a small step but failed true
residual or wrong selection. The product must expose that distinction and preserve
the original start/route constraints. Failure: a passing control receives a green
“solver validated” label, or speed is optimized before the required systems meet
their agreed tests. **Implementation reference:** [P1][p1] source completeness, [P2a/P2c][p2]
evidence comparison, then a [P4][p4] bounded verification pilot.

<a id="c11"></a>
## C11. Analyze raw data and compare matched diagnostics

**Task and cooperation.** A chain project compares spectral statistics, OTOCs and
operator-Krylov behavior. The parent defines the common model/grid; branches own
their distinct ensembles, clocks, sizes and reliable windows. Open raw-data and
analysis provenance beside each figure, checking symmetry sectors and candidate
labels before making a comparison. A missing result remains absent rather than
being inferred from a smooth neighboring curve.

**Useful output.** A reproducible figure or qualified comparison with the input
selection, transformation, uncertainty and limitations attached. Raw completion,
read-back validation and physical interpretation remain separate. Full-trace
operator-Krylov candidates remain distinct from exact controls; finite-parameter
tails do not automatically establish a limiting model or universal chaos measure.

**Current support and gap.** [Read/search][reader] can recover existing textual
accounts. [Run/artifact paths][runs] and [artifact service][artifacts] do not yet
provide application analysis or provenance; [sandbox execution][sandbox] is
unavailable. The interface specification is not a data-analysis benchmark.

**Acceptance and counterexample.** Deliberately include an unmatched grid, wrong
sector, candidate curve and missing point. Preserve these distinctions through
selection, plotting and a status interjection. Failure: averaging hides the
mismatch, a restarted job expands accepted coverage, or a plot without retained
inputs is called reproducible. **Implementation reference:** [P2][p2] bounded material inspection;
[P4][p4] a named analysis/plot workflow. P2 alone does not deliver raw-data execution.

<a id="c12"></a>
## C12. Develop a manuscript, figures and citations

**Task and cooperation.** Open the complete affected argument and writing plan
from Notes or a manuscript resource. Select a paragraph while source passages,
figure inputs and cited editions remain accessible. Write prepares the full
argument needed for substantive restructuring. A proposed change shows affected
text and links. Scratch proposals and independent review are useful options according
to the task; the future application's read/write policy remains to be specified and
this design grants no write access. A build uses the selected manuscript
and retains its output receipt.

**Useful output.** A coherent revised account whose opening, derivation and
conclusion agree, with figures traceable to data/analysis and citations to the
actual sources. Compiled, citation-checked, scientifically checked and
researcher-approved remain separate. Declining the proposal leaves source text
unchanged; known dependent passages carry the correction or an explicit limitation.

**Current support and gap.** [Writing instructions][writing] and text reads exist;
the [proposal mock][prototype] is synthetic. [DocumentService][documents],
[manuscript adapter][manuscripts], review execution and build/effect paths are
unavailable. Automatic context selection does not yet guarantee reading the whole
affected argument: the current English restructuring-word heuristic suppresses
ordinary excerpts but does not itself load the whole owning note; selected files
still determine that input. Complete-argument reading is presently a Skill
guidance; runtime prioritization and delivered-coverage tracking remain to be implemented.

**Acceptance and counterexample.** Request substantive restructuring in Chinese
and English; inspect the actually delivered context, not just its reference list.
Use a short selected paragraph whose condition is elsewhere, a long equation, an
old figure and a changed premise outside the edit. Omission of a critical premise
must stay visible in the coverage account; the model can reopen it, qualify the draft
or continue another useful part of the task. Preserve the condition and identify obsolete
dependencies. Failure: an omission silently disappears, a source gap blocks every
kind of writing, a successful PDF build validates the science, or a polished
summary erases a useful failed route. **Implementation reference:** [P1][p1] context completeness,
[P3][p3] complete scratch proposal/review/recovery, then [P4][p4] a named real
writing/build pilot.

<a id="c13"></a>
## C13. Promote reusable knowledge without duplicating authority

**Task and cooperation.** A project derives or clarifies a result useful to a
second question. Search the existing knowledge index and conventions first.
Prepare a provisional pointer to the owning research section, stating the result,
assumptions and limitation. A self-contained shared explanation is proposed when
its independent role is clear; promotion follows the applicable researcher
confirmation rule. Project-specific variants remain explicit where used.

**Useful output.** One reusable, findable entry or pointer with provenance and a
clear support label. The original argument remains reachable. When a result is
corrected, its affected known uses are revised or qualified; no claim of a complete
dependency graph is made from a bounded search.

**Current support and gap.** [Memory guidance][memory-skill] supplies ownership and
promotion rules. [Search/read][reader] may retrieve existing knowledge text, but
[KnowledgeService][knowledge] is a placeholder and [documents][documents] cannot
apply promotion or corrections. A knowledge tab mock is not a managed collection.

**Acceptance and counterexample.** Find an existing entry in different conventions
and a provisional result with one dependent use. Avoid a redundant atom, preserve
the convention difference and keep the provisional status. Failure: a session
answer is automatically promoted into established knowledge or the new entry
becomes a second conflicting owner. **Implementation reference:** [P2a][p2] lookup/where-used;
[P3–P4][p3] approved promotion and correction.

<a id="c14"></a>
## C14. Distill a demonstrated research procedure into a Skill

**Task and cooperation.** Debugging, source reading or a correction reveals a transferable decision: for example, which residual distinguishes apparent from actual convergence, or how to resolve edition/page mismatches. Skill catalog finds the actual existing methods and motivating episodes; Distillation compares the demonstrated operation with them before proposing a narrowly scoped addition or revision. Distill the diagnostic choice, applicable conditions, inputs, failure signs and stop condition; keep the scientific result in its note. Use a concrete task that could expose the procedure's failure. Later use under [C22](#c22) can reveal a missing prerequisite or a poor match and return feedback to the same method owner. The [distillation design](11-research-memory.md#skill-distillation-loop) owns this optional loop; it is not a requirement to manufacture a Skill at every task close.

**Useful output.** A focused portable Skill or correction to an existing one,
grounded in a demonstrated operation, with paths and limitations made explicit.
An existing Skill may already cover the useful choice; in that case the outcome can be a linked example, applicability correction or no durable change. Under read-only scope, an inspectable candidate or finding is useful without being written or installed. Conceptual conclusions do not become procedure cards. Drafting, checking a bounded example, actual later use, installation and publication remain different observations. Installation or publishing uses its actual authority rather than being inferred from local drafting.

**Current support and gap.** The [distillation Skill][distill] is part of the
[runtime Skill index][context] and can guide conversation. The application
[method service][methods] and scientific write/execution paths are unavailable.
The repository's existing Skills are not evidence that the workbench can create,
validate or distribute a new Skill. Harness can discover configured Skill sources, but the proposed [distillation view](12-desktop-interface.md#distillation-workbench), use-feedback route and research-specific change flow have no integrated application evidence.

**Harness UI acceptance route — W5 / UI-6 (design only).** Inspect draft, evaluation, file, installed and published states separately; retain failed or untested transfer and distinguish pending note integration from a Skill proposal. [W5](12-desktop-interface.md#scenario-walkthroughs) uses fixed synthetic outcomes. The first real increment ends at transfer untested until a bounded evaluator receives the draft on a changed instance; it can keep or discard the proposal without a write or installation.

**Acceptance and counterexample.** Compare a useful correction with an attractive
but untested procedure. Retain the demonstrated boundary, exercise the failure
case and avoid workstation-only assumptions in a portable Skill. Reuse the candidate in a task with a changed premise, preserve the failed use and revise the applicable conditions when supported; an unchanged method may need no revision. Failure: one successful run becomes a universal method, negative use disappears, a new Skill duplicates an existing one, or installation is reported as proof of scientific correctness. **Implementation reference:** a selected read-only catalog/context slice can inspect and evaluate a candidate before authoring. Applied changes to actual research Skill files need a specifically named [P4][p4] pilot; [P3][p3] can exercise only its selected scratch scope. No blanket Skill automation is promised by P1–P3.

<a id="c15"></a>
## C15. Independently review and propagate a correction

**Task and cooperation.** When independent review is requested or useful for a
consequential source change or handoff, a
separate reviewer receives the actual session log and relevant files, and
reconstructs the task without relying on the author's summary. It checks the
argument, evidence, preserved work and scope. The author assesses findings and is
the source editor; disagreement remains explicit when evidence does not settle it.

**Useful output.** An inspectable review and author disposition, then one
correction at the owner and its affected uses. A changed premise outside the
edited paragraph can make an earlier review stale. Agreement between models is
not independent physical evidence, and the researcher's decision is not replaced
by a reviewer verdict.

**Current support and gap.** [ReviewService][review] persists queued requests and
exports actual logs; reports and assessments are empty, application is unavailable, and
reviewer task shells are absent. The [current session export][sessions] explicitly
excludes worker/reviewer conversations and lacks full-output artifact references;
its existence does not establish complete review evidence. The [Astra design
critique][design-review] was performed through the host agent workflow; it is not
an executed application reviewer feature. Proposal/review visuals are mock only.

**Acceptance and counterexample.** Seed a dropped condition, an omitted critical
premise and a premise changed outside the proposed edit, including a Chinese
restructuring request. Inspect the context actually delivered to author and
reviewer; an attached pointer is not evidence that either read the premise. The
author addresses valid findings within the selected scope and retains unresolved
disagreement. Changed dependencies make the old review's coverage uncertain; report
that limitation without stopping unrelated work. All hash-related checks remain disabled; proposed
exact-text/argument checks require their own design decision. Failure: queued
means reviewed or two agreeing answers mean proved. **Implementation reference:** [P3b–c][p3].

<a id="c16"></a>
## C16. Interrupt, resume and reconcile uncertain effects

**Task and cooperation.** During a scoped derivation or diagnosis, the researcher
asks a parent-project status question; later the process stops or context is
compacted. Session/task state preserves the original objective, pending choice
and selected scope. On return the application rereads current sources while
retaining what an earlier answer actually received. A changed or missing source
is visible. External effects are reconciled from evidence before any retry.

**Useful output.** A faithful continuation or a precise blocked decision, without
reconstructing authority from an old successful action. A run with unknown submit
outcome remains uncertain; unrelated read-only recovery can proceed. A stale
path does not silently retarget an active task.

**Current support and gap.** [Session/task handling][sessions], [context refresh][context]
and [compaction][compaction] exist. The [recorded pilot][integration] preserved a
waiting task across a status interjection, restart and forced compaction, with
original failures retained. [Effects][effects] and command/action recovery are
unavailable. Full editor-layout and historical-citation restoration are future
work, not established by session durability alone. A 2026-10-22
[reproduction](../../agent/notes/review-2026-10-22.md) found that a moved or deleted
selected source makes context preparation fail instead of appearing as an omission.
Compaction neither re-delivers interjection-attached material nor separates researcher
decisions from model summaries.

The proposed [rule editor](12-desktop-interface.md#collaboration-rule-editor) adds a related
continuation test: a scoped user rule change must survive restart with its exact source
and actual adoption state. Rule editing/resolution is currently unavailable; a declared
config API and readable Skill do not implement it.

**Harness UI acceptance routes — W1 / UI-1 and W6 / UI-4 (design only).** [W1](12-desktop-interface.md#scenario-walkthroughs) exposes original instructions, provisional working items, source observations and generated summaries separately after compaction. W6 separately tests a rule edit during a running request: saved is not yet adopted, the next request records actual use, and save failure retains the draft. These are synthetic walkthroughs; real rule-source persistence/adoption and restart evidence are still required. UI-1 includes a read-only effective-rule view, not the rule editor.

**Acceptance and counterexample.** Interrupt with a required choice pending;
change a scratch source between delivery and resume; simulate an uncertain
external action once execution exists. Preserve the task and distinguish retained
observation from current text. Failure: a status question replaces the objective,
or reconnect submits an effect twice. Change a project writing preference and separately
give an explicit task instruction: the next relevant request must receive the selected text, other
projects retain their defaults, and already dispatched work is not falsely relabelled.
With details closed, show the relevant instruction, important unread context and pending choice;
the complete rule and evidence remain one deliberate expansion away. **Implementation reference:** [P1][p1] read-only recovery;
[P3c][p3]/[P4][p4] writes and effect reconciliation.
Editable rule persistence is a separately selected slice under the plan, not automatically
included in P1 by adding this acceptance example.

<a id="c17"></a>
## C17. Delegate parallel work and hand it back coherently

**Task and cooperation.** One approved question separates into a source audit, an
analytic check and a bounded implementation diagnosis. The coordinating session
gives each worker a concrete output, scope, applicable constraints and resource
share. Read-only review can proceed alongside an independent source task; edits
to the same owner require one integrator. The parent integrates implications and
limitations while the branches retain their evidence and next actions.

**Useful output.** A single coherent account with inspectable contributions and
unresolved disagreement. Handoff updates the existing owner when its scientific
meaning changes; a transcript export alone does not integrate a result. Worker
completion, scheduler completion and scientific acceptance remain different.

**Current support and gap.** [Session exports][sessions] and the [AITP memory
procedure][memory-skill] support manual handoff through ordinary files. Application
worker execution and [controllers][controllers] are unavailable; a delegated
agent in the surrounding development environment does not establish a workbench
worker capability. [Review requests][review] do not supply research workers.

**Acceptance and counterexample.** Two workers return incompatible conventions,
one times out and one proposes an overlapping edit. Preserve all qualifications,
avoid duplicated integration and stay inside the aggregate budget. Failure:
majority agreement settles the claim, a worker expands the objective, or a new
handoff summary becomes a parallel scientific owner. **Implementation reference:** [P3][p3]
independent reviewer; [P5][p5] separately selected research orchestration.

<a id="c18"></a>
## C18. Work across desktop, hosts and existing tools

**Task and cooperation.** The researcher opens a native desktop window while
files and tools live in a selected WSL environment; a remote run may live elsewhere
later. The resource identifies host, configured root and relative path. Native
actions reveal/open through a narrow bridge; the filesystem host performs reads
and Git operations. Codex or Claude Code can later continue from the same
scientific note without needing application-only state.

**Useful output.** The correct resource in the correct host, an explicit offline
or unresolved state when unavailable, and portable scientific continuity. Reuse the selected Harness desktop carrier and state who owns each local/WSL backend's startup and shutdown. The old attach-only Pi proposal does not describe Harness Electron lifecycle. Remote compute attachment is separate.

**Current support and gap.** The retained Pi [local server][server] and [path guards][paths] supply old evidence; the new base includes [Harness Electron](../../apps/desktop/README.md). Ordinary Markdown remains portable. Actual research-root/WSL attachment, stable cross-host addresses and scientific continuation are unverified. The format trials
did not establish fresh Claude Code continuation, as [15][design-review] records.
No successful multi-host product or note migration is claimed.

**Acceptance and counterexample.** Give two hosts the same relative filename;
disconnect one and close/reopen the desktop. Do not resolve to the other host.
Before migration, fresh Codex and Claude Code sessions must recover the same
owner, pending choice, scope and failed route from the scratch note without
runtime data. Failure: a Windows-looking path silently maps to a WSL root or
portable syntax is treated as demonstrated interoperability. **Implementation reference:**
[P2d][p2] native local attachment; explicit later host and migration exercises.

<a id="c19"></a>
## C19. Browse a knowledge wiki without starting a research task

**Task and cooperation.** The researcher opens Knowledge to explore a subject,
look up a definition or revisit a derivation. A subject index and search lead to
existing questions, concepts, results, examples and learning stories. An entry
exposes its assumptions, conventions, prerequisites and supporting sources;
ordinary links, an outline and back/forward navigation let the researcher follow
the argument and return to the same passage. Related entries and where-used links
have explicit meanings and bounded coverage. A graph is an optional view of those
links, not a prerequisite for reading or a new source of scientific authority.

**Useful output.** A useful explanation with its limitations and a traceable route
to the original source. Concept navigation and paper-by-paper navigation coexist:
a paper route preserves its original section order, equations, footnotes and open
derivation steps. A summary gives orientation; it cannot stand in for the source
reading. Browsing requires neither a project nor a model request. Asking about a
selected passage is an optional next action.

**Current support and gap.** [Source reading][reader], ordinary note links and
search supply a foundation. The [knowledge adapter][knowledge] is a placeholder;
the global wiki index, complete navigation loop and dedicated where-used view are
specification only. Current location-bound sessions do not supply a Global
knowledge session. C05 covers guided learning and C13 covers promotion; neither
establishes this independent browsing workflow.

**Acceptance and counterexample.** Start without a chat or known file path. Find a
concept, inspect a premise and its source, then return to the original passage
with scroll and context preserved. Show missing links and unknown index coverage.
Failure: browsing creates a project/task, a similarly named concept with different
conventions silently substitutes for the target, or an overview hides an unproved
step. **Implementation reference:** [P2a][p2], with actual PDF source navigation in P2b.

<a id="c20"></a>
## C20. Review knowledge entries against their supporting sources

**Task and cooperation.** The researcher selects an existing entry, passage or
bounded collection for review. Knowledge opens the claim and its assumptions
beside the cited edition and derivation. A human can inspect them directly; a
requested independent reviewer later receives the selected scope and relevant
sources through the review runtime. It checks what the source actually supports,
missing hypotheses, convention changes, unexplained derivation steps and conflicts
with related entries. Link/metadata problems remain distinct from scientific
objections. A review may find no correction to make.

**Useful output.** Findings tied to exact inspected passages, with coverage and
unresolved dependencies stated. Source reasoning, reconstructed steps and imported
results remain distinguishable. A consequential correction identifies the owning
entry and known affected uses, then enters the existing proposal/assessment flow;
the review report is not a competing knowledge page. Unread portions remain
unreviewed, and a model's agreement never proves a theorem.

**Current support and gap.** Existing source tools allow bounded manual inspection;
[review][review] can queue a request and export a log, but cannot execute or assess
the review. Knowledge/source comparison panes, knowledge review coverage and
controlled corrections are unavailable. C15 supplies the shared review mechanism;
this case supplies the distinct corpus-maintenance task, including review with
no proposed edit. No complete knowledge-base audit is claimed.

**Acceptance and counterexample.** Use a synthetic entry that drops a hypothesis,
cites the wrong edition and links to an unread dependent entry. A scoped review
must expose the hypothesis and edition problem, retain the dependency gap, and
avoid marking the whole subject reviewed. Opening the review must not change
scientific labels or source text. **Implementation reference:** [P2a/P2b][p2] for human inspection;
[P3b][p3] for actual read-only review, P3c for controlled scratch correction, and
[P4][p4] for a named real correction pilot.

<a id="c21"></a>
## C21. Browse and curate an existing literature library

**Task and cooperation.** The researcher opens Library to inspect what is already
available, without first asking the agent to find a paper. Search and collection
filters expose title, author, year, topic, identifiers, local availability and
recorded reading state. A work opens its distinct editions, local PDF/source,
existing source-ordered reading notes, unresolved reading steps, and linked
knowledge entries or project arguments. The researcher can compare papers in
shared panes and return to the same filtered list. C03 owns external discovery and
import; C04 owns close reading after choosing a source.

**Useful output.** The intended paper and edition, what has actually been read or
explained, and a route back to its relevant notes. Later curation can correct
metadata, classify a selected work or reconcile duplicate candidates through a
reviewable change to its existing owner. Similar titles, a preprint and a journal
article do not automatically denote identical editions. Collection membership is
not a second copy of the paper or its scientific conclusions.

**Current support and gap.** Existing paths and text tools can locate some local
material; [works][works] remains a placeholder. Collection/work/edition views,
actual PDF reading and library curation are unavailable in the application.
Prototype selections are synthetic and do not establish a working library.

**Acceptance and counterexample.** Starting from Library alone, find a paper among
similarly titled works, select its intended edition, open its reading note and
return without losing filters. A missing PDF still exposes known bibliography;
unknown or incomplete indexing cannot appear as an empty library. AI-read,
researcher-read and explained-derivation coverage remain distinct. Failure:
opening a paper marks it read, two editions merge silently, or a view triggers a
download or metadata write. **Implementation reference:** [P2b][p2] for read-only browsing;
[P3][p3] scratch proposals and a separately selected [P4][p4] curation pilot for
actual changes. Bulk reorganization and external import need their own scope.

<a id="c22"></a>
## C22. Select a Skill and decide how it fits the current problem

**Task and cooperation.** A project has accumulated methods for a particular solver, source-reading route or analytic technique. The next problem may share the topic while changing the assumptions, or share a useful operation with a different topic. Skill catalog supplies candidate instructions from configured portable, personal and project sources. The candidate provider under shared context retrieves methods and packages their conditions, inputs and demonstrated limits. The main model compares these with the current question, requested output and physical/mathematical conditions; it records its applicability judgment as a provisional [working item](11-research-memory.md#working-memory-items). Topic association and semantic similarity help find candidates; they do not establish applicability. Following [the applicability design](11-research-memory.md#skill-applicability), the model reads the relevant instructions and chooses complete use, a bounded part, reference use, or an unsuitable/unknown assessment. The researcher can supply a candidate or correct the relationship without taking over every routine selection.

**Useful output.** A method choice with a concise reason and decisive limitations, linked to the exact source and portions actually supplied. For example, a diagnostic for equation residuals may transfer while the original solver's update rule does not. Partial use retains all mandatory instructions and dependencies applicable to that portion; it cannot silently discard conditions or claim that the complete Skill was executed. If a necessary condition is unknown, the model may inspect it, explain conditional use, choose another route or retain the method only as a reference. The task continues adaptively under its actual instructions. The [Skill library and use view](12-desktop-interface.md#skill-library-and-use) exposes this distinction on demand; no new mode or automatic action lock is implied.

**Current support and gap.** The Harness launcher connects the pinned AITP Skill source, and inherited Skill discovery supplies a platform basis. The application has no demonstrated task-specific applicability provider, selected-portion delivery with dependencies, or research-use feedback integration. The old Pi [method service][methods] remains historical placeholder evidence. Readable Skills and the proposed screen do not establish good matching, actual adoption or successful use.

**Harness UI acceptance route — W4 / UI-3, with W5 feedback (design only).** Inspect a borrowed step with its dependencies and unused scope, then a selected topic copy shadowed by a same-named source; leave the mismatch unresolved until actual source-qualified loading exists. Show changed or compacted-away instructions accurately. [W4/W5](12-desktop-interface.md#scenario-walkthroughs) contain synthetic judgments and evaluations. Runtime acceptance requires real candidate listing, delivery evidence and the attributed main-model use item; changing the relationship cannot silently replace an agreed solver.

**Acceptance and counterexample.** Use a same-topic candidate with an incompatible hypothesis and a differently named candidate with a transferable diagnostic. Check both a whole-method match and a partial match with a required prerequisite outside the selected section. An absent prerequisite remains unknown; the model must not cherry-pick around mandatory instructions or relabel reference use as completing the method. Then change the task's assumption or the Skill source after compaction, and verify that the retained use account identifies what was actually loaded while current applicability is reconsidered where affected. Include an explicit researcher correction, a selected topic method shadowed by a same-named catalog entry, and a case where no Skill fits. Failure: the closest title wins, source selection silently invokes another file, every project Skill enters context, a summary becomes the full procedure, stale selection persists after a relevant change, or partial borrowing silently changes the agreed algorithm. **Implementation reference:** a separately selected read-only context/Skill-catalog slice; [C14](#c14) owns later distillation and actual method revision.

<a id="adaptive-research-checks"></a>
## Cross-case exercises: evidence changes the next action

The [research collaboration model](10-project-workspace.md#research-control) supplies
the question, relevant memory, actual source coverage and researcher instructions while
the model selects useful next steps. A proposed change to the researcher's objective or
an explicitly fixed method calls for discussion. These synthetic exercises
connect the existing cases; they are not new mandatory research phases and have
not been run as model evaluations. Their expected behavior admits several sound
routes rather than grading one exact tool-call sequence.

| Exercise and existing cases | Useful context and possible next steps | What would fail the case |
| --- | --- | --- |
| Local knowledge has the needed result; a variant omits one source hypothesis. C05/C06/C19/C20/C21 | Prioritize the existing result, conventions and source hypothesis. The model may reuse the derivation, reopen the original, reason conditionally or look for another source. Missing full text remains unknown | An unnecessary survey despite sufficient evidence, claiming an unread source supports the result, treating zero search hits as an empty knowledge base, or universally banning exploration until the source is available |
| Algebraic agreement is being used to infer a physical realization under an analytic-only task. C06/C07 | Identify the missing representation, locality or limiting argument; inspect sources or derive the bridge. Preserve “algebraic step established, physical identification unresolved” if that is all supported | Unapproved numerical execution, or treating a finite control/matching algebra as proof of the physical interpretation |
| An iterative step is small but the declared equation residual is large. C08/C10 | Recover the intended equation and stopping rule; inspect the actual code and inputs, then distinguish an implementation defect from a proposed algorithm change. An authorized fix restores the chosen method; a change to an explicitly fixed solver or root-selection rule calls for discussion unless delegated | Increasing the scan, changing the definition of convergence silently, or calling a successful small-system control a universal solver |
| A critical premise falls outside the context budget, and compaction retains only the claimed result. C06/C12/C15/C16 | Preserve the coverage gap and prioritize the premise, failed route and conditions on continuation. The model may reopen it, narrow the assessment or work on an independent question | A pointer counts as a read, a summary removes the caveat, the same failed route restarts without a changed condition, or a generic readiness lock prevents all further work |
| A scoped correction invalidates a knowledge entry used in two known notes; another use remains outside inspected coverage. C07/C13/C15/C20 | Compare versions/conditions, propose correction at the owner and inspect actual affected uses. Under read-only scope leave a pending proposal; under later authorized writing apply/read back and name the remaining gap | An automatic whole-library “verified” label, silent changes outside scope, duplicated conclusions, or a report mistaken for an applied correction |
| The researcher changes a writing preference, then explicitly narrows the task; a later message only asks for status. C02/C16/C17 | Deliver the preference and task instruction with their scope and source, preserve the task during the status answer, and report actual running effects honestly. Continue useful work consistent with the explicit instruction; leave unanswered choices visible | A preference becomes an automatic tool ban, the explicit task instruction is lost, a worker silently broadens scope, repeated approval is demanded for an unchanged routine step, or the status question implicitly selects a method |
| A settled one-file implementation contrasts with a multi-stage change with unresolved interfaces and resource needs. C08/C09/C12 | Execute the authorized routine fix with relevant validation. For the multi-stage task, prepare/update a useful plan and resolve consequential choices before dependent implementation; retain only meaningful outcomes | A compulsory plan file for every action, or unplanned dependent changes/campaigns before their methods and bounds are settled |
| A familiar project Skill assumes a particular solver, while the current problem shares only its residual diagnostic. C08/C10/C14/C22 | Inspect the method and its prerequisites, borrow the justified diagnostic with its limits, and preserve the current algorithm. A later failed use can motivate a focused correction or no change | Loading every project method, treating a shared topic as compatibility, dropping a mandatory dependency, or silently importing the original solver into the task |

Select exercises for the capabilities actually being implemented: source-context
prioritization and recovery can use synthetic notes; paper/code views, independent
review, writing and long-running work need their own actual implementations and
selected scopes. The plan's milestone references organize that development work,
not the order in which a researcher or model must think. A simulated tool result
cannot establish a working execution or authoring capability.

Assess source recovery, instruction adherence, the action's scientific relevance,
retention of qualifications and unnecessary researcher interruptions separately.
Change one decisive premise or explicit delegation while keeping the rest of a
fixture fixed, and check whether the next action changes appropriately. Reuse a
still-applicable check; repeat only changed or uncertain behavior. The
[comparative evaluation](#comparative-evaluation) below owns the requested
AITP-agent versus Codex + AITP protocol. Neither this written walkthrough nor
passing a context-delivery test establishes scientific correctness or general
superiority.

<a id="comparative-evaluation"></a>
## Compare implemented features with Codex + AITP

The researcher requires comparisons against **Codex with the same portable AITP
protocol and relevant methods**, not plain Codex. This section defines prospective
comparisons for C01–C22; none has been run by writing the plan. Select a small
paired exercise when its feature works, then revisit representative combinations
in the integrated product. [14](14-implementation-blueprint.md) owns scheduling
and GPT readiness; the [Harness integration account](../../agent/notes/harness-integration.md)
owns actual trial evidence. No separate benchmark platform or scientific score is
required.

The [GPT reliability slice](../../agent/notes/harness-integration.md#gpt-reliability-slice) supplies engineering prerequisites for C08 (tool execution) and C16 (continuation): same-mode filesystem/PowerShell and actual child-agent handling, unchanged-failure suppression, bounded small-window compaction, restored-loop routing and Codex protocol/retry handling. These tests use synthetic inputs. A live ChatGPT/SSE C08 engineering smoke read two Pauli-matrix fixture files, fixed an incorrect commutator, ran the check once and exited naturally; the recorded run recovered from one visible transport retry. A later deterministic race test exposed an orphan WebSocket under concurrent title/main requests; after correcting cache ownership, both auto and explicit WebSocket read/edit/run scratch tasks also exited naturally. These checks do not cover every proxy/disconnection case, and no physical claim follows from this finite matrix check. These results do not establish retention of physical assumptions, native Windows behavior or an AITP-agent versus Codex + AITP advantage; those comparisons remain unrun.

### Keep three kinds of evidence separate

- **Engineering checks:** deterministic fixtures, recorded-request inspection and
  replay establish what the implementation actually reads, delivers, restores or
  changes. Provider checks cover actual GPT request/response and tool handling;
  an adapter failure must be located before attributing a weak answer to the model.
- **Model behavior:** paired live tasks assess whether the agent uses the sources,
  preserves conditions and corrections, chooses a useful next step and reports
  uncertainty. A replayed answer cannot supply this evidence.
- **Human and scientific assessment:** a person inspects the argument and actual
  interactions. Usability, source fidelity and physics validity are distinct;
  another model's review can help find errors but cannot settle validity by itself.

### Prepare a fair, inspectable pair

1. Give both systems independent scratch copies of the same initial notes, code,
   papers and Skill sources, with the same question, user corrections and allowed
   operations. Start fresh sessions and keep one system's outputs out of the
   other's inputs. Keep assessor-only expected findings out of both contexts;
   supplied excerpts and preprocessing must be available to both. Include changed
   conditions and held-out examples, not only examples used to design the feature.
2. Use the same pinned portable AITP revision and inspect the source that each host
   actually resolves. Check nested-method discovery and same-name overrides. For
   a controlled method-use trial, explicitly select the same method in both; for
   a method-selection trial, offer the same candidates and observe the actual
   selection. Record which instructions were available, loaded and still present
   after compaction. Installation alone does not establish an AITP baseline.
3. Match the model/version, reasoning setting, tool capabilities, source access,
   requested context/output budgets and task instructions where each host permits
   it. Record the actual provider/auth route and exposed settings, including what
   could not be verified. Host prompts, context selection, compaction, permissions
   and tool encodings may differ; identify those differences rather than claiming
   identical inputs. The comparison of whole products includes their context
   selection. A separate matched-input provider check can isolate transport defects.
4. Use paired repetitions and vary host order; record the chosen repetition count,
   actual runs and stopping reason. Keep unsuccessful and interrupted attempts.
   Use controlled local sources first. Live search adds changing availability and
   ranking, so report retrieval coverage separately. If equivalent compaction
   triggers or context pressure cannot be arranged, report each native mechanism
   and limit the comparison instead of pretending two commands mean equal pressure.
5. Preserve observable prompts, delivered source/tool records, outputs, changed
   files and failures with private data kept local. Codex's documented
   [non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode)
   offers structured events for a baseline runner; confirm the installed version's
   capabilities before using them. Missing observability stays unknown. Do not
   infer hidden reasoning or fabricate equal token use from configured budgets.

### Scenario and feature evaluation map

The checks below become runnable as their named capabilities are implemented.
They are acceptance examples, not current support claims or a required action
sequence. Each group has a bounded fallback when a full comparison is unavailable.

| Cases and cooperating features | Engineering exercise | Paired behavior or human assessment | Limitation and useful fallback |
| --- | --- | --- | --- |
| [C01](#c01), [C02](#c02), [C16](#c16): topic records, task/working memory, context and collaboration rules | Preserve a Chinese/English scope correction, a choice with its question, and a failed route with its reopening condition through compaction/restart; a deleted source becomes a reported omission | Does the next action respect the correction, avoid the failed route absent changed conditions, retain pending choices and distinguish model suggestions from user decisions? | If one host cannot expose or force the same recovery operation, test its supported recovery and report unmatched stress; a deterministic AITP-agent request check remains useful but is not a comparative model result |
| [C03](#c03), [C04](#c04), [C05](#c05): literature, source selection and learning/knowledge context | Resolve two editions, a precise passage and an unavailable source; inspect what PDF/text material actually reached each model | Source-faithful explanation, useful prerequisite repair, exact citation and honest unread coverage; learner assesses whether the explanation resolves the difficulty | Live retrieval and PDF extraction may differ. Supply equal local source/excerpt copies for a bounded reading trial; this does not test discovery, extraction or personal learning benefit |
| [C06](#c06), [C07](#c07): analytic working memory, knowledge and method use | Retain analytic-only scope and assumptions while a source variant changes one decisive condition | Does the argument expose the missing physical bridge, qualify the transferred result and stop an unsupported claim without freezing unrelated reasoning? | Novel mathematics may have no known answer. Use a bounded argument with inspectable premises first; unresolved research requires expert assessment and cannot receive an automatic correctness score |
| [C08](#c08), [C09](#c09), [C10](#c10), [C11](#c11): code workspace, GPT tools, run/analysis providers | Distinguish two dirty checkouts, preserve unrelated edits, exercise a known mismatch and a small-step/large-residual control; retain actual inputs, commands, outputs and coverage | Restore the agreed equation/algorithm, separate solver and verification evidence, detect unmatched grids/failed jobs and avoid treating numerical completion as physical acceptance | Matched local execution can test a small fixture. Scheduler, aggregate resource limits and long campaigns need the actual host and scope; recorded run outputs test interpretation only, not submission or enforcement |
| [C12](#c12), [C13](#c13), [C15](#c15), [C20](#c20): records, proposals, knowledge and review | Seed a dropped hypothesis, changed dependent premise and unread source; preserve original files during proposal-only trials and verify actual changes in separately scoped apply trials | Does author/reviewer coverage retain the caveat, correct the owner and known uses, and distinguish an unapplied draft from durable integration? Inspect disagreement as well as agreement | If writing/review is unavailable, compare drafts and source inspections, reporting the missing path. Use distinct reviewer context; shared model, sources or assumptions limit scientific independence |
| [C19](#c19), [C21](#c21): wiki/library readers, topic navigation and workbench UI | Browse without chat; distinguish same-title works/editions, unknown index coverage and unavailable files; recover the selected passage | Researcher performs the same find/read/return task through each product's available interaction route; report lost place, manual path explanations and avoidable steps | This is user-assisted usability work. Codex may have a different UI or require existing external tools; disclose them. A prototype walkthrough or API test cannot establish a comparative UX advantage |
| [C14](#c14), [C22](#c22): Skill catalog, working memory, context and distillation/proposals | Expose same-name/nested candidates and actual bodies; distinguish loaded/currently available/changed instructions and recorded partial-use scope | Reject a same-topic assumption mismatch, borrow a cross-topic diagnostic with its prerequisites, preserve the agreed solver, and evaluate a focused draft on a changed case when delivery exists | An unapplied draft needs an actual isolated delivery path and an identified assessor before transfer can be tested. Until then report “transfer untested”; drafting, installation and successful original use do not establish reusable method quality |
| [C17](#c17), [C18](#c18): delegation, shared records and host/desktop adapters | Exercise conflicting worker conventions, timeout, overlapping edit proposals and same-path resources on different hosts; preserve source identity on disconnection | Can the coordinator produce a qualified account and can a fresh host recover the scientific question, conditions and pending work from the intended record? | Real multi-host/desktop tests require those environments and often user participation. Local worker fixtures or file-only continuation test those narrower claims; they do not establish native attachment or remote-effect recovery |

### Report results and infeasible comparisons plainly

For each selected pair, state the task and inspected scope, actual material/tool
coverage, source qualifications, missed conditions, user corrections required,
scope violations, and which outputs are drafts versus verified file changes.
Report elapsed time, tool calls and usage/cost only where observed, separating
setup, waiting, failed transport and researcher effort. Mark unavailable cost or
context data as unknown. A short observation with evidence is preferable to an
opaque aggregate score.

When credentials, a matching model/tool, an implementation, a source, a real host
or a qualified assessor is missing, tell the researcher which comparison is
**blocked**, **not directly comparable**, or **requires user participation** and
why. Offer the bounded fallback from the table and state what it cannot establish.
Do not substitute mocks for an unavailable live test or count a blocked arm as a
loss. No real-note edit, campaign, installation or publication is implied by an
evaluation plan; use the selected scratch scope and actual user authorization.

Retain regressions and neutral results alongside improvements. Judge each task
against its scientific purpose and inspectable conditions, allowing multiple sound
routes. Set any task-specific acceptance boundary before interpreting its outcome;
there is no universal score or pass threshold for research. Neither one successful
case nor a collection of engineering passes justifies “AITP-agent is better than
Codex + AITP” across research. The useful conclusion names which capability helped,
under which conditions, and what remains unresolved.

## Boundaries still needing a real case

The inspected requirements cover computational electronic structure, chain
diagnostics, analytic symmetry, interacting topology, source-based learning and
manuscript development. An active DMFT workflow was not established by the bounded
source reads. Before claiming DMFT readiness, add an actual impurity/solver,
self-consistency and observable-owner fixture with its own acceptance boundary;
do not extrapolate C10 into a universal electronic-structure solver workflow.

The same rule applies to a new experimental-data, large-scale tensor-network or
collaborative publication workflow: describe the actual task and evidence before
claiming coverage. This is not an assertion that such work is impossible. Current
source reads and synthetic demonstrations do not establish source-parser fidelity,
model quality, human usability or scientific suitability in those settings.

[integration]: ../../agent/notes/integration.md
[prototype]: prototype/README.md
[memory]: 11-research-memory.md
[design-review]: 15-design-review.md
[reader]: ../../agent/packages/runtime/src/tools/workspace/index.ts
[locations]: ../../agent/packages/core/src/locations/index.ts
[notes]: ../../agent/packages/core/src/notes/index.ts
[paths]: ../../agent/packages/core/src/paths/index.ts
[sessions]: ../../agent/packages/runtime/src/sessions/index.ts
[context]: ../../agent/packages/runtime/src/context/index.ts
[compaction]: ../../agent/packages/runtime/src/compaction/index.ts
[cards]: ../../agent/packages/runtime/src/cards/index.ts
[review]: ../../agent/packages/runtime/src/review/index.ts
[actions]: ../../agent/packages/runtime/src/actions/index.ts
[sandbox]: ../../agent/packages/runtime/src/sandbox/index.ts
[artifacts]: ../../agent/packages/runtime/src/artifacts/index.ts
[effects]: ../../agent/packages/runtime/src/effects/index.ts
[controllers]: ../../agent/packages/runtime/src/controllers/index.ts
[documents]: ../../agent/packages/core/src/documents/index.ts
[knowledge]: ../../agent/packages/core/src/knowledge/index.ts
[works]: ../../agent/packages/core/src/works/index.ts
[checkouts]: ../../agent/packages/core/src/checkouts/index.ts
[runs]: ../../agent/packages/core/src/runs/index.ts
[methods]: ../../agent/packages/core/src/methods/index.ts
[manuscripts]: ../../agent/packages/core/src/manuscripts/index.ts
[server]: ../../agent/packages/server/src/app.ts
[ui]: ../../agent/apps/workbench/src/App.tsx
[memory-skill]: ../../aitp/plugins/aitp/skills/aitp-memory/SKILL.md
[brainstorming]: ../../aitp/plugins/aitp/skills/aitp-human-brainstorming/SKILL.md
[learning]: ../../aitp/plugins/aitp/skills/aitp-human-learning/SKILL.md
[research]: ../../aitp/plugins/aitp/skills/aitp-research/SKILL.md
[verify]: ../../aitp/plugins/aitp/skills/aitp-verify/SKILL.md
[writing]: ../../aitp/plugins/aitp/skills/aitp-writing/SKILL.md
[distill]: ../../aitp/plugins/aitp/skills/aitp-distill/SKILL.md
[p1]: 14-implementation-blueprint.md#p1
[p2]: 14-implementation-blueprint.md#p2
[p3]: 14-implementation-blueprint.md#p3
[p4]: 14-implementation-blueprint.md#p4
[p5]: 14-implementation-blueprint.md#p5
