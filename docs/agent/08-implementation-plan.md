# 08. Implementation plan

**Historical W/M delivery sequence.** [14 Development plan and progress](14-implementation-blueprint.md)
owns the active P0–P5 sequence, authorization and milestone state. This document retains
earlier stream ownership, conventions and baseline acceptance definitions. Use those
technical conventions where still applicable; its old priorities and role assignments
do not authorize implementation, commits or continuation today.

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

Revised after design round 1: six workstreams, contracts first, and a live GPT slice as the first integrated
milestone.

## 1. Roles

| Role | Who | Does |
| --- | --- | --- |
| Designer and integrator | Claude | Writes the design, the shared contracts (09) and every stream brief. Owns stream 1. Audits each stream, brings audited work into `aitp-agent`, runs the integration suite, commits |
| Design reviewer | GPT-6 Astra, reasoning `xhigh`, read-only | Reviews the design and contracts before fan-out. Gives second-opinion audits of authority, recovery and security code |
| Implementers | GPT-6.1 Sol, reasoning `high`, one Codex session per stream part | Implement a brief in their own worktree; fix audit findings in the same session (`codex exec resume`) |

## 2. Streams and ownership

Every path has exactly one owner. The exact rules are `agent/streams.json`, checked by
`test/integration/ownership.test.ts`.

- **S1** owns every package manifest, every package entry point (`src/index.ts`), the shared configuration, the
  contracts, the registry and composition files, the fixtures and the test support (`@aitp/test-support`).
- **Each other stream** owns its implementation directories, the tests beside them
  (`packages/<pkg>/test/<module>/`) and its notes (`agent/notes/<stream>-<part>.md`).
