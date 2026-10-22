# 12. Desktop interface specification

Proposed interface, 2026-10-21. The [isolated prototype](prototype/README.md) demonstrates a subset using synthetic content. This document specifies intended behaviour; the prototype README distinguishes implemented interactions from static examples. Production UI remains unchanged.

## Layout and navigation

The recommended layout is a persistent resource explorer with a shared editor area. Compare three alternatives:

| Layout | Strength | Failure in research use | Decision |
| --- | --- | --- | --- |
| Overview with permanent right-hand chat | Easy first question | Discussion squeezes equations and PDF/code comparison; transcript dominates returns | Retain only as an optional two-group preset |
| Separate dashboard for each research mode | Immediate specialised controls | Moving from reading to derivation loses place and duplicates navigation/state | Reject fixed silos; modes configure editors |
| Shared resource and session tabs, optional inspector | Same paper can remain open beside code, derivation or discussion | Requires focus/history discipline and good tab names | Recommend |

```text
┌ ‹  ›  Project ▾ / Branch / Thread            Search or command           Host ┐
├────┬────────────────────┬─────────────────────────────────────┬──────────────┤
│ P  │ Research explorer  │ Overview   Thread   Note   Work ×   │ Inspector    │
│ L  │                    ├──────────────────┬──────────────────┤              │
│ K  │ Current project    │ primary editor   │ second editor    │ Source       │
│ N  │  Threads           │                  │                  │ Conditions   │
│ C  │  Subprojects       │ equation / PDF   │ work session     │ Relations    │
│ W  │  Ideas             │ / code / state   │ / comparison     │ History      │
│ ?  │  Resources         │                  │                  │              │
│ ⚙  │                    ├──────────────────┴──────────────────┴──────────────┤
│    │                    │ Activity · Runs · Problems                  hide  │
├────┴────────────────────┴────────────────────────────────────────────────────┤
│ WSL · root name       Read only          task state              connection │
└─────────────────────────────────────────────────────────────────────────────┘
```

P/L/K/N/C/W are accessible icon buttons with visible labels on expansion and tooltips: Projects, Literature, Knowledge, Notes, Code, Work sessions. Search is available from every screen. The inspector starts closed; the activity panel starts closed unless the current workflow needs it. The default project page is not four narrow columns.

At 1440×900: rail 48 px, explorer 248 px, optional inspector 288 px; editor takes remaining space. Title bar 44 px, tabs 36 px, status 24 px. Two editor groups have a minimum usable width of 360 px; if not available, collapse the inspector first, then offer a single group with tabs. At 1024×768 the inspector is a dismissible overlay, explorer can collapse, and a two-pane comparison can temporarily hide explorer. At 1920×1080 permit three groups; default to two. Below 900 px use one editor, never hide scientific content. Support 200% zoom through scroll/reflow; wide equations/tables scroll within their own region rather than the entire app.

Resize handles have a 6 px hit target, visible focus and keyboard increment controls. Layout, open tabs and scroll positions persist per workspace and window. Restore does not submit a prompt, resume execution, grant permissions or initialize a project.

### Tab and link semantics

- A single click opens a preview tab in the focused group; double-click or edit pins it. Explicit Open beside pins a second-group tab. Opening a source must not replace an unsent work draft.
- Tab title is the human object name, with a type icon; a short parent suffix disambiguates duplicates. The full path/edition/host is available in the tooltip and inspector, not forced into the title.
- Resource selection changes focused content. Adding it to AI context is a separate explicit action. Merely browsing a paper must not append it to a running session.
- Selection actions resolve within the originating editor group. Both selection endpoints must belong to the same resource and match the action's origin; a selection in one pane cannot be relabelled by clicking another pane's action. A cross-resource selection needs explicit separate attachments.
- Back/forward restores resource, group, locator and scroll. A sidebar activity change is in navigation history but does not alter an authorized task. Missing targets remain in history as unavailable entries.
- Closing a session tab hides it; running state remains in Work sessions. Closing the app offers clear runtime attachment information without pretending a disconnected task was cancelled.
- Shared paper/knowledge/code objects open once per group with contextual breadcrumb history; the same object can be intentionally pinned in two groups at different locators.

