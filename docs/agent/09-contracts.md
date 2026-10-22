# 09. Shared contracts

The linked schema/service code describes the current API. [10 Target architecture](10-project-workspace.md)
describes its proposed evolution, and [14 Development plan](14-implementation-blueprint.md)
owns the implementation stage. Proposed version-2 origins, context homes and citation
semantics are not available merely because they are documented. Change contracts and
consumers together within the authorized stage; preserve compatibility explicitly.

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

The contracts between the streams are **code**: this document explains them, and the code is normative. They
were written in wave W0 and reviewed by Astra in round 3. Fan-out followed the fixes that review required.
From then on they change only through the integrator, with updated fixtures.

| Where | What | Owner |
| --- | --- | --- |
| `agent/packages/protocol/src/` | Serializable contracts as zod schemas with inferred types: references, research records, documents, sessions, context, actions, cards, reviews, workers, methods, manuscripts, models, configuration, audit events, the export format, API errors, events and the route table | S1 |
| `agent/packages/protocol/fixtures/` | Representative JSON examples of every serializable contract, validated by `packages/protocol/test/` | S1 |
| `agent/packages/core/src/contracts.ts` | Callable interfaces of the research core and their factory signatures | S1 |
| `agent/packages/runtime/src/contracts.ts` | The execution port, state transactions, tools, hooks, task shells, the models port, watches, runtime services and their factories | S1 |
| `agent/packages/server/src/contracts.ts` | The HTTP server surface the composition root calls | S1 |
| `agent/streams.json` | Which stream owns which path, checked by `test/integration/ownership.test.ts` | S1 |
| `agent/test/support/` | `@aitp/test-support`: a fixture workspace with a valid configuration, and in-memory state | S1 |

Pi types never appear in these contracts. Only `@aitp/pi-adapter` imports Pi, and it imports the runtime
contracts type-only (`test/integration/import-boundaries.test.ts`).

## 1. Conventions

- **Schemas and types share a name.** `export const X = z.object(…)` and `export type X = z.infer<typeof X>`.
  Tagged unions are built from object schemas, with shared fields spread into each variant.
- **Primitives.**
  - `Hash` is `sha256:` plus 64 lowercase hex digits, validated through `z.templateLiteral`.
  - `JsonValue` is `z.json()`, which rejects non-finite numbers.
  - Size limits: the server enforces the raw UTF-8 request-body limit before JSON parsing. `checkJsonLimits` then
    bounds the decoded depth before recursive schema validation, and the encoded size.
  - `canonicalJson` gives every hashed value (approval bindings, change-set digests, request fingerprints) one
    form.
- **Paths.** `WorkspacePath` is POSIX and relative to `workspace.root` (by default the parent of `topicsRoot`),
  without `..`. Anything outside the root is an `AbsolutePath` under a configured root, which the path guard
  checks.
- **Requests.** Every mutating request carries a `requestId`. A repeat with the same body fingerprint returns
  the original result; a repeat with a different body fails with `request_reused`. Pi deduplicates inputs by id
  without comparing content, so the runtime compares fingerprints itself.
- **Fixtures.** Every example must parse and round-trip unchanged (no key dropped). The required list in
  `fixtures.test.ts` names the contracts two streams agree on.

## 2. References

- **`Address`** says where a thing lives. The kinds are:
  - workspace path;
  - absolute path;
  - URI;
  - artifact file;
  - snapshot;
  - episode;
  - conversation entry;
  - action.
- **`Locator`** says where inside it, and keeps typed page forms apart: PDF page, printed page, section,
  equation, TeX label, region.
- **`ResourceRef`** adds a kind, a version, a locator, ambiguous alternatives and an edition binding.
- **`FrozenRef`** is the form used for scope items, approval targets and evidence:
  - it needs a version unless the address is immutable (snapshot, artifact file, conversation entry); actions and
    episodes change, and no kind is exempt;
  - page and region locators need their edition and artifact hash;
  - a region is non-empty and lies within its page.
- **`ThreadRef`** identifies a Current work entry by its owning note and a key derived from its name. Sessions,
  grants, scope flags and the UI all use it.
- **`projectionOf(T)`** wraps a derived value with its sources and freshness. Semantic extraction is labelled
  (`suggestion`, `summary`) and never replaces the source passage.

