# Research memory: readable sources and dependable research objects

Status: proposed design, 2026-10-21. This specifies the next research-memory surface;
it does not change the installed AITP Skills, existing notes, parser or application.
The earlier format recommendation received the [independent redesign review](15-design-review.md).
The context/control refinements below are subsequent design work, not additional
validation by that review. Note migration still needs the researcher's approval
and the migration checks below. The implementation remains largely read-only.

## 1. Recommendation and its evidence boundary

Keep ordinary Markdown as the shared research record. Make the existing opening,
Current work and scientific account more dependable through a small set of readable
conventions. Add a meaningful anchor when an entry needs a lasting reference. Move
substantial detail into existing supporting-note locations when the argument calls
for it; do not split every section or require a scientific-state sidecar.

This is closest to trial F2, with selective distribution rather than F3's blanket
section splitting. F1's optional opening labels can help a particular note, but a
second editable “current answer” is not required. F4 is a possible adapter for an
already structured collection, not the default format new AITP notes must adopt.

The retained experiment compared five formats on two private notes, with thirty
reader runs and ten hypothetical-update writer runs. All processes completed. That
is execution coverage, not forty passed quality tests. Readers could recover useful
context even from the originals. A sampled structured-opening response mixed open
questions and plan packages into its live-thread list; structured data alone did
not settle the object model. Some writers removed a concluded thread's heading
without retaining its old fragment. Writers of distributed and sidecar variants
updated both files in these examples: inevitable drift was not demonstrated.

The assessment is candidate-aware, with no independent final grades, repetitions or
human usability study. It supports concrete design requirements and tradeoffs, not
a quantitative claim that one format makes an agent more scientifically capable.
The private build record owns the source notes, run outputs and detailed findings;
private content is deliberately absent from this public specification.

| Candidate | Useful property | Cost or limitation | Design disposition |
| --- | --- | --- | --- |
| F0: existing prose and Current work | Works in existing hosts; preserves the author's argument | State and continuation may require interpretation; heading removal can break references | Fully supported legacy input |
| F1: labelled opening and thread fields | Makes question, gap and continuation easy to locate | Can repeat the argument; additional open-question lists do not themselves distinguish questions from authorized threads | Optional authoring style |
| F2: clearer existing Markdown conventions | Explicit continuation and ownership with a single readable note | Still needs source-aware parsing and disciplined anchor retention; not proven cheaper to read | Default guidance for new or approved revised notes |
| F3: short map with distributed account | Short main view; detailed arguments can be opened separately | More files and cross-file obligations; many forwarding anchors give coarse rather than precise navigation | Distribute selectively for a scientific reason |
| F4: scientific-state YAML sidecar | Explicit fields and links | Two sources must be read and maintained; dates and identities need careful serialization; generic Markdown readers lose the state view | No required sidecar or automatic conversion |

## 2. Ownership: what persists where

There are three kinds of persistence. Their purpose, rather than the storage
technology, defines which one owns a fact.

| Record | Owns | Must not silently become |
| --- | --- | --- |
| Research files | Questions, arguments, assumptions, qualifications, decisions, ideas, evidence, reusable knowledge, papers and scientific reports | A transcript archive or a generated dashboard database |
| Runtime storage | Conversations, authorized tasks, actions, permissions, proposed changes, session outcomes, resource associations and UI state | The sole maintained account of an accepted scientific conclusion |
| Derived index | Parsed objects, source spans, relationships, search, outlines and previews | An independent authority that survives disagreement with the files |

A conversation can contain derivations and useful ideas. Those remain conversation
content until a relevant outcome is deliberately integrated into its research
home. A runtime completion event cannot mark a scientific claim established.
Conversely, a scientific run report may retain job identifiers, code revisions and
execution details needed for reproducibility. The distinction does not prohibit
scientifically useful operational evidence.

Each state or decision has an owning source passage. A project overview, thread
page and context bundle display that passage or a deterministic projection with
its source. They do not maintain separate editable summaries. An opening may
summarize the argument in the same record; its supporting account must agree.
A parent states a branch's implication and limitation, and links the branch that
owns its detailed continuation. This is normal scientific exposition, not a
requirement to copy the branch's full state into its parent.

Index deletion must lose only derived views. Runtime deletion can lose conversations,
layout and app-specific associations, but must not erase the researcher's maintained
scientific record. Backups of those two stores have different purposes.

