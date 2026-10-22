# 04. The research agent

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

The agent is a pi-durable conversation configured by AITP. The Skills carry the judgment: when to write, when to
ask, how to verify, when to distill. The runtime supplies instructions, context, tools, enforcement and
visibility. Serializable shapes are in 09.

## 1. Sessions and active tasks

| Kind | Bound to |
| --- | --- |
| Research | One research location (03 §3); the root for cross-topic work |
| Reading | A location and an edition (03 §7), with its current locator |
| Code | A location and a checkout (03 §8) |
| Worker | Owned by a controller task |
| Review | Owned by a review task; read-only; no history from the reviewed session |

- **Creating a session never creates a note, topic or branch.**
- **Inputs have a purpose and a delivery.**
  - **Purpose:** `task` (a new or revised request), `interjection` (a status question, side question or learning
    aside) or `continue`.
  - **Delivery** (what happens if a turn is running): `steer` (placed after the current tool round), `follow-up`
    (placed when the turn ends) or `reject`.
  - The composer defaults to `follow-up` while a turn runs; **Steer** is the explicit alternative.
- **Active task.** Each session has a durable *active task*: the researcher's current authorized request, its
  agreement source, and its unfinished next action.
  - It changes only when a `task` input is **placed**, not when one is queued. Interjections leave it as it is.
  - "Continue" (a button, or a bare "continue" in any language) resumes the active task's unfinished action. It
    never resumes the latest board item, and never authorizes a new campaign.
  - After a restart or external changes, context is reassembled first.
- **Steering.**
  - The researcher can steer a running turn, queue a follow-up, or abort.
  - From the workbench, steering can carry a selected object: a passage, a file range, a figure or a PDF region.
  - Steering a worker goes to that worker's conversation (§9).
- **Resuming** shows the transcript unchanged, plus what changed since the researcher last looked (by hash).
  "Context as it was" reconstructs any earlier view.

## 2. Instructions and data

Two channels, never mixed:

| Channel | Content | Delivery |
| --- | --- | --- |
| **Instructions** (trusted, from the researcher) | Identity; the AITP research-cycle kernel; the Skill index; applicable instruction sources (03 §4); agreements and active grants; the tool guide | System sections, in a stable order, with no timestamps or changing values |
| **Data** (reasoned about, never obeyed) | Note excerpts, plans, knowledge entries, paper passages, file contents, episodes, web results | `aitp.context` entries in the user role, each framed as data with its source, version and span; tool results |

The instruction kernel contains:

- verbatim from `aitp-memory`: "The research cycle", the write decision of "Timing and recovery", and
  "Close the task visibly";
- the names and descriptions of the seven core Skills and of the matching methods.

Longer sections and Skill bodies load on demand with `read_skill`, because the cycle tells the agent when it
needs them.

**Delivery and supersession** (09 §4):

- **When a note changes,** a new excerpt is delivered at the next eligible placement boundary, together with
  the context edit that hides the previous excerpt. The log keeps both. The manifest records what was actually
  delivered, superseded and omitted, and when.
- **A queued follow-up** carries its own task-specific data inside the input, so that data is placed with it
  and never enters the running turn early.
- **After a compaction is applied,** the current versions of the in-scope items are delivered again, because
  hiding an old excerpt does not remove what a summary has already absorbed.

**Budget.** The whole request is counted: instructions, tool declarations, history, context entries, images and
expected output. The default is 60% of the model's context window, configurable. On overflow:

1. lower-priority data items become one-line pointers;
2. then history is compacted;
3. the omissions are listed in the manifest.

## 3. Context assembly (`aitp-memory@1`)

| Situation | Items (data unless marked) |
| --- | --- |
| Always | The location's opening and Current work |
| Branch location | Each parent's opening and the passage that uses this branch |
| Instructions | Applicable instruction sources (03 §4), as *instructions* |
| Continuing a thread with a plan | The plan's operative phase |
| Root location or a cross-topic request | The relevant root direction sections |
| The task needs theory, including the theory inside computational work | The knowledge index header and the matching area sections |
| Reading session | The paper map; the section note at the locator |
| Code session | The checkout summary, the map row, the relevant file versions |
| Selected materials | As chosen, with their versions |
| "What did we try?", or a repeated route | The top episodes for the location, marked lower authority (03 §11) |
| Restructuring or reinterpretation | Nothing preloaded; the agent reads the whole affected account section by section, recorded |