## 3. Research records

The research core's outputs:

- `ResearchLocation`, `Outline`, `ThreadEntry` and `ThreadRow`;
- `Graph` with its navigation projection, and `Grouping`;
- `InstructionSource`, `PlanRef`, `Use`;
- knowledge entries with passage labels; works, editions and library artifacts; locator candidates;
- checkouts, working-tree `FileVersion`s, approximate symbols and receipts;
- run owners, campaign coverage and cluster observations.

The observable behaviour is frozen by `agent/fixtures/workspace/expected.json`:

- the kind and parents of each location;
- the form, state, date, pointer and continuation of every entry;
- instruction sources, plans, runs, methods and knowledge;
- the edition offset.

Parser patterns and ranking weights stay inside their modules.

## 4. Sessions, inputs and context

- **Purpose and delivery are separate.** `purpose` is `task`, `interjection` or `continue`. `delivery` (what
  happens when the conversation is busy) is `steer`, `follow-up` or `reject`.
  - The active task changes only when a `task` input is **placed**, not when it is admitted.
  - Task-specific data for a queued input travels inside that input as `DataBlock`s. Pi places follow-ups only
    at a final boundary but passive writes at every boundary, so separate delivery could enter the running turn
    early.
- **Preparation is separate from placement.** `ContextService.prepare` puts an input's task-specific data
  inside the input and records the manifest; it submits nothing. The session then submits that input once.
  Request deduplication fingerprints the original request and reuses its persisted preparation; it does not
  regenerate different data under the same request id.
- **Delivery.** `DataDelivery` is one passive entry: data blocks plus the context edits (`omit`, or `replace`
  with a pointer) that hide their predecessors.
  - It has a deterministic request id.
  - Its receipt reports admission first, then placement with the entry id. Await admission, never placement,
    inside a tool round that must finish first.
- **Edits target context items.** Pi edits whole entry contributions, while one input can hold the researcher's
  request and several data items. The adapter therefore:
  - groups the edits by their containing entry;
  - reconstructs that entry's model contribution, preserving the request, images and unaffected items;
  - omits the entry only when nothing remains.
- **Sessions and active tasks** carry their thread (`ThreadRef`) and their frozen scope.
- **`ContextItem`** records the channel, role, reason, tokens and status of one item. Data items carry their
  delivery; instruction items carry their section and rendering hash.
- **`ContextManifest`** budgets the whole request.
- **After an applied compaction,** the current versions of in-scope items are delivered again
  (`afterCompaction`). Omitting an old entry does not remove what a summary has already absorbed.

## 5. Actions and grants

`ACTION_TRANSITIONS` is the state machine; `ActionRecord` validates its history against it, and every record
starts as `proposed`.

```text
proposed → approved | denied | cancelled
approved → reserved (consumes a once-grant in the same transaction) | revoked | cancelled
reserved → executing (committed with the operation id before any invocation) | revoked | cancelled | interrupted
executing → done | failed | interrupted
interrupted → uncertain (effect kinds) | failed (local kinds)
uncertain → done | failed (only by conclusive reconciliation; inconclusive evidence leaves it uncertain)
```

- **Grants.** A `Grant` scope is discriminated and carries its identity: once, task, session, location, thread
  or workspace. A thread scope is bound to the entry's version, so a changed entry is a different scope.
  - Once-grants and plan grants must bind the canonical execution-argument hash and the target versions. A plan
    approval creates one bound grant per step.
  - A `GrantRequest` can carry roots, clusters and scope-flag `overrides`. Only the researcher creates grants
    with overrides; the service enforces it.
  - `run-read` is the authority for sandboxed read-only commands, given by a default workspace grant.
- **Effects.** `EFFECT_KINDS` are the operations that need reconciliation after an interruption, local commits
  included.
- **Uncertain effects.** An uncertain-effect card accepts only "reconcile again". No response bypasses the
  uncertainty rule; a manual, evidence-bearing resolution is future work.
- **Repeated calls.** A repeated call names the approved action in the reserved argument `approval`, which is
  excluded from the hash. Without it, a call proposes a new action. Matching arguments alone never decide that
  two calls are the same operation.
- **Retries.** A new attempt is a new record with `retryOf`. It may follow only `failed`, `cancelled`, `denied`
  or `revoked`, never `uncertain`.
