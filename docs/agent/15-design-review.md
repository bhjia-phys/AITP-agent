# 15. Independent design critique and revision

This records the review of the initial redesign package, before the subsequent
living architecture/progress/case expansion. It supports the retained decisions;
it is not a new Astra review of every later document addition. Current status belongs
to [14](14-implementation-blueprint.md), and current architecture to [10](10-project-workspace.md).

The researcher subsequently selected Harness on 2026-10-22. This retained review supports its scientific-record and interface reasoning; it did not review the Harness migration, GPT adaptation or any new research plugin. Pi execution and attach-only desktop recommendations below describe the reviewed design at that time and are superseded by 10 where host implementation differs. No new independent-review result is claimed here.

2026-10-21. GPT-6 Astra at xhigh reviewed the redesign in a fresh context, read-only,
against the original researcher request, the new specifications, implementation
seams and private format evidence. This is a new product-design review, separate
from the earlier R1–R3 contract reviews. The author makes the revisions; Astra does
not edit the design or application. Astra inspected the revised contracts, prototype
source and final screenshots, including the compact split, selection draft and Global
session. Its verdict: **ready for researcher design review and a narrowly scoped P1
implementation decision, with no remaining architecture blocker requiring redesign**.
This verdict does not grant researcher or production acceptance.

The private design record retains the review brief and source-specific evidence.
Public examples and prototype screenshots are synthetic. No user usability trial,
production implementation acceptance or scientific validation is implied.

## Critique and author disposition

The identifiers below index the actual review findings for this disposition; they
are not another runtime issue tracker.

| Finding | Consequence | Revision and present evidence |
| --- | --- | --- |
| R1 Source state hidden by the prototype | Project showed question/counts; thread sometimes showed only Next, dropping frontier and qualifications | Complete qualified opening and thread passages are visible in the final project and thread/session screenshots; production projection remains a P1 test |
| R2 Global resource work inherited the last project | Browsing a paper could accidentally imply unrelated project/task context | Explicit Global origin, deliberate optional project selection and focused-origin header are demonstrated; specification distinguishes context home, origin and display filter |
| R3 Existing Markdown renderer cannot supply new anchor semantics | `skipHtml` drops explicit anchors, cross-file navigation can lose fragments, global DOM lookup collides across panes | P1 explicitly changes the navigation boundary: safe anchor recognition, locator-carrying opening and pane-local IDs; future tests cover same note twice and cross-note anchors |
| R4 Authority inheritance was underspecified | Scientific parent graph, project navigation and task authority could be conflated | Explicit note/global `ContextHome`, server-resolved instructions, separate task/selection/filter, conflicts reported before affected actions; global instructions no longer depend conceptually on a fake location |
| R5 Exact answer citations were deferred too far | Current files could be mistaken for the passage actually read | P1 citation contract reuses retained delivered entries/excerpts; historical observation opens separately from current source; P3 adds authoring baselines later |
| R6 Critical context could be omitted without changing readiness | A recipe listing required refs did not prove the model read them | Ready/partial context status and missing critical inputs; no source-complete verification or authoring readiness from pointers alone |
| R7 Review bound only to the edited text was insufficient | A premise outside the edit could change while an old review still appeared valid | Proposed non-hash policy compares declared reviewed argument/premise observations; changed/missing dependency makes review stale; preserves external-race and unknown-dependency limits |
| R8 Identity and relation vocabularies could diverge | Duplicate references, conflicting edge names and cross-host path collisions | 11 owns relation vocabulary; host/root file address extends existing ResourceRef; one locator model; explicit legacy mapping |
| R9 Closed thread identity lacked an outcome lifecycle | Reopening an old conversation could recreate current work or restore old authority | Retained anchor resolves to outcome with “no longer in Current work”; opening history grants nothing |
| R10 P2/P3 were too broad for meaningful stop points | One approval could become a large uncontrolled implementation wave | P2a–d and P3a–c each end in an inspectable child gate and explicit researcher continuation |
| R11 Desktop startup/attachment ownership was missing | A thin wrapper did not explain first launch, authentication or closing behaviour | P2d attach-only decision: existing CLI owns WSL backend; native window loads authenticated backend origin; closing detaches; managed launcher remains a separate decision |
| R12 Visual spec and prototype diverged | Palette, small source/state text and default inspector weakened readability | Spec now matches linen/forest, 12 px minimum meaningful captions and closed inspector; screenshot review caught and corrected a blank compact layout; final panes and modal footer are visibly accessible |
| R13 Resource metadata screens did not exercise research reading | An unavailable-PDF box and absent mathematical body could disguise the note-reader/chat problem | Synthetic equation-bearing note and static paper pages now demonstrate edition/page passage selection, context chip and proposed-outcome route; real PDF/math-adapter acceptance remains future work |
| R14 Selection could acquire another pane's origin | A note selection and a paper action could pair real text with the wrong source | Named passages are pane-scoped; free-text endpoints, resource identity and editor membership are checked. Browser checks reject cross-editor provenance and accept the matching paper selection |

