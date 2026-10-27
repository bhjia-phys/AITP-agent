# 12. Desktop interface specification

This document owns the AITP-agent interface: its frame, navigation, views, interaction states, scenario walkthroughs and the user-interface handoff to implementation. It specifies intended behavior. [10](10-project-workspace.md) owns component responsibilities and data ownership, [11](11-research-memory.md) owns memory and context semantics, [13](13-research-journeys.md) owns case suitability and [14](14-implementation-blueprint.md) owns scope, sequence and progress.

**Design handoff:** Claude completed this UI design and its synthetic prototype. Codex owns incremental client and backend implementation and integration tests under [14's development crosswalk](14-implementation-blueprint.md#development-crosswalk). No research view is implemented or accepted merely by this handoff.

**Frame revision 2026-10-22; implementation status updated 2026-10-23.** The interface is rebound to the selected DeepSeek Harness Web/Electron client. The earlier standalone shell (activity rail, explorer, editor groups, inspector, activity panel and status bar) is superseded: Harness already supplies the left sidebar, the main column, the per-Session right dock, the conversation, approvals, questions, compaction markers and permission controls, and AITP contributes research views to those places instead of replacing them. The scientific requirements of the earlier design are kept.

Evidence labels used below:

| Label | Meaning |
| --- | --- |
| **Existing Harness** | Inspected Harness client behavior or extension point in `packages/client/`; usable now, but not research-aware |
| **Proposed AITP** | Interface behavior specified here; not implemented in the application |
| **Synthetic demonstration** | Shown in a static prototype with invented data; establishes neither backend support nor usability |
| **Application with fixture** | Real Harness components and asynchronous interfaces using labelled synthetic data; no real-source or model-context acceptance |
| **Functioning AITP feature** | Working application behavior with its data-provider scope and recorded evidence in [14](14-implementation-blueprint.md) |

Two earlier isolated prototypes remain available. The [Harness-frame prototype](prototype/harness-frame/README.md) demonstrates this revision with seven deep-linkable walkthroughs and a browser check. The [earlier prototype](prototype/README.md) demonstrates the superseded shell and its selection-provenance checks; its interactions remain useful evidence for reader behavior, not for the frame.

The [topic-centred redesign](16-topic-centred-redesign.md#navigation) prioritizes project overview → topic → subtopic → material. The [formal research client](../../packages/client/ui-aitp-research/README.md) implements that navigation as the [research map](#research-map): an overview of directions and topics, a branch focus, topic pages and a material reader. Its adapter supplies hierarchy and material identity independently of note layout. The generic host `sidebar.context` slot supports the topic tree in the existing sidebar footprint; switching to Conversations restores the host browser. UI-1's note reader and Session views remain reusable. The [standalone prototype](prototype/topic-workspace/README.md) remains a design reference; application evidence is separate and owned by [14](14-implementation-blueprint.md#topic-redesign-review).

<a id="ui-1-implementation-status"></a>
### Client and backend boundary

The client reads through framework resources and a workspace-bound asynchronous provider. Scope and answer edits prepare a serializable preview, then show the provider's acknowledgement, conflict or unknown outcome. An open draft retains its original revision; a later source update requires explicit re-preparation. The opt-in fixture stores only in-memory demonstration state and identifies it throughout the UI. The optional Markdown backend now supplies source mapping, scratch operation recovery and actual model-context delivery; these remain backend responsibilities. Opening a resource or a Session alone does not establish delivery. [B1–B6](14-implementation-blueprint.md#memory-backend-work) records the tested paths and open defects. The [connection reference](../../packages/client/ui-aitp-research/README.md#backend-connection) owns the implemented interface, including the relationship to the older UI-1 note protocols.

## Design commitments

- **The question comes first; conversation is optional.** Topics, papers, knowledge, code and methods can be found and read without creating a Session or attaching anything to a model.
- **Every scientific display is a view of an owner.** The topic home, thread rows and context views show source passages with locators. They keep no second editable summary; edits go to the owning note through the selected writing flow.
- **Provenance is visible by kind.** Researcher words, provisional agent working items, source observations and generated summaries look and read differently, by label and icon as well as colour.
- **The compact surface keeps what changes the next decision**: the task, applicable researcher instructions, conditions attached to a displayed conclusion, consequential gaps, a pending choice and unapplied outcomes. Operational detail is one deliberate expansion away.
- **No ceremony.** There is no mode selection, no fixed research sequence and no approval dialog for ordinary authorized work or a preference edit. A source gap informs the next step; it never locks unrelated work.
- **Honest states.** Unknown coverage, missing files, disconnected backends, unsaved drafts and unimplemented capabilities are shown as such, never as empty results or success.

<a id="layout-and-navigation"></a>
## Application frame on Harness

The researcher authorized a unified topic-and-conversation workbench on 2026-10-26. It is implemented with bounded application validation; [14](14-implementation-blueprint.md#topic-discussion-workbench) owns acceptance evidence and remaining limits. The existing Harness sidebar and ordinary Session remain the owners of navigation and execution. Within Research, the centre reads the research object and the right region embeds the complete normal Conversation. Library panels instead keep their catalogue on the left and open sources in the native document dock on the right. Asking about a source presents the same normal Conversation in the left area; **Back to library** restores its catalogue while the document remains open. Entering a catalogue temporarily hides the discussion presentation, and returning to the topic restores the previously visible discussion without creating a Session or altering its draft. A discussion can be renamed through the existing Session title service; both the topic list and right-hand picker reflect the same title. An actual research-writer operation shows a qualified update notice with a **View changes** action exposing the recorded before/after text. Prepared, partial and unknown outcomes retain their own labels; they are never reported as saved or scientifically integrated. Generic external file edits can refresh readers but do not manufacture an operation receipt or historical diff.

```text
┌ Harness sidebar ─────────┬ reading region ──────────────────┬ research discussion ────────────┐
│ ▾ Project                │ Topic / note / paper / code      │ Topic name                      │
│   ▾ Subdirection         │                                  │ [Conversation ▾] [+ New]        │
│       Discussion A       │ A cited answer opens its source  │ [Expand] [Collapse]              │
│       Discussion B · run │ here, preserving the discussion. │ Full native Conversation:       │
│   ▾ Another direction    │                                  │ tools, questions, permissions,  │
│       Discussion C       │ Saved records reread in place.   │ model, stop, draft and messages │
└──────────────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

Each topic directly exposes its discussions in the existing tree; no separate conversation mode is required for this route. Selecting a discussion changes the right region and highlights the same item in the tree. The right title menu selects another discussion of that direction. New is available beside the topic and in the discussion header. Opening a topic or material never starts a model request. Explicit New/Ask may open the host's blank draft Session; the first actual submitted input durably establishes its research origin, without manufacturing a human message.

The shared discussion presentation belongs to `ui-aitp-research`; its root factory is reused by the independently owned library panels. It uses Harness's `conversation.content` embedded surface under a real Session provider, keeping the normal composer, attachment admission, approvals, pending questions and stop controls. Library providers continue to own catalog/read behavior. No new agent loop or second transcript store is introduced.

Reading location and discussion scope are separate. Changing material within a topic preserves the selected discussion and stages the current source/selection for the next explicit question. Submission captures that origin before asynchronous reference expansion and attachment work. Switching topics preserves each discussion's draft and running work; a request and its late results cannot move to the newly viewed topic. Source context is attached to the actual input, not an ambient next-turn variable.

Library source links from an embedded discussion and workspace-path materials selected in Research open the native right document dock when their Workspace has a unique library connection. The source library owns its root-scoped tab body, while `ui-sidebar-right` owns the shared native frame, tabs, collapse, fullscreen and width. Ordinary Conversations retain their Session-scoped dock. Root document scopes are keyed by library and explicit research scope; opening or switching them creates no Session and grants no Session file authority. Each source continues to resolve through the existing authorized source-root resource. Reopening the same located source reveals its tab; distinct passage locators remain distinct resource tabs so an exact excerpt is not silently replaced by whole-source content. Root tabs retain reading state during the current application lifetime, not after a whole-page reload. Scoped citation navigation falls back only when its owner cannot handle the resource.

Saved-file invalidations refresh open topic and library observations. A successful save, an unresolved save and a failed refresh remain separate facts; the UI reports only the result actually observed. An updated child note does not rewrite an independently authored parent conclusion. The next model step rereads its appropriate research scope; historical answers retain their delivered source observations.

The workbench uses the host font, controls, themed surfaces and single sidebar. The right discussion can expand, collapse or occupy the reading region in a narrow window; it never compresses both panes into unreadable columns. Closing it hides presentation, not execution. Unscoped global-library reading uses the same root document dock without creating a Conversation; ordinary conversation navigation retains its existing path.

### Workspaces, topics and Sessions: one project list

Harness Workspaces (canonical directories) remain the only project list. A workspace-bound provider supplies the research project and topic hierarchy; topics do not create additional Harness Workspaces. The formal frontend follows provider-supplied identities and parent/child relationships without requiring a `research.md` format. The earlier note projection remains a compatibility route: a backend may derive topics from a root note and its links. Resolving independently added topic directories to a containing research project belongs to that backend mapping and is not implemented by the fixture.

Sessions remain owned by Harness Workspaces. The research tree additionally groups their recorded research origins directly under the corresponding topic. A Session's AITP origin (topic and thread, paper passage, knowledge entry, code range or Global) is shown in three places: the row hover card, the origin chip in the Session header, and the topic home's **Sessions on this topic** list. Harness rows are not restyled. A row subtitle would need a new Harness seat and is deferred.

### Widths, focus and keyboard

Harness owns the sidebar widths and ordinary Session dock. The sidebar spans 264–420 px (rail 56 px); the ordinary dock opens at 45 % of the viewport and is capped at 70 %, protecting a 400 px centre, and below 768 px opens fullscreen. Library document docks use the same native frame geometry and narrow-window fullscreen rule. Their catalogues retain filtering and independent scrolling when documents open, and each live document tab retains its own reading state. The Research workbench uses that same sidebar footprint and a fluid centre; its embedded discussion takes about 44 % of the available workbench width, bounded between 380 and 600 px. At a narrow viewport or a workbench narrower than 760 px, discussion fills the reading region and **Back to reading** restores the centre. Wide equations, tables and code scroll inside their own block.

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

<a id="research-map"></a>
## Research map, topic pages and materials

**Revision 2026-10-23; application with fixture.** The [formal research client](../../packages/client/ui-aitp-research/README.md) organizes the workspace views as a focus map. It replaces the earlier client's project grid of answer cards and its five-tab topic view. Those views placed each topic's answer, qualification, gap, next step and child links on every overview card, divided topic detail among tabs, and showed the hierarchy only in the sidebar, with directions as labels unconnected to topics.

| Model considered | Strength | Limit for this workspace |
| --- | --- | --- |
| Free node-and-edge canvas | Shows the whole programme at once | Becomes unreadable beyond a few dozen topics, handles long titles and keyboard use poorly, and drawn edges suggest relations the records do not state |
| Column browser | Exposes depth directly | Spends the reading width on columns; mathematics and long qualifications need that width |
| Indented outline as the main view | Compact and familiar | The sidebar already provides it; it shows structure but no qualified state |
| **Focus map (selected)** | Draws direction → topic → branch structure around one focus at a time, with the summary one step from the page | One more step from the overview to a topic page; the page and the map have distinct purposes |

The map has four levels, each with one purpose:

1. **Overview — orientation.** The project title and its recorded summary, then one lane per research direction with its top-level topics on a drawn spine, a lane for topics without a direction, and the ideas to explore. A node shows its title, work state, recorded relation and branch count; its branches open in place on request. No answer, gap or next step appears at this level.
2. **Branch focus — exploration.** Selecting a node centres the map on that topic: its question and recorded role in the parent; a summary with the current answer and its conditions together, what remains open, the next step and the topic's materials; its branches on the spine below it; and the other topics at the same level. Selecting a branch moves the focus down, a trail step moves it up, and Open topic proceeds to the page.
3. **Topic page — reading.** The question and main action lead into the current answer with its conditions, what remains open and the next step. Scope sits beside the main reading column when space permits and below it in a narrow window. Branches with their recorded roles, materials, claims and routes, work and choices, and activity follow in sections. Branches and materials start open, work and choices open when a choice waits for the researcher, and the rest start closed and read nothing until opened. Editing keeps its preview/apply, capability, draft and unknown-outcome behavior.
4. **Material — the full document.** A reading column with the material's kind and source location and its complete content, or the actual unavailable state.

**Disclosure.** A shorter display never removes a qualification: wherever an answer appears, its conditions appear directly beneath it under “Conditions and limits”, and no answer is truncated to a headline. Work state uses a dot family (active, waiting on the researcher, waiting on a run, analysis or integration, paused or dormant, superseded, concluded); it never encodes scientific verification. Superseded routes have dashed connectors and borders; dormant and paused topics are muted.

**Structure from records only.** Lanes come from `directionId`, the spine from the primary `parentId`/`childIds`, and labels such as Prerequisite, Alternative route, Control or Application from the optional recorded `parentContribution`. Nothing is drawn or labelled from parenthood, order or chronology; a topic without a recorded contribution shows no role. A page that is partial or has a further page says so: the next page is offered on request, branches a parent names but the reading lacks are counted as not loaded or not available, and the provider's reason is shown. The sibling row links to the complete level when its first page is incomplete.

**Continuity.** The trail above each view lists Research map, the direction and the recorded parents. Its steps stay in the current mode: on the map they refocus the map, on a page they open pages, and Show on map or Open topic switches mode explicitly. Back returns to the previous location with its scroll offset and focused control. Node expansion, section state and requested pages are kept in the panel's interaction store. Arrival waits for the location's content. It re-applies while that content is replaced, for example when a resource held only by the previous view reloads once, and the reader's first wheel, touch, pointer or key input ends it. The sidebar outline in `sidebar.context` opens along the current path, keeps the branches the reader opens or closes, and shows titles only. No additional navigation column is added.

**Motion, keyboard and width.** Changing location fades the new view in over 180 ms and opening branches over 140 ms; both are removed under reduced motion, and no animation blocks input. Every node, toggle, trail step and section header is a button reachable by Tab; arrow, Home and End keys move between map nodes. Hover only reveals affordances. At container widths below 880 px the focus summary moves between the focus card and its branches; below 640 px padding and title sizes reduce, and the views keep a 16 px gutter without horizontal scrolling.

**Evidence.** The browser test [`aitp-workspace.e2e.ts`](../../apps/web/tests/aitp-workspace.e2e.ts) walks overview → branch focus → further page → nested topic → its page → material → Back in the assembled Harness Web application with the labelled fixture, checks containment at 1440, 1024, 720 and 390 px in light and dark themes and in Chinese, and compares accessibility snapshots in [its expected directory](../../apps/web/tests/expected/aitp-workspace/). [14](14-implementation-blueprint.md#topic-redesign-review) owns the progress record. The fixture establishes no backend support, real-note mapping or researcher acceptance.

<a id="topic-page-pilot"></a>
### Topic-page visual pilot

The representative page is a topic's detail view and its material-entry path. The reference is Harness's running [Plugin manager and detail page](../../packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx): a restrained heading, clear main action, comfortable reading width and separated content rows. The pilot uses the host font, theme and spacing rhythm, with existing `Button`, `Menu`, `MarkdownText`, `FileTypeIcon` and `PathLabel` primitives. Its topic summary uses the host reading font rather than the prototype's proposed serif treatment.

“Ask about this topic” focuses the existing scoped composer; it does not submit a question. “More actions” contains map and edit actions. The complete account has its own reading action, while related materials show title, source location and type in rows. Qualifications stay beside the answer. Routine reading metadata and topic management move into disclosures; loading, unavailable sources and uncertain edits remain visible. Long titles wrap, and the scope column and action row stack in narrow windows.

The overview omits recognized source section headings already supplied by its labels, preserving nested headings and the authored body. A qualification that is also the recorded open question appears once beside the answer. Editing and the complete account retain the original source sections. Missing scope and condition notices use the selected interface language. Valid YAML source properties stay inspectable in a reader disclosure; the source-text view and question locators retain the complete original bytes.

Leaving for a library captures the topic's scroll position and focused control; returning restores them and its section state without adding another Back destination. PDF viewing position survives reader remounts within the loaded client, independently of the source or passage selected for a question. The acceptance path is topic → material → explicit question → return, including narrow windows, long titles, empty content and loading. [14](14-implementation-blueprint.md#topic-redesign-review) owns its current validation and researcher-acceptance status. The researcher subsequently authorized the three-library redesign described in [Library presentation](#library-presentation); the earlier pilot no longer limits that implementation scope.

## Research panel and topic home

This section specifies the UI-1 topic home over the note projection; the workspace adapter's views follow the [research map](#research-map).

**Entry.** Research in the sidebar panel list. Opening it sends no prompt and creates no Session.

**Project setup and creation.** The workspace adapter first reports whether the selected Harness Workspace has been enabled for research. The owner explicitly enables read-only access or saving; existing host-configured limits remain visible. New topic and New subdirection collect a title, research question, optional scope and the current parent. Successful creation opens the new topic and focuses its question composer without contacting a model. Unconfirmed outcomes retain the original creation request for inspection and retry. Providers without creation support retain their existing reading views. [14](14-implementation-blueprint.md#topic-onboarding) owns implementation evidence and boundaries.

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

Library, Knowledge and Code each need a stable direct destination and a global overview. A topic or subdirection shows its related materials by kind, with the recorded reason for use; opening its complete literature, knowledge or code list leads to that same destination with the topic filter and return position retained. The proposed persistent shortcuts to these destinations share the Materials workspace. Their exact placement in the existing navigation remains a layout proposal; the shared frame and single sidebar remain in force.

<a id="source-study"></a>
### Study selected sources

Literature and knowledge share a Notebook-style study interface, with code passages available through the same source selection. A named source set retains references, selected passages and reading position in application operational storage under [11's ownership rules](11-research-memory.md#2-ownership-what-persists-where). It can be associated with several topics without copying their sources or owning a second research main line. In a project or topic, the shared navigation lists topics and their conversations. Library catalogues remain on the left and sources open in the native right document dock. An explicit question presents the normal Harness Conversation in the left area beside the retained document; citations open native source tabs with the question scope intact. Unscoped global browsing uses the same root document dock and retains its explicit conversation handoff.

Source checkboxes select the material eligible for a question or generated reading aid. Actual request delivery remains separately visible through Sources & memory. The current topic and selected sources stay visible; entering from a subdirection preserves its question, while global browsing keeps Global until a topic is explicitly chosen. Cited answers, comparisons, derivation outlines and reading drafts retain their exact source observations and attribution. Saved answer drafts live with the existing operational records; integrating a reading note or knowledge correction writes to its existing scientific owner through the [scoped authoring increments](14-implementation-blueprint.md#p3). P2 supplies browsing, source selection and runtime-held drafts; it does not authorize scientific-file writes. A named real collection follows P4's existing pilot policy.

<a id="library-presentation"></a>
### Library presentation

**Implemented 2026-10-26; running-app checks passed, researcher visual acceptance pending.** Literature, code and knowledge retain separate plugins, but use the same Harness type scale, native icons, buttons, source selection, search, folder filtering, return controls and loading/error treatment. Shared material resources own reads; the presentation plugins do not create separate indexes, source copies or conversation systems. [14](14-implementation-blueprint.md#library-ui) owns implementation evidence.

The reference choices are [Zotero's collections and item metadata](https://www.zotero.org/support/quick_start_guide), [GitHub's file navigation](https://docs.github.com/en/repositories/working-with-files/using-files/navigating-code-on-github), and [MediaWiki's article layout and contents](https://www.mediawiki.org/wiki/Skin:Vector/2022/Design_documentation). These guide each library's reading structure; Harness remains the visual and interaction owner. Literature foregrounds title, author, year and recorded reading state. Code separates repository observations, folders, source and observed changes. Knowledge foregrounds the article, its actual headings, kind, support and source links. Missing metadata remains missing; a presentation never infers review, reading completion or scientific validity.

A shared catalog factory owns keyed domain content. The shared reader owns actions, PDF position, exact source selection, source details and return behavior; keyed domain header/body positions provide specific reading layouts. Catalog navigation keeps the chosen code folder in the existing scope-aware view store. Research-scoped reading presents the native discussion in the left main area when explicitly opened, and its sources are staged only for the next submitted message. Source details are progressively disclosed; the primary discussion and source actions appear above the reading body.

<a id="workbench-ui-review"></a>
### Shared workbench presentation

The comprehensive 2026-10-26 review starts from the running Research page and the actual Harness plugin manager. Its reusable rules are the plugin manager's centred reading column, moderate title weight, secondary labels, separated rows and shared button/menu/focus primitives. Research and the libraries use a 1056px outer column, 24–48px horizontal desktop padding and 16px at narrow reading widths; note prose retains a readable measure. Typography follows Harness and its content-size setting, without a separate serif application style. Domain-specific components stay in their own plugins; common layout, source selection, reading and return behavior belong to the existing material frame/factories.

The project map uses quiet hierarchical rows instead of a card per topic. The location trail and primary action share one row. Topic management, source paths, observed revisions and saved-note metadata are disclosed on demand. An unresolved topic-creation attempt remains reachable while inspecting its partial result. The selected-source summary stays near the reader; opening it reveals sources, task preparation and saving. A question draft, pending operation or failure keeps those controls visible. The discussion pane retains its native composer and Session ownership, with compact source disclosure, labelled New/switch controls and accessible expand/return buttons. Known provider metadata values receive plain-language labels without rewriting authored values or promoting unreviewed claims.

Study notes use the same list, title and reading rhythm. Returning to the list retains the unsaved draft and exposes Continue draft. Title search explicitly covers the loaded page, not a full-text index. Library lists retain their scroll offset independently of source readings and research return points. Native PDF page controls retain an explicit last-page choice when the bottom scroll limit prevents aligning it at the reading line; a manual scroll or viewport change resumes observation-based page reporting. Empty content, loading, disconnected/read failure and denied source access remain distinct; technical error details are expandable and retry never implies granting file access.

This page/state inventory defines the review surface; the [execution receipt](../../agent/notes/harness-integration.md#workbench-ui-review) owns observed results and limits.

| Surface | Review states and transitions |
| --- | --- |
| Global navigation, project and topic hierarchy | Project selection, overview, focused direction, topic opening and return; absent workspace and unconfigured research |
| Topic body, related materials and research records | Long text, compact section navigation, related-library scope, actual update notice and before/after changes |
| Literature, knowledge and code | Lists, filters, empty matches, details, contents/folders, Markdown/image/PDF/code reading, Git diff/history |
| Study notes and source selection | Empty list, retained draft, saved note, title search, selected-source disclosure, task/source-set controls |
| Right discussion and history | No discussion, New, switch/rename, current scope, next-message sources, citation return, draft/position retention |
| Menus, forms and failures | Keyboard focus/Escape, long names, loading, failed read and retry, partial/unknown save, permission denial |
| Presentation | Desktop/1024px/narrow windows, long Chinese titles and paths, long body/list, light/dark, Harness text sizing and native reader zoom |

### Native source reading

Opening a linked source keeps the current library frame and chooses its reader from the actual format. Markdown uses the native document reader, images use its image and zoom controls, and code uses Harness source rendering. Native tabs retain each located source and reading position; returning to the topic restores its previously visible discussion and unsent draft. A link to a differently classified source does not by itself switch the visible library.

Markdown relative links and local illustrations resolve from the Host-observed source links under the existing root permissions. Inline illustrations support the native image enlargement; opening an image as a source retains its zoom and scroll position. Recognized local anchors use actual source locators, while unavailable or unresolved targets remain explicit. No reader fabricates a Session to acquire file access, and displaying an image does not attach its pixels to a model request.

PDF content uses the same continuous reader as ordinary Harness documents and Office-to-PDF previews, through the typed `document.pdf.reader` factory. It retains native selectable text, zoom, fit-width behavior, loading and retry treatment. The research frame supplies its topic, explicit source/quotation actions and return path; it does not create a Session merely to obtain file access. Physical page, zoom and scroll position belong to the existing scope-aware view state. Prefetched pages do not count as the current reading page.

The Host reads complete PDF bytes under the existing source-root grant and binary limit; omitting the inline copy from a text observation does not disable preview. Current-page text is requested separately, so viewing beyond the initial extraction window still supports an exact quotation. Selection must stay inside one physical page; only whitespace differences between native text layout and the extracted text are reconciled, and ambiguous matches remain unresolved. Merely scrolling or zooming never changes sources already selected for a question. [14](14-implementation-blueprint.md#native-source-readers) owns this adaptation's checks and limits.

### Literature library and reader

A configured shared paper directory can live outside topic workspaces without moving files. The initial PDF-only view excludes extracted source-figure directories and displays a real arXiv identifier when available. Existing records without verified bibliographic fields remain unknown; the fuller collection and metadata behavior below is a design target, not an assertion that those fields have been imported.

Collection views and search filter by title, author, year, identifier, known edition, local availability and recorded reading state. Filters and list position survive returning from a paper. The indexed scope is visible: an incomplete index is never an empty library ([s2.1](prototype/harness-frame/screenshots/s2-1.png)). A work shows its editions and files, existing reading notes, linked knowledge entries and the project passages that use it. Collection membership points to the existing owner. Duplicate candidates stay separate and unresolved; a filename never proves edition identity.

The reader shows edition, PDF page and printed page separately and keeps one page-index convention, converted at one boundary. Selection creates an edition-bound excerpt and region. A jump to an equation number without a checked locator presents candidates instead.

Actions:
- **Ask about selection** in a scoped library opens or continues the direction's selected discussion in the left main area beside the right document, with the excerpt staged for the next question. Unscoped global browsing opens a local Session draft with origin Global and the attachment “attached, not sent”; it never inherits the last topic.
- **Add to existing session** queues the excerpt with the next message.
- **Compare with knowledge entry** opens the entry in the second region ([s2.2](prototype/harness-frame/screenshots/s2-2.png)).

Reading states show researcher, agent delivery and derivation explanation separately.

States:
- **Missing PDF**: known bibliography, Locate existing file, and a disabled Fetch explained as a later scoped capability; another edition is never substituted ([s7.2](prototype/harness-frame/screenshots/s7-2.png)).
- **Scanned PDF**: page viewing only, with selection marked unavailable until OCR.
- Reader loading never blocks open notes, and local active content never receives application privileges.

Later additions: stored highlights and annotations as edition-bound researcher records, full-text index, citation extraction, bibliographic import, metadata edits, duplicate merging and collection changes. Each is a scoped change with an inspectable proposal. P2 browsing creates no paper maps, knowledge entries or annotations in real files.

### Knowledge

Knowledge projects the existing AITP collection under [11's ownership rules](11-research-memory.md#knowledge-collection). Its landing view follows the collection's readable index, grouped by area and searchable by question, name and alias. An index row can open an explanation still maintained inside a research topic; browsing requires neither moving it nor creating an empty atom page. The navigator exposes the kinds present in the collection:

| Kind | Reading route |
| --- | --- |
| Reusable knowledge (atoms) | Question, statement, conditions, example, reasoning, limits and sources; concepts, theorems, techniques and results retain their distinct purposes |
| Source readings | Paper map and close-reading section notes in source order, with edition, page/equation locators, covered passages and the researcher's corrections |
| Learning stories | A developing chain of the researcher's questions, supported answers, open difficulties and links into atoms and source readings; one maintained main line |
| Author collections, when present | The selected author's reasoning moves and paper organization, linked to the source passages inspected |

An entry shows its assumptions, conventions and source locators. Support labels (`derived`, `source`, `unchecked`), who reviewed the claim, and reading coverage appear separately and as recorded, down to the claim or section when needed. The interface never marks researcher-read from agent delivery or page opening. A provisional research pointer is labelled as such and opens the owning argument with its qualifications; it is not displayed as an established atom. Prerequisites and related entries are ordinary links with an outline and back/forward. Where-used is bounded, and its searched scope is stated (“search covered ~/research notes only”).

The [shared study interface](#source-study) works over these owners. Saving an answer preserves its citations and attribution; it does not promote a research result to an atom or replace a source reading with a generated summary. Subdirection material links lead back to the same knowledge entry under the selected question's context.

Conflicting explanations stay side by side with their sources. An optional neighbourhood graph has a list equivalent and labelled edges; there is no global force-directed graph. Review of a passage or bounded set shows inspected scope, unread dependencies and the difference between a broken link and a scientific objection. Model review arrives with the review capability, and no entry-wide “verified” badge is inferred.

### Code workspace

The current global overview first lists explicitly configured Git checkouts. Opening a checkout reads only its immediate directory and observed branch/status; descending reads the selected directory. A topic-scoped overview includes a checkout only when an existing authored source link establishes that association. It does not equate a topic workspace with a repository or infer ownership from directory names.

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
| Panel entries and global panels | `sidebar.panellist`, `main` keyed slot, `ctx.layout.selectPanel` | Current Workspace; whether it is a research root | Research map and explicitly configured Markdown roots connected; general automatic root discovery remains limited |
| Topic navigator and topic home | Global panel; `useResource` | Topic projection: topics, opening passages with spans, Current work entries with clauses, pending choices, failed-route and branch passages, linked materials, Sessions by origin | Workspace map/topic/material provider implemented for Markdown; full legacy note projections and topic Session listings remain unconnected |
| Note reader | Panel region and dock tab type; `ResourceProtocolMap` | Note resource by address with spans and anchors; Session-independent read authority for configured research roots | Workspace and dock note readers have configured-root access; unique supported rendered selections map to raw intervals. Mathematical/cross-source selections and broader note projections remain incomplete |
| Session hover card | `sidebar.session.row.hover` | Session origin and task summary by Session id | Runtime origin retained; production bridge to the legacy hover-card resource missing |
| Origin chip, Sources & memory action | `conversation.session.header.actions` | Session origin | Real owner-scoped `aitp-session` bridge implemented; current scope comes from accepted Session events |
| Task card | `conversation.input.dock` | Working-memory projection: researcher items verbatim with event references, choice answers with question and option text, provisional agent items, gaps with requirement level, rules changed and adoption | Real task-card bridge implemented for original inputs, provisional items and omissions; rule-adoption provider remains missing |
| AITP transcript rows | `tool.call.toolview` | Logged AITP tool calls and results (reads, working items, method use, outcomes) | Native read/working/write tools logged in ordinary Sessions; dedicated research rows and Skill-use integration remain separate work |
| Sources & memory page | Dock page type; `useProjection` | Observation records: locator, why included, requirement level, located / sent / available / condensed / re-read / missing states; rules and Skills in effect with load state; summaries by compaction event | Real page bridge implemented with exact request snapshots, compaction/projection state and separate current-note reads; rule/Skill adoption remains missing |
| Library, knowledge, code readers | Independent catalogues, native root dock tabs, `ResourceProtocolMap` | Authorized source roots, physical PDF pages, authored knowledge labels, checkout identity, dirty paths, diffs and history | Local providers and complete native document presentation implemented and application-tested; semantic work/edition management, equation locators, knowledge prerequisites and cross-source reading coverage remain incomplete |
| Comparison tab | Dock tab type | Two resolved resources and locators | Uses reader data |
| Skill catalog and use view | Panel tab, dock tab type | All candidates for a name with source and precedence, loaded text per Session, current text for comparison, relationship record and its author, borrowed portion and dependencies | Registry exposes winners only; relationship record and source-qualified load missing |
| Distillation page | Dock page type | Proposal draft, diff, evaluation records, outcome states, evidence locators | Missing |
| Rules panel | Global panel | Effective rule projection with sources, scopes, revisions, adoption receipts; save to the chosen destination | Missing; Harness settings do not supply resolution or adoption |
| Agent questions, approvals, plan, goal, compaction marker, permissions | Existing Harness packages | — | Existing |

The workspace adapter and runtime working projection are implemented within the bounded Markdown scope. They do not supply every older UI-1 resource or the proposed rule, Skill and domain-reader views. Each item belongs to the owners in [10](10-project-workspace.md#harness-service-mapping); [14](14-implementation-blueprint.md#memory-backend-work) owns current evidence and open defects.

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

UI-1 needs research-root and topic projection, Session-independent note access, Session origin, working-memory and observation projections, and model-writable working items. The runtime and workspace adapter now supply the first bounded path. The optional real backend now supplies `aitp-session` and `aitp-note`; the task card and Sources & memory use accepted Session observations without starting an Agent. Exact recorded context and current source reads are separate. Per-file links retain unknown availability unless an actual per-file observation supports more. The broader rule/Skill and legacy note projections remain separate work.

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

**Component ownership.** Codex implements the client contributions and backend integration described in [14's crosswalk](14-implementation-blueprint.md#development-crosswalk), using Claude's completed design. `ui-aitp-research` and `ui-aitp-session` exist under `packages/client/`; the optional `ui-aitp-backend` connects the workspace adapter to the host service. The other packages below remain proposed reservations; agree their ownership before concurrent edits.

| Client package or proposed reservation | Owns | Consumes |
| --- | --- | --- |
| `ui-aitp-resources` | Resource protocols for notes, papers, knowledge entries, Skills and checkouts; the shared reader components; dock tab types and the comparison tab | Research-record, literature, knowledge, Skill and checkout providers through host remotes |
| `ui-aitp-research` | Research panel entry, topic navigator, topic home, Session hover card | Topic projection; Harness Sessions and their AITP origin |
| `ui-aitp-session` | Header actions, task card, AITP tool rows, Sources & memory page | Working-item, observation and rule-adoption projections; logged AITP tool calls |
| `ui-aitp-materials` | Materials panel tabs, Skill discovery report and use view, distillation page | Reader components; Skill candidates and method-use items; proposal and evaluation records |
| `ui-aitp-rules` | Rules panel and editor | Effective-rule projection and save operation |

Every package derives what it shows from backend projections or resources and keeps no scientific state of its own. Layout and navigation history are local view state. Product copy is locale-owned, as Harness requires.

**Required data and actions**, including the distinction between runtime support and unconnected legacy views, are listed in the [integration map](#harness-integration-map-and-missing-backend-information). **Acceptance per increment** is the walkthrough and state list named in [Increments](#increments). Run it in the application with scratch data, plus keyless recorded-Session snapshots for model-visible rows as Harness testing policy requires. The prototype check is design evidence only.

**Decisions that change UI behavior.**

1. Already listed as open product defaults in [14](14-implementation-blueprint.md#next-implementation-slice) and [current.md](../../current.md):
   - broader session-independent resource access defaults (configured Markdown roots already support browsing);
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
| 10 | [Harness service mapping](10-project-workspace.md#harness-service-mapping): Workbench and native host row; plugin table Workbench presentation and Desktop host rows | Name the ordinary Session dock and root-scoped native document slots, while keeping Session-independent source-root read authority explicit |
| 10 | Same table, Skill catalog row | Point to the use view's need for all-candidate listing and source-qualified loading |
| [11](11-research-memory.md) | [Memory user view](11-research-memory.md#memory-user-view) | Replace “Research record / Current sources / Pending integration” with the topic home, the task card and Sources & memory, and adopt the provenance and state vocabulary above |
| [13](13-research-journeys.md) | C01, C04, C08, C14, C16 and C22 acceptance paragraphs | Optionally reference W1–W6 as interface acceptance routes; coverage labels stay unchanged (synthetic demonstration only) |
| [14](14-implementation-blueprint.md) | Progress-table P1 row (“shared editors”), [P1](14-implementation-blueprint.md#p1) usable result and modules (“shared tabs and split panes”), and P1's Markdown navigation paragraph | Express P1's interface as UI-1 on the Harness frame: panel regions and dock tabs instead of editor groups; pane-local anchors per region and dock tab |
| 14 | Crosswalk rows Workbench shell, Skill catalog, Collaboration rules and Desktop attachment | Reference UI-1 to UI-6 and the backend data in the integration map; record the proposed client package reservations |
| [current.md](../../current.md) | Q05 (citations), Q09 (Session-free browsing), Q11 (progressive disclosure; still cites the Pi AgentDock) and Q16 (Skill use) | Point to this revision and its remaining backend dependencies; record the implemented root-scoped native document surface and its in-app retention limit; Harness compaction keeps shadowed rows visible |