## Screen specifications

### 1. Project selection

Use a compact list with title, one source-backed question/description, last *observed activity*, and a text state such as “one decision waiting”. Pinned and recent projects are navigational preferences. Do not rank science by commit volume or declare a percentage complete. A family project shows its existing family description and child questions rather than inventing a common answer.

Top actions: Open existing project, New project, Global library. Opening an existing folder is read-only discovery. A proposed new project opens a draft form; in the initial read-only slice its final creation step is unavailable with an explanation. No note or session is created by opening either form.

Empty: “No projects attached” with explicit folder selection. Missing root: retain project and history, show reconnect/location repair. Discovery diagnostics distinguish ignored snapshots, unresolved links and excluded sources. Long names wrap to two lines; a tooltip exposes the rest.

### 2. Project overview

```text
Project / Topic                            New idea   New work session
Scientific question
Qualified current answer [source]    Decisive gap [source]

CURRENT WORK                           PENDING DECISION
Thread                     State       Choice and its scientific consequence
Relative construction      waiting     Open the evidence →
Control comparison         active

Subprojects and contributions          Ideas / open questions
Name → contribution + limitation       Seed / question → owning passage

Recent activity  [All | Science | Code | Runs | Sessions]
proposed change · committed code · finished run · reviewed argument
```

Question/current answer/gap are named source passages or an explicitly labelled extraction awaiting acceptance. Never silently synthesize prose at render time. If the parser cannot identify them, show the complete source opening with “Source opening” rather than empty invented fields. Default limit is visual height, with an accessible Expand control retaining complete text. Conditions remain attached to each claim.

Rows show exact disposition first, optional normalized state second. Waiting on evidence, waiting on the researcher, and paused are distinct. Clicking a child contribution opens the child owner; the parent does not restate its Next action. “No recorded next step” is meaningful and is not auto-filled by the agent.

### 3. Thread and decision

Header: title, project/owner breadcrumb, exact state and source. Main body: frontier, limitation, next action or pending choice, evidence list and relevant plan passage. Below: associated sessions and outcomes. Inspector: parent use, assumptions, related questions, earlier failed routes. Two primary actions: Continue in existing session and New session on this thread. When the choice is unanswered, Continue opens that choice rather than executing a guessed route.

The decision editor shows the alternatives, consequence, recommended option when recorded, rationale material, and existing authority. Responding records the user answer operationally; a scientific decision enters its owning note only through an authorized proposed change. The card must distinguish these two steps. A rejected proposal remains inspectable; it is not displayed as a scientific outcome.

### 4. Idea, new project and branch promotion

An idea is title plus free prose and source links, not an obligatory form schema. New idea opens a local draft that can be discussed without saving or promoting it. Save seed later proposes one insertion in the existing seed owner. “Develop into a branch” shows objective, approach, parent/contribution, success/stop criteria and proposed paths/links together. Choosing a name alone does not authorize branch creation.

The new-project form asks name, existing/new folder and question. The preview includes only agreed necessary files, uses existing homes, and explains whether files already exist. Back and Cancel preserve or discard the UI draft without touching sources. Duplicate path, inaccessible folder and conflicting parent choice receive inline errors; no destructive replacement button is the default.

### 5. Literature library and reader

Library opens globally without a selected project or a model conversation. Collection views and search can filter by title, author, year, subject, identifier, known edition, local availability and recorded reading state. Preserve filters and list position on return from a paper. Show the indexed scope and unavailable metadata; an incomplete index is not an empty library. A work detail links its editions/files, existing reading notes, knowledge entries and using project passages. Collection membership points to the existing owner rather than copying the material.

The explorer includes an optional project filter and recent reading. Group known editions under recorded work identifiers while retaining unresolved duplicate candidates; a downloaded filename alone does not prove edition identity. Avoid storing the same PDF under every project.

```text
Library ▾ [Project filter: All]     title / author / identifier search
Paper list                         Paper detail
Work A   v2  local                 metadata · source · editions · related notes
Work B   v1  missing               Open PDF       Open reading note

Reader editor                      Split editor
pages / outline                    source-reading note / derivation / session
PDF viewport                       selected equation with edition + page
PDF page 12 · printed p. 9          Ask / Compare / Link to question
```

