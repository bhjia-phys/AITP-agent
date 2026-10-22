# 03. Research model

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

`@aitp/core` reads the workspace into a model shared by the runtime and the workbench. Everything here is
**derived**: each value records its sources (path, content hash, span) and is rebuilt when they change. Nothing
here is a second home for research content, and no semantic summary replaces a source passage. Serializable
shapes are in 09; this document states their meaning and how they are built.

## 1. Entities

| Entity | Owner (source of truth) | Derived record |
| --- | --- | --- |
| Research location | A main note: `research.md`, an established TeX main note, a knowledge story, or a configured path | `ResearchLocation` |
| Root | `topics/research.md` | Directions, connections, seeds, agreed choices, standing agreements |
| Workspace and family maps | `topics/README.md`, family READMEs | Map links, groupings, code-location tables, standing rules |
| Live thread | One Current work entry | `ThreadEntry` |
| Instruction source | `topics/AGENTS.md`, rule passages of family READMEs, checkout `AGENTS.md`/`CLAUDE.md`, guidance files named by a method | `InstructionSource` |
| Plan | A plan file or section linked from a Current work entry | `PlanRef` (phases, operative phase) |
| Knowledge entry | Atom, story, question page, paper map, section note | `KnowledgeEntry`, with passage-scoped labels |
| Work, edition, artifact | Paper maps, the library, bibliographic metadata | `Work`, `Edition`, `Artifact` |
| Checkout and working tree | A git working tree linked from notes or maps | `CheckoutRecord`, `FileVersion` |
| Run and campaign | A run owner README and its receipts | `RunRecord`, `CampaignCoverage` |
| Method | A `SKILL.md` in an established home | `MethodRecord` |
| Episode | A closed session's log (runtime) | `Episode` (lower authority than notes; 05) |
| Selection | Any addressable passage of any of the above | `ResourceRef` (09 §2) |

## 2. Reading notes

`parseNote(location, text)` returns an outline and never throws. Whatever it cannot structure is kept as raw
spans with warnings.

**Parsing is pure; resolution is separate.** `parseNote` reads one text and touches no file. Its pointers
carry `resolved: null`, and its link anchors are unchecked. `outline` (the workspace model) then:

- resolves link targets and checks anchors against the target outlines;
- marks pointers resolved or not;
- loads linked plans with their phases.

- **Opening:** the text after the title heading and before the first `## ` heading (Markdown), or the abstract
  and introduction before the first section command (TeX).
- **Headings and anchors:** GitHub-compatible slugs with de-duplication, plus explicit HTML anchors
  (`<a id>`), plus TeX `\label{}`s.
- **Links:**
  - inline, reference-style (definitions anywhere in the file) and autolinks;
  - resolved relative to the containing file (by `outline`);
  - anchors checked against the target's slugs, anchors and labels (by `outline`); unresolved anchors are
    warnings;
  - a kind for each link: main note, note, code, data, figure, PDF, TeX, directory, arXiv, DOI, web.
- **Mathematics** is preserved verbatim.

### Current work

The section is the first heading whose text is "Current work" (case-insensitive). Entries are top-level list
items, or `### ` sub-headings with their following prose. Each entry keeps its **complete source span**.

Classification happens in this order:

1. **Pointer.** A bold name containing `→ [label](target)` is a pointer entry. Its prose is the contribution
   and limitation and is never used to infer state.
2. **Thread** (list item with a bold name) or **heading** (`### `), whose disposition is the text after the
   first dash up to the first ` · ` or sentence end, or the bold status line.
3. **Raw:** anything else.

**State** is normalized from the disposition after **whitespace normalization**, because real dispositions
break across lines (for example between "independent" and "analysis"). The patterns live in the parser module;
`fixtures/workspace/expected.json` freezes their observable results. They cover qualified forms:

- "waiting on the researcher's review" and "waiting on the learner's reproduction";
- "waiting on retained replay evidence" and "waiting on validated branch inputs";
- "waiting on a physical construction";
- "paused by the researcher", "stopped", "blocked on".

They report `unknown` when none applies. The UI always shows the disposition verbatim.

**Continuation** is extracted as a *suggestion*, labelled as inferred, with its source span. Cues, in order:

- a sentence beginning "Next:";
- "The next prerequisite/step/discriminator is…";
- "Start with…";
- "Before …, …";
- an imperative first sentence under a heading entry.

When no cue matches, there is no suggestion and the entry text stands alone. Phrasings outside these cues (an
embedded "assemble…", for example) are not guessed at. A suggestion is never an execution instruction.

**Tests check meaning.** Fixtures reproduce, synthetically, every real variant the survey found: multi-line
entries, heading entries with bold status, qualified dispositions, pointers with "unresolved" in their prose,
free-text states and prose-embedded actions. Tests assert the extracted state, pointer target, continuation
suggestion and spans, not merely that parsing did not fail.

