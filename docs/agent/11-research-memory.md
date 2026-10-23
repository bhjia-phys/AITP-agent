# Research memory: readable sources and dependable research objects

Status: research-memory design retained through the 2026-10-22 Harness adoption. This specifies the research-memory behavior; host adoption does not change installed AITP Skills, existing notes or the selected scientific ownership rules.
The earlier format recommendation received the [independent redesign review](15-design-review.md).
The context refinements below are subsequent design work, not additional
validation by that review. Note migration still needs the researcher's approval
and the migration checks below. The old read-only Pi implementation remains reference evidence; Harness research-memory integration is not established by its generic persistence or file tools. [14](14-implementation-blueprint.md#harness-migration) owns the current scope.

[16’s synchronization proposal](16-topic-centred-redesign.md#synchronization) defines backend connection requirements for concurrency, durable acknowledgements, partial or unknown outcomes, recovery and stale context; it does not select a storage or journal algorithm. The researcher’s latest direction relaxes the note-format constraint: the frontend now describes typed topic views, document/resource references and shared read-change intents. The researcher then limited this side to UI and interfaces for the separately developed backend. The backend owns how those views map to existing notes or other storage. Generated Markdown in the prototype is a preview, not a second editable authority. The file-based rules below describe the existing route; they do not dictate screen layout. No note migration or production writing policy is adopted here.

## 1. Recommendation and its evidence boundary

The selected runtime role is to give the model the research context that matters most: the current question, source-backed understanding, assumptions, useful failed attempts, unresolved issues and the researcher's instructions. The model chooses whether to read literature, derive, inspect code, plan or request review as the work develops. Memory preferences guide selection and emphasis; they do not become a fixed research action policy or a universal prerequisite checklist. Existing Harness tool permissions and explicit task instructions retain their actual meaning. Read/write coordination and any later authoring controls remain to be specified within their selected implementation scope.

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
| Runtime storage | Conversations, current tasks and explicit instructions, source observations, context delivery, actual tool permissions, proposed changes, session outcomes, resource associations and UI state | The sole maintained account of an accepted scientific conclusion |
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

<a id="memory-user-view"></a>
### A clear user view of memory and its editable rules

The proposed [Harness interface](12-desktop-interface.md#what-the-interface-distinguishes) presents the **topic home**, **task card** and **Sources & memory** as views of existing owners. The Research panel opens the main note and linked arguments without creating a Session. During work, the task card above the composer summarizes the actual task, researcher instructions, provisional agent items, consequential gaps and changed rules. Sources & memory is a Session dock page containing the complete attributed items, actual source-delivery/availability records, rule and method adoption, generated summaries and collapsed diagnostics. Opening its detailed view leaves only the summary in the task card. Pending integration remains a named outcome in these views, not another memory store.

Researcher words and choice answers, provisional agent working items, source observations and generated summaries retain distinct labels. Choice answers include their question and selected option; a generated summary never acquires researcher styling or authority. Located, attached but unsent, delivered, currently available, condensed out, pointer-only and missing/unavailable sources describe different facts. A later reread is a new delivery. Backend observations supply these states and declared requirement levels; the UI neither infers scientific assessment from reading nor invents missing dependencies. These projections still require implementation; the synthetic prototype supplies no runtime evidence.

Under Rules, the researcher can edit guidance for returning to a question,
reading depth, retaining useful outcomes, main/detail placement and checking affected uses.
The [editable-rule contract](10-project-workspace.md#editable-rules) preserves upstream
`aitp-memory` as the default while allowing scoped customization. Changes apply to the
selected guidance and future operations; they do not automatically restructure existing
notes, repeat an earlier write or turn an old permission into a fresh grant.

Draft, saved but not yet used, used by a particular request, and failed save remain distinguishable. A saved edit does not change an already running request. Hiding a panel or closing a tab changes no source, instruction, model context or permission. After disconnect, cached views say last observed and recover current backend state before presenting continuation as available.

The compact interface keeps the supporting argument easy to reopen during a substantial edit.
A compact current-answer view retains its decisive condition, even when the complete
derivation is behind a link. Important unread premises, conflicting instructions and
unapplied changes remain visible where they affect the next decision. A prose rule can
guide retention or parent-use repair; the UI may label either as performed only after
the corresponding operation and evidence exist.

## 3. Objects and relationships

Harness Workspaces own directory identity and Session grouping in a single sidebar list. The Research panel derives scientific topics and their homes from the containing root `research.md`, its links and supported family maps; a topic need not be another Workspace. If the researcher explicitly adds a topic directory or checkout as a Workspace, resolve the containing research root without duplicating its scientific topic. Folder discovery supplies candidates, not an assertion that every directory is a project. Archive stores, empty folders and trial copies remain distinguishable. Existing family and learning-workspace structures remain readable without a prescribed hierarchy or automatic note creation.

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
The retained Pi protocol already retains complete entry text, source spans, disposition,
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

For a normal continuation, context construction prioritizes the project home and owning
note's opening, the selected thread, relevant decisions, earlier attempts and the links
useful for the current task. It follows a pointer to its owner. A substantial
argument revision benefits from the complete relevant argument and affected uses;
the AITP writing and memory Skills guide that reading. These are different reading
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

The [research collaboration model](10-project-workspace.md#research-control) leaves
the next action to the model within the actual request. The following are context
selection considerations, which may be combined or revisited as useful:

1. Recover the current request, explicit instructions, source owner and selected
   material. Recover live continuation, earlier useful failure and pertinent
   parent-use passage. A Global task needs no invented project note.
2. Discover candidate support through the existing note/README links, knowledge
   and literature indexes, bounded full-text search and actual source references.
   Return searched scope, exclusions and observation state. A zero-hit result
   means no match in that coverage, not that no earlier work exists.
3. Open current source passages at a useful depth. For a theory or study task,
   relevant knowledge entries can supply definitions and previous reasoning; reuse
   earlier reads while they remain sufficient. A new obstacle or conflict may justify
   another lookup. There is no obligatory index scan for each task or tool call.
4. Identify the inputs necessary for the proposed inference: exact definitions,
   assumptions, conventions, source premises, pertinent counterevidence and code
   or observational facts. For substantial rewriting, prioritize the affected account
   and relevant dependencies beyond the selected edit range.
5. Supply those observations, expose omissions and reassess the action. Discovering
   an unmet theorem hypothesis may suggest a source check, a conditional derivation,
   a code inspection or a question to the researcher. Finding a sufficient derivation may
   make another literature search unnecessary.

These considerations do not prescribe a fixed sequence or automatically block an
action when a source is missing. A single source read may satisfy several needs.
The search index is a candidate finder; distinguish its excerpts from an actual
reading of the original. Optional future
semantic retrieval may improve discovery if measured missed cases justify it,
but has the same source/coverage boundary. No embedding store, exhaustive claim
graph or new document atomization is required by this design.

### 7.2 Research priorities and honest context coverage

Adapt the useful observation and delivery information in the retained `ContextManifest`
into Harness events and projections. For selected material, record its source, what
actually reached the model, why it matters to the question and any extraction or
budget limit. Selection may follow the researcher, an explicit source link or model
judgment; keep those origins distinguishable. The list helps the model notice important
context and choose a useful next action. It is not an exhaustive premise inventory or
an automatic eligibility test for research actions.

Each requested observation retains why it matters and who declared that need: an explicit researcher selection/instruction, a required dependency stated in an owning passage, a provisional model-declared need, or optional background. A bare hyperlink does not establish a required premise. The context owner surfaces unavailable material with its named dependent inference, so the UI can keep consequential omissions visible without inventing English-keyword rules or marking every source critical. The model may revise its own declared need when the inference changes; it cannot silently rewrite the researcher's instruction. Undeclared dependencies remain outside this coverage claim.

Reading and scientific checking have separate meanings:

| State | What it establishes |
| --- | --- |
| Located | A reference or search candidate was found; its substantive content may be unread |
| Attached, not sent | A passage is selected for a Session draft or queued input; it has not yet reached a model request |
| Delivered observation | Specific text/page/region reached the model, with source and actual covered range; truncation and extraction limits remain visible |
| Available for this inference | The current context contains the needed passage or it has been deliberately reopened; a removed passage or retained pointer is insufficient for a detail-dependent check |
| Condensed out | A prior delivery remains recorded, but its passage is no longer available to the model; a subsequent reread creates a new delivery |
| Pointer only | A source reference reached the model without its substantive content |
| Missing or unavailable | A requested read failed, with its reason and affected declared need; cached content remains labelled last observed |
| Scientifically assessed | A stated check addressed a particular claim under its conditions, with a result and limits; delivery alone never supplies this state |

These distinctions describe coverage, not compulsory badges or permission to proceed.
An unread or unavailable premise stays visible with its relevance. The model may look
for it, reason conditionally, inspect related code, give a bounded answer or ask the
researcher; a gap does not universally stop unrelated or exploratory work. Report a
review's actual coverage and a revision's remaining uncertainty without calling them
source-complete. Neither a complete delivery list nor generated prose establishes that
the model understood every dependency or that a physical conclusion is valid.

Budget allocation favors the current question, applicable instructions, decisive
premises, limitations, counterevidence and useful earlier attempts over generic
background. The researcher can adjust these priorities. A high search rank or earlier
candidate insertion does not establish scientific priority. For a large account,
select coherent sections and keep source-linked intermediate understanding; reopen
exact equations and conditions when the next inference needs them. If the available
budget leaves a gap, retain it and qualify the answer. A summary must not erase it.

### 7.3 Changes, compaction and task choices

The current task follows the actual request and later explicit answers. Preserve
explicit restrictions separately from configurable preferences, provisional routes
and source-stated scientific assumptions. A parsed directive from an old paper or a
speculative plan cannot acquire instruction authority. Under the selected
[collaboration model](10-project-workspace.md#research-control), the model adapts its
research actions to the question and available evidence. When a choice would change
the researcher's stated objective or a method they explicitly fixed, bring that choice
back to the researcher; ordinary route adjustments need no extra approval ritual.

Compaction and restart preserve the task, effective agreement and its source
references, pending choices, the specific obstruction, useful failed routes,
important unread inputs and any outcome awaiting integration. Restore execution
facts from runtime records and current science from its owners. The summary is a
recovery aid. It neither grants fresh authority nor silently overwrites a source
that now contradicts the earlier observation. A status interjection and an
unrelated tab switch preserve the active task and an unanswered consequential choice.

Harness keeps pre-compaction rows visible in the conversation. Their presence on screen does not mean those instructions or passages remain available in the next model request. The task card and Sources & memory use the working-item and observation projections to expose the difference; the existing generated summary remains separately labelled and inspectable.

On use, reopen relevant sources and distinguish current text from historical
observations. A changed premise makes a dependent assessment worth revisiting;
show that uncertainty without blocking unrelated work. Failed routes retain
their assumptions and reopening conditions so compression cannot turn an excluded
ansatz back into the default next action. A new condition may justify retrying it;
the change must be stated. No hash, timestamp-as-proof or universal automatic
dependency detector is introduced.

<a id="working-memory-items"></a>
#### Explicit working items and their owner

The task/working-memory service owns the recoverable operational account. User messages and choice answers enter through existing input/interaction records; preserve the actual correction and, for a choice, the question, selected label and supplied explanation. A model-facing tool can add, revise or retire the model's own explicit working items without stopping the turn or presenting a mandatory approval card. The tool records a concise current gap, outcome and limitation, failed route and reopening condition, method-use scope and unmet conditions, proposed next step, or outcome awaiting integration. These are inspectable working notes, not captured private reasoning or a new canonical scientific record.

Every item has an origin: researcher-authored text, a complete choice answer, provisional model-authored text, or an actual source observation. Retain the originating session entry or resource locator and the task/subproblem it concerns. The model tool may update its own item, reference a user correction or report a suspected conflict, but cannot replace that correction or relabel an inference as a researcher decision. Source observations remain the source/observation service's facts; working items point to them rather than copying a second observation store. A method-use judgment and later use result therefore have an explicit producer, even when no Skill UI is loaded.

The researcher can correct or retire an agent item through an explicit input operation. A correction retains the researcher's words and source event; the superseded model item remains inspectable. UI labels and controls render this lifecycle without rewriting its origin. Generated compaction summaries are recovery material alongside these items, never a replacement for them.

Rebuild the projection from existing logged messages, interaction and tool records, context snapshots and visible history. The proposed tool's accepted add/revise/retire operation and result use that same log. A replay must distinguish proposed calls, successful operations, failed calls and repeated delivery. Retiring or superseding an item removes it from the active projection while leaving its origin inspectable; it does not delete the source record. Persisted tool results and session records survive compaction even when their original content is no longer visible to the model. An interrupted or unflushed write cannot be reported as a recovered update. Prefer these existing carriers; new session events require the compatibility review described in [10](10-project-workspace.md#aitp-runtime-integration).

At request preparation, the context coordinator renders a bounded working block as a required `systemPrompt.context` contribution, separating actual instructions, provisional model items and source observations. Required delivery affects availability, not instruction authority. Keep still-effective user corrections verbatim and linked to their source; reconstruct their relevant meaning from explicit scope and later statements rather than retaining every user message forever. Include the current gap and pertinent failed routes with their conditions; retrieve older detail on demand. If the block cannot fit, expose that loss and revise the budget rather than silently truncating an instruction. Compaction's generated “Primary Request” or “Next Step” cannot supersede this source-attributed account.

Restriction lifetime and the destination for a saved standing rule remain product decisions. Fixtures can state a task lifetime without choosing a global default. This service does not install standing preferences, enable real-note writing or extract new instructions from scientific source text. [14](14-implementation-blueprint.md#independent-development) assigns implementation ownership; [C16](13-research-journeys.md#c16) and [C22](13-research-journeys.md#c22) exercise recovery and method-use attribution.

<a id="plugin-memory-coordination"></a>
### 7.4 Memory and context across research plugins

The selected [runtime integration](10-project-workspace.md#aitp-runtime-integration) gives memory an application service, with source adapters, research-context prioritization and observation records. `aitp-memory` supplies methodological guidance for recovering and maintaining an argument; the service retrieves relevant material, prepares it for model requests and records actual delivery, current availability and recovery. This support does not depend on the model remembering to invoke a Skill. Its implementation remains pending.

A read has four distinct stages: a provider locates a source; the reader observes specified content; the context coordinator includes selected content in a particular request; later compaction may remove it from the available request history. Record transitions and limits without promoting one stage into the next. Model-invoked reads use the same observation path as attachments. If an indirect tool exposes source content without sufficient locator/delivery information, report that coverage as unknown until an appropriate adapter exists. A request-independent “AI has read this file” boolean cannot represent these states.

Research, Materials and Rules global panels can inspect resources without a Session, using explicitly scoped research-root read authority. Their display and navigation state do not create model-delivery records. The same reader component can later open in a Session dock tab; only actual request delivery changes availability records. Human-marked reading state remains separate from agent delivery and from whether a derivation has been explained. The Session-independent read service and these projections remain implementation work.

On restart, reconstruct the agreement, observed coverage and pending outcome from durable runtime events, then reopen the scientific owners needed for the next step. When only Markdown transfers to another host, recover the scientific thread and explicitly report missing operational state. Read/write coordination, protocol-guided judgment and source content retain separate owners; no new canonical memory database or content-hash mechanism is required.

The [selected Harness composition](10-project-workspace.md#plugin-composition) preserves
the ownership rules above. Research-record, knowledge and literature providers expose
source content; the Skill catalog exposes procedural guidance from its configured source.
Session state retains operational facts. The derived index locates these materials.
None introduces a competing canonical memory store.

The research-record adapter recognizes existing main notes, family README maps and linked
detail, preserving raw passages when structure is unknown. It supplies the question and
frontier, argument owner, pertinent parent use and dependent passages with their sources.
The portable AITP Skills offer methods for reading and writing a coherent argument;
the adapter does not require every note to adopt an application schema. A changed branch
conclusion prompts inspection of the parent's actual using passage and relevant linked
uses. It does not require rewriting every ancestor or copying the branch's complete state.
Known uninspected uses stay visible rather than being counted as automatically repaired.

Context providers offer bounded candidates with a locator, observed content, purpose,
coverage limits and relevance to unresolved questions. A single coordinator prioritizes the
actual request, explicit selections, pertinent argument/definitions, useful Skills and
earlier attempts over generic background. A provider cannot promote source text into
an instruction or declare its own material scientifically sufficient. Current tool reads
enter the same observation model as initial attachments; a prior delivery survives as
history after compaction without being falsely labelled still model-visible.

Context changes with the next inference. For example, a code comparison may need a
normalization convention from a source paper. The model may consult the literature
provider, reason conditionally or pursue an independent part of the comparison; an
unmet hypothesis can suggest further derivation or a researcher choice.
The model selects the warranted move using these observations and applicable AITP
guidance. Runtime supplies important context and records actual observations and delivery;
existing Harness permissions continue to govern tools. Missing research context informs
the model's judgment instead of becoming a fixed action ban. No fixed
literature-to-derivation-to-code pipeline, per-tool planning card or automatic library-wide
read is required. These are research integration requirements, not capabilities already established by adopting Harness. The old Pi context uses fixed Skill sections and heuristics; its gaps remain in `current.md`. On Harness, model-visible facts use logged events and derived projections, with explicit handling of compaction and source rereads. Do not store a parallel transcript or import the old runtime store implicitly.

<a id="skill-applicability"></a>
### 7.5 Relate a Skill to the current question

The researcher's requested distinction is between using an applicable procedure and borrowing a useful part. This is a relation between a method and a particular problem, not a permanent category attached to the Skill or a new research mode. The Skill catalog supplies discovery and source access; a replaceable candidate provider retrieves candidates and packages their relevant conditions. The main model judges fit and records that provisional assessment in a [working item](#working-memory-items); the context coordinator supplies the actually adopted guidance. A retrieval score can rank candidates but cannot establish that their physics or numerical assumptions hold.

Start from the present gap: what inference, diagnostic, explanation or implementation decision is needed? Recover the relevant object, conventions, assumptions, available inputs, intended result and stated limits from the task and its owners. Look for a small candidate set through explicit user selections, topic/main-note links, domain indexes and configured Skill sources. Topic proximity and prior use improve discovery; they do not outrank a known assumption mismatch. A method from another topic can be useful. Opening a topic does not load every associated Skill, and a different task within the same topic may require different guidance. The portable [method-library guidance](../../aitp/plugins/aitp/skills/aitp-research/references/method-library.md) owns placement and ordinary linked discovery.

The applicability assessment compares the following where they matter to this inference. Unknown facts remain unknown; these are reasons for a choice, not mandatory form fields for every task.

| Question | Evidence to inspect |
| --- | --- |
| Does this method address the present gap? | The task's desired inference/output and the Skill's actual purpose; a shared subject name alone is insufficient |
| Do its assumptions and inputs fit? | Relevant symmetry, boundary conditions, approximation, normalization, numerical map, input requirements and tool availability |
| Which steps depend on which conditions? | The actual instructions and linked derivations/examples; a diagnostic may transfer while the solver or theorem application does not |
| What has been demonstrated? | Motivating use, decisive check, failed cases and untested scope; an author claim or successful tool exit is not independent validation |
| What would change by adopting it? | Remaining differences, work needed to justify adaptation and any change to a researcher-fixed method or direction |

Use progressively deeper reads: discovery descriptions first, then the candidate's purpose and conditions, then the complete instruction section and dependencies needed for adoption. A short description cannot supply the actual procedure. When instructions do not make the separable parts clear, inspect the whole Skill before extracting a step. Candidate inspection treats the text as material to assess; invocation admits applicable instructions through the selected Skill path. This distinction must be explicit in the application, not simulated by ignoring a loaded instruction.

| Task-specific use | Meaning and visible consequence |
| --- | --- |
| Use the applicable procedure | Adopt the method for the named subproblem after inspecting its requirements and limits. Follow the applicable instructions, including their own conditional steps; this does not prescribe the session's entire research route |
| Borrow specified steps | Name the operation or diagnostic retained, its necessary assumptions/dependencies, the omitted procedure and the resulting limit. A borrowed convergence diagnostic does not silently replace the agreed solver |
| Reference or comparison | Inspect the method for ideas or a contrast without claiming its procedure was executed or its validation transferred |
| Do not adopt for this inference | Identify the concrete mismatch or redundant work; preserve a useful alternative without launching it |
| Applicability unresolved | Identify the missing condition or evidence. The agent can inspect it, reason conditionally or continue independent work; no general action lock follows |

These descriptions need not be buttons that the user must select. The model can make routine choices autonomously and show a short reason when it affects the approach or claim. A researcher can select a method or adjust the intended use. Explicit invocation retains that intent; if the method conflicts with the task, expose the conflict instead of silently downgrading the request to background reading. Material changes to a reserved algorithm, assumption or direction follow the existing collaboration agreement. Partial borrowing never removes applicable user instructions, host permissions, general AITP obligations, or the checks and limits on which the borrowed step depends. If a candidate cannot be separated that way, treat adaptation as a proposed new method or use it only for comparison.

For example, in a synthetic fixture a method's stated precondition may be full SU(2) symmetry while the current task establishes only U(1). Shared topic words do not justify importing that method's symmetry reduction. A separate residual-diagnosis step may still be useful if its own requirements are met, without establishing the original method's physical conclusion. Conversely, an error-diagnosis method from an unrelated numerical project may address the present input/normalization discrepancy. These examples test the selection explanation and preserved conditions, not universal mathematical transfer.

The working-item tool records a meaningful adoption or correction using existing task and source/observation references: actual Skill source, inspected/adopted sections, concise applicability reason, relevant mismatch and dependency locators. Context delivery records what was actually supplied. An evaluation/result observation links later evidence to that particular use. Do not record every tool call as a new method-use object or put a duplicate decision ledger into the topic. Candidate, read, adopted, carried out and checked remain distinguishable; loading text establishes only a read/delivery observation. A model explanation of fit is provisional, not a researcher decision or proof that instructions were followed.

Reassess when the question, relevant assumption, source instructions or observed result changes, or when compaction removes needed detail. Restore the chosen scope and reopen required conditions; an old full-use choice must not erase a later partial-use correction. Same-named Skills retain their actual provider/source identity. If a source is deleted or its text changes, show historical use separately from the currently inspectable version; do not transfer an earlier evaluation to unread replacement instructions. Discovery failure reports searched roots and links, rather than claiming no method exists. No timestamps-as-certificates, content hashes or mandatory metadata migration are needed.

**Observed host gap.** Harness already has a [Skill registry and source interface](../../packages/skill/skill/src/index.ts). Its [filesystem discovery](../../packages/skill/skill-filesystem/src/index.ts) scans immediate children of configured roots; the top-level AITP root alone does not enumerate nested domain methods or arbitrary topic Skill folders. A bounded contribution can expose manifest-declared method roots and explicit topic links, preserving source identity. Linked reading remains a valid portable discovery path; every nested method need not become a global catalog entry. Do not recursively crawl all research files or maintain another authoritative method registry.

The [launcher](../../scripts/aitp-agent.ts) supplies the pinned AITP root as `bundled`, which has lower priority than project, custom and user roots. It isolates `DSH_HOME`, but leaves the shared `DSH_AGENTS_HOME` default unchanged. Thus a local same-named Skill can win over the pinned copy; pinning the submodule alone does not establish which body a session uses. Choosing custom-root placement would change some priorities but still leave project roots ahead. Product precedence remains undecided. For controlled trials, isolate and record all participating roots and the actual resolved sources rather than changing the user's defaults silently.

The current [Skill tool](../../packages/skill/tool-skill/src/index.ts) and [content renderer](../../packages/skill/skill/src/index.ts) load the full instruction body; the catalog prompt requires following full applicable instructions. They do not implement a separate inspect-only/partial-use path. The registry returns winning candidates; duplicate entries are discarded from that public view after a warning. Browsing all copies requires a candidate/diagnostic extension or a source provider that retains those observations. Name-based lookup is not selection of an arbitrary source. A topic link to a shadowed method must not silently invoke the winning file instead. Source-qualified resolution is additional work: match the returned source to the selected candidate, or expose the mismatch and leave that adoption unresolved.

The proposed AITP integration needs compatible inspection and invocation semantics, selected-span/dependency delivery and a matching model-facing explanation. One route is a source-qualified inspection path that treats candidate text as material while retaining `skill` for invocation; another replaces the consumer's loading guidance. The implementation must resolve the conflict with today's full-instruction catalog text explicitly. Keep full invocation working, preserve general instructions and test the distinction at the actual request boundary. The portable methodological rule belongs in an independently reviewed change to [method-library guidance](../../aitp/plugins/aitp/skills/aitp-research/references/method-library.md); this app document does not imply that the upstream Skill or Codex baseline already includes it.

The filesystem provider has no loaded-body revision protocol. A proposed availability adapter should inspect retained Skill tool results on the current session surface; a catalog republished after compaction does not restore those bodies. Compare the current instruction text returned for the same source with the recorded text when reread, without hashes; changed or unavailable content invalidates claims of current availability while preserving historical use. The active method-use item can request a reread and reconsideration. Do not announce a file unchanged when it was not checked, or treat a new body as covered by an old evaluation. [C22](13-research-journeys.md#c22) owns the behavioral counterexamples; [14](14-implementation-blueprint.md#independent-development) owns implementation scope.

<a id="skill-distillation-loop"></a>
### 7.6 Feed demonstrated use back into methods

The portable [aitp-distill](../../aitp/plugins/aitp/skills/aitp-distill/SKILL.md) owns when a demonstrated procedure merits distillation, how to retain its conditions, and when to revise or decline a generalization. The application supplies sources, execution and reviewable outcomes for that method. It must support no change, a narrow draft, failed transfer and an untested candidate as useful endings; it does not run a mandatory optimization loop.

The Skill-use and proposal owners initially provide this workflow together. A proposal links the actual method-use item, motivating source/result evidence, selected existing Skill and draft change. Source-reading and delivery observations show which instructions and evidence the author or evaluator actually received. The working-memory service retains pending/no-change outcomes across restart. Actual scientific findings stay in their note owners; the proposal does not create an additional scientific summary or copy private research into a shared Skill.

The first proposal demonstration may finish with **transfer untested**. A later evaluation increment needs a concrete delivery route: supply the unapplied draft as clearly identified candidate instructions, with only its declared resources, to a bounded execution session or subagent on a changed synthetic/scratch instance. This is candidate evaluation, not installation or a silent replacement of the active Skill. Independent review or the researcher examines the output against the stated claim, conditions and counterexample; another model's agreement alone does not establish scientific transfer. Record the actual supplied draft, fixture, outcome and coverage, including failures and unavailable prerequisites. Model, tool or resource mismatches can make a proposed comparison inconclusive.

The same proposal can be revised, narrowed or declined on that evidence. Drafting, evaluation, authorized local application, installation and publication remain separate outcomes; none follows automatically from the preceding one. With application writes unavailable, preserve a reviewable draft and an honest pending outcome without claiming that a Skill file changed. Later use can link new evidence back to that owner. [C14](13-research-journeys.md#c14) owns the scenario, [the comparison design](13-research-journeys.md#comparative-evaluation) owns cross-host test limits, and [12](12-desktop-interface.md) owns the interaction.

## 8. History, edits and migration

History joins source revisions, session outcomes, commits, calculations and decisions
without equating them. A code commit is activity; an explained change in the accepted
scientific account is progress. Git may later back local note history, but no Git
restructuring, repository creation or migration is authorized by this design phase.

The eventual writing workflow should expose a concrete source diff and affected
references, preserve the baseline and make the actual application outcome inspectable.
Independent review is useful for substantial restructuring and can be requested or
selected for the task. The read/write policy and application mechanism remain to be
specified; this memory design neither enables writes nor imposes one mandatory review
sequence on every edit. With digest
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
assumptions and unresolved objections. Use independent review when requested or useful
for the scope, and respect the actual write authorization and available tools; do not
add a new permission question for each routine edit already authorized. The planned
authoring implementation does not itself grant write access. After application, read back the actual argument and
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
to assess context selection, retained instructions, route changes and writeback as
their relevant capabilities become available. They are prospective tests, not
completed evaluations or a new source of scientific authority.