Within research files, project notes own the question-specific argument; paper
readings own source-ordered interpretation with exact edition/locators; shared
knowledge owns reusable explanations and their conditions; reports own actual
observations. A provisional knowledge pointer can refer to the result's existing
owner without copying its conclusion. Skills retain demonstrated procedures and
general decision rules. A scientific concept or newly generated answer is not
automatically a Skill. Prefer the already useful home over a new prescribed tree.

Working memory is a use of runtime storage: current task agreement, the present
gap, source observations, proposed next action, unresolved dependencies and pending
integration. Its model-generated synthesis is provisional and source-linked. The
model's latent knowledge, a retrieval snippet and a compaction summary can suggest
what to inspect; none independently establishes what the researcher's files say.

## 3. Objects and relationships

The initial Project boundary is a top-level topic folder, with an explicitly chosen
home note or family README. Folder discovery supplies candidates, not an assertion
that every directory is a project. Archive stores, empty folders and trial copies
remain distinguishable. Existing family and learning-workspace structures are
supported without rewriting them into one prescribed hierarchy.

| Object | Source and meaning | Relationship rule |
| --- | --- | --- |
| Project | Durable workspace with a selected home and resources | May contain and refer to several scientific questions |
| Subproject or direction | An independent question's main note, or an authored grouping | May appear under several projects; one scientific owner remains |
| Research thread | One explicitly maintained Current work entry | Many conversations may work on it; a conversation need not create a thread |
| Pointer entry | Parent passage naming another owner | Carries the contribution and limit, not a copied next action |
| Open question | A question stated in the account or an optional question section | Does not automatically become a task, thread or permission to work |
| Idea | A speculative entry at its existing home | Can be discussed before it becomes an agreed direction |
| Decision | A source passage containing a choice and its scope | Links to rationale and affected work; missing dates remain missing |
| Argument or derivation | A passage or supporting note | Keeps assumptions, imported results, inference and remaining gap together |
| Evidence | A report, calculation, source passage, figure or data artifact | A link proves a connection; “supports” needs an authored statement of what it establishes |
| Knowledge entry | A reusable explanation in the shared collection | Referenced from projects without duplicating the entry |
| Paper, edition and file | Bibliographic work, exact version and accessible artifact | One work may have several versions and belong to several projects |
| Checkout, commit and run | Code repository and scientific execution artifacts | Activity is associated with a thread; it is not a measure of scientific progress |
| Conversation and task | Runtime session and its currently authorized objective | Origin may be any resource; a side question preserves the main task |

The canonical initial relation vocabulary is `links-to`, `contains`, `contributes-to`,
`uses`, `cites`, `implements`, `tests` and `supersedes`. A plain Markdown link creates
only `links-to`; stronger edges require an explicit source statement and retain that
passage. Ownership is the object's `owner` field, not a separately inferred edge.
Parent pointer entries resolve to `contributes-to` only where their text states the
contribution. Direction is always subject → target (the newer account `supersedes`
the older). Other prose relationships remain `links-to` until a reviewed contract
adds their semantics. “Contradicts”, “proves” and
“validates” must not be inferred from proximity or a shared tag. An agent can propose
such a relation with a reason; it becomes maintained science only through an
approved source edit. A runtime “opened from this thread” association needs no
scientific note edit and must remain visibly operational.

The interface may filter source-stated knowledge as established, derived,
hypothetical or open. If the source does not make that distinction, show its words
and leave the classification unset. Never assign a scientific confidence badge
from a model's fluency or a passing software test.

## 4. Minimal authoring convention

The opening explains the question, supported answer, decisive reasoning and gap in
connected prose. Labels such as “Question” and “Remaining gap” are optional. They
are not required YAML keys, and an unlabeled opening remains fully readable.

Current work contains only maintained continuations. A preferred list entry is:

```markdown
## Current work

- <a id="finite-size-limit"></a>**Finite-size limit** — waiting on analysis · date unrecorded.

  The retained calculations resolve the two smallest sizes, with the boundary
  assumption stated in [the comparison](notes/comparison.md). They do not
  establish the infinite-size limit.

  Next: compare the two proposed scaling forms using the retained observable.
  Stop if the data cannot distinguish them at the declared uncertainty.

  [Derivation and assumptions](notes/limit.md) · [Existing data](results/README.md)

- **Boundary construction → [boundary branch](boundary/research.md#current-work)** —
  supplies the independent boundary condition; its finite-size control does not
  establish the thermodynamic response.
```