### Scope flags

Scope is attached at the narrowest unit the note states, a location or a thread. One note can hold an active
analytic thread and a dormant numerical route. Flags:

- `analyticOnly`;
- `dormant`;
- `paused`;
- `deferred`;
- `executionExcluded` (for example "excludes local project execution").

Each flag records its source span. The researcher may override a flag; overrides are stored as grants, never
written into the note.

## 3. Locations, the graph and navigation

- **Discovery is link-driven and bounded.**
  - Start from the root note, the workspace README and configured locations.
  - Follow links to main notes; follow family READMEs.
  - Follow pointer targets and links to main notes in subdirectories.
  - A README table column headed "Main note", or a list item linking a main note, marks one.
  - Knowledge stories (`knowledge/topics/<t>/story.md`) are learning locations.
  - TeX main notes and unusual files are declared in configuration.
- **Exclusions.** A path is never a location if a segment is `provenance`, `snapshots`, `history`, `before`,
  `aitp-before`, `superseded`, `ref` (under `workspace/`), `.aitp`, `.git` or `node_modules`, or if it lies
  under `studying_note/`, unless the root links it directly (kind `record`).
- **The graph.** Nodes are locations, families and groupings; edges are typed links: uses, pointer-to,
  maps-to, cites. Scientific ownership is never inferred from directory proximity alone.
- **Scientific parents** of a location are:
  - the notes with a Current work pointer entry to it;
  - the notes its opening links while they link to it;
  - the root, for the topics its directions list.

  A mention elsewhere does not make a parent.
- **Navigation is a projection.** The research tree shows the graph as a tree, with the primary parent
  following the pointer or the map, and a node with several users listed under each. Unmapped `research.md`
  files found by a bounded listing (one level below known locations, skipping directories with more than 2,000
  entries) appear under "Unmapped".
- **Groupings** are display configuration:
  - one per root direction, whether the direction's section uses a table or a list;
  - one per family README;
  - researcher overrides in `groupings.json`.

  A grouping page renders its source sections verbatim.

## 4. Instructions and plans

**Instruction resolution** collects the instruction sources that apply to a task. The runtime delivers them as
instructions (04 §3), separately from research data:

- `topics/AGENTS.md` (workspace rules);
- the family README passages that state standing choices or rules, identified by their headings or by a
  configured span; for example a default setting the family has agreed on;