P2 reading: local PDF rendering, page navigation/search, known edition and explicit PDF/printed page labels, selection-to-session with captured excerpt/region, existing reading-note links. Pagination must retain a page index convention; conversion to the existing protocol's one-based `pdf-page.index` happens at one boundary. A jump to equation number without a checked locator presents candidates; it never jumps arbitrarily and calls it verified.

Later: stored highlights/annotations with edition-bound rectangles or quotes, full-text search infrastructure, citation extraction, bibliographic import and cross-edition reconciliation. Annotation state is a user reading record with export, not transient editor layout and not evidence by itself. PDF replacement must preserve earlier annotations against their original edition; offer reconciliation rather than silently moving them. “Read by researcher” is a user assertion, never set by scrolling or model reading.

Read-only browsing may show duplicate candidates, existing classifications and metadata problems. Correcting metadata, changing collections, merging records, importing or deleting material are later scoped changes with an inspectable proposal. A duplicate title does not settle work identity or edition equivalence. Existing paper reading routes retain section/equation locators and unresolved steps; AI source coverage and explained-derivation coverage are separate from researcher reading state. See [C21](13-research-journeys.md#c21).

Missing PDF: show known bibliography and source link, with Locate existing file or a later authorized fetch. Scanned/no text: page viewing works; selection-dependent features say unavailable until OCR. Reader loading does not block already open notes. Local active content never gets application-origin privileges.

### 6. Knowledge workspace

Explorer: index questions, concepts and learning stories, with filters for support/review state. Main list prefers a scientific question and conditions over a tag cloud. Entry editor shows definition/result/derivation, assumptions and scope, source locators, support (`derived`, `source`, `unchecked`) separately from reviewer and reading-depth labels. These are the existing AITP labels; proposed claim-kind badges (hypothesis/open question) are another dimension, not replacement evidence grades.

Knowledge also opens globally as a wiki: subject index/search → entry → prerequisites, related entries or supporting paper → return to the original passage. Use ordinary links, an entry outline, breadcrumbs and navigation history with scroll restoration. Concept navigation coexists with source-ordered paper routes; expose the cited edition, section, equation and any unexpanded reasoning. Neither entering this view nor following a link creates a project or session. See [C19](13-research-journeys.md#c19).

Where-used opens projects and argument passages. Conflicting explanations remain side by side with their sources; the UI does not choose by recency. A small optional neighborhood graph can expose relations for a selected entry, with a list equivalent and labelled edge meanings. Do not begin with a global force-directed graph.

Review opens a selected passage or bounded set of entries beside its supporting sources and any existing findings. Show the inspected scope, unread dependencies and the distinction between a broken link and a scientific objection. P2 supports human inspection. New independent model review arrives with P3b and must also support a review that proposes no edit; later correction uses the shared proposal/application flow. An entry-wide or collection-wide “verified” badge cannot be inferred from a reviewed passage. See [C20](13-research-journeys.md#c20).

Creating a reusable atom is a reviewed promotion. A provisional source pointer can be sufficient; no empty page per noun and no automatic conversion of a chat answer into established knowledge. A learning story opens without needing a research topic folder.

### 7. Code and Git

Explorer: attached checkouts, each with host, path, branch and dirty indicator; inside, Files / Changes / History. Main editor shows source with line numbers, bounded search and symbols when supported. Repository context is always visible when two worktrees share a basename.

Changes has explicit Unstaged / Staged / Commit / Branch scopes and a separate “This work session” filter only when action provenance supports it. File and hunk diff can open beside a formula note. History names commit and repository; selecting a commit can start Explain or Review with that exact revision. File modification time does not associate a change with a research thread. Associate via a linked note/run or an explicit outcome record.

P2 is read-only. Open in VS Code is the native integration escape hatch; AITP retains selection/ref so returning rereads the actual source. Native editing, validated build/test receipts and grant-controlled Git actions arrive later. No staging, reverting, branch switching, installation or publication is triggered by inspecting a diff. Large/binary files get size/type and an appropriate viewer; truncated source is labelled.

Disconnected WSL: retain the selected checkout and last observation, disable live actions, offer reconnect. The UI never tries a same-looking Windows directory as fallback. Renamed/deleted files retain historical diff access where Git has it, with current-path status explicit.

### 8. Notes, derivation and manuscript editors

Notes explorer combines linked scientific notes with an optional physical file view. The editor offers Preview / Source / Compare, an outline and source-aware links. Display and inline mathematics must render; copy equation offers original LaTeX. Selecting a premise can open its source alongside the current argument. Highlighting a disputed step creates a proposed question/work session, not an automatic scientific label.

For a derivation, a two-pane preset opens argument and premises; the inspector lists conventions and the selected step's actual supporting links. Result status is plain source text until accepted metadata exists. A successful algebra program never relabels a physical claim. An analytic-only scope is visible and excludes execution capabilities.

For writing, a manuscript entry lists sources, bibliography, figures, build recipe and last retained output. Paragraph review opens comment/change proposal beside source and preview. P2 displays existing outputs; later approved builds add a receipt and artifact. Compilation success is not reference or derivation validation. The prototype does not implement LaTeX compilation or real note editing.

### 9. Work sessions

Work sessions are independently searchable by origin, intent, task state and time. An origin groups sessions without becoming a compulsory directory. The header shows a human title, origin chip, current authorized task and a compact state. Transcript is the editor body. Group ordinary tool steps as “Read 3 passages” or “Compared 2 files”, expandable to exact sources/actions. Keep raw IDs, token bookkeeping and transport epochs in diagnostics.

Session list rows include a short source subtitle when task titles coincide: paper edition/page, note/anchor or thread. The active editor's header shows its actual project or Global independently of the explorer's browsing filter. Returning to work must not require opening identical titles to discover their origins.

The composer defaults to continuing the present task. “Ask a side question” explicitly creates an interjection; the header continues showing the task. While busy, delivery is “Send into current work” or “Queue after current work”. These map to existing steer/follow-up semantics and must survive reload. Stop asks the runtime to stop; its result is shown separately from unknown remote effects.

Context drawer: origin, selected passages and why they were loaded, omitted inputs, applicable instruction sources, historical/current observation toggle. Removing a future attachment does not rewrite a past delivered context. Clicking a citation opens the matching captured passage or clearly identified current source; ambiguous locators show alternatives.

The session exposes the current objective and effective boundaries, with the source of a consequential user choice available on demand. Default delegation follows [10](10-project-workspace.md#research-control): routine next actions are autonomous inside those boundaries; material assumption, algorithm or direction changes return for discussion unless delegated. Adjustments express concrete scope or delegated choices, not an unexplained “autonomy level”. A UI suggestion cannot grant itself permission.

At a useful decision point, show a concise next-action explanation: the present gap, the proposed action, what its success could establish and any missing input or required choice. Ordinary work does not generate a card after every tool call. Distinguish “allowed and available”, “outside the agreement”, “capability unavailable” and “input missing”; scientific suitability remains an explained judgment. The researcher can redirect the action without changing unrelated constraints. The context drawer distinguishes located references, actual delivered ranges and declared unread prerequisites; “ready” is never displayed as a scientific-validity badge.

Outcome panel: No durable change / Proposed change / Applied change / Decision recorded / Run receipt / Unresolved question. Every item links to its real owner or receipt. “Done” on the task is not “accepted” on the science. Required questions remain visible across restart and cannot be bypassed by typing Continue. Existing grants are shown only where they affect the pending action.

### 10. Search and command palette

Quick open searches titles/paths/identifiers; full search returns passages grouped by resource type with active scope visible. Default is the selected project, with All projects one action away. Results show a matched excerpt, source type, location and observation state. Unknown/missing sources are distinguishable from zero matches.

The command palette exposes actions contextually: Open beside, Focus explorer, Work on selection, Show sources, Switch project, Show activity. Commands never imply broader permissions. Confirmation belongs to consequential actions, not navigation.

## Visual system

The interface is restrained and dense with a muted forest accent and warm neutral surfaces, as demonstrated by the prototype. Use subtle borders and rows for repeated information; use cards only for distinct decisions/proposals. Science has more typographic space than controls. No hero slogans, decorative gradients, agent avatars per message or metric tiles for “research productivity”.

| Role | Proposed token/value |
| --- | --- |
| UI font | Inter with system sans fallback, 13 px / 1.45; controls 13 px; captions 12 px minimum |
| Reading font | Source Serif 4 with serif fallback, 16 px / 1.65, width 68–80 characters |
| Code | JetBrains Mono with system monospace fallback, 13 px / 1.55, configurable independent of UI |
| Hierarchy | page title 24/30; section 16/22; body 14/21 in overviews |
| Spacing | 4, 8, 12, 16, 24, 32 px; normal row 36 px; compact row 30 px |
| Shape | control 5 px; surface 8 px; no nested pill containers |
| Light surfaces | paper/panel `#fdfdfb`, sidebar `#f4f4f0`; selection/border use semantic CSS tokens |
| Light accent | `#346b59`; primary/secondary text must meet the contrast gate below |
| Dark surfaces | paper/panel `#222a25`, sidebar `#1d2420`; selection/border use semantic CSS tokens |
| Dark accent | `#a4c799`; primary/secondary text must meet the contrast gate below |
| Focus | 2 px accent ring, 2 px offset, never removed without equivalent |
| State | icon + text; amber waiting, neutral paused, blue active; “accepted” only with actual evidence/review |
| Motion | 120–160 ms for disclosure/focus, respect reduced motion; no animated activity unless running |

These roles and geometry are target tokens, not a claim of measured prototype compliance. The isolated prototype's `app.css` and `prototype.css` own exact current colour pairs; implementations must consolidate them into semantic application tokens rather than copy contradictory values from two documents. Bundle fonts locally with their licences and keep fallbacks. Production acceptance computes contrast for all actual text/background pairs (normal text at least 4.5:1, large text/control boundaries at least 3:1), including selection and diff states. Status and diffs do not rely on colour alone. Inspect both themes at 1024×768, 1440×900 and 1920×1080 and at 200% zoom.

## Keyboard and accessibility contract

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Quick open | Ctrl+P | Cmd+P |
| Command palette | Ctrl+Shift+P | Cmd+Shift+P |
| Find in resource | Ctrl+F | Cmd+F |
| Workspace search | Ctrl+Shift+F | Cmd+Shift+F |
| Focus group | Ctrl+1 / Ctrl+2 | Cmd+1 / Cmd+2 |
| Open beside | Ctrl+Enter from resource list | Cmd+Enter |
| Back / forward | Alt+Left / Alt+Right | configured native equivalents |
| Escape | close overlay, then return to invoking focus | same |

Bindings respect text inputs and terminal/native browser reservations. Configurable collisions are surfaced; browser profile may expose menu alternatives. Buttons have accessible names, tablists use roving focus, dialogs trap focus and restore it, resize handles expose separator values. Streaming output announces concise status, not each token. Equations retain accessible source text. Tooltips supplement labels; they are not the only route to an action.

## State and transition acceptance

Every resource adapter has loading, empty, partial, missing, permission-denied, disconnected and ready states. Loading preserves prior content with an observation label. Empty distinguishes “none recorded” from “not indexed/unavailable”. Errors offer the smallest useful recovery without erasing selection or draft.

Transitions to test: project → thread → evidence → split discussion → side question → return; global library → selected edition → attach to project session; code diff → scientific formula → unchanged active task; rename/unresolved anchor → explicit repair; disconnect/reconnect during stream; restart with two groups and a waiting choice. Test focus, scroll, scope and task identity at every boundary.

Design evaluation asks a researcher to find an unresolved question, inspect its decisive evidence, start appropriately scoped work and return days later. Record hesitations, wrong destinations and corrective actions. Set initial targets of at most three purposeful navigation actions from project home to a known thread/source, no mandatory prompt to locate known resources, and zero silent loss of scope/conditions. These are prospective usability criteria; no human usability trial is claimed here.