This is an illustrative example, not a required folder template. Reuse the
workspace's existing material locations. A short heading entry is equally valid
when its continuation needs more space. Long arguments belong in the scientific
account or its linked detail, not inside dashboard fields.

An entry contains a readable name, disposition, the current frontier, a
continuation and relevant links. Dates are optional; use “date unrecorded” when
the absence itself matters. Do not manufacture dates from file modification time.
The date refers to a consequential change, not the last time an index refreshed.

Continuation clauses have different meanings:

- `Next:` states an available next research action.
- `Pending choice:` names the decision still needed and, if stated, who decides.
- `Resume when:` gives a reopening condition for paused or dormant work.
- A pointer names another owner rather than supplying a competing continuation.

These are source facts, not executable grants. If several clauses are needed,
retain them with their conditions; do not flatten them into one “Run” button.
Unclassifiable disposition text remains visible and maps to `unknown` for filters.
The phrase “waiting on a construction” alone cannot determine whether a human,
agent, missing input or unresolved argument is responsible.

Decisions can remain beside the argument they constrain. A dedicated section is
useful when several choices govern future work. Its entry can be a concise sentence
with date when known, choice, scope, decider and a rationale link. Avoid maintaining
the same full directive in Current work, a decision table and an argument map:
put its explanation in one place and use short source-linked references elsewhere.

Ideas and open questions may use optional sections or existing notes. An idea's
promotion is an explicit research decision, not a consequence of discussing it in a
conversation. A small new question need not acquire a separate file and identifier.

## 5. Identity without a metadata registry in every note

Use a resource reference composed of the configured workspace root, relative path
and an optional human-readable anchor. Runtime UUIDs are appropriate for sessions
and actions; they are not required in every scientific paragraph.

For an explicitly addressable thread, `research.md#finite-size-limit` is the
portable identity. Its visible title may change while its anchor remains.
Anchors must be unique within the file. Existing anchors are reused. Add an anchor
when a durable reference is needed, in a future authorized edit; do not batch-insert
them merely because the app can display the file.

For legacy sources without anchors, the adapter uses the note path, heading trail
or entry title, and the observed span. The span is a locator in that reading, not
a permanent identifier. Disambiguation may include occurrence within the source,
but the app must not silently attach an old conversation to a different item after
an insertion or rename. A unique exact heading/title match can resolve the current
location. Multiple matches or an absent target produce an unresolved reference,
with the former title and observed excerpt available to the user.

| Change | Required handling |
| --- | --- |
| Rename a thread with a retained explicit anchor | Keep associations and show the new title |
| Remove a concluded Current work entry | Move its anchor to the integrated outcome, or leave a concise forwarding passage |
| Move a detailed argument to another file | Retain the old fragment as a meaningful forwarding link, and repair affected relative links |
| Move a file through an approved app operation | Record an explicit old-path/new-path alias for runtime references; update ordinary authored links in the reviewed change |
| External rename with uncertain identity | Offer possible matches as unresolved candidates; never infer identity from a title alone |
| Duplicate anchor | Report ambiguity and open the source; do not choose the first occurrence silently |

A coarse anchor landing on “see the sidecar” is weaker than a link to the actual
outcome. Preserving anchor spelling is necessary but does not prove preservation
of meaning. A closed thread's scientific result remains in the argument even
when it disappears from the current-work queue. Runtime history can retain the
former thread association and link to that result.

Resolving an old session after a thread closes returns the original origin plus the
anchored outcome passage and the diagnostic `no longer in Current work`. The outcome
is not reclassified as a live thread just because a session points to it. Opening it
is read-only history; starting a new discussion creates a new task from the current
request, without inheriting the concluded task's execution authority. Acceptance
includes close thread → reopen old session → open outcome → new discussion, with no
new live Current work entry unless separately agreed.

No identity, revision, conflict or approval rule in this design depends on content
hashes. All hash-related checks remain disabled as explicitly requested. Legacy
digest fields are historical metadata. Git commit identifiers may still identify
actual Git revisions; this does not reinstate a digest-based file or approval gate.

## 6. Source-aware parsing and views

Extend the existing total parser rather than replacing the working legacy path.
The current protocol already retains complete entry text, source spans, disposition,
form, anchors, links and warnings. Its contracts are in
[research.ts](../../agent/packages/protocol/src/research.ts) and
[core contracts](../../agent/packages/core/src/contracts.ts).

