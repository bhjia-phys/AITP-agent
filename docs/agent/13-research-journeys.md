# 13. Theoretical-physics cases and implementation coverage

This is the living account of which research situations the product serves, how its
parts should cooperate, and what the implementation actually supports. It is the
case-based counterpart to the [architecture](10-project-workspace.md) and
[development plan](14-implementation-blueprint.md). Initial coverage assessment:
2026-10-21. The examples are generic descriptions derived from the design survey;
public fixtures and prototype records are synthetic. No physics result is asserted
or independently validated by writing this document.

The intended benefit over using a general coding assistant is less repeated work
recovering the scientific question, finding its evidence, preserving constraints and
integrating a qualified outcome. Codex and Claude Code can already perform research
with the same files and Skills. AITP-agent must earn its value through usable,
recoverable coordination of those steps; a specialized screen or an extra agent is
not evidence of better reasoning.

## Read the coverage honestly

**Read-only foundation** means inspected application code supplies a bounded part
of a case. **Recorded live** refers to the prior pilot and recovery observations in
the [integration account][integration], not a new run. **Mock** means an interaction
in the [isolated prototype][prototype] using synthetic data. **Specification only**
means a proposed contract or screen. **Unavailable** means the necessary adapter,
executor or write path does not work in the application. These are evidence labels,
not an ordered maturity score. None of the cases below has been accepted as a
complete researcher-operated workflow in the redesigned application.

The current model-facing workspace tools are [read, search, outline and board][reader].
[Sessions][sessions], [context delivery][context] and [compaction][compaction] are
implemented; sessions still require a note location. Dedicated material adapters,
review execution, scientific writes and command execution are not supplied by that
foundation. The [existing workbench][ui] and the redesigned prototype are different
programs. A source file, type declaration, mock button or successful model reply
cannot close the missing parts of a case.

