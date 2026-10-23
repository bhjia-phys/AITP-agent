# 12. Desktop interface specification

This document owns the AITP-agent interface: its frame, navigation, views, interaction states, scenario walkthroughs and the user-interface handoff to implementation. It specifies intended behavior. [10](10-project-workspace.md) owns component responsibilities and data ownership, [11](11-research-memory.md) owns memory and context semantics, [13](13-research-journeys.md) owns case suitability and [14](14-implementation-blueprint.md) owns scope, sequence and progress.

**Design handoff:** Claude completed this UI design and its synthetic prototype. Codex owns incremental client and backend implementation and integration tests under [14's development crosswalk](14-implementation-blueprint.md#development-crosswalk). No research view is implemented or accepted merely by this handoff.

**Revision 2026-10-22.** The interface is rebound to the selected DeepSeek Harness Web/Electron client. The earlier standalone shell (activity rail, explorer, editor groups, inspector, activity panel and status bar) is superseded: Harness already supplies the left sidebar, the main column, the per-Session right dock, the conversation, approvals, questions, compaction markers and permission controls, and AITP contributes research views to those places instead of replacing them. The scientific requirements of the earlier design are kept.

Evidence labels used below:

| Label | Meaning |
| --- | --- |
| **Existing Harness** | Inspected Harness client behavior or extension point in `packages/client/`; usable now, but not research-aware |
| **Proposed AITP** | Interface behavior specified here; not implemented in the application |
| **Synthetic demonstration** | Shown in a static prototype with invented data; establishes neither backend support nor usability |
| **Application with fixture** | Real Harness components and asynchronous interfaces using labelled synthetic data; no real-source or model-context acceptance |
| **Functioning AITP feature** | Working application behavior with its data-provider scope and recorded evidence in [14](14-implementation-blueprint.md) |

Two earlier isolated prototypes remain available. The [Harness-frame prototype](prototype/harness-frame/README.md) demonstrates this revision with seven deep-linkable walkthroughs and a browser check. The [earlier prototype](prototype/README.md) demonstrates the superseded shell and its selection-provenance checks; its interactions remain useful evidence for reader behavior, not for the frame.

The [topic-centred redesign](16-topic-centred-redesign.md#navigation) prioritizes project overview → topic → subtopic → material. The [formal research client](../../packages/client/ui-aitp-research/README.md) implements that navigation with child-owned cards and Overview / Work & choices / Claims & routes / Materials / Activity tabs. Its adapter supplies hierarchy and material identity independently of note layout. The generic host `sidebar.context` slot supports the topic tree in the existing sidebar footprint; switching to Conversations restores the host browser. UI-1's note reader and Session views remain reusable. The [standalone prototype](prototype/topic-workspace/README.md) remains a design reference; application evidence is separate and owned by [14](14-implementation-blueprint.md#topic-redesign-review).

<a id="ui-1-implementation-status"></a>
### Client and backend boundary

The client reads through framework resources and a workspace-bound asynchronous provider. Scope and answer edits prepare a serializable preview, then show the provider's acknowledgement, conflict or unknown outcome. An open draft retains its original revision; a later source update requires explicit re-preparation. The opt-in fixture stores only in-memory demonstration state and identifies it throughout the UI. Backend storage, source mapping, durable recovery and actual model-context delivery are separate responsibilities; opening a resource or a Session does not establish that the model received the material. The [connection reference](../../packages/client/ui-aitp-research/README.md#backend-connection) owns the implemented interface, including the relationship to the older UI-1 note protocols.

## Design commitments

- **The question comes first; conversation is optional.** Topics, papers, knowledge, code and methods can be found and read without creating a Session or attaching anything to a model.
- **Every scientific display is a view of an owner.** The topic home, thread rows and context views show source passages with locators. They keep no second editable summary; edits go to the owning note through the selected writing flow.
- **Provenance is visible by kind.** Researcher words, provisional agent working items, source observations and generated summaries look and read differently, by label and icon as well as colour.
- **The compact surface keeps what changes the next decision**: the task, applicable researcher instructions, conditions attached to a displayed conclusion, consequential gaps, a pending choice and unapplied outcomes. Operational detail is one deliberate expansion away.
- **No ceremony.** There is no mode selection, no fixed research sequence and no approval dialog for ordinary authorized work or a preference edit. A source gap informs the next step; it never locks unrelated work.
- **Honest states.** Unknown coverage, missing files, disconnected backends, unsaved drafts and unimplemented capabilities are shown as such, never as empty results or success.

<a id="layout-and-navigation"></a>
## Application frame on Harness

The frame is the existing Harness three-column frame ([ui-layout](../../packages/client/ui-layout/README.md)):

```text
┌ Harness left sidebar ┬ main column ─────────────────────────────┬ right dock (per Session) ┐
│ aitp-agent       «   │ AITP global panel  (Research | Materials │ ≤ 2 panes of tabs:        │
│ + New session        │   | Rules), selected from the panel list │  note · paper · code ·    │
│ ◎ Research       1   │                                          │  knowledge · Skill ·      │
│ ▤ Materials          │        — or —                            │  Rule↔code comparison ·   │
│ ✎ Rules              │                                          │  Sources & memory ·       │
│ ⧉ Plugins            │ Harness conversation of the selected     │  Distillation             │
│ WORKSPACES           │   Session, with AITP header actions,     │                          │
│ ▾ research-workspace │   transcript rows and the task card      │ (absent while a global   │
│   • Root selection…  │   above the composer                     │  panel fills the main    │
│   Third-system…  2h  │                                          │  column)                 │
│ ⚙ Settings           │                                          │                          │
└──────────────────────┴──────────────────────────────────────────┴──────────────────────────┘
```

| Region | Owner | AITP contribution (proposed) | Harness extension point (existing) |
| --- | --- | --- | --- |
| Left sidebar | Harness [ui-sidebar](../../packages/client/ui-sidebar/README.md), [ui-workspace](../../packages/client/ui-workspace/README.md) | Three panel entries; a Session-row hover card with topic, thread, task and gaps | `sidebar.panellist` list; `sidebar.session.row.hover` list |
| Main column, no Session | Harness layout | Research, Materials and Rules global panels, each with its own navigator, one or two reading regions and back/forward history | root-scoped `main` keyed slot and `ctx.layout.selectPanel(id)` |
| Main column, Session | Harness [ui-conversation](../../packages/client/ui-conversation/README.md), [ui-chat](../../packages/client/ui-chat/README.md), [ui-tool](../../packages/client/ui-tool/README.md) | Origin chip and Sources & memory action; task card; rows for AITP tools | `conversation.session.header.actions` list; `conversation.input.dock` list; `tool.call.toolview` keyed by tool name |
| Right dock | Harness [ui-sidebar-right](../../packages/client/ui-sidebar-right/README.md) | Resource tab types and session pages | `ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab`; `ctx.sidebarRight.openResource/openTab` |
| Resource data | Harness [resources](../../packages/client/resources/README.md) | AITP resource protocols for notes, papers, knowledge entries, Skills and checkouts | `ResourceProtocolMap` + `useResource` (available in every slot scope) |
| Session state | Harness [ui-session](../../packages/client/ui-session/README.md) | Task, working-memory and context-coverage views | `useProjection(name)` over Session projections |
| Questions, approvals, plan, goal, permissions, model, compaction marker | Harness | Existing controls remain available; Goal and plan composition is an open decision, and the synthetic UI-1 demonstration omits them | [ui-user-questions](../../packages/client/ui-user-questions/README.md), [ui-approval](../../packages/client/ui-approval/README.md), [ui-plan](../../packages/client/ui-plan/README.md), [ui-goal](../../packages/client/ui-goal/README.md), [ui-permission-presets](../../packages/client/ui-permission-presets/README.md), ui-chat compaction item |

**Why this frame.** It reuses Harness navigation, Session grouping, conversation, dock, previews and host integration rather than building a second shell. The design makes these tradeoffs; product acceptance remains pending:

- The right dock has no surface without a Session and allows at most two panes. Session-free reading therefore happens inside the AITP global panels, which own a navigator and one or two reading regions. Each resource type has one reader component, rendered both in a panel region and as a dock tab.
- The dock has no content back/forward. AITP panels keep their own navigation history (resource, region, locator, scroll); dock tabs rely on Harness tab focus.
- Three-way comparison beside a conversation uses a **comparison tab**: one dock tab showing two resources side by side (for example a note equation and a code range). The conversation stays visible.
- Global panels and the conversation alternate in the main column. Moving from a panel to a Session calls `ctx.uiWorkspace.openSession(target)` and, after the Session is mounted, `ctx.sidebarRight.openResource(...)`; dock commands fail while no Session is on screen.

### Workspaces, topics and Sessions: one project list

Harness Workspaces (canonical directories) remain the only project list. A workspace-bound provider supplies the research project and topic hierarchy; topics do not create additional Harness Workspaces. The formal frontend follows provider-supplied identities and parent/child relationships without requiring a `research.md` format. The earlier note projection remains a compatibility route: a backend may derive topics from a root note and its links. Resolving independently added topic directories to a containing research project belongs to that backend mapping and is not implemented by the fixture.

Sessions remain grouped by Workspace in the Harness sidebar. A Session's AITP origin (topic and thread, paper passage, knowledge entry, code range or Global) is shown in three places: the row hover card, the origin chip in the Session header, and the topic home's **Sessions on this topic** list. Harness rows are not restyled. A row subtitle would need a new Harness seat and is deferred.

### Widths, focus and keyboard

Harness owns widths. The sidebar spans 264–420 px (rail 56 px) and collapses when the dock opens or below 1024 px. The dock opens at 45 % of the viewport and is capped at 70 %, protecting a 400 px centre; below 768 px it opens fullscreen. AITP panels use a 236 px navigator and fluid reading regions. A second reading region appears only when both keep at least 360 px; otherwise the navigator hides first, then the comparison becomes a single region with a switch. Wide equations, tables and code scroll inside their own block.

AITP commands register through the Harness [shortcut service](../../packages/client/shortcuts/README.md) and follow its platform defaults and modal rules. Harness bindings keep priority; for example Mod+K searches Sessions, Mod+B toggles the sidebar and Mod+Backslash belongs to Harness.

| AITP command | Default request (subject to the shortcut service's Web policy) |
| --- | --- |
| Open Research / Materials / Rules panel | Mod+Alt+1 / 2 / 3 |
| Focus the current panel's search | Mod+Alt+F (browser find stays on Mod+F) |
| Open the focused resource beside the Session | Shift+Enter while a resource list has focus |
| Back / forward in a panel | Mod+Alt+Left / Mod+Alt+Right (plain Alt+Left is browser history on Web) |
| Attach the current selection to a Session draft | Mod+Alt+A |
| Toggle Sources & memory for the current Session | Mod+Alt+M |

<a id="provenance-and-states"></a>
## What the interface distinguishes

The same vocabulary appears in every view; its copy is locale-owned.

| Kind | Visual treatment | Wording | Examples |
| --- | --- | --- | --- |
| Researcher-authored | Solid accent left rule, filled dot | “You · task”, “You · instruction”, “You · choice” with the question and option | Task statement, later correction, choice answer, saved rule text |
| Provisional agent working item | Dashed violet rule, sparkle | “Agent · provisional” plus kind (gap, next step, failed route, method use) | Current gap, suggested next step, borrowed-step reason |
| Source observation | Grey rule, document icon, locator | “Source · research.md L19–22”, “Skill text” | Note passage, failed route recorded in a note, Skill instruction |
| Generated summary | Dotted rule, tinted background | “Generated · not authoritative” | Harness compaction summary, optional generated orientation |
| Gap | Amber rule | “Gap · ⟨requirement level⟩” plus effect | Missing linked note, budget-omitted premise |

The kinds and their lifecycle are defined by [11's working items](11-research-memory.md#working-memory-items); the interface only renders them. A researcher can mark an agent item wrong or retire it. Marking it wrong records the researcher's words as a new instruction; the agent item stays visible as superseded. Agent items are never shown with researcher styling.

**Source and context states.** These follow [11 §7.2](11-research-memory.md#72-research-priorities-and-honest-context-coverage) and never collapse into one “read” flag:

| State | Wording | Meaning |
| --- | --- | --- |
| Located | “Found, not read” | A reference or search hit; content not delivered |
| Attached | “Attached, not sent” | Explicitly selected for a Session draft or queued input |
| Delivered | “Sent at turn N” | That excerpt or range reached a model request |
| Available | “In context now” | Still in the current model context |
| No longer available | “Condensed since”, optionally “· re-read at turn M” | Removed by compaction; re-read is a new delivery |
| Missing / unavailable | “Missing — file not found”, “Unavailable — host disconnected” | Attempted and failed, with reason |
| Pointer only | “Link only, not read” | A reference was passed without its content |
| Scientifically assessed | Shown only on a stated check | Never inferred from any state above |

**Requirement levels.** These come from backend data, not from UI heuristics: “Required by you” (researcher selection), “Required by the note” (declared link from the owning passage), “Agent says needed” (model-declared, provisional) and “Optional background”. A **critical omission** is an omitted or missing item at one of the first three levels. The interface states that undeclared dependencies cannot be detected.

**Reading states for people and models** are separate facts: “You: marked read” is set only by the researcher; “Agent: delivered excerpt” comes from delivery records; “Derivation: explained / not expanded” comes from the reading note.

**Guidance states**: Draft · Saved, not yet used by this task · Used by the request at turn N · Couldn't save. **Outcome states**: No durable change · Pending integration · Proposed change · Applied change · Decision recorded · Run receipt · Unresolved question. “Done” on a task never means “accepted” on the science.

<a id="progressive-disclosure"></a>
### Show what changes the current decision

| Depth | Where | Content |
| --- | --- | --- |
| Current work surface | Topic home header sections; Session task card; one-line transcript rows | Question and qualified answer, active task, researcher instructions count, provisional notes count, consequential gaps, pending choice, unapplied outcome, the method relationship in one line |
| On demand | Sources & memory page; resource tabs; Skill and distillation pages; rule “Why this rule?” | Verbatim instructions and their turns, rules in effect with adoption, agent notes, every source with state and requirement level, summaries, selected Skill portions with dependencies |
| Diagnostics | Collapsed section at the end of Sources & memory; Harness Trajectory view | Event identifiers, token accounting, transport and checkpoint details |

Empty regions are absent rather than shown empty. Routine reads group into one row (“Read 3 passages”) that expands to exact sources. A decisive caveat stays beside its conclusion; a critical omission is never mixed into optional background. Presentation follows explicit task and source states, not a model choosing which inconvenient facts to hide. Hiding a panel changes no storage, source text, model context or permission.

## Research panel and topic home

**Entry.** Research in the sidebar panel list. Opening it sends no prompt and creates no Session.

**Navigator.** Root note; topics from the root note's links with kind (topic, family map, learning story) and authored disposition; an Unmapped group of note candidates not linked from the root. A family map shows its own description and children, never an invented common answer.

**Topic home** (Proposed AITP; [synthetic demonstration](prototype/harness-frame/screenshots/s1-1.png)), in this order:

1. Breadcrumb, title, note path, observation time and the label “Assembled from the note · edit the note to change it”.
2. **Question**, **Current answer, as written** and **Decisive gap**: verbatim passages with locators and Open in note. A character limit never truncates a conditional answer into an unqualified headline; long passages expand in place. If the parser cannot identify these parts, the complete source opening is shown with the label “Source opening”.
3. **Needs your input**: pending choices written in the note, plus Harness Sessions on this topic with a pending interaction. Each item has the choice, who decides when stated, its source, and Answer in session / Open passage. The section is absent when nothing waits.
4. **Current work**: one row per maintained entry with its authored disposition, its Next / Pending choice / Resume when clause, and Continue or New session. “No recorded next step” is meaningful and is not filled in by the agent.
5. **Failed routes kept in the note** and **Branches** (the parent's using passage: contribution and limit, linking to the branch owner).
6. **Relevant materials**: papers, knowledge, code and methods linked from the note, each with why it is linked. A linked method is a candidate, not an adopted method. Only groups with entries appear.
7. **Sessions on this topic**: Harness Sessions whose origin is this topic, with task and state.

The page never shows generated orientation by default. An optional generated orientation must be labelled generated, cite its inputs and never replace these passages.

**Note reader** (panel region or dock tab): Markdown with display and inline mathematics, an outline, source-aware links, copy-as-LaTeX and pane-local anchors. Recognized safe anchors map to region-local targets, `openResource(ref, locator, region)` keeps cross-file fragments, and two views of one note never scroll each other ([10 P1 contract](10-project-workspace.md#p1-contract-decisions-origins-authority-and-citations)). Selecting a passage offers **Work on this passage**. This opens a Session draft carrying origin, locator and excerpt, never another region's selection.

**States.**
- No root note: an explanation and Choose another workspace; no invented topics ([s7.1](prototype/harness-frame/screenshots/s7-1.png)).
- Backend unreachable: last observed passages with time, Session states “unknown”, nothing re-synthesized ([s1.4](prototype/harness-frame/screenshots/s1-4.png)).
- Moved note: the original reference and an explicit repair action, never a title guess.
- Duplicate anchor: a diagnostic, and the source opened without selecting an occurrence.

## Work sessions

The conversation is the Harness Session view. AITP adds only what makes the research task legible.

**Header actions** (`conversation.session.header.actions`):
- an origin chip (“Topic · Self-consistent spectra › Third-system comparison”, “Global · Paper A ed. 2 · p. 112”), which opens the origin;
- **Sources & memory**, which opens the session page in the dock.

The single `lineage` seat stays with Harness subagent breadcrumbs.

**Task card** (`conversation.input.dock`, placed before whichever Todo, Goal and Queue contributions are enabled). It renders the active projection of [working items](11-research-memory.md#working-memory-items) and never edits it except through the researcher's own actions. Collapsed, it shows:
- the task statement as written;
- counts “From you · n” and “Agent notes · provisional · n”;
- the most consequential gap with its requirement level;
- rules changed since the last request and whether they were used;
- “n generated summaries”.

Expanded, it lists researcher items verbatim with their turns, agent items with Mark wrong, and gaps with their effect (“not needed for the current comparison · the session continues”). When Sources & memory is open in the dock, the card shows only its summary line, so detail appears in one place.

**Transcript contributions** (`tool.call.toolview`) for AITP tools:
- grouped reads with exact sources;
- “Working note added · provisional — …”;
- “Method use · borrowing step 3 of ⟨Skill⟩; keeping your ⟨fixed method⟩” with a why link;
- “Outcomes · Pending integration … · Possible method correction → open distillation”.

Each row derives from the logged tool call and result.

**Compaction.** Harness already renders a “Context compacted” marker with an expandable summary, and keeps the rows above it visible. The design keeps that marker. Because visible rows are no longer what the model sees, the task card and Sources & memory state which instructions and sources survived. A locale refinement (“Messages above stay visible here but are no longer in the agent's context”) is a proposed Harness copy change.

**Citations** in answers open the excerpt as delivered (“As used in this answer”); Open current source is a separate action. If the delivered excerpt is unavailable, the citation says so and offers the current source without claiming identity.

**Composer.**
- Attachments use the attachment states above.
- The Harness permission and model controls are unchanged; the interface never presents a research preference as a tool restriction.
- A chip states that a message continues the current task. A side question is an interjection (Harness steer while busy); a new task is a deliberate action.
- Queued input that predates a later restriction is shown as queued with that restriction attached, not silently dispatched under the older scope.

**Agent questions** use Harness [ui-user-questions](../../packages/client/ui-user-questions/README.md) unchanged; they survive restart. Continue never answers a pending choice; independent useful work may continue.

**Sources & memory** (dock page; [synthetic demonstration](prototype/harness-frame/screenshots/s1-3.png)) contains:
- an at-a-glance line of counts by state;
- Your instructions (verbatim);
- Rules and methods in effect, with adoption;
- Agent working notes;
- Sources with state, requirement level and why included;
- Generated summaries;
- a collapsed Diagnostics section.

Removing a future attachment does not rewrite a past delivery.

**Disconnect and restart.** Harness shows connection state. AITP views label cached content “last observed” and never report running work as stopped. After reconnect, the views re-read task and source states before offering Continue or Retry. Closing a dock tab hides it; running work stays in the Session.

## Materials panel

Materials opens without a Session. Tabs: Library, Knowledge, Code, Skills, with one search field scoped to the active tab. The project or topic filter is optional and never a prerequisite.

### Literature library and reader

Collection views and search filter by title, author, year, identifier, known edition, local availability and recorded reading state. Filters and list position survive returning from a paper. The indexed scope is visible: an incomplete index is never an empty library ([s2.1](prototype/harness-frame/screenshots/s2-1.png)). A work shows its editions and files, existing reading notes, linked knowledge entries and the project passages that use it. Collection membership points to the existing owner. Duplicate candidates stay separate and unresolved; a filename never proves edition identity.

The reader shows edition, PDF page and printed page separately and keeps one page-index convention, converted at one boundary. Selection creates an edition-bound excerpt and region. A jump to an equation number without a checked locator presents candidates instead.

Actions:
- **Ask about selection** opens a local Session draft with origin Global, an optional empty topic selector (never inherited from the last topic) and the attachment “attached, not sent”.
- **Add to existing session** queues the excerpt with the next message.
- **Compare with knowledge entry** opens the entry in the second region ([s2.2](prototype/harness-frame/screenshots/s2-2.png)).

Reading states show researcher, agent delivery and derivation explanation separately.

States:
- **Missing PDF**: known bibliography, Locate existing file, and a disabled Fetch explained as a later scoped capability; another edition is never substituted ([s7.2](prototype/harness-frame/screenshots/s7-2.png)).
- **Scanned PDF**: page viewing only, with selection marked unavailable until OCR.
- Reader loading never blocks open notes, and local active content never receives application privileges.

Later additions: stored highlights and annotations as edition-bound researcher records, full-text index, citation extraction, bibliographic import, metadata edits, duplicate merging and collection changes. Each is a scoped change with an inspectable proposal. P2 browsing creates no paper maps, knowledge entries or annotations in real files.

### Knowledge

The navigator offers subjects, learning stories and entries. An entry shows its definition or result, assumptions and scope, and source locators. Support labels (`derived`, `source`, `unchecked`) and review labels appear as written, separate from reading depth. Prerequisites and related entries are ordinary links with an outline and back/forward. Where-used is bounded, and its searched scope is stated (“search covered ~/research notes only”).

Conflicting explanations stay side by side with their sources. An optional neighbourhood graph has a list equivalent and labelled edges; there is no global force-directed graph. Review of a passage or bounded set shows inspected scope, unread dependencies and the difference between a broken link and a scientific objection. Model review arrives with the review capability, and no entry-wide “verified” badge is inferred.

### Code workspace

Familiar explorer, source, changes and history arrangement for formula-to-implementation work ([s3.1](prototype/harness-frame/screenshots/s3-1.png)):

- **Checkout list**: host, path, branch and dirty state. Two worktrees of one repository remain distinct and are never substituted.
- **Header**: host and path, branch and revision (working tree or commit), and dirty files with “attribution unknown” unless action records support it.
- **Changes**: explicit Unstaged / Staged / Commit / Branch scopes. A “This session” filter appears only when action records exist.
- **History**: names commit and repository. Selecting a commit can start Explain or Review with that exact revision. File modification time never links a change to a thread.
- **Retained output**: shown as a file with its observation time, labelled “not an execution record”.

Three capability tiers are always visible on the page:

| Tier | Status | What it means in the UI |
| --- | --- | --- |
| Viewing | Existing Harness (file preview, [read-only LSP](../../packages/lsp/lsp/README.md)) | Source, symbols, search, diff and history; reading never runs code |
| Agent edits and commands | Existing Harness, generic | The agent may edit files or run commands under the Session's Harness permission mode; changes appear in Harness's changed-files card ([ui-deliverables](../../packages/client/ui-deliverables/README.md)) and tool rows; the UI does not present them as research-linked |
| Research run record | Proposed AITP, future | Command, inputs, environment, outputs and the thread or claim they test, reviewed as evidence; unavailable until the run adapter exists |

This scope describes the research code view. Generic agent editing and execution already exist in Harness under its actual permissions; the research-linked execution record and dedicated editing interactions remain to be integrated. A read-only pane does not make an independently running agent read-only.

**Rule ↔ code comparison** (dock comparison tab; [s3.2](prototype/harness-frame/screenshots/s3-2.png)) shows the agreed formula or rule beside the code range, then diagnostic evidence beneath. Derived numbers are marked “Agent · provisional derivation”. Open in VS Code delegates editing to the host editor; AITP keeps the selection and re-reads on return. Full debugger, terminal, LSP-editing or extension parity is out of scope. Large or binary files show size and type; truncated source is labelled. A disconnected host keeps the last observation, disables live actions and never falls back to a similar-looking Windows path.

<a id="skill-library-and-use"></a>
### Skill library and use in the current problem

**Catalog** (Materials › Skills; Session-free):
- Purpose, stated preconditions and limits, motivating examples and associated topics, each from the Skill's text. An absent statement shows as unknown.
- Source filters: Portable AITP, Topic, Personal.
- Every source path and kind is shown. Duplicate names list every source with the one that would load by name. A topic association never selects the winner.
- A **Discovery report** lists the roots searched, nested methods reachable only through links, and shadowed names. No result means no match in those roots ([s7.3](prototype/harness-frame/screenshots/s7-3.png)).

**Use in a task** (dock tab opened from the transcript's method-use row or from the catalog; [s4.1](prototype/harness-frame/screenshots/s4-1.png)):

1. **Relationship to this task**, a single choice the agent sets and the researcher may change: Use whole procedure · Borrow steps · Reference only · Not used · Unresolved. The agent's short reason is labelled provisional; a researcher change is recorded as the researcher's instruction.
2. **In this task** summary for borrowing:
   - the borrowed step;
   - what it depends on, with availability;
   - the instructions that travel with it;
   - steps not used and why;
   - claims that do not transfer.
3. Purpose, preconditions against this task (met / unmet / unknown with reasons), all steps marked used, borrowed or not used, travelling instructions, and limits.
4. Load state: “Loaded at turn 12 · text retained in the session”, “Shown as file text · not invoked”, or “Changed since it was shown” with Show differences and Ask the agent to reload.

Rules:
- A shortened excerpt never implies omitted mandatory instructions were waived.
- Choosing Use whole for a method that would replace a researcher-fixed method shows that consequence; the agent asks before acting on it.
- When a researcher selects a specific source and loading by name would deliver another, the view says so and leaves adoption **Unresolved** ([s4.2](prototype/harness-frame/screenshots/s4-2.png)). It never substitutes silently.
- Reading, pinning or associating a Skill installs nothing, runs nothing and does not show improvement.
- In ordinary work one transcript line suffices. The page reopens when a mismatch, changed premise, changed text or researcher correction affects the choice. A new catalog candidate does not create a card.

<a id="distillation-workbench"></a>
### Distillation from demonstrated use

Opened from the outcome row “Possible method correction”, from a Skill's Distill from evidence, or from an explicit request ([s5.1](prototype/harness-frame/screenshots/s5-1.png)). Layout:

1. **Status cells**, never merged into a percentage or a “validated” badge:
   - Draft (exists in this session, not a file);
   - Evaluation (narrowed · n failed · n untested);
   - Skill file (unchanged · writes not enabled);
   - Installed;
   - Published.
2. **Proposed revision**: a focused diff against the existing step it changes.
3. **Evaluation**: each check with its result. The result is one of:
   - replay (labelled “not evidence of transfer”);
   - failed transfer (and how the draft was narrowed);
   - passed on a named changed instance;
   - untested.
4. **Evidence**: session excerpt, code lines and note passage with locators.
5. A note that the scientific finding is pending integration at its note owner, not part of the Skill.
6. Outcomes: Keep narrow draft · No change needed · Discard. Apply to Skill file is shown disabled with its reason while writes are unavailable. Installation and publication are separate later actions.

“No change needed” and a failed transfer are ordinary, visible results. The catalog shows a pending proposal beside the current Skill text ([s5.2](prototype/harness-frame/screenshots/s5-2.png)) without changing it. Distillation follows the portable [aitp-distill](../../aitp/plugins/aitp/skills/aitp-distill/SKILL.md) procedure; this page only presents evidence, draft, evaluations and outcome states.

<a id="collaboration-rule-editor"></a>
## Rules (collaboration rules)

The Rules panel (Proposed AITP) groups guidance under **Writing and explanation**, **Research collaboration** and **Recording and recovery**. It opens on the rules that apply to the current topic, with a scope selector for all of the researcher's rules. Each rule card shows its exact text, scope, source (your app rule, project instructions file, portable AITP default) and adoption state. **Why this rule?** shows source text, origin, scope and the request that last used it. Portable AITP defaults are not edited here: Override for my work creates a researcher-owned rule that names what it replaces.

**Editing** ([s6.1](prototype/harness-frame/screenshots/s6-1.png)) happens in place on the rule card:

- The current text and the new text are shown; the researcher's text is saved verbatim. An AI suggestion appears only as a visible diff.
- **Affects**: Sessions on this scope, marking any with a running step.
- **Scope**: This task only · This topic · All my work. A task correction never silently becomes a standing rule.
- **Saved to**: the actual destination before Save. The proposed default is app rules for the scope, labelled “this app only”. `research.md › Standing agreements` is portable to Codex and Claude Code, but is shown disabled while note writes are not enabled. A portable AITP Skill is a separate upstream change.
- **Takes effect**: from the agent's next request in affected Sessions. The step now running keeps its rules, and earlier replies and notes are not rewritten.
- **Conflict**: detectable conflicts show both texts and sources. The agent says which it followed, or asks when the choice is consequential. Conflict detection is fallible and is not presented as complete.
- One Save; no approval dialog. States: Draft · not saved → Saved · not yet used by this task → Used by the request at turn N. A failed save keeps the draft and never shows active ([s6.4](prototype/harness-frame/screenshots/s6-4.png)).

The panel states that tool permissions are Harness Session controls; editing a rule grants or removes no tool. Common preferences (language, audience, derivation depth) may receive controls only when they map faithfully to the authored text; prose and controls edit the same rule, and complex rules stay prose. Reverting creates a new revision. External edits to rule sources are re-read and shown as changes or conflicts.

## Scenario walkthroughs

Each walkthrough is demonstrated with synthetic data in the [Harness-frame prototype](prototype/harness-frame/README.md); the step links open its screenshots. A working application must reproduce the behavior with real services; the prototype does not establish that.

### W1. Return to a topic after interruption and compaction — C01, C16, C02

- **Entry point:** Research panel. No Session or prompt ([s1.1](prototype/harness-frame/screenshots/s1-1.png)).
- **Visible:**
  - question, current answer and decisive gap verbatim with locators;
  - one pending choice;
  - live threads with authored dispositions;
  - a failed route from the note;
  - Sessions on this topic.

  The hover card on a Session row shows topic, thread, task and gaps.
- **Researcher:** Continue the thread's Session. In the conversation ([s1.2](prototype/harness-frame/screenshots/s1-2.png)) the task card summarizes the task, three researcher items, two provisional agent items and one gap. The failed route retains its source label when expanded. Harness compaction markers show the two checkpoints.
- **Agent:** Answers with the code finding, its limit and the missing linked note “not needed for this comparison”.
- **On demand:** Sources & memory ([s1.3](prototype/harness-frame/screenshots/s1-3.png)) shows:
  - the task, the turn-9 restriction and the turn-12 choice with its question, verbatim;
  - rules in effect, including aitp-memory “condensed since · reload pending”;
  - agent notes;
  - sources, including the opening read at turn 2, condensed since and re-read at turn 32, and the run log condensed and not re-read;
  - summaries kept apart.
- **Failure or uncertainty:**
  - Backend unreachable ([s1.4](prototype/harness-frame/screenshots/s1-4.png)): last observed passages and “state unknown”, with no cancellation claim.
  - Missing linked note: a gap with level “Optional background”, with its origin in the paused thread stated separately; work continues.
  - Moved main note: original reference and repair.

### W2. Read a paper and consult a knowledge prerequisite — C04, C05, C19, C21

- **Entry point:** Materials › Library, without a topic or Session ([s2.1](prototype/harness-frame/screenshots/s2-1.png)).
- **Visible:**
  - work with two editions (only edition 2 local);
  - PDF page 4 and printed page 112;
  - Eq. (7) selected;
  - reading note and where used;
  - three reading states;
  - the index-coverage notice.
- **Researcher:** Compare with knowledge entry ([s2.2](prototype/harness-frame/screenshots/s2-2.png)), which shows the entry's support and review labels, assumptions and its prerequisite (contraction mapping). Then follow the prerequisite and return to the same position, and choose Ask about selection ([s2.3](prototype/harness-frame/screenshots/s2-3.png)). The draft has origin Global, the optional topic selector empty, and “attached, not sent”. Discard leaves nothing.
- **Agent:** After Start ([s2.4](prototype/harness-frame/screenshots/s2-4.png)) the chip reads “sent at turn 1 · in context now”, and the reply cites edition 2, p. 112.
- **Failure or uncertainty:**
  - Edition 1 has no file and numbers equations differently: candidates, not a jump, and no substitution.
  - A same-titled entry with other conventions stays a separate candidate.
  - Partial index is never “no results”.
- **Unsaved:** An abandoned draft is local and disappears on Discard; a queued attachment to a busy Session is shown as queued.

### W3. Compare a formula with code and diagnostic evidence — C08, C10

- **Entry point:** Materials › Code or the topic's code link ([s3.1](prototype/harness-frame/screenshots/s3-1.png)).
- **Visible:**
  - checkout identity;
  - two dirty files with attribution unknown;
  - the stopping test highlighted;
  - retained log labelled as a file;
  - the three capability tiers.
- **Researcher:** Compare with the agreed stopping rule. This starts a Session with the comparison tab, code tab and Sources & memory in the dock ([s3.2](prototype/harness-frame/screenshots/s3-2.png)).
- **Agent:** Localizes the mismatch (the code tests the damped step α‖r‖, not ‖r‖). The implied residual is shown as “Agent · provisional derivation”, with what this does not establish (convergence of system C, branch selection).
- **Failure or uncertainty:**
  - Another worktree is never substituted.
  - No research run record exists; any new run would use generic Harness tools under the Session's permission mode and would appear as such.
  - A disconnected host disables live actions and keeps the last observation.

### W4. Borrow only a justified part of a Skill — C22, C10

- **Entry point:** The transcript row “Method use · borrowing step 3 of anderson-mixing-solver; keeping your damped linear mixing” ([s4.1](prototype/harness-frame/screenshots/s4-1.png)).
- **Visible:**
  - Relationship: Borrow steps.
  - In this task: step 3 borrowed; depends on F(xₖ), available at mixing.py:39; travelling instruction “report the residual in the same norm as the tolerance”; steps 1, 2 and 4 not used because they replace the fixed solver; convergence-rate claims do not transfer.
  - Preconditions: unmet (solver change), met (F evaluable), unknown (preconditioner).
- **Researcher:** Keep, or change the relationship with a reason. Choosing Use whole shows the fixed-solver consequence; the agent asks before acting.
- **Failure or uncertainty** ([s4.2](prototype/harness-frame/screenshots/s4-2.png)):
  - The researcher selects the topic copy of residual-diagnostics, while loading by name would deliver an older personal copy. The view reports the mismatch, offers comparing the texts, and leaves use Unresolved.
  - The file changed after it was shown: Show differences or Ask the agent to reload.
  - After compaction the load state reads “condensed since”, not “in context”.

### W5. Turn a demonstrated correction into a distillation proposal — C14, C22

- **Entry point:** The transcript outcome row lists the system-C finding as pending integration in research.md and offers “Possible method correction → open distillation” ([s5.1](prototype/harness-frame/screenshots/s5-1.png)).
- **Visible:** Status cells (Draft in session; Evaluation narrowed: 1 failed, 1 untested; Skill file unchanged; Installed no; Published no), the diff to step 2, the evaluations, and the evidence with locators.
- **Researcher:** Keep the narrow draft, mark No change needed, or Discard. Apply to Skill file is disabled with its reason.
- **Agent:** The failed Broyden transfer narrows the draft to constant linear damping. It is not hidden or retried until it passes.
- **Afterwards:** The catalog shows the pending proposal beside the current text ([s5.2](prototype/harness-frame/screenshots/s5-2.png)).
- **Failure or uncertainty:** No reusable operation means no draft. Writes unavailable means the proposal is retained and the file is reported unchanged. A replay is never shown as transfer evidence.

### W6. Change a writing rule while a task is active — C16, C12

- **Entry point:** Rules panel while a step runs ([s6.1](prototype/harness-frame/screenshots/s6-1.png)).
- **Visible:**
  - current and new text;
  - affected Sessions (one running);
  - scope This topic;
  - destination App rules, with research.md disabled (note writes not enabled);
  - effect timing;
  - a conflict with a personal rule.
- **Researcher:** Save once.
- **System:** “Saved · not yet used by this task — the running step began before the save” ([s6.2](prototype/harness-frame/screenshots/s6-2.png)). After the next request, the task card reports the rule as used at turn 35 and the reply uses the notation ([s6.3](prototype/harness-frame/screenshots/s6-3.png)). Earlier replies are unchanged.
- **Failure or uncertainty:**
  - Save failure keeps the draft and never shows active ([s6.4](prototype/harness-frame/screenshots/s6-4.png)).
  - An unsaved draft stays Draft when leaving.
  - A conflict with a task instruction stays visible, and the agent states which it followed.
  - Another topic's rules are unaffected.

### W7. Empty, unavailable and catalog-coverage states — C18, C21, C22

These are a workspace without a root note ([s7.1](prototype/harness-frame/screenshots/s7-1.png)), an edition without a file ([s7.2](prototype/harness-frame/screenshots/s7-2.png)) and the Skill discovery report ([s7.3](prototype/harness-frame/screenshots/s7-3.png)). Every resource view supports loading (prior content kept, labelled), empty (“none recorded” versus “not indexed”), partial, missing, permission-denied, disconnected and ready states. Errors offer the smallest recovery without erasing selection or draft.

## Harness integration map and missing backend information

| Component (proposed client contribution) | Harness extension point used | Data and actions it needs | Backend status |
| --- | --- | --- | --- |
| Panel entries and global panels | `sidebar.panellist`, `main` keyed slot, `ctx.layout.selectPanel` | Current Workspace; whether it is a research root | Workspace exists; research-root detection missing |
| Topic navigator and topic home | Global panel; `useResource` | Topic projection: topics, opening passages with spans, Current work entries with clauses, pending choices, failed-route and branch passages, linked materials, Sessions by origin | Missing (research-record provider) |
| Note reader | Panel region and dock tab type; `ResourceProtocolMap` | Note resource by address with spans and anchors; Session-independent read authority for configured research roots | Missing; Harness previews read only through a Session filesystem |
| Session hover card | `sidebar.session.row.hover` | Session origin and task summary by Session id | Missing (origin metadata) |
| Origin chip, Sources & memory action | `conversation.session.header.actions` | Session origin | Missing |
| Task card | `conversation.input.dock` | Working-memory projection: researcher items verbatim with event references, choice answers with question and option text, provisional agent items, gaps with requirement level, rules changed and adoption | Missing (task/working-memory provider and model-writable working items) |
| AITP transcript rows | `tool.call.toolview` | Logged AITP tool calls and results (reads, working items, method use, outcomes) | Missing (AITP tools) |
| Sources & memory page | Dock page type; `useProjection` | Observation records: locator, why included, requirement level, located / sent / available / condensed / re-read / missing states; rules and Skills in effect with load state; summaries by compaction event | Partly derivable from logged events and visible history; projection missing |
| Library, knowledge, code readers | Panel regions, dock tab types, `ResourceProtocolMap` | Work/edition/page index with coverage; knowledge entries with labels, prerequisites and bounded where-used; checkout identity, dirty paths, diffs, history | Missing; Harness LSP and previews reusable for viewing |
| Comparison tab | Dock tab type | Two resolved resources and locators | Uses reader data |
| Skill catalog and use view | Panel tab, dock tab type | All candidates for a name with source and precedence, loaded text per Session, current text for comparison, relationship record and its author, borrowed portion and dependencies | Registry exposes winners only; relationship record and source-qualified load missing |
| Distillation page | Dock page type | Proposal draft, diff, evaluation records, outcome states, evidence locators | Missing |
| Rules panel | Global panel | Effective rule projection with sources, scopes, revisions, adoption receipts; save to the chosen destination | Missing; Harness settings do not supply resolution or adoption |
| Agent questions, approvals, plan, goal, compaction marker, permissions | Existing Harness packages | — | Existing |

No interface listed as missing is implemented; names such as “working-memory projection” describe required data, not existing APIs. Each backend item belongs to the owners in [10](10-project-workspace.md#harness-service-mapping) and the scope in [14](14-implementation-blueprint.md).

## Increments

**UI-1, first useful increment: topic → note → session → context.** It is useful with a minimal backend:

- Research panel with topic navigator and topic home, built from verbatim passages only. Needs your input, Current work, failed routes and Sessions on this topic are included. Relevant materials appears only as plain links.
- Note reader in the panel and as a dock tab, with pane-local anchors and Work on this passage creating a Session draft with origin and excerpt.
- Session header origin chip and Sources & memory action; the task card; the Sources & memory page with the four provenance kinds, source states and gaps.
- A read-only list of rules in effect inside Sources & memory, without the editor.
- Session hover card.
- States: no root note, missing note, duplicate anchor, disconnected, compaction.

Acceptance is W1 and the note part of W2 on scratch data, in the running application, at 1440 × 900 and 1024 × 768 in both themes:
- no Session is created by browsing;
- researcher items are verbatim and never mixed with agent items;
- a condensed source is not reported as in context;
- a missing source neither throws nor locks work;
- the topic home contains no generated prose.

UI-1 needs: research-root and topic projection, note resource protocol with Session-independent read authority, Session origin metadata, the working-memory and observation projections, and model-writable working items. Until the last two exist, the task card shows researcher items and source states only, with the agent section absent.

**Later increments**, each independently schedulable once its backend exists:
- **UI-2**: Materials Library and Knowledge readers with attach-to-Session (W2, C19–C21).
- **UI-3**: Skills catalog, discovery report and use view (W4, C22). Requires all-candidate listing and source-qualified loading for the selection rules.
- **UI-4**: Rules editor with scope, destination and adoption (W6).
- **UI-5**: Code views and the comparison tab (W3).
- **UI-6**: Distillation page (W5).
- **Later still**: annotations, research run records, manuscript views, desktop host and WSL identity surfaces.

Each increment keeps the states and acceptance listed in its section.

## Visual system

AITP views use Harness theme alias tokens and [ui-primitives](../../packages/client/ui-primitives/README.md) controls so they follow the selected Harness theme. AITP adds semantic tokens only where Harness has none:

- provenance colours: researcher, agent provisional, source, summary and gap;
- reading typography;
- equation blocks.

The prototype's linen and forest values are proposals for those semantic tokens, not a separate design system.

| Role | Proposed token/value |
| --- | --- |
| UI text | Harness UI font and sizes; captions at least 12 px |
| Reading | Source Serif 4 with serif fallback, 15.5–16 px / 1.6, 68–80 characters |
| Code | Harness code font and size setting |
| Provenance | Researcher accent `#346b59` / `#a4c799`; agent `#5b4b8a` / `#b9a8ec` dashed; summary `#5c605d` / `#a7aca8` dotted; gap `#8a5a00` / `#e7b95e`; missing `#a1301e` / `#f08a78` (light / dark) |
| State | Icon and text always; colour is never the only signal; “accepted” appears only with actual evidence |
| Motion | Harness timing; respect reduced motion; no animation unless running |

Production acceptance computes contrast for all actual text and background pairs: normal text at least 4.5:1, large text and control boundaries at least 3:1. This includes selection, diff and pill states. The Harness-frame prototype's measured representative pairs were at least 5.25:1 in both themes. Inspect 1024 × 768, 1440 × 900, 1920 × 1080 and 200 % zoom in both themes.

## Accessibility

Buttons have accessible names, and tab lists use roving focus. Dialogs trap and restore focus, and resize handles expose separator values (Harness owns the frame and dock behavior). Relationship and scope choices are radio groups. Provenance is announced by its text label. Streaming announces concise status, not tokens. Equations keep accessible source text, and tooltips never carry the only route to an action.

## State and transition acceptance

Test focus, scroll, scope and task identity at every boundary:

- project home → thread → evidence → Session → side question → return;
- library → edition → attach to Session;
- code diff → formula → unchanged active task;
- rename or unresolved anchor → explicit repair;
- disconnect and reconnect during a stream;
- restart with a waiting choice;
- a topic writing-rule change → next-request adoption, with other topics unchanged;
- a critical unread premise with all drawers closed;
- an unapplied child-note correction with its parent use reachable;
- a source edited outside the UI;
- a rule-save failure;
- a project Skill that is unsuitable;
- a differently named Skill with a useful shared step;
- partial use with an unmet prerequisite;
- a Skill changed after compaction;
- a distillation with a failed example and a no-change outcome.

Researcher evaluation asks them to find an unresolved question, inspect its decisive evidence, start appropriately scoped work and return days later, recording hesitations, wrong destinations and corrective actions. Initial targets:
- at most three purposeful navigation actions from project home to a known thread or source;
- no prompt needed to locate known resources;
- zero silent loss of scope or conditions.

These are prospective criteria; no usability trial has occurred.

## Implementation handoff

**Component ownership.** Codex implements the client contributions and backend integration described in [14's crosswalk](14-implementation-blueprint.md#development-crosswalk), using Claude's completed design. The package names below are proposed reservations under `packages/client/`, following the existing `ui-brand-aitp` naming; agree them before concurrent edits.

| Proposed client package | Owns | Consumes |
| --- | --- | --- |
| `ui-aitp-resources` | Resource protocols for notes, papers, knowledge entries, Skills and checkouts; the shared reader components; dock tab types and the comparison tab | Research-record, literature, knowledge, Skill and checkout providers through host remotes |
| `ui-aitp-research` | Research panel entry, topic navigator, topic home, Session hover card | Topic projection; Harness Sessions and their AITP origin |
| `ui-aitp-session` | Header actions, task card, AITP tool rows, Sources & memory page | Working-item, observation and rule-adoption projections; logged AITP tool calls |
| `ui-aitp-materials` | Materials panel tabs, Skill discovery report and use view, distillation page | Reader components; Skill candidates and method-use items; proposal and evaluation records |
| `ui-aitp-rules` | Rules panel and editor | Effective-rule projection and save operation |

Every package derives what it shows from backend projections or resources and keeps no scientific state of its own. Layout and navigation history are local view state. Product copy is locale-owned, as Harness requires.

**Required data and actions** are listed per component in the [integration map](#harness-integration-map-and-missing-backend-information); none of the missing items is implemented. **Acceptance per increment** is the walkthrough and state list named in [Increments](#increments). Run it in the application with scratch data, plus keyless recorded-Session snapshots for model-visible rows as Harness testing policy requires. The prototype check is design evidence only.

**Decisions that change UI behavior.**

1. Already listed as open product defaults in [14](14-implementation-blueprint.md#next-implementation-slice) and [current.md](../../current.md):
   - session-independent resource access (UI-1 cannot browse without it);
   - same-name Skill precedence and source-qualified loading (UI-3 selection rules);
   - saved-rule ownership and destination (UI-4);
   - restriction lifetime;
   - default permission mode.

   This design shows each choice explicitly and does not settle it.
2. Specific to this interface:
   - Whether the AITP research configuration keeps Harness Goal, its round driver and plan mode beside the task card. The synthetic UI-1 demonstration omits them. This does not disable the shipped plugins or select the product default; an implementation fixture must declare its composition, and coexistence needs an explicit relationship between the Goal strip and task card.
   - Whether Harness should receive a Session-row subtitle seat and the compaction-marker copy refinement, or whether that information stays in the hover card, task card and Sources & memory.

**Coordination with other owners.** The integration pass carries these requirements into the existing owners below. Keep them aligned when the interface or backend changes; this table is a responsibility map, not a second progress record.

| Owner | Passage | Required alignment |
| --- | --- | --- |
| [10](10-project-workspace.md) | Opening paragraph on the three entrances; section “One interface, three entrances and independently navigable resources” and its shell diagram | Replace explorer, editor-group, inspector and activity-panel wording with the Harness frame; keep Research, Materials and Rules as `sidebar.panellist` panels |
| 10 | [Harness service mapping](10-project-workspace.md#harness-service-mapping): Workbench and native host row; plugin table Workbench presentation and Desktop host rows | Name the extension points used here, the Session-less dock limit and the need for Session-independent read authority for research roots |
| 10 | Same table, Skill catalog row | Point to the use view's need for all-candidate listing and source-qualified loading |
| [11](11-research-memory.md) | [Memory user view](11-research-memory.md#memory-user-view) | Replace “Research record / Current sources / Pending integration” with the topic home, the task card and Sources & memory, and adopt the provenance and state vocabulary above |
| [13](13-research-journeys.md) | C01, C04, C08, C14, C16 and C22 acceptance paragraphs | Optionally reference W1–W6 as interface acceptance routes; coverage labels stay unchanged (synthetic demonstration only) |
| [14](14-implementation-blueprint.md) | Progress-table P1 row (“shared editors”), [P1](14-implementation-blueprint.md#p1) usable result and modules (“shared tabs and split panes”), and P1's Markdown navigation paragraph | Express P1's interface as UI-1 on the Harness frame: panel regions and dock tabs instead of editor groups; pane-local anchors per region and dock tab |
| 14 | Crosswalk rows Workbench shell, Skill catalog, Collaboration rules and Desktop attachment | Reference UI-1 to UI-6 and the backend data in the integration map; record the proposed client package reservations |
| [current.md](../../current.md) | Q05 (citations), Q09 (Session-free browsing), Q11 (progressive disclosure; still cites the Pi AgentDock) and Q16 (Skill use) | Point to this revision and its remaining backend dependencies; record that the Harness dock has no Session-less surface and that Harness compaction keeps shadowed rows visible |