Architecture findings R3–R11 are addressed in the specification, not implemented or
passed by the application. Prototype findings require actual mock interaction and
visual evidence; labelling them simulated is necessary but does not replace the
interaction.

The final prototype browser run passed 11 workflow groups with zero page/network
errors and 13 local GET requests, with no external or non-GET requests. It checked
qualified passages, origin ownership, named/native-text selection, rejected
cross-editor selection, proposal preview, navigation, themes and visible compact
editor content. These are implementer-run checks. Astra independently inspected
source and screenshots; it did not rerun the browser suite. Both JavaScript files
also pass `node --check`. No application regression suite was rerun for these
design-only changes.

Review the [project](prototype/screenshots/01-project-light.png),
[selection draft](prototype/screenshots/10-paper-selection-draft.png),
[Global session](prototype/screenshots/11-paper-global-session.png) and
[compact split](prototype/screenshots/09-split-1024.png), or follow the
[prototype walkthrough](prototype/README.md). All are synthetic.

## Retained choices and limits

Astra's final architectural judgment supported readable single-owner Markdown,
shared resource/session editors and the existing Pi seam. It did not find a reason to
mandate scientific-state sidecars, a universal graph UI or a Pi rewrite. The author
keeps those choices with the qualified trial assessment; no format superiority or
inevitable sidecar drift is claimed.

The proposed exact-text and explicit-argument authoring policy is still a decision
for the researcher, particularly because all hash-related checks remain disabled.
Astra's critique improves the proposal; it does not grant execution permission.
Native Windows–WSL behaviour, accessibility measurement, full reader integration and
real human workflow use remain future acceptance evidence. The implementation
blueprint now gives those claims an explicit gate rather than treating the design
document as a completed product.

Two further visual requirements remain explicit: sessions with identical task titles
need source subtitles, and realistic long equations/titles and 200% zoom need an
actual layout check. The session draft should progressively disclose optional
settings so ordinary passage discussion stays short. The synthetic residual illustrates mathematical reading but
does not establish those cases. Viewport checks must measure visible editor content
and controls as well as page overflow; a blank or clipped pane can pass a simple
overflow assertion.

Host compatibility also remains a migration gate. Sol/DeepSeek format trials did not
demonstrate a fresh Claude Code continuation. Before an approved note migration,
fresh Codex and Claude Code sessions must recover the same owner, pending choice,
scope and failed route from the selected scratch note without application runtime
data. Ordinary Markdown is the architectural basis for this requirement, not proof
that the cross-host test has passed.

## Approval boundary

P0 produces a design package for inspection. The researcher still judges the format,
interaction and first implementation scope. P1 does not begin automatically after a
reviewer returns. Every later milestone and meaningful child slice follows the same
researcher continuation boundary in [14](14-implementation-blueprint.md).