## 4. Modes

Modes are presets. They set a short instruction paragraph and preload tool groups, never closing others:

- Continue;
- Theory;
- Computation;
- Reading;
- Learning;
- Writing;
- Brainstorm;
- Status.

Status removes write tools for that turn. Scope flags (03 §2) restrict tools for the location or thread they
attach to:

- `analyticOnly` and `executionExcluded` remove every execution tool, including any code-execution path;
- `dormant` and `paused` require an approval before research actions.

## 5. Tool surface

A small stable core is always offered; specialist groups are deferred and loaded with `tool_search` when the task
needs them.

| Core tool | Purpose | Replay | Authority |
| --- | --- | --- | --- |
| `read` | A note, knowledge entry or file, by path, section or line range; returns version and lines | safe | none |
| `search` | Notes and knowledge (FTS) or a checkout (`rg`) | safe | none |
| `outline` | Opening, headings, Current work, links of a location | safe | none |
| `board` | Thread rows for a scope | safe | none |
| `propose_changes` | A change set (create, edit, move) across notes and knowledge, with base versions; returns a preview id | safe | none |
| `apply_changes` | Applies a previewed change set | unsafe | `note-write` / `knowledge-write` within write mode and ownership |
| `code_edit`, `code_write` | Anchored edit or write of a source file in a granted root; returns the new file version | unsafe | `code-write` for the root |
| `run` | Sandboxed command or Python script on stdin (02); returns exit code, output tails and artifacts | unsafe | none read-only; `run-write` for granted output roots |
| `read_skill`, `find_methods` | Skill bodies and references; ranked methods (05) | safe | none |
| `ask_researcher`, `propose_plan`, `close_report` | Interaction cards (§8) | safe | none |
| `tool_search` | Load a deferred group | safe | none |

| Deferred group | Tools |
| --- | --- |
| `literature` | `arxiv_search`, `crossref_lookup`, `inspire_search`, `fetch_paper` (`library-write`), `pdf_text`, `pdf_find`, `compare_sources` |
| `knowledge` | `create_entry` from templates with label rules; `index_row` (provisional pointer) |
| `code` | `checkouts`, `git_state`, `git_log`, `git_diff`, `symbols` (approximate), `build_or_test` (receipt), `git_commit` (`git-commit`) |
| `cluster` | `cluster_status`, `cluster_read`, `submit_job` and `cancel_job` (per-call approval) |
| `artifacts` | `list_artifacts`, `artifact_provenance`, `propose_artifact_placement` |
| `workers` | `start_investigation`, `worker_status`, `steer_worker`, `stop_worker` |
| `learning` | `exercise` (an optional practice card) |

Rules for every tool:

- results to the model are capped at 256 KB of text, with a pointer to the full output;
- file and web text is framed as data;
- every tool honours its abort signal;
- arguments stay small (pi-ai re-parses streamed arguments on every delta), so edits are anchored, never whole
  files.