- **A stream changes only the paths it owns.** When it needs a change elsewhere (a contract, a dependency, an
  export, another stream's module), it records an integration request in its notes. Meanwhile it uses an
  explicit, temporary mock inside its own tests, and never an alternative contract. The integrator decides.

| Stream | Owns (summary; `streams.json` is exact) |
| --- | --- |
| **S1 Contracts and integration** (Claude) | Manifests, lockfile, shared configuration, `packages/protocol/**`, every `src/index.ts`, `core/src/{contracts,compose}.ts`, `runtime/src/{contracts,compose,registry}.ts`, `server/src/{contracts,compose}.ts`, `fixtures/**`, `test/**`, `docs/agent/**`, top-level documentation |
| **S2 Research core and documents** | `core/src/{config,paths,notes,locations,instructions,plans,board,documents,index}/**` and their tests |
| **S3 Pi runtime and agent behaviour** | `pi-adapter/src/**` except the entry point; `runtime/src/{models,sessions,context,compaction,controllers,review,export,cards,tools/interaction}/**` and their tests, including the conformance tests |
| **S4 Execution, authorization and server** | `runtime/src/{actions,sandbox,artifacts,effects,tools/workspace}/**`; `server/src/**` except the S1 files; `bin/**` |
| **S5 Research adapters and method learning** | `core/src/{knowledge,works,checkouts,runs,methods,episodes,manuscripts}/**`; `runtime/src/{methods,manuscripts,tools/research}/**` |
| **S6 Workbench** | `apps/workbench/**` except its manifest and tsconfig |

Interfaces between modules are declared by S1 in `core/src/contracts.ts`, `runtime/src/contracts.ts` and
`server/src/contracts.ts`. W0 left a typed placeholder in every module directory, which exports the declared
factory and throws "not implemented"; each stream replaces it. Wiring is the integrator's job
(`registry.ts`, `compose.ts`).

## 3. Waves and milestones

Two implementation agents run at once. The integrator runs no other heavy process meanwhile.

| Wave | Parallel parts | Depends on |
| --- | --- | --- |
| **W0** (Claude) | Contracts in code: protocol schemas and fixtures, the `contracts.ts` modules, the route and event tables. Workspace skeleton with every allowed dependency installed. Base fixture workspace with `expected.json`. Ownership manifest, import-boundary test, test support, typed placeholders. **Ends with Astra's review of the contract code and fixtures (round 3)** | Astra round 2 on 09 |
| **W1** | **S2-A** core reading: config, path guard, `parseNote`, locations graph and navigation projection, groupings, instruction resolution, plans, board, FTS index for notes ‖ **S3-A** pi-adapter (`ExecutionPort` on pi-durable and pi-ai; models, file credential store and login), sessions and active tasks, context assembly (channels, manifest, supersession, budget), instruction sections, compaction summary hook, log export | W0. S3-A codes against `CoreServices` with its own small fake; S2-A is concurrent |
| **W2** | **S4-A** authorized-tool wrapper and action records (proposal, approval, binding, reservation, revalidation); grants and defaults; the read-only workspace tools (`read`, `search`, `outline`, `board`); server (security, routes for the slice, WebSocket with epochs, CLI `init`/`serve`/`open`/`doctor`) ‖ **S6-A** shell, design system, home, grouping, topic and note views; agent dock (sessions, streaming transcript, cards, context tab, composer with steer and queue); settings for sign-in; against fixture mocks, then the real server | W1 integrated |
| **M1** | **Live GPT slice**, read-only, on a real topic (§5) | W2 integrated; the researcher's sign-in |
| **W3** | **S2-B** documents: change sets, anchors, locks, snapshots and pinning, journal, preservation checks, policy checks, external-change polling; full derived index with the link graph ‖ **S5-A** knowledge, works, editions and locators; checkouts, file versions and symbols; runs and campaign coverage; methods index; episodes; manuscript projects | W2 integrated |
| **W4** | **S4-B** sandbox (allowlist profile, self-test, `prlimit`, scratch, stdin scripts, admission), `run`, artifacts with provenance; `propose_changes`/`apply_changes`, `code_edit`/`code_write`; effects (operation ids, `uncertain`, reconciliation); typed git and cluster operations ‖ **S3-B** controllers and workers (plans from Skill prose, admission, budgets, steering, integration through one writer, restarts); review orchestration (signals, restructuring review before application, coverage, deduplication); complete export | W3 integrated |
| **M2** | Writes on **scratch copies** of real topics: authorization, conflicts with injected external saves, change sets, restructuring review | W4 integrated |
| **W5** | **S5-B** research tools: literature (search, compare, fetch through actions, `pdf_text`, `pdf_find`), cluster tools on S4's typed operations, `build_or_test` receipts, knowledge entries; `find_methods`, use records, distillation cues and proposals, transfer checks, distillation review; manuscript review threads and builds ‖ **S6-B** derivation workspace, formula–implementation–experiment, campaign, reader, literature, knowledge with where-used and impact, manuscripts, code, runs, board, inbox, methods, change-set and conflict views | W4 integrated; M1 passed; M2 passed for write-bearing acceptance |
| **M3** | One complete task in each workflow family (theory, computation, code, literature, learning, writing, workflows) | W5 integrated |
| **W6** | **S6-C** polish, accessibility, performance, the full browser suite, real-workspace screenshots (kept outside the repository) ‖ S1 final integration, usage guide | M3 |
| **M4** | Workers and method transfer on the pilot; researcher trials | W6 |

**Startup profiles** (`server/src/compose.ts`):

- **Read-only (M1).** The first start uses a fresh data directory. Restarts may reopen a store created by this
  profile when its marker matches the workspace and AITP configuration identity and write mode remains off.
  Unknown/full stores and change-set journals are refused. It registers only implemented capabilities that
  need no authority, and reports unavailable context sources instead of substituting empty results.
- **Full.** It always performs document recovery and action recovery before scheduling.

**Gates.**

- **M1 gates breadth.** If the only blocker is the researcher's sign-in when W2 is integrated, W3 and W4 (depth:
  documents, adapters, authority, recovery) proceed on fixtures. View breadth (S6-B) and the research tools
  (S5-B) wait for M1 to pass.