The next adapter should expose the following conceptual fields; these are a design
contract, not a claim that new schemas are implemented:

```text
object: kind, owner, portable reference, title
source: path, anchor if present, observed span, verbatim text
fields: disposition, date if stated, continuation clauses
relations: target, relation kind, source passage
interpretation: explicit | legacy-extracted | unclassified
resolution: resolved | missing | ambiguous
```

Each extracted field retains the span from which it came. A normalized state is a
filter aid; the interface shows the authored disposition. If a parser recognizes
only an entry boundary, the full entry still appears and can be opened or used as
session context. Unknown structure does not make the research disappear.

Parsing order is explicit anchors and recognized structure, then compatible legacy
list/heading forms, then a raw passage with a diagnostic. Do not promote arbitrary
account headings, work-package lists or “future work” prose into live threads.
Likewise, a reference to a branch is not proof that a new local thread exists.

The UI can assemble a project view from the opening, maintained threads, authored
decisions and questions, shared resources, and runtime activity. Every scientific
display has “Open source” at the relevant passage. If a useful field is absent,
show “not stated” or the source paragraph. An optional generated orientation is
labelled as generated, cites its inputs and is not used as the canonical state or
silently written into the note.

Cache refresh uses existing file observation and explicit refresh mechanisms. A
stale index is marked and rebuilt from the authoritative files. It does not overwrite
them. Observed source text can be retained with a session for provenance; this is
not a new authoritative copy or a guarantee that the live file still says the same
thing. External-change protection remains an implementation acceptance item,
especially with the user's digest checks disabled.

## 7. Context and continuation across hosts

Codex, Claude Code and the workbench consume the same readable notes and applicable
AITP Skills. No workbench-only state file is needed to resume the scientific thread.
App runtime data enriches session history but does not replace the note's argument.

For a normal continuation, context construction reads the project home and owning
note's opening, the selected thread, applicable scope and decisions, and the links
needed for the current task. It follows a pointer to its owner. A substantial
argument revision requires the complete relevant argument and affected uses, as
the AITP writing and memory Skills already require. These are different reading
needs; not every ordinary question needs the whole project archive.

The session kind affects what context is useful:

| Origin or purpose | Additional context |
| --- | --- |
| Derive or investigate | Definitions, assumptions, previous obstruction and exact supporting argument |
| Learn or read a paper | Intended depth, exact edition/passage, learning position and unresolved prerequisites |
| Compute or implement | Code instructions, checkout state, declared observable/map, inputs and acceptance criteria |
| Verify or review | Claim, evidence, known failures and the requested independent check |
| Write | Target document, audience, surrounding argument, source and qualification links |

The visible context preview explains these inclusions in research language. Runtime
manifests and delivery identifiers belong in an optional diagnostic view. A context
bundle preserves omitted or unavailable dependencies explicitly; it must not
reconstruct an unavailable paper, source file or branch conclusion from a title.

The active task remains session state. A side question does not replace it. “Next”
in a note helps select the work but cannot answer an unresolved researcher choice
or authorize a new external action. When a conversation reaches a useful result,
propose the smallest appropriate source change and link its proposed or confirmed
outcome. No durable change means no research-note write.

<a id="context-reading"></a>
### 7.1 Discover relevant material, then read what the inference needs