- **Recovery.** Recovery re-enters the authorized-tool wrapper only for replay-safe tools. Unsafe operations
  are reconciled by startup recovery, not rerun.
- **Startup order** (`server/src/compose.ts`):
  1. open storage without scheduling;
  2. recover change-set journals;
  3. scan the action records;
  4. start scheduling.

## 6. Documents

- **Preconditions.** Every `DocumentOp` states one: base versions for edits and moves, absence for creations and
  destinations.
- **Moves.** Link repairs after a move are separate edits, generated at preview time and authorized with the
  rest.
- **Binary files.** `copy-artifact` places a binary file such as a figure.
- **The change set's `digest`** binds approvals and restructuring reviews. A substantive revision gives a new
  digest and invalidates the earlier assessment.
- **Guarantee, stated honestly:**
  - Changes are serialized among AITP writers and journalled.
  - Filesystem observers may see partial application.
  - Recovery completes or compensates only where version checks permit. Otherwise it preserves evidence and
    reports `recovery-required`.
  - A rollback never overwrites an intervening external edit.
  - `FileOutcome` reports each file.
  - Journals stay internal; the API exposes `RecoverySummary`.
- **Snapshots** are immutable copies of versions AITP observed or wrote. Inode preservation (a hard link before
  the rename) is only an additional detection mechanism, because a hard link can track later in-place
  mutations.

## 7. Cards

`Card` payloads and `CardResponse`s are typed per card type:

- **Informational** cards change nothing about the run: change set, run, artifact, close, review report.
- **Optional** cards may be answered: exercise, artifact placement.
- **Required** cards end the run, and the answer arrives as the next input: approval, choice, plan, conflict,
  distillation, uncertain effect.

A restructuring review result is informational. Application waits for the main agent's assessment, which must
clear the gate for the same digest. A required card appears only when a human decision is unresolved.

## 8. Reviews

- **`ReviewRequest`** follows the reviewer Skill's coverage rule:
  - every part of the log no earlier review inspected, gaps included;
  - the whole session at handoff, session end and delegation (enforced by the schema);
  - the researcher's messages across the whole session, always.

  A restructuring review names the change set's digest and baselines. Merged duplicate triggers are recorded.
- **`ReviewReport`** is submitted through the reviewer's report tool, with structured findings.
- **`ReviewAssessment`** is the main agent's verdict on each finding. `clearsGate` says whether the assessed
  change may be applied.

## 9. Workers and tasks

- **Plans.** `WorkerPlan` instantiates the roles and stopping condition a Skill describes in prose. A
  `PlanProposal` lists its bounded steps and the grants they need.
- **Workers.** `WorkerRecord` keeps admission, budget, usage, restarts, `retryOf` and reassignment as AITP
  records.
- **Integration chain** (Pi joins only on `allSettled` or `failFast`):
  - in one transaction before the worker becomes terminal, its completion installs its integration task
    (`StateTransaction.startTask`, with its idempotency binding), the predecessor link and the new controller
    tail;
  - integration tasks belong to the live controller, so Pi accepts their owner;
  - one integration therefore writes at a time, in completion order;
  - the controller waits for the workers and then for the final integration tail;
  - `TaskShellContext.waitIdle` waits for a worker conversation the task owns.
- **Retries.** `ExecutionPort.retryTask` returns a new task with `retryOf`; Pi cannot revive a terminal task.
- **Task views.** `TaskView` composes Pi's live task graph with AITP admissions and retained history.

## 10. The execution port and its mapping onto pi-durable 1.3.0

`ExecutionPort` (`runtime/src/contracts.ts`) covers what the runtime depends on. The mapping was checked against
the installed 1.3.0 typings and build:

| Port | pi-durable 1.3.0 |
| --- | --- |
| `open`, `startScheduling` | `Harness.open` dispatches nothing; `resume()` enables scheduling. Calls that ask for progress (submit, idle waits) also enable it, so startup recovery runs before any of them |
| `transact`, `read` | A serialized transaction over runtime documents (object roots). Inside tools it maps to `api.commit`, inside task phases to the task-runtime commit, elsewhere to a harness transaction. `startTask` inside it maps to `tx.createTask`. Transaction handles reject all operations after their callback ends |
| `appendAudit` | An `aitp.audit` entry without model messages, written in the same transaction |
| `createConversation` | Atomic creation with ownership and an idempotency binding for its `requestId` |
| `submit`, `submission` | Input submissions with `requestId`; `delivery` maps to `whenBusy` `steer`, `followUp` or `reject`. Placement is observed through the submission status and the conversation watch |
| `deliver` | A passive `write` submission whose entry carries `model` messages and `edits`. It is placed at once when idle, otherwise at the next boundary (`inbox.js`, `applyBoundary`). A queued write has no entry id yet |
| Hooks | `beforeTool` (before intent; early denial only); `onYield`; `beforeCompact`, given the selected entries, the model messages as `ModelMessage`s, the first kept entry, the reason and the instructions. Compaction summarizes Pi's selected, context-edited messages, not raw transcript entries; provider-private metadata stays in the adapter. Hook APIs read committed state and memos and cannot write; `beforeRequest` is not used for context because its changes are not recorded |
| `ToolSpec` | `replay`, `deferred` (loaded by `tool_search` through `control.addTools`), `callers`; `ToolResult` maps to `output` (text and images), `isError`, `diagnostics`, `details` and `control` |
| Recovery | The built-in tool task runs `beforeTool`, records intent and executes in one handler. Its `execute` phase is reached only by recovery: a replay-safe tool reruns without `beforeTool`, an unsafe one is reported as interrupted and never reruns |
| `TaskShell` | A task whose checkpoint holds the phase name and the shell's state. `next`, `wait` (`allSettled` or `failFast`) and terminal results become phase transitions, committed per phase; a default abort handler commits an aborted outcome |
| `compact` | `Conversation.compact()` admits a task and returns its id. The summary is placed like a passive write, so a manual compaction can finish before its summary is applied; application is recorded separately (`compaction-applied`) |
| `watchConversation`, `watchTasks` | Conversation views (active entries, built-in documents) and the task graph (live tasks). Both are state observation, not an audit feed: a slow watch may collapse updates into a replacement snapshot. Pi's unanswered submissions and orphaned or faulted tasks surface as `problem` frames with Pi's reason. Compaction is a flag beside the session state, because Pi compacts while work continues |
| `readLog` | Native entries plus the immutable audit entries, ordered by `(entry id, ordinal)`. Entries carry no timestamps of their own; `at` is present when the source records one |

Two points still need probes in S3-A: placement when idle at 1.3.0, and the atomicity of harness transactions
outside tools. Both run as conformance tests against the faux provider before anything depends on them.

## 11. The reviewer export

`aitp.workbench-log@1` is JSON Lines: a `LogHeader`, then `LogRecord`s in cursor order (`ExportLine`).

- **The header** lists every conversation exported (main, workers, review) with its cutoff cursor, plus the
  limitations the reviewer must report as coverage gaps.
- **Records** are messages (with purpose and delivery), tool calls, tool results (with a reference to the full
  output), compaction summaries and audit events.
- **The audit events** record:
  - instruction renderings, context deliveries and supersessions;
  - active tasks, cards and their responses;
  - grant creation and revocation, and action transitions;
  - change sets and recoveries;
  - artifacts and attachments;
  - review requests, reports and assessments;
  - worker lifecycle;
  - applied compactions;
  - method uses.
- **Evidence** referenced by an export is persisted and pinned when it is created, not at export time.
- **Renderings and records are kept whole:**
  - an `instruction-rendering` event holds the rendered text, and `text: null, hash: null, bytes: 0` records a
    removal;
  - export maps native system-section changes into rendering records and preserves removals;
  - every action event holds the complete resulting record, with approval, receipt and reconciliation
    evidence.
- **Truncated tool results** need a pinned full-output reference or an explicit coverage limitation.

## 12. The API

`ROUTES` (`protocol/src/api/routes.ts`) lists every route of 07. Each entry has:

- the method and path;
- schemas for path parameters, query and body;
- the response schema (`binary` and `jsonl` are marked);
- the error codes;
- the stream implementing the service behind it.

S4 implements every handler.

`EVENTS` (`api/events.ts`) maps each WebSocket event to its payload schema; `Envelope` and `ClientMessage`
frame them. A new `epoch` is announced with a `reset` event before the replacement snapshots.