- **An actual M1 failure** stops the waves. Pi-dependent work is reassessed (route D against the agent-core
  fallback) before anything else is integrated; fixture success cannot waive the failure.
- **M2 gates writes.** It must pass before write-bearing acceptance in W5, and before any write to a real
  project.

## 4. Conventions for every stream

- **Layout.** npm workspaces under `agent/`: `packages/protocol`, `packages/core`, `packages/runtime`,
  `packages/pi-adapter`, `packages/server`, `apps/workbench`.
- **Language.** Node 24, ESM, TypeScript `strict`. Server-side code runs through Node type stripping: erasable
  syntax only (no `enum`, parameter properties or namespaces), `.ts` import extensions. Checked with
  `tsc --noEmit`, per package.
- **Dependencies.** All allowed libraries (§7) are installed in W0; the lockfile is never changed by a stream,
  and no stream installs anything. Pi packages are exactly `1.3.0`; implementations follow their installed
  typings.
- **Memory.** Assume about 3 GB free while the researcher works, until measured.
  - Every heavy command (typecheck, test run, build, browser test, dev server) runs under one shared lock:
    `flock "$AITP_HEAVY_LOCK" <command>`. `AITP_HEAVY_LOCK` is a single absolute path given to every agent, the
    same in every worktree.
  - The lock is held for the whole workload, including its child processes. No workload may leave a daemon or
    server running after it returns.
  - `NODE_OPTIONS=--max-old-space-size=1024`; 1536 only for `build:ui`. Heap limits are per process and do not
    bound total memory, so the lock does that.
  - Vitest runs one fork (configured in `vitest.config.ts`).
  - Typecheck the packages you changed, not the whole workspace.
- **Safety while building.**
  - Never write under the researcher's topics, knowledge, other repositories or the live AITP checkout.
  - Tests use temporary directories (`AITP_AGENT_HOME`, `AITP_AGENT_CONFIG`) and the fixtures.
  - Real-workspace checks are read-only and run only when `AITP_REAL_WORKSPACE` names a topics root.
  - No network in tests. Literature, cluster and git remotes are faked: recorded responses, a fake `ssh` on
    `PATH`, local bare repositories.
- **No git commits** by streams. The integrator commits after the audit.
- **Notes.** Each part ends with `agent/notes/<stream>-<part>.md`, covering:
  - what was implemented;
  - deviations from these documents, with reasons;
  - requests to other owners;
  - commands run with their results;
  - known gaps;
  - for each acceptance item, **what demonstrates it**: a fixture test, a scripted faux session, a
    walkthrough, an independent session, or live researcher use.

  Passing packaging tests does not establish scientific correctness, and the notes do not claim it.

## 5. Acceptance by part

Each part's brief repeats its items with exact fixture names. The essentials:

**S2-A**

- Every Current work form and the survey's real variants (synthetic) parse to the expected form, state, pointer
  target, continuation suggestion and spans. A property test shows `parseNote` never throws.
- Locations come from links, maps, list-based root directions, family READMEs, stories and configured TeX
  mains.
- Exclusions hold; bounded enumeration refuses large directories.
- Instruction resolution returns workspace, family-rule, repository and root-agreement sources with spans.
- Real workspace (read-only): the graph builds in under 60 s; at least 40 main notes are reachable; every
  Current work section parses; pointer targets resolve or are reported.

**S3-A** (faux provider)

- A session on a fixture branch sends a request where instructions and data travel in separate channels (09 §4),
  with the branch opening, Current work, parents' using passages and applicable instruction sources, all in the
  manifest with versions.
- After an external edit, the next request supersedes the old excerpt; `contextAt` shows the old one.
- A status interjection leaves the active task unchanged, and "continue" resumes it.
- Steer and follow-up behave as specified.
- Probes A, B, C and E pass as conformance tests against the port. Probe D tested the agent-core fallback and is
  not ported.