The [research decision loop](10-project-workspace.md#research-control) chooses the
next action from the present gap. Context preparation serves that action rather
than filling a fixed quota with generally related text:

1. Resolve the current request and effective agreement, source owner and selected
   material. Recover live continuation, earlier useful failure and pertinent
   parent-use passage. A Global task needs no invented project note.
2. Discover candidate support through the existing note/README links, knowledge
   and literature indexes, bounded full-text search and actual source references.
   Return searched scope, exclusions and observation state. A zero-hit result
   means no match in that coverage, not that no earlier work exists.
3. Open current source passages at the required depth. For a theory or study task,
   inspect the relevant knowledge index once and read needed entries; reuse those
   reads until a new obstacle, conflict or proposed knowledge addition warrants
   another lookup. Routine coding does not repeatedly scan the knowledge library.
4. Identify the inputs necessary for the proposed inference: exact definitions,
   assumptions, conventions, source premises, pertinent counterevidence and code
   or observational facts. Substantial rewriting reads the whole affected account
   and relevant dependencies, not only the selected edit range.
5. Supply those observations, expose omissions and reassess the action. Discovering
   an unmet theorem hypothesis may change an implementation task into a source
   check before any code is written. Finding a sufficient existing derivation may
   make another literature search unnecessary.

These steps describe obligations, not mandatory separate model calls. A single
source read may satisfy several needs. The search index is a candidate finder;
read the original before relying on its scientific meaning. Optional future
semantic retrieval may improve discovery if measured missed cases justify it,
but has the same source/coverage boundary. No embedding store, exhaustive claim
graph or new document atomization is required by this design.

### 7.2 Operation-specific requirements and honest readiness

Extend the existing `ContextManifest` with requirements attached to the current
operation, not universal fields every scientific note must contain. A requirement
states why a source passage or unresolved input is needed, whether its absence
blocks that operation, and which observation supplies it. Selection can come from
the researcher, explicit source dependencies or model analysis; preserve that
provenance. A newly found premise can add a requirement. A model must not silently
drop an unmet requirement just to make the operation appear ready.

Reading and scientific checking have separate meanings:

| State | What it establishes |
| --- | --- |
| Located | A reference or search candidate was found; its substantive content may be unread |
| Delivered observation | Specific text/page/region reached the model, with source and actual covered range; truncation and extraction limits remain visible |
| Available for this inference | The current context contains the needed passage or it has been deliberately reopened; a removed passage or retained pointer is insufficient for a detail-dependent check |
| Scientifically assessed | A stated check addressed a particular claim under its conditions, with a result and limits; delivery alone never supplies this state |

These are distinctions for runtime/UI behavior, not compulsory badges on every
entry. `ready` means the **declared context requirements for this operation** have
been met. It does not mean all hidden dependencies were discovered, the model
understood them, or the physical conclusion is valid. `partial` preserves useful
work: inspect available evidence, look for the missing source, or give a bounded
answer. Do not offer source-complete review or an apply-ready substantial rewrite
while a blocking requirement remains unmet. Generated prose still needs scrutiny;
the runtime can enforce its own readiness and action state, not prove every claim.

Budget allocation protects applicable instructions and the decisive premises,
limitations and counterevidence for the current inference before optional
background. A high search rank or earlier candidate insertion does not establish
scientific priority. When the account is too large, read coherent sections with
their premises and keep source-linked intermediate understanding; reopen exact
equations and conditions before relying on them. If the required understanding
cannot be recovered within the available budget, narrow the claimed coverage or
pause that dependent operation. A summary must not erase the missing premise.

### 7.3 Changes, compaction and task choices

The effective task agreement follows the actual request and later explicit
answers. Preserve binding restrictions separately from preferences, provisional
routes and source-stated scientific assumptions. A parsed directive from an old
paper or a speculative plan cannot acquire instruction authority. Reuse the
researcher-selected autonomy default in [10](10-project-workspace.md#research-control):
routine action selection is delegated; material changes to assumptions, algorithms
or direction require discussion unless a task explicitly delegates them.

Compaction and restart preserve the task, effective agreement and its source
references, pending choices, the specific obstruction, useful failed routes,
critical unread inputs and any outcome awaiting integration. Restore execution
facts from runtime records and current science from its owners. The summary is a
recovery aid. It neither grants fresh authority nor silently overwrites a source
that now contradicts the earlier observation. A status interjection and an
unrelated tab switch preserve the active task and an unanswered required choice.

On use, reopen relevant sources and distinguish current text from historical
observations. A changed premise invalidates the dependent readiness/assessment
until reconsidered; it need not invalidate unrelated work. Failed routes retain
their assumptions and reopening conditions so compression cannot turn an excluded
ansatz back into the default next action. A new condition may justify retrying it;
the change must be stated. No hash, timestamp-as-proof or universal automatic
dependency detector is introduced.

## 8. History, edits and migration

History joins source revisions, session outcomes, commits, calculations and decisions
without equating them. A code commit is activity; an explained change in the accepted
scientific account is progress. Git may later back local note history, but no Git
restructuring, repository creation or migration is authorized by this design phase.

The eventual writing workflow previews a concrete source diff and its affected
references, obtains the authorization required for that action, applies through the
document service and re-reads the result. Substantial main-note restructuring uses
the AITP reviewer with the baseline available. This is a design for later authoring,
not a claim that the current authority/write services are complete. With digest
checks disabled, do not claim transactional protection against arbitrary external
editors; concurrency handling must be demonstrated before write acceptance.

<a id="memory-writeback"></a>
### 8.1 Integrate durable changes and corrections at their owners

At a substantive result or natural pause, decide whether the work changed retained
understanding. This is an editorial decision within the task's actual write scope:

| Outcome | Appropriate retained change |
| --- | --- |
| No durable change, or a status/read-only request | No scientific file edit; answer from the available evidence and name any pending correction |
| Useful observation or detailed derivation; main argument remains accurate | Update its existing report/supporting note; leave an already adequate main-note implication and link alone |
| Changed conclusion, assumption, useful failure or research choice | Revise the owning argument and its opening/Current work where their meaning changes; preserve the conditions and evidence |
| Changed branch contribution | Repair the affected parent-use passage; the child's next action still lives only with the child |
| Reusable source understanding or research result | Improve the existing reading/knowledge owner or a provisional pointer to the result; do not duplicate the maintained conclusion or auto-promote an unconfirmed atom |
| Demonstrated transferable procedure | Assess a focused Skill change through distillation; speculative procedures and physical conclusions remain in notes |

Before a consequential revision, read the complete affected argument, its required
support and known using passages. Prepare a source diff retaining useful failures,
assumptions and unresolved objections. Independent review and authorization follow
the existing P3/P4 policy; do not add a new permission question for each routine
edit already authorized. After application, read back the actual argument and
affected evidence links, then refresh derived views and dependent context. A saved
proposal, completion card or review report is not an applied scientific update.
When application is unavailable or outside scope, retain the pending proposal in
runtime state and report that the scientific owner is unchanged.

For contradictions, compare the actual claims, source editions, conditions and
support before deciding whether one supersedes the other. Search explicit incoming
links and relevant terminology/aliases to locate candidate uses. Inspect their
meaning and correct those actually affected within scope; name known unresolved
uses. The search has bounded coverage and cannot establish that every semantic
dependency was found. Never bulk-rewrite linked notes merely because an edge exists.
Retain a failed route's reason and reopening condition where future work will find
it, rather than accumulating a log of failed commands or deleting it for tidiness.

### 8.2 Adoption and migration

Adoption is incremental: support existing sources first; test adapters on fixtures
and scratch copies; agree on a concrete pilot note only after the design review;
review its scientific preservation and link routes; then consider broader adoption.
An approved future migration must preserve the baseline, source locators, exact
qualifications and reversible file changes. It must not erase useful failed routes
or convert speculative ideas into active directions.

Ordinary Markdown makes host interoperability plausible; the retained trials do not
demonstrate fresh Claude Code continuation. Before any approved migration, have fresh
Codex and Claude Code sessions independently recover the same owner, pending choice,
scope and failed route from the selected scratch note without application runtime
data. Assess source fidelity rather than model superiority or speed.

## 9. Acceptance examples for the implementation milestone

The next read-only milestone should demonstrate these behaviors using synthetic
fixtures plus an authorized read-only real-workspace sample:

1. One folder has several note owners; one shared resource belongs to two projects
   without duplicated scientific content.
2. The original list, heading, pointer and raw forms remain reachable. Unknown state
   is visibly unknown, while its entire disposition is preserved.
3. Three Current work entries and several account questions produce three maintained
   threads, with questions shown separately and no inferred execution authorization.
4. An anchored thread can be renamed and later integrated into an outcome while its
   old conversation reference still opens the correct passage.
5. Duplicate anchors, deleted targets and ambiguous legacy titles are explicit; the
   app does not silently bind them to a different source.
6. A moved supporting section is reachable from its old fragment and from repaired
   relative links. The target displays the same qualified argument.
7. A source change made by an external host refreshes the view; deleting the derived
   index preserves research files and reconstructs the scientific objects.
8. A hypothetical “decision to close an issue” remains distinct from an observed
   closure. A narrower learning scope leaves the omitted derivation unfinished.
9. A paused branch, a missing input and a pending researcher choice remain distinct
   in both the UI and a fresh session's proposed continuation.

Required evidence includes source-to-view comparison, working navigation, context
preview and documented failure behavior. Passing parser tests alone does not accept
scientific suitability or readability. The researcher's review must still decide the
preferred default entry presentation and pilot scope; no existing note needs a
format change to use the initial read-only project workspace.

Use the [cross-case decision exercises](13-research-journeys.md#adaptive-research-checks)
to assess context selection, retained constraints, route changes and writeback as
their implementation gates become available. They are prospective tests, not
completed evaluations or a new source of scientific authority.
