# 06. Workbench UX and visual design

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Artifact/source-span digest binding below is superseded. Show source locations and observation metadata without certifying content equality.

The workbench is a research workspace. The researcher works on the material itself (passages, equations,
code, runs, papers, manuscripts), and the agent acts on what is selected, beside it. The accepted prototype's
choices carry over:

- project-first entry and breadcrumbs;
- split reading;
- the separation of snapshot and current context;
- conflict recovery;
- the "if this succeeds, what changes?" question.

Revised after design round 1: a calmer default layout, and dedicated workspaces for derivations,
formula-to-code-to-experiment, campaigns, literature comparison, knowledge impact and manuscripts.

## 1. Principles

1. **Structure first.** Every screen answers: where am I, what does this note claim, which threads are live, what
   is the agent doing.
2. **Work on objects, not in a chat.** Select a passage, an equation, a code range, a figure, a PDF region or a
   board row, then ask, steer, check or change it. The agent dock follows the selection.
3. **Everything is linked, previewable and versioned.** Links open in tabs, hover shows the target passage, and
   a selection carries its version.
4. **Evidence and execution are never confused.** Support, review and reading labels look different from
   execution states.
5. **Calm by default, dense on demand.** The default is the navigator plus the working material. The dock and
   panels open when useful.
6. **Keyboard-first, mouse-friendly.** Command palette, quick open, pane and tab shortcuts.
7. **Editorial and scientific visual language.** Typography made for mathematics, restrained colour, no
   ornament without meaning.

## 2. Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ AITP  Research ▸ Direction 1 ▸ Screening ▸ Reference branch      [⌘K Search or command…] ◐ ⚙ │
├────┬──────────────────────┬──────────────────────────────────────────────────────────┬──┬─────┤
│ ▤  │ RESEARCH             │ ▣ Screening ✕ │ Derivation: eq. (5) ✕ │ +                │  │     │
│ ◫  │ ▾ Direction 1        │──────────────────────────────────────────────────────────│ A│     │
│ ✉4 │   ▾ Screening        │                                                          │ s│     │
│ ⎘  │     • Reference      │        working material (topic, note, derivation,         │ k│     │
│ ⚑  │     • Periodic       │        formula–code–experiment, campaign, reader,         │  │     │
│ ⋯  │ ▸ Direction 2        │        literature, knowledge, manuscript, code …)         │ ▸│     │
│    │ ▸ Unmapped (12)      │                                                          │  │     │
├────┴──────────────────────┴──────────────────────────────────────────────────────────┴──┴─────┤
│ writes: PILOT · sandbox ✓ · cluster-a ✓ · index ✓ · GPT ✓ · 1 task running ▸                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Activity bar.** Five primary activities: Research, Inbox and Board, Library (papers and knowledge), Code,
  Runs. Methods, Search and Manuscripts sit under "⋯". At widths of 1280 and above, all are shown.
- **Agent dock.** It starts as a slim rail with "Ask" and the running-task indicator. It expands to the full dock
  (`Ctrl+J`) when a session is active at the current location, or when the researcher selects an object and asks.
- **Bottom panel** (Work, Runs, Problems, Activity) opens when a task starts or a problem appears, and closes
  again.
- **Focus modes.** Reading and derivation collapse the navigator and bottom panel (`Ctrl+Shift+F11` restores
  them).