- Two further conformance tests settle what 09 §10 leaves open at 1.3.0:
  - a passive write is placed at once when the conversation is idle;
  - harness transactions outside tools are atomic.
- SIGKILL during a slow read resumes it.
- The compaction summary keeps the active task, decisions and action states.
- The export validates against `aitp.workbench-log@1`.

**S4-A**

- An approval binds arguments and target versions: a changed argument needs a new approval.
- A once-grant cannot be consumed twice (a concurrency test).
- A revocation is honoured on recovery: kill, revoke, restart, and the action is denied.
- The server rejects a missing token, a wrong Host and a foreign Origin.
- Every slice endpoint returns schema-valid data.
- The WebSocket resynchronizes after reconnects and epoch changes.
- Duplicate card responses are idempotent.

**S6-A** (fixture mocks, then the server in faux mode)

- Project-first navigation with breadcrumbs and multiple parents.
- Topic view with the complete opening and thread cards (disposition verbatim, labelled suggestion, "if this
  succeeds, what changes?").
- Note rendering with mathematics and hover previews.
- The agent dock streams; steer joins a running turn; cards render by kind; the context tab shows deliveries,
  supersessions and omissions.
- No overflow at 1024×768; AA contrast in both themes.

**M1** (live, read-only, real topic)

- The same three requests go to the workbench (GPT through pi-ai) and to the researcher's usual Codex workflow
  with AITP: a status question, a "continue" on a waiting thread to its decision point (read-only), and a
  context question about a parent's use.
- The comparison covers: correctness against the notes, sources cited, the context recovered, token use and
  latency and the read-only execution boundary. Before/after hashing is disabled.
- Exercised along the way: resume after restart, an external note change, a status interruption, and a forced
  compaction with the review request it queues.
- Results are recorded privately, outside the repository.

**S2-B**

- A change set across three files applies, with an outcome per file.
- Crashes injected at each step of application end, after recovery, in `completed`, `compensated` or
  `recovery-required`. None of them overwrites a version that changed in between.
- Creates refuse an existing path; moves refuse an existing destination; link repairs appear as explicit
  previewed edits.
- Moved passages pass the preservation check.
- An external save injected after the hash check and before the rename is detected and reported as a conflict,
  with its content kept where it could be captured. The documented residual races are tested as far as they can
  be.
- Write mode, pilot list, ownership and label rules are enforced.

**S5-A**

- Edition-bound locators keep printed-page and PDF-page ambiguity.
- An explicit read or refresh shows the current working-tree file. Hash invalidation is disabled.
- Coverage counts appear only when a receipt states them.
- Methods are indexed from all roots.
- Episodes are stale after a cited source changes.
- Manuscript projects are discovered from folders and README links.

**S4-B**

- A sandboxed command cannot read hidden paths or the data directory, cannot reach the network, and cannot write
  outside scratch and granted roots.
- `.git` in a writable root stays read-only.
- Outputs survive teardown as artifacts with provenance.
- Admission queues a second heavy command.
- Crashes at the three effect points behave as follows:
  - **before invocation:** the fake scheduler sees no job, and none appears unless an authorized new attempt is
    made;
  - **after acceptance, or before the receipt is persisted:** reconciliation finds the existing job by its
    operation id and records it, with no duplicate;
  - **inconclusive evidence** leaves the action `uncertain`, and no retry is possible from that state.

**S3-B**

- Probe B's scenario runs through the API: three workers, one cancelled, SIGKILL and resume, one integration
  write per settled result, and a disagreement kept open.
- Per-worker steering and budgets.
- A declared restructuring is reviewed before application, and application waits for the assessment.
- Compaction reviews are deduplicated, and a later review covers only new ranges.
- Reviewer sessions are never reviewed.

**S5-B**

- Literature search against recorded responses groups editions and duplicates; a fetch happens only through an
  approved action.
- `find_methods` ranks a topic Skill above an unrelated core Skill.
- A `contradicted` record lowers the current version's rank.
- A revised method is retrieved on a changed instance and set aside on an inapplicable one.
- A topic-home revision applies within authorization, with an undo card; an AITP-method revision is written only
  to the configured branch worktree.
- Nothing forces a note or Skill write.

**S6-B**

Each view of 06 §3 works against the server on fixtures, including:

- a disputed step and its check cards in the derivation workspace;
- a patch diff and an authorized test with its receipt in the formula–implementation–experiment view;
- coverage separate from scheduler observations in the campaign view;
- edition-bound selection in the reader;
- comparison tables and import previews in the literature view;
- where-used and impact in the knowledge views;
- paragraph threads becoming stale after their span changes in the manuscript view;
- three-way recovery in the conflict view.

**S6-C**

- The initial route bundle is under 400 KB gzip.
- Screenshot sets in both themes at 1440×900 and 1024×768.
- Keyboard paths work for palette, quick open, tabs and cards.
- Real-workspace rendering in faux mode produces no console errors.

## 6. Audit and integration

For each part, the integrator:

1. **Reads** the notes and the full diff. Checks that only owned paths changed and that contracts and the
   lockfile are untouched.
2. **Reruns** typecheck and tests outside Codex's sandbox (where bubblewrap works), and the browser suite for
   S6.
3. **Probes AITP semantics on the real workspace, read-only, where relevant:**
   - board rows against the notes;
   - the context manifest for branches in three families;
   - status mode makes no edits;
   - analytic-only threads expose no execution tools;
   - excluded copies are absent;
   - the read-only profile exposes no research-file write tool; no file-hash verification runs.
4. **Reviews security** for S3 and S4: token and origin checks, the path guard, the sandbox profile, action
   enforcement on recovery, secrets in logs and responses. Astra gives a read-only second opinion on these parts.
5. **Inspects the screenshots** (S6) against 06.
6. **Writes findings** (blocking, important, minor) with locations. Blocking and important findings go back to
   the same Codex session as a fix brief.
7. **Integrates** once blocking and important findings are resolved, or explicitly deferred with a rationale
   recorded in `agent/notes/integration.md`:
   1. stops the implementer and records its exact base commit and its complete diff, untracked files included;
   2. audits an explicit manifest of changed paths, which must all be owned by the part's stream;
   3. transfers exactly those paths into `aitp-agent`, including deletions, renames and executable bits, and
      verifies that no S1 file changed;
   4. compares the transferred diff with the audited one;
   5. wires `registry.ts` and `compose.ts`, runs the integration suite, and commits.

   Ownership is disjoint, so this is a transfer, not a merge. Stream worktrees are created from the latest
   integrated commit and removed after integration.

## 7. Allowed libraries

| Package | Libraries |
| --- | --- |
| protocol | `zod` |
| core | `yaml`, `github-slugger`, `diff`, `node-diff3`, `ignore`, `micromark`, `mdast-util-from-markdown`, `micromark-extension-gfm`, `mdast-util-gfm`, `micromark-extension-math`, `mdast-util-math` |
| runtime | `pdfjs-dist`, `fast-xml-parser` |
| pi-adapter | `@earendil-works/pi-ai`, `@earendil-works/pi-durable`, `@earendil-works/chord` (exactly 1.3.0) |
| server | `hono`, `@hono/node-server`, `ws` |
| workbench | `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `zustand`, `react-resizable-panels`, `cmdk`, `@tanstack/react-virtual`, `lucide-react`, `katex`, `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `github-slugger`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/search`, `@codemirror/merge`, `@codemirror/lang-markdown`, `@codemirror/lang-cpp`, `@codemirror/lang-python`, `@codemirror/legacy-modes`, `pdfjs-dist`, `@fontsource-variable/inter`, `@fontsource/source-serif-4`, `@fontsource/jetbrains-mono` |
| development | `typescript`, `@types/node`, `vitest`, `vite`, `@vitejs/plugin-react`, `puppeteer-core`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `happy-dom` |