- for a code task:
  - the checkout's `AGENTS.md` or `CLAUDE.md`;
  - developer guidance files that the matching method names (for example a project's `develop_tips.md`);
- the root's agreed choices and standing agreements that concern the location.

Each source records its span and hash. A change to one is reported to the open sessions it affects.

**Plans.** A Current work entry that links a plan (a plan file, or a plan section) gets a `PlanRef` with its
phases and the operative phase if the plan marks one. Continuing that thread includes the operative phase's
passage.

## 5. Board and inbox

- **Board.** One row per Current work entry of every location, with its owner, grouping, form, state,
  disposition text, date, continuation suggestion and links.
- **Inbox** collects the items needing the researcher:
  - rows waiting on the researcher;
  - required-decision cards (choices, approvals, plans);
  - review reports not yet assessed;
  - distillation proposals;
  - uncertain external effects needing reconciliation.

## 6. Knowledge

Entries are read with their frontmatter:

- `kind`, `area`, `support`, `review`, `arxiv`, `version`, `reading_depth`, `close_reading`, `attribution`;
- **passage-scoped labels:** paragraph labels such as `[Imported]` and `[Reconstructed]`, and section-level
  support where the README allows support to differ within a note.

The index is read by area, as header rules plus the relevant area sections; the full 102 KB index is never sent
whole. The edit tools enforce the label rules:

- only the researcher sets `reading_depth: researcher-read` or `review: confirmed`;
- agent entries start `review: awaiting`;
- research results enter as provisional pointer rows citing their note.

## 7. Works, editions and artifacts

| Record | Meaning |
| --- | --- |
| `Work` | Bibliographic identity: title, authors, year, DOI, arXiv id without version |
| `Edition` | A specific version (arXiv `v2`, journal version) with its metadata and page numbering |
| `Artifact` | A local file of an edition: library PDF, TeX source, its content hash |

Locators are typed and bound to an edition and an artifact hash, with ambiguity retained:

- printed page;
- PDF page index;
- section;
- equation;
- TeX label;
- quoted text.

"p. 27" in a note is resolved as a printed page when the edition's page offset is known, and otherwise shown as
ambiguous with both candidates. Existing paper maps and section notes attach to their edition through the
`version` field.

## 8. Code

- **Checkouts** come from map tables, links to directories containing `.git`, and configuration. Each
  `CheckoutRecord` holds branch, HEAD, upstream, ahead and behind, dirty files and worktrees, from read-only git
  commands with timeouts.
- **Working-tree views** are keyed by file content hash, not by HEAD, so deliberate uncommitted edits are seen
  as they are. A `FileVersion` records path, content hash and whether it equals the committed blob.
- **Symbols.** A regex indexer for C++, Python and Fortran, cached per file hash. It is labelled *approximate
  navigation* everywhere.
- **Build and test receipts** are recorded by the runtime (04): checkout, file versions, command, environment,
  exit status, duration and output artifact. They are attached to the thread that requested them and are
  visible in the code and campaign views.

## 9. Runs and campaigns

- **Run owners.** A directory README linked from a note that contains run evidence: job ids with job,
  submission, allocation or array; `sbatch`; receipt files; dated observation sentences. `RunRecord` keeps job
  ids, clusters, receipts and observations verbatim, never a live state.
- **Campaign coverage.** When receipts are machine-readable (`raw-audit.json`, `campaign-complete.json`, coverage
  tables in a README), counts are read from them with their source spans: expected, retained, read back and
  accepted. A count is shown only when a receipt states it; nothing is computed by guessing.
- Live scheduler state comes only from a cluster query on request, stamped with its observation time.

## 10. Methods index

Roots:

1. AITP core Skills;
2. AITP domain methods with their READMEs;
3. topic and family `skills/*/SKILL.md` (bounded listing plus README links);
4. configured external skill sets.

`MethodRecord` holds the name, description, home, domain, topics, file version and the runtime's evidence of use
(05). The Skill file itself carries no runtime data.

## 11. Episodes

`Episode` is derived from a closed session's log:

- location, task, active-task identity;
- what was attempted and why;
- outcomes and failures with their conditions;
- evidence and artifact references;
- Skill versions used, note versions read and written.

Episodes are searchable per topic ("what did we try?"). They persist in the data directory, not in the
disposable index.

Their authority is lower than notes: they link the log and the owning note, show their date, and become stale
when a source they cite changes. They cannot authorize anything or override the current scientific account.
Consequential failures and corrected assumptions still belong in notes under AITP's write rule.

## 12. Documents

The document service is the only write path into notes and knowledge (code changes use the code tools within
granted roots).

- **Operations** each state their precondition:
  - `edit` (anchored, against a base version);
  - `create` (from a template or text; the path must be absent);
  - `move` (against a base version; the destination must be absent);
  - `copy-artifact` (places a binary artifact file, such as a figure; the destination must be absent).

  Link repairs after a move are generated at preview time as explicit `edit` operations and authorized with the
  rest.
- **Change sets.** One or more operations across files, previewed as one diff with a `digest` that approvals
  and restructuring reviews bind to. Preservation checks run first. They cover moved passages: every original
  sentence is present or has a disposition.
- **Guarantees** (02):
  - Changes are serialized among AITP writers and journalled.
  - Filesystem observers may see partial application.
  - Recovery completes or compensates only where version checks permit. Otherwise it preserves evidence and
    reports `recovery-required`, with an outcome per file.
  - A rollback never overwrites an intervening external edit.
  - For external editors the guarantee is best-effort detection, not prevention.
- **Anchors.** Quote (exact text, optional prefix and suffix), heading path, Current work entry (thread key),
  line range with expected text. An anchor must resolve uniquely, or the result is ambiguous with candidates.
  There is no global replace.
- **Snapshots** are immutable copies of the versions AITP observed or wrote, content-addressed. Versions
  referenced by an episode, an action, a review or an export are pinned when the reference is made. Others are
  kept for at least 90 days, plus the last 20 versions per path. History shows these versions plus Git history
  where the folder is tracked; it does not claim to be the complete history of external edits.
- **Policy checks** before any write: write mode and pilot list; ownership (04 §6); protected paths; knowledge
  label rules; scope flags.
- **External changes.** Polling: 2 s for open notes, 30 s otherwise. A change invalidates projections and marks
  open previews stale.
- **Git, when the folder is tracked.** Diff and log are shown beside the snapshot history. The service never
  commits.

## 13. Derived index

`<data>/index.sqlite` (`node:sqlite`, WAL, disposable):

- outline cache;
- FTS5 over heading-split notes and knowledge;
- the link graph (for "where is this used?");
- the board;
- knowledge, works, editions and artifacts;
- checkouts and file versions;
- symbols;
- runs and coverage;
- methods;
- episodes.

A full rebuild of the real workspace finishes in under 60 s within the memory budget; incremental updates follow
change events.

## 14. Projections in the UI

Pages show bounded source passages: the complete opening, Current work entries, using passages. Any semantic
extraction, such as a one-sentence answer or a continuation suggestion, is labelled as extracted and links its
source span. If extraction is not confident, the source passage alone is shown.