- **Persistence.** Tabs, splits (up to two, `Ctrl+\`) and pane sizes persist per browser, with failure tolerated.

## 3. Views

### 3.1 Home and groupings

- **Home:**
  - root directions as cards (first paragraph of the root section, member topics, live-thread counts by state);
  - inbox highlights;
  - recent sessions and their active tasks;
  - recent note changes that AITP observed or wrote;
  - running tasks;
  - connections and seeds rendered from the root.
- **Grouping page:** the root direction's section (table or list) and the family README map, verbatim, beside
  topic cards. Card text is bounded source text with a source link; no extracted "answer" is shown unlabelled.

### 3.2 Topic

- **Header:** title, kind, path, parents, and scope chips (each showing its source line).
- **The complete opening**, rendered.
- **Current work** as thread cards, each showing:
  - the disposition verbatim, with a state badge and date;
  - the continuation suggestion, labelled "suggested from text";
  - actions: open at source, continue in a session, **"If this succeeds, what changes?"**, add to scope.

  Pointer entries are branch cards showing their contribution and limitation.
- **Below:** branches, uses and used-by (the using passages), materials (papers, knowledge, checkouts, runs,
  artifacts), methods used here, and sessions.

**"If this succeeds, what changes?"** opens a compact panel with the original question (from the opening), the
proposed step, the expected discriminating outcomes and the remaining inference. It can be discussed in a
brainstorm session or kept as a seed through a change-set preview.

### 3.3 Note

- **Rendered view:** KaTeX, tables, code highlighting, an outline rail, link chips with hover previews,
  reference-style links resolved.
- **Source view:** CodeMirror 6 with Markdown and LaTeX highlighting and a live-preview split. Saves go through
  change sets with base versions; a conflict opens the three-way view.
- **Selection toolbar:** Ask, Explain this step, Derive the next step, Check this claim, Challenge, Open in
  derivation workspace, Add to scope, Cite elsewhere.
- **History:** the versions AITP observed or wrote, plus Git history where the folder is tracked, with a diff
  against any of them. The view does not claim to show every external edit.

### 3.4 Derivation workspace

For theoretical work: a passage, an equation or a short argument at the centre, with its context around it.

```text
┌ Derivation · methods/screening/research.md § "Static map" · eq. (5) · version a3f1 ────────────────────┐
│ PREMISES & CONVENTIONS        │  PASSAGE                                    │ CHECKS                     │
│ • definitions used (linked)   │  … rendered derivation, the disputed step   │ ○ independent route        │
│ • conventions: signs, units,  │    highlighted after "Mark disputed step"   │ ○ limiting case: t → 0     │
│   Fourier, normalization      │                                             │ ● dimension/sign check ✓   │
│   (from the note, instruction │  [Mark disputed step] [Ask for next step]   │ ○ completion audit          │
│   sources, cited passages)    │                                             │ results as cards, each with │
│ • cited source passages       │                                             │ route and evidence          │
└───────────────────────────────┴─────────────────────────────────────────────┴────────────────────────────┘
```

- **Requests** run in a theory session on the location: an independent derivation by a different route, a
  limiting case, a counterexample search, or a completion audit stating what the results establish and where the
  impasse is.
- **Results** appear as cards with their route and labels: derived here, imported from a source, or conditional.
  The workspace keeps "conditional algebra" visually distinct from "physical construction" when the note or the
  agent's report says which is which.
- **Changes** to the account are proposed as change sets in the owning note.
- In analytic-only scope, the checks offered are analytic only; no numerical check is offered.

### 3.5 Formula–implementation–experiment

For computational work linking theory and code:

```text
┌ FORMULA ───────────────────┬ IMPLEMENTATION ──────────────────────┬ EXPERIMENT ─────────────────────────┐
│ eq. (12) in note § …       │ checkout lib-main · HEAD 3f2c… dirty │ inputs (hashes) · build receipt      │
│ conventions, assumptions   │ src/screen.cpp:210–260 (version e9…) │ test/run receipts · outputs          │
│ rendered                   │ approximate symbols · git diff        │ acceptance check (fixed beforehand)  │
│ [Trace to code]            │ [Request patch] [Review diff]        │ [Run authorized test] [Compare figs] │
└────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘
```

Each column shows versions. "Request patch" opens a code session with the three columns as scope. The patch
arrives as a diff card, and applying it needs the `code-write` grant for that root. "Run authorized test" creates
an action with its bound command and limits. Results link back to the thread that asked.

### 3.6 Campaign view

From run owners and machine-readable receipts:

- coverage as recorded: expected, retained, read back, accepted, each with its source span;
- failed and missing cases;
- read-back evidence and its scripts;
- **separately**, scheduler observations stamped with their time and cluster.

Actions: query the scheduler now; propose a read-back analysis (a plan); open the run owner.

### 3.7 Paper reader

```text
┌ Work: An example paper · Edition 2101.00001v2 · artifact paper.pdf (hash 77c…) · reading depth: AI-read ┐
│ ┌ PDF (pdf.js) ▸ PDF p.7 = printed p.27 ─────┐ ┌ Map │ Section notes │ Q&A │ Files ┐                     │
│ │ [selection] ─► Explain · Challenge ·        │ │ …                                │                     │
│ │               Try this step (optional)      │ │                                  │                     │
│ └─────────────────────────────────────────────┘ └──────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Selections** bind to an edition and artifact hash with a typed locator: PDF page, printed page, section,
  equation, TeX label or quote.
- **Ambiguous locators** in notes show both candidates.
- **"Try this step"** is an optional practice card; explanations are never withheld behind it.
- **New notes** use the collection's templates. Only the researcher can set "researcher-read".

### 3.8 Literature discovery and comparison

- **Search** across arXiv, INSPIRE and Crossref metadata and the local library. Results are grouped by work, with
  editions and duplicates marked and local artifacts flagged.
- **Citation chaining:** references and citations where the service provides them.
- **Import preview:** what will be fetched, where it will be stored, and which paper map stub will be created.
  Applying it is an action (`library-write`).
- **Comparison table** for selected sources:
  - objects;
  - conventions (sign, normalization, units, gauge);
  - regimes;
  - decisive passages (locators);
  - agreement, different scope, competing assumption or contradiction.

  It is produced in a session as an artifact. It can be saved as a supporting note through a change set, and the
  bridge between the sources stays explicit.

### 3.9 Knowledge, where-used and correction impact

- **Index areas and entries,** with filters for kind, support, review and reading depth. Entries show
  frontmatter and passage-scoped labels.
- **Where is this used?** For a passage, an entry or a note section: every use across notes, readings and index
  rows (from the link graph), with relationships the graph cannot establish marked unknown.
- **Correction impact.** When a claim changes, the dependent uses are shown together, with proposed coordinated
  corrections as one change set. Decisions and turning points are shown from their owning passages, with episode
  recall beside them at lower authority.
- **Learning routes** start from a story or question page, without creating a research topic.

### 3.10 Manuscript projects

A manuscript project is a folder with sources (TeX or Markdown, several files), bibliography, figures, a build
recipe (Makefile, `latexmk`-like sequence, or a configured command) and its output. Projects are discovered from
`manuscripts/` folders and README links, or declared.

- **Panes:** a source tree, the PDF preview, and a **paragraph review** pane.
- **Review threads** are bound to a source span hash and keep their status (open, addressed, resolved) and
  author (researcher, agent, external model). A thread becomes stale when its span changes.
- **Coordinated revision.** The abstract, body and captions change in one change set.
- **Builds** run as actions in the project folder; errors link to source lines.
- **Workspace policy** (for example JHEP for this workspace) comes from instruction sources, not code.

### 3.11 Code, runs, board, inbox, methods, settings

- **Code:**
  - checkout header (branch, HEAD, upstream, dirty, worktrees, and deliberate-change warnings from the map);
  - a `.gitignore`-aware tree;
  - a viewer keyed by working-tree version;
  - approximate symbols, search, log and diff;
  - diff cards for agent changes;
  - build and test receipts.
- **Runs:** run owners, receipts, observations verbatim, figures and artifacts with provenance.
- **Board:** a virtualized table of all threads (owner, thread, state, disposition verbatim, date, suggestion)
  with filters and grouping.
- **Inbox:** threads waiting on the researcher, required-decision cards, review reports, distillation proposals,
  and uncertain external effects to reconcile.
- **Methods:** the library by home and domain; a method page with the rendered Skill, where it was used,
  validations, corrections, contradictions and transfer checks.
- **Settings:**
  - models and sign-in, with the pi-ai login events shown (authorization URL, device code);
  - roots and explicit locations;
  - write mode and pilot topics;
  - preview preferences;
  - clusters;
  - the sandbox self-test;
  - grants (list, revoke);
  - theme.

## 4. Agent dock

- **Header:** location, active task chip ("Continue" when it has an unfinished action), mode preset and session
  switcher.
- **Scope bar:** the objects in scope, each with its version. Stale objects are marked, with "refresh to
  current". Items enter by selection actions, by dropping them, or from the context manifest.
- **Transcript:** virtualized and streaming. Thinking summaries collapsed. Tool activity grouped and expandable.
  Cards appear by kind:

| Kind | Cards |
| --- | --- |
| Informational | Change set applied (diff, versions, undo), run finished (receipt), artifact exported (provenance), close report, review report (findings and the main agent's assessment; a restructuring's report is informational, and application waits on that assessment) |
| Optional response | Exercise, "add this artifact to the note?" |
| Required decision | Approval (bound action, scope, limits), choice, plan (methods used, steps, cost, stopping, grants), conflict (three-way view), distillation proposal, uncertain effect (reconcile again, with the evidence found so far) |

- **Composer:** `Ctrl+Enter` sends. Each input has a purpose (task, interjection, continue).
  - While a turn runs, sending queues the input as a follow-up, and **Steer** places it after the current tool
    round instead.
  - Slash commands: `/continue`, `/status`, `/plan`, `/handoff`, `/review`.
- **Tabs:** Context (the manifest with deliveries, supersessions and omissions, plus what changed since you last
  looked) and Methods (in play, with outcomes).
- **Figures:** shown with provenance (artifact, script, inputs). Two figures can be compared side by side or
  overlaid when their axes match.

## 5. Interactions

- **Command palette** (`Ctrl+K`), **quick open** (`Ctrl+P`), **global search** (`Ctrl+Shift+F`).
- **Deep links:** `/topic/<path>`, `/note/<path>#<anchor>`, `/derive/<ref>`, `/fce/<ref>`, `/campaign/<path>`,
  `/paper/<work>?edition=&loc=`, `/lit/<query>`, `/manuscript/<path>`, `/code/<checkout>/<file>#L<n>`,
  `/session/<id>`, `/board?state=`.
- **Notifications:** required decisions, task completion, review reports, connection loss.

## 6. Visual design system

The design system is unchanged from the first version:

- warm paper and ink in light mode, deep graphite in dark mode;
- one accent and the state colours;
- self-hosted Inter (interface), Source Serif 4 (notes, at 16 px and line height 1.65) and JetBrains Mono (code);
- a 4 px spacing scale, radii of 6 and 10 px, hairline borders, shadows only on overlays;
- outlined pills for support, review and reading labels, filled badges for execution states;
- KaTeX tuned to the serif, display math scrolling within its block;
- motion of 120–180 ms, off with reduced motion.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F7F5F0` | `#15171A` | Window |
| `--panel` | `#FFFFFF` | `#1C1F23` | Panes, cards |
| `--panel-sunken` | `#F0EDE6` | `#121417` | Navigator, panels |
| `--border` | `#E3DED3` | `#2A2E34` | Dividers |
| `--text` | `#1F2328` | `#E6E8EB` | Text |
| `--text-muted` | `#5F6670` | `#9AA3AE` | Secondary text |
| `--accent` | `#2F5D8A` | `#7FA8D6` | Actions, focus, links |
| `--accent-weak` | `#E5EDF5` | `#22303F` | Selection, hover |
| `--state-active` | `#2F6FBA` | `#6FA3E0` | Active |
| `--state-researcher` | `#B7791F` | `#E3B35E` | Waiting on the researcher |
| `--state-analysis` | `#6B4FBB` | `#A890E8` | Waiting on analysis, run, integration |
| `--state-paused` | `#5B6472` | `#9AA3AE` | Paused, stopped |
| `--state-dormant` | `#8A8F98` | `#6B717A` | Dormant |
| `--state-deferred` | `#8C7B65` | `#A8977F` | Deferred |
| `--state-proposed` | `#1F8A8A` | `#5CC7C7` | Proposed |
| `--state-concluded` | `#2E7D4F` | `#6BC48F` | Concluded |
| `--danger` | `#B42318` | `#F07467` | Conflicts, failures, uncertain effects |
| `--success` | `#2E7D4F` | `#6BC48F` | Applied, validated |

## 7. Accessibility, performance, installation

- **Accessibility:**
  - ARIA roles for tree, tabs, dialogs and listboxes;
  - labelled icon buttons and visible focus;
  - AA contrast in both themes;
  - polite live regions;
  - focus restored when cards and dialogs close.
- **Performance:**
  - virtualization (board, transcript, trees, long notes);
  - Markdown rendering memoized per version;
  - pdf.js, CodeMirror and KaTeX lazy-loaded;
  - route-level code splitting;
  - no full re-render on stream deltas.
- **Honest states.** Empty, loading and error states describe the real capability. Demo and disconnected
  banners.
- **Installation.** A PWA (manifest, icons, app-shell service worker); `aitp-agent open` opens an Edge app window
  from WSL (02).