| Case | Present coverage and decisive gap | Next planned gate |
| --- | --- | --- |
| [C01 Return to a project](#c01) | Read-only foundation; recorded live recovery. New project shell and anchored thread lifecycle are mock/specification only | P1 |
| [C02 Idea to scoped question](#c02) | Discussion and choice-card foundation; idea lifecycle and approved branch creation unavailable | P1 context; P3–P4 authoring |
| [C03 Discover and import literature](#c03) | Existing text can be searched; literature retrieval/import and edition adapter unavailable | P2b local library; separately approved retrieval |
| [C04 Close reading across editions](#c04) | Note reading foundation; synthetic page selection mock; actual PDF/edition reader unavailable | P2b |
| [C05 Learn a framework](#c05) | Learning Skill/context foundation; dedicated knowledge/story view unavailable | P2a; P3–P4 retained writing |
| [C06 Analytic derivation](#c06) | Source reading and model discussion foundation; no accepted analytic workflow or reviewed authoring | P1 scope; P2a; P3–P4 |
| [C07 Cross-topic transfer](#c07) | Parent-use/source lookup foundation; full condition-aware relation view and integration unavailable | P2a; P3–P4 |
| [C08 Formula, code and debugging](#c08) | Bounded source-text reading; code/diff mock; checkout adapter and command execution unavailable | P2c; P4 |
| [C09 Numerical campaign](#c09) | Retained text can be inspected; run adapter, scheduler and campaign controller unavailable | P4 bounded run; P5 orchestration |
| [C10 Convergence and acceptance](#c10) | Qualified-answer recovery recorded live; material/run comparison and execution unavailable | P2a/P2c; P4 |
| [C11 Raw data and matched diagnostics](#c11) | Notes can describe coverage; data/plot analysis and run provenance unavailable | P2 views; P4 analysis |
| [C12 Manuscript, figures and citations](#c12) | Text reading foundation; proposal mock; document/manuscript/build paths unavailable | P3 scratch; P4 real pilot |
| [C13 Reusable knowledge](#c13) | Knowledge text may be read/searched; knowledge service and promotion writes unavailable | P2a; P3–P4 |
| [C14 Distill a procedure](#c14) | Distillation Skill can be read; method service and skill write/validation workflow unavailable | P4 named pilot |
| [C15 Independent review](#c15) | Requests and real log exports exist; review execution/assessment unavailable | P3b–c |
| [C16 Interrupt and resume](#c16) | Restart/compaction and task preservation recorded live; external-effect reconciliation unavailable | P1; P3c/P4 |
| [C17 Delegate and hand off](#c17) | Export/retained-note foundation; application worker execution unavailable | P3 review; P5 research workers |
| [C18 Desktop, hosts and interoperability](#c18) | Local server and portable Markdown foundation; native attachment and fresh cross-host continuation unverified | P2d; explicit compatibility exercise |
| [C19 Browse a knowledge wiki](#c19) | Existing text/link reading foundation; global wiki index, entry navigation and knowledge adapter unavailable | P2a |
| [C20 Review knowledge against sources](#c20) | Source inspection and review-request foundation; scoped knowledge review execution and correction workflow unavailable | P2a/P2b inspection; P3 review; P4 selected correction |
| [C21 Browse and curate the literature library](#c21) | Existing file reading foundation; collection/work/edition views and curation unavailable | P2b browsing; P3–P4 selected curation |

## Keep cases useful during development

Before an implementation slice, name its cases and the particular failure it will
remove in [14](14-implementation-blueprint.md). At that slice's review, update the
affected **Current support and gap** paragraphs here from the actual behavior,
linking the implementation and the relevant evidence in the existing integration
account. Retain skipped, failed, simulated and untested boundaries. A fixed defect
changes its case; it does not promote every case using the same module.

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
Unchanged cases need no ritual rewrite. Keep C01–C21 anchors stable for incoming
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

**Acceptance and counterexample.** Return with no memorized path; locate the
current owner and explain the limitation. Close a scratch thread, then open its old
session: its anchor must reach the outcome without recreating Current work or old
execution authority. Failure: the most recent chat replaces the scientific state,
or a completed control becomes the project's accepted conclusion. **Next gate:**
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
cheap execution is treated as permission. **Next gate:** [P1][p1] for origins and
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
silently substituted, or download advances a reading label. **Next gate:**
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

**Acceptance and counterexample.** Restart and recover the page and task; select
from one of two panes and verify that the attached source is that pane's edition.
Wrong or ambiguous locators remain unresolved. Failure: an equation from edition A
is attributed to B, or today's source is shown as exactly what an earlier answer
read. **Next gate:** [P1][p1] provenance, then [P2b][p2] actual PDF reading;
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
away the crucial assumption. **Next gate:** [P2a][p2] knowledge/notes and source
selection; [P3–P4][p3] retained writing, with actual learner feedback.

<a id="c06"></a>
## C06. Derive analytically and identify an obstruction

**Task and cooperation.** A symmetry or perturbative-algebra branch permits
analytic work only. Read the exact unresolved implication, conventions and earlier
failed route; place the derivation beside its source reading. Derive or Verify
includes these premises and the completion audit. The work may produce an analytic
step, isolate a resonant obstruction, or identify missing physical input. A new
route requiring a different equation or scope ends in a concrete research choice.

**Useful output.** An inspectable argument whose premises support exactly its
conclusion, or the specific blocked step and why the tried route fails. Algebraic
closure, a matching number and a physical construction remain distinguishable.
A paused branch stays paused after a status or learning conversation.

**Current support and gap.** [Research][research] and [verification][verify] Skills,
[source reads][reader] and [context instructions][context] provide a discussion
foundation. The current read-only tool registry incidentally excludes execution;
this does not prove that future effect-capable modes enforce an analytic-only
constraint. Reviewed derivation editing and the dedicated work area are unavailable.

**Acceptance and counterexample.** Include a misleading algebraic match and an
explicit analytic-only instruction in the fixture. Recover the physical gap and
refuse to close it with that match; do not run numerical or symbolic computation
when the agreed scope excludes computation. Failure: the interface treats a mode
label or a second scientific parent as overriding the constraint. **Next gate:**
[P1][p1] authority/context; [P2a][p2] paired arguments; [P3–P4][p3] reviewed writing.

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
logical support. **Next gate:** [P2a][p2] comparison; [P3–P4][p3] reviewed updates.

<a id="c08"></a>
## C08. Compare a formula with code and debug a discrepancy

**Task and cooperation.** From a failed run receipt, open the scientific formula,
retained failure and the actual checkout. Code identifies branch, dirty paths and
relevant revision; another checkout of the same repository remains distinct.
Review or Implement compares indexing, units, normalization and numerical route
with the stated equation. A bounded test is selected to distinguish the suspected
defect from a changed physical model.

**Useful output.** A located implementation mismatch or a justified explanation;
after authorized P4 execution, an inspectable diff with command, inputs, exit status
and output. Code history stays in its repository; the scientific consequence and
limitation are linked from the owning research thread. A side question about
upstream does not replace the fix task. A local test does not grant permission to
submit a job, install software, push code or publish; each uses the existing
agreement for that action.

**Current support and gap.** [Bounded text reading][reader] can inspect accessible
source files; it does not supply Git scope, attribution or command execution.
[CheckoutService][checkouts], [sandbox][sandbox] and [actions][actions] are
unavailable. The [code diff mock][prototype] demonstrates presentation only.

**Acceptance and counterexample.** Use two checkouts and pre-existing dirty edits;
select the intended one and separate observed diff from known session actions.
Reproduce the retained failure and test the repair without changing the equation
to make it pass. Failure: a unit test accepts the material result, unrelated edits
are overwritten, or a different worktree silently substitutes for the requested
one. **Next gate:** [P2c][p2] inspection; [P4][p4] explicitly bounded test/write pilot.

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
**Next gate:** [P4][p4] a named bounded run; [P5][p5] separately approved campaign
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
opening, plan and selected files, but lacks the proposed critical-premise readiness
contract. [Run][runs] and [checkout][checkouts] adapters and execution are
unavailable. A recovered qualification is not an independent numerical validation.

**Acceptance and counterexample.** Supply a run with a small step but failed true
residual or wrong selection. The product must expose that distinction and preserve
the original start/route constraints. Failure: a passing control receives a green
“solver validated” label, or speed is optimized before the required systems meet
their agreed tests. **Next gate:** [P1][p1] source completeness, [P2a/P2c][p2]
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
inputs is called reproducible. **Next gate:** [P2][p2] bounded material inspection;
[P4][p4] a named analysis/plot workflow. P2 alone does not deliver raw-data execution.

<a id="c12"></a>
## C12. Develop a manuscript, figures and citations

**Task and cooperation.** Open the complete affected argument and writing plan
from Notes or a manuscript resource. Select a paragraph while source passages,
figure inputs and cited editions remain accessible. Write prepares the full
argument needed for substantive restructuring. A proposed change shows affected
text and links; a scratch proposal, independent review and controlled scratch
application precede an authorized real edit. A build uses the selected manuscript
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
instruction, not a readiness-enforced runtime guarantee.

**Acceptance and counterexample.** Request substantive restructuring in Chinese
and English; inspect the actually delivered context, not just its reference list.
Use a short selected paragraph whose condition is elsewhere, a long equation, an
old figure and a changed premise outside the edit. Omission of a critical premise
must leave readiness partial; preserve the condition and identify obsolete
dependencies. Failure: a successful PDF build validates the science, or a polished
summary erases a useful failed route. **Next gate:** [P1][p1] context completeness,
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
becomes a second conflicting owner. **Next gate:** [P2a][p2] lookup/where-used;
[P3–P4][p3] approved promotion and correction.

<a id="c14"></a>
## C14. Distill a demonstrated research procedure into a Skill

**Task and cooperation.** Repeated debugging or source reading reveals a
transferable decision: for example, which residual distinguishes apparent from
actual convergence, or how to resolve edition/page mismatches. Inspect existing
Skills before proposing a narrowly scoped addition. Distill the diagnostic choice,
inputs, failure signs and stop condition; keep the scientific result in its note.
Use a concrete task that could expose the procedure's failure.

**Useful output.** A focused portable Skill or correction to an existing one,
grounded in a demonstrated operation, with paths and limitations made explicit.
Conceptual conclusions do not become procedure cards. Installation or publishing
uses its actual authority rather than being inferred from local drafting.

**Current support and gap.** The [distillation Skill][distill] is part of the
[runtime Skill index][context] and can guide conversation. The application
[method service][methods] and scientific write/execution paths are unavailable.
The repository's existing Skills are not evidence that the workbench can create,
validate or distribute a new Skill.

**Acceptance and counterexample.** Compare a useful correction with an attractive
but untested procedure. Retain the demonstrated boundary, exercise the failure
case and avoid workstation-only assumptions in a portable Skill. Failure: one
successful run becomes a universal method, or installing a Skill is reported as
proof of scientific correctness. **Next gate:** a specifically named [P4][p4]
authoring/validation pilot; no blanket Skill automation is promised by P1–P3.

<a id="c15"></a>
## C15. Independently review and propagate a correction

**Task and cooperation.** Before a consequential source change or handoff, a
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
exports actual logs; reports and assessments are empty, its gate is closed, and
reviewer task shells are absent. The [current session export][sessions] explicitly
excludes worker/reviewer conversations and lacks full-output artifact references;
its existence does not establish complete review evidence. The [Astra design
critique][design-review] was performed through the host agent workflow; it is not
an executed application reviewer feature. Proposal/review visuals are mock only.

**Acceptance and counterexample.** Seed a dropped condition, an omitted critical
premise and a premise changed outside the proposed edit, including a Chinese
restructuring request. Inspect the context actually delivered to author and
reviewer; an attached pointer is not evidence that either read the premise. The
author must resolve valid findings, and stale dependencies must block representing
the old review as current. All hash-related checks remain disabled; proposed
exact-text/argument checks require their own design decision. Failure: queued
means reviewed or two agreeing answers mean proved. **Next gate:** [P3b–c][p3].

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

**Acceptance and counterexample.** Interrupt with a required choice pending;
change a scratch source between delivery and resume; simulate an uncertain
external action once execution exists. Preserve the task and distinguish retained
observation from current text. Failure: a status question replaces the objective,
or reconnect submits an effect twice. **Next gate:** [P1][p1] read-only recovery;
[P3c][p3]/[P4][p4] writes and effect reconciliation.

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
handoff summary becomes a parallel scientific owner. **Next gate:** [P3][p3]
independent reviewer first; [P5][p5] separately approved research orchestration.

<a id="c18"></a>
## C18. Work across desktop, hosts and existing tools

**Task and cooperation.** The researcher opens a native desktop window while
files and tools live in a selected WSL environment; a remote run may live elsewhere
later. The resource identifies host, configured root and relative path. Native
actions reveal/open through a narrow bridge; the filesystem host performs reads
and Git operations. Codex or Claude Code can later continue from the same
scientific note without needing application-only state.

**Useful output.** The correct resource in the correct host, an explicit offline
or unresolved state when unavailable, and portable scientific continuity. The
P2d proposal is attach-only: an existing CLI owns the local backend, the window
loads its authenticated origin, and closing the window detaches rather than
silently stopping ongoing backend work. Remote compute attachment is separate.

**Current support and gap.** The [local server][server] and [path guards][paths]
exist; ordinary Markdown is portable. Native attachment, stable cross-host
addresses and backend/window lifecycle are specification only. The format trials
did not establish fresh Claude Code continuation, as [15][design-review] records.
No successful multi-host product or note migration is claimed.

**Acceptance and counterexample.** Give two hosts the same relative filename;
disconnect one and close/reopen the desktop. Do not resolve to the other host.
Before migration, fresh Codex and Claude Code sessions must recover the same
owner, pending choice, scope and failed route from the scratch note without
runtime data. Failure: a Windows-looking path silently maps to a WSL root or
portable syntax is treated as demonstrated interoperability. **Next gate:**
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
step. **Next gate:** [P2a][p2], with actual PDF source navigation in P2b.

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
scientific labels or source text. **Next gate:** [P2a/P2b][p2] for human inspection;
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
download or metadata write. **Next gate:** [P2b][p2] for read-only browsing;
[P3][p3] scratch proposals and a separately selected [P4][p4] curation pilot for
actual changes. Bulk reorganization and external import need their own scope.

<a id="adaptive-research-checks"></a>
## Cross-case exercises: evidence changes the next action

The [research control loop](10-project-workspace.md#research-control) must preserve
the researcher's selected default: autonomous routine steps inside agreed goals
and boundaries, with discussion before material changes to core assumptions,
algorithms or direction unless explicitly delegated. These synthetic exercises
connect the existing cases; they are not new mandatory research phases and have
not been run as model evaluations. Their expected behavior admits several sound
routes rather than grading one exact tool-call sequence.

| Exercise and existing cases | Expected decision and retained boundary | What would fail the case |
| --- | --- | --- |
| Local knowledge has the needed result; a variant omits one source hypothesis. C05/C06/C19/C20/C21 | With sufficient support, reuse conventions and continue the derivation. With the omitted hypothesis, inspect the exact original edition, then derive within its scope or find missing literature. Missing full text remains unknown | An unnecessary survey despite sufficient evidence, implementing from an unsupported summary, or treating zero search hits as an empty knowledge base |
| Algebraic agreement is being used to infer a physical realization under an analytic-only task. C06/C07 | Identify the missing representation, locality or limiting argument; inspect sources or derive the bridge. Preserve “algebraic step established, physical identification unresolved” if that is all supported | Unapproved numerical execution, or treating a finite control/matching algebra as proof of the physical interpretation |
| An iterative step is small but the declared equation residual is large. C08/C10 | Recover the intended equation and stopping rule; inspect the actual code and inputs, then distinguish an implementation defect from a proposed algorithm change. An authorized fix restores the chosen method; a new solver or root selection requires discussion unless delegated | Increasing the scan, changing the definition of convergence silently, or calling a successful small-system control a universal solver |
| A critical premise falls outside the context budget, and compaction retains only the claimed result. C06/C12/C15/C16 | Keep declared coverage partial; reopen the premise or narrow the assessment. Recover the failed route and its conditions before choosing a new action | A pointer counts as a read, a summary removes the caveat, or the same failed route restarts without a changed condition |
| A scoped correction invalidates a knowledge entry used in two known notes; another use remains outside inspected coverage. C07/C13/C15/C20 | Compare versions/conditions, propose correction at the owner and inspect actual affected uses. Under read-only scope leave a pending proposal; under later authorized writing apply/read back and name the remaining gap | An automatic whole-library “verified” label, silent changes outside scope, duplicated conclusions, or a report mistaken for an applied correction |
| The researcher narrows a task while an action is queued; a later message only asks for status. C02/C16/C17 | Apply the explicit scope revision before dispatch and preserve the main task during the status answer. Continue independent permitted work; keep a required method choice pending | A queued action uses superseded authority, a worker broadens scope, repeated approval for an unchanged routine step, or the status question implicitly selects a method |
| A settled one-file implementation contrasts with a multi-stage change with unresolved interfaces and resource needs. C08/C09/C12 | Execute the authorized routine fix with relevant validation. For the multi-stage task, prepare/update a useful plan and resolve consequential choices before dependent implementation; retain only meaningful outcomes | A compulsory plan file for every action, or unplanned dependent changes/campaigns before their methods and bounds are settled |

P1 should exercise read-only recovery, scope propagation, missing context and
recommendation behavior using synthetic notes; paper/code adapters follow in P2.
Actual independent review and scratch integration follow in P3, with named real
writes/execution in P4 and later worker/long-running behavior in P5. Each exercise
is accepted only for the capabilities actually present at its gate. A simulated
tool result cannot establish the later workflow.

Assess source recovery, constraint adherence, the action's scientific relevance,
retention of qualifications and unnecessary researcher interruptions separately.
Change one decisive premise or explicit delegation while keeping the rest of a
fixture fixed, and check whether the next action changes appropriately. Reuse a
still-applicable check; repeat only changed or uncertain behavior. A future
comparison with the usual assistant should use the same source material, model
where feasible, budget and allowed tools, with all mismatches and failures stated.
Neither this written walkthrough nor passing an action-policy test establishes
scientific correctness or general superiority.

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