Code mode (pi-durable's JavaScript tool orchestration) is not used in version 1. When it is added later, it is
limited to bounded read aggregation with exported nested evidence, and disabled where execution is excluded.

## 6. Authorization

### Action records

Every consequential operation is an `ActionRecord` (09 §5), operational state in the runtime and never a
scientific record:

```text
proposed → approved → reserved → executing → done | failed
   ↘ denied | cancelled   ↘ revoked | cancelled   ↘ interrupted → uncertain (effects) | failed (local)
                                                         uncertain → done | failed, by reconciliation only
```

The transition table is `ACTION_TRANSITIONS` (09 §5).

- **Binding.** An approval is bound to:
  - the hash of the canonical execution arguments;
  - the target versions (file hashes, checkout HEAD and dirty state);
  - the limits (wall time, memory, output roots);
  - its scope, which carries its identity (this active task, this session, this location or thread).

  A changed argument or target needs a new approval.
- **Repeated calls name the approval.** After an approval, the agent repeats the call with the reserved argument
  `approval` set to the action id; it is excluded from the hash. Without it, a call proposes a new action.
  Matching arguments alone never decide that two calls are the same operation.
- **Reservation.** `approved → reserved` consumes a once-grant in the same transaction, so a once-grant cannot be
  consumed twice. `reserved → executing` is committed, with the operation id, before any invocation.
- **Enforcement** happens in the *authorized-tool wrapper* inside `execute()`, not only in `beforeTool`: Pi's
  recovery reruns `execute()` without `beforeTool`. In one transaction per transition, the wrapper:
  1. loads or creates the record;
  2. checks the grant and its binding;
  3. revalidates effective access: revocations, write mode, scope flags and target versions;
  4. commits the transition with its audit entry.

  `beforeTool` is used only for cheap early denial.
- **Recovery** re-enters the wrapper only for replay-safe tools. Unsafe operations are reconciled by startup
  recovery, not rerun. At startup, before scheduling begins (02, process model), records left in `reserved` or
  `executing` without a receipt become `interrupted`, then `uncertain` (effects, §7) or `failed` (local
  operations).
- **Approval flow.** When approval is needed, the wrapper:
  1. commits the record as `proposed`;
  2. returns a tool result naming the action id;
  3. ends the run with a required-decision card (§8).

  The researcher's decision arrives as the next input, and the agent repeats the call with `approval`.
- **Read-only execution** has its own kind, `run-read`, granted by default for the workspace. Scope-flag
  overrides are grants with `overrides`, created only by the researcher.

### Grants and defaults

A grant names its actions, its scope and its source. Scopes are once, an active task, a session, a location, a
thread or the workspace. Sources are the researcher in the workbench, a plan approval, or a standing
configuration default.

- **A plan approval** authorizes only the plan's stated bounded steps, through one bound grant per step.
- **Defaults:**
  - reading under configured roots;
  - sandboxed read-only commands (`run-read`);
  - arXiv, Crossref and INSPIRE metadata queries;
  - read-only queries to configured clusters;
  - writes to the session's own location within the write mode;
  - topic-home Skill revisions within the research task's authorization, as `aitp-distill` allows.
- **Previews** of opening, conclusion and parent edits are researcher preferences (02 Config), off by default
  inside an existing authorization. Edits are always shown as informational cards with undo.
- **Ownership.**
  - Workers write only their listed notes.
  - The integrator owns the authorized affected set of a change (child, parent, index).
  - A parent never receives a branch's next action or job state.
- **Historical permissions** quoted in notes are context, never grants.

## 7. External effects

Submissions, cancellations, fetches into the library, commits and pushes are *effects*. Local commits count,
because an interrupted commit may or may not have happened.

1. The record gets an **operation id**; `executing` is committed with it before invocation.
2. Effects carry the id outward where possible: a job name or comment, a commit trailer.
3. After an interruption the record is `uncertain`. The runtime **reconciles** it with the effect's evidence:
   the scheduler's jobs carrying the id, the remote ref, the library file.
   - Conclusive evidence moves it to `done` or `failed`.
   - Inconclusive evidence leaves it `uncertain`, shown in the inbox. Its card offers only "reconcile again"; a
     manual, evidence-bearing resolution is future work.
4. **No new attempt while uncertain.** A new attempt is a new record with `retryOf`, allowed only after the old
   one is `failed`, `cancelled`, `denied` or `revoked`. It needs its own authorization; a fresh model call cannot
   bypass this.

Tests crash at three points (08):

- **Before invocation:** the scheduler sees no job, and none appears unless an authorized new attempt is made.
- **After remote acceptance:** reconciliation finds the job by its operation id and records it without a
  duplicate.
- **Before the receipt is persisted:** the same as after acceptance.

## 8. Cards

| Kind | Examples | Effect on the run |
| --- | --- | --- |
| Informational | Change set applied (with undo), run finished, artifact exported, close report, review report | None |
| Optional response | Exercise, "add this figure to the note?" | None; the answer, if any, arrives as input |
| Required decision | Approval, choice between consequential options, plan, conflict, distillation proposal, uncertain effect | The run ends after posting; the decision arrives as the next input |

Payloads and responses are typed per card type (`Card`, `CardResponse`; 09 §7).

`close_report` is informational: it states what is now supported, where it was retained (with links and
versions), and what the evidence warrants next. "Nothing further is warranted" is valid. Exercises are offered,
never imposed; a requested complete explanation is always delivered.

## 9. Workers and controllers

A controller is a durable task. Its phases call pure AITP policy functions over worker results (earlier probe
B).

- **Worker plans** come from Skill prose. The agent reads a method's roles and stopping condition and proposes a
  worker plan with `propose_plan`; the plan card is the reviewable instantiation. There is no executable
  metadata in version 1.
- **Workers** are task-owned conversations. Each has a role, model, thinking level, instructions (role text plus
  AITP's hand-off contract), tools, writable set and a budget (model calls, wall time). Budgets, usage,
  admission and reassignment are AITP records (`WorkerRecord`).
- **Control.**
  - Steer, follow-up, stop and reassign per worker.
  - **Global admission** limits concurrent workers across all controllers (default 2) and one heavy command at a
    time (02).
  - Queued work shows its position.
- **Integration chain.** Settled results are integrated while others continue, through one writer at a time.
  Pi joins only on all-settled or fail-fast, so:
  - each settled worker starts one integration task keyed by its worker id;
  - each integration task waits for its predecessor, which is recorded atomically in the controller's state;
  - integrations therefore run one at a time, in completion order;
  - the controller waits for all workers and then for the chain's tail.

  The integrator is the only writer of the shared affected set, through change sets. Incompatible results become
  an open question in the owner.
- **Restarts** are counted per worker. After three, the worker is stopped and shown with a retry action. A retry
  is a new task with `retryOf`; Pi cannot revive a terminal task.

## 10. Review

| Signal | When the review runs |
| --- | --- |
| `compaction` | After a compaction is applied; asynchronous. Reliance on the session's results outside the session (a submission, a manuscript build for sharing) waits for it |
| `handoff`, `session-end` (with edits), `delegation` | At that point, over the whole session |
| `restructuring` | **Before application.** The agent declares a restructuring (moving, merging or removing sections, or rewriting the opening together with the section structure); a heuristic on the change set can require the declaration. The reviewer receives the proposed change set, bound by its digest, and the baseline snapshots. The report is informational; application waits on an internal gate, the main agent's assessment for the same digest. Any substantive revision of the change set gives a new digest and closes the gate again |
| `outside-reliance` | Before the reliance |
| `researcher` | On request |

- **The reviewer.**
  - Model: `models.reviewer`; another provider is recommended.
  - Inputs: the exported log (09 §11), the signal and the baselines.
  - Tools: read-only, including the export's referenced evidence.
  - Instructions: verbatim `aitp-reviewer.md`.
- **Coverage** follows the reviewer Skill:
  - The researcher's messages are checked across the whole session, every time.
  - Everything else is reviewed over every part of the log no earlier review inspected, including gaps between
    reviews.
  - Handoff, session end and delegation cover the whole session.
  - Each review records the ranges and compaction ids it covered.
  - Duplicate triggers for the same ranges are merged into one request.
  - Reviewer sessions are never reviewed.
- **Findings** are submitted through the reviewer's report tool and go to the inbox. The main agent assesses each
  one (`aitp-verify`, "assess another model's review") and applies the valid ones as the only writer. A required
  card appears only when a human decision is unresolved. Review records never enter notes.

## 11. Compaction

pi-durable compacts at its thresholds. AITP's `beforeCompact` hook supplies the summary. The summary keeps:

- the active task and its agreement;
- the researcher's requests and decisions;
- action records and their states;
- change sets applied (paths and versions);
- open questions;
- pointers to the owning notes.

It never restates note content as authority.

A manual compaction task can finish before its summary is placed, so the runtime acts on the **applied**
compaction (the `compaction-applied` audit event):

1. the current versions of in-scope items are delivered again (§2);
2. a review request is queued (§10).

## 12. Status answers

A status question runs read-only. It is answered from:

- board rows;
- plans;
- run owners and coverage receipts;
- cluster observations (only on request);
- choices waiting on the researcher.

The answer is one table with a location and an observation time per line. It distinguishes the scientific
frontier, execution state, evidence awaiting interpretation, and choices awaiting the researcher. Stale or
conflicting records are reported, not fixed. The active task is unchanged afterwards.

## 13. Models and roles

| Role | Default |
| --- | --- |
| Main | `openai` provider, a GPT model chosen in settings, thinking high. Sign in with ChatGPT or API key |
| Workers | Main unless a role overrides it |
| Reviewer | Another provider when configured, else main in a fresh context |
| Compaction summarizer | Main |

Provider reasoning signatures are kept intact for replay and are never shown as readable reasoning. The faux
provider runs tests and a demo mode.
