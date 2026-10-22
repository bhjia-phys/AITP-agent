# S3-A — Pi execution, sessions and context

Branch: `aitp-agent-s3a`. Base and final HEAD: `fdfc7d2d`. No commits were made. Only S3-owned paths changed;
S1 entry points, contracts, manifests, fixtures and lockfile are untouched. Controllers and review remain W0
placeholders for S3-B. All executions below use faux providers and temporary workspaces/data directories.

## Implemented

- **Pi adapter:** native SQLite storage at `runtime.sqlite`; an OS-backed exclusive SQLite transaction on
  `runtime.lock`; explicit scheduling startup; object-root runtime documents; atomic audit/document/task
  transactions; request bindings; input admission and placement; passive writes; item-level supersession;
  historical context; native manual compaction with atomic request binding; task shells, waits, cancellation,
  retained outcomes and retries; tools, sections and hooks; conversation watches and task snapshots; ordered
  native/audit log conversion. No `@earendil-works/*` imports escape this package. Runtime contracts are
  imported type-only.
- **Invocation lifetime:** transaction handles have a separate callback lifetime. Tool and task APIs have an
  invocation lifetime, including reads, progress, child creation and waits. Tool commits use `api.commit`;
  task commits use the native task-runtime commit. Retaining a handle cannot turn it into a host transaction.
- **Images/data:** artifact resolution is late; constructing the port does not call `readArtifact`. Images are
  stored in native model contributions with their artifact references retained in application data. Input
  and tool-output image references are recovered on reopen. Research data is verbatim text in the specified
  user-role frame. Edits rebuild the containing contribution and preserve requests, images and other items.
  Pending passive edits to the same entry accumulate.
- **Models:** a serialized, atomically replaced `credentials.json` with mode 0600; a stable `device-id`;
  catalog, completion and `Models.login` interactions. Prompts include select-option labels when applicable.
  OAuth, device-code and API-key flows use the installed interaction interface. Errors returned by login and
  completion are bounded and omit provider exception details. A stream wrapper redacts known stored and
  ambient credentials from errors, diagnostics, text and tool arguments; incomplete credential prefixes are
  held back during streaming. Provider-private signatures remain inside the adapter. Real-provider factories
  are registered without model requests; legacy OpenAI Codex is registered only when selected in a role.
- **Sessions:** frozen session scope/thread; idempotent creation, updates, original-request fingerprinting,
  persisted preparation and original receipts; continuation bindings; abort, compaction and JSON Lines export.
  The latest placed task input in the committed log is the authority. The cache is keyed by its native entry;
  a status input or a queued task cannot replace it. A cache claiming a later entry also cannot override the
  log read. Continuation retains the authorized task and its unfinished action.
- **Context:** stable identity, verbatim memory-kernel sections, seven core Skill names/descriptions, method
  index, applicable instructions, active grants and tool guide. Data assembly covers location opening and
  Current work, both parents' openings/using passages, operative plans, root directions, knowledge headers,
  selected reading sections/paper maps, checkout summaries/map rows/file versions, selected materials and
  prior episodes. Whole-account requests do not receive automatic partial-account excerpts. Unavailable core
  sources are recorded as `omitted: unavailable`. Source hashes and delivery bindings are retained. Refresh
  plans and preparation are durable before delivery/admission. Compaction application causes current context
  to be delivered again through a lazy session observer, with durable deduplication.
- **Budget:** UTF-8 estimates count system sections, actual declarations from the same tool factories S1
  registers, history, input, images, data and output reserve. Oversized data becomes a pointer or an explicit
  omission. Exhausted history admits one compaction and is counted again. The default fraction is 0.6.
  Native rendering records reconcile whether prepared instruction hashes have actually rendered; a rendering
  changed after preparation is represented separately rather than claiming the prepared text was shown.
- **Cards/hooks/tools:** idempotent card posting (the Card-only post interface uses card.id) and responses with schema/type/choice validation and atomic
  audit events; required responses arrive as deduplicated next inputs. `ask_researcher`, `propose_plan`,
  `close_report`, `read_skill` and runtime-owned `tool_search` are implemented. There is no native Pi
  `tool_search` extension. Discovery uses the registered runtime factories, rather than inventing unavailable
  specialist tools. Compaction summarizes `CompactionInput.messages` plus explicit current control state.
  Early tool denial checks status mode and the outline's applicable analytic/execution flags; S4 still owns
  execution authority inside tools.

## Pi 1.3.0 observations and deviations from 09 §10

1. **The two open probes passed:** passive writes place immediately when idle; throwing host transactions
   roll back documents, audit entries, task creation and idempotency bindings together.
2. **`submit`, compaction and idle waits enable scheduling themselves.** The port rejects progress requests
   until `startScheduling`. Opening, inspecting, transactions, conversation creation and task creation do not
   enable scheduling. Crash tests reopen pending work with the same identities.
3. **`InputEntry` cannot carry edits.** Its application payload contains only kind/data. On a placed input's
   native publication the adapter immediately queues a persisted `aitp.context-edits` entry and supersession
   audit on Pi's mutation line, before generation reads its context. It rebuilds old contributions from their
   recorded native content. Startup repairs an interrupted placement/edit boundary. The conformance test
   checks what the faux provider actually received, not only the final context or fixtures.
4. **Invocation-bound `ConversationHandle` has input submission but no passive-write method.** Passive
   writes therefore use public transaction primitives, `InboxDoc` and `LiveDoc`, on the invocation's own commit
   line. They await admission only and retain the one-entry data-plus-edits boundary.
5. **Native `Conversation.compact` has no request-id argument.** The adapter creates the public native
   `CompactionTask` and its `LiveDoc` status with the request binding in one transaction. Its summary may be
   queued after the task is terminal. Application audit follows the placed summary, never task completion.
   Queued summaries are attributed using Pi's `compaction:<task id>` submission binding, since the task placing
   the entry at a boundary can be the generation rather than the original compactor.
6. **Native termination requires every call in a round to request termination.** This fails the required-card
   rule when a card shares a round with a read or an unavailable call. `generation.ts` supplies a public
   `RegistryReader` that delegates every native generation phase/checkpoint and adapts only the completed
   tool round's read of controls when any tool requested termination. Persisted outcomes and error entries
   are unchanged. The regression uses a required card, a successful read and an unavailable call together.
   This small adaptation is deliberately isolated for the integrator's review and future Pi upgrade probes.
7. **Prompt-section keys have a restricted grammar and `instructions` is reserved.** Arbitrary port section
   names are encoded to safe native keys; persisted name mappings restore the original names in context and
   export. Native section removals become rendering records with null text/hash and zero bytes.
8. **There is no cross-process storage lock in Pi.** The adapter holds a separate SQLite exclusive transaction
   on `runtime.lock`. This is released by the OS on SIGKILL, has no helper process/stale PID recovery race, and
   refuses a second port. An initial subprocess/pipe-based lock helper was discarded after it failed here.
9. **Task runtime commits return no callback result.** The adapter carries that result outside the callback
   while preserving the invocation-bound commit. A retry under a completing/terminal former owner becomes
   conversation-owned; it retains `retryOf`, because Pi refuses new children of that owner.

## Integration requests and temporary representations

- **S1 — `SubmissionReceipt.reason`:** the schema has no reason field, although Pi gives unanswered inputs a
  reason. The adapter temporarily returns an additional structural `reason` property and emits the native
  reason as a `problem` frame. `DeliveryReceipt.reason` is already available. Please add the optional field to
  `SubmissionReceipt` so schema parsing/server serialization cannot discard it.
- **S1/S5 — reading locator:** `SessionMeta` has edition and scope but no current reading locator. The temporary
  selector is an explicitly scoped section note. Without one, the paper map is delivered and omitted sections
  explain the missing selection; no section is guessed. Please decide the locator-to-section contract.
- **S3-B — export coverage:** session export currently includes the main conversation and explicitly reports
  worker/reviewer exclusion in its header. Extend its conversation collection/cutoffs when controller and
  review services exist. Those W0 modules were deliberately not replaced.
- **S4/S1 — pinned full tool output:** the adapter has a read-only artifact callback, not an artifact writer.
  Native bounded results are exported, images keep artifact references, and the header explicitly reports the
  missing pinned full-output references for possible truncation. Wire a writer/pinning capability before
  claiming full large-output reviewer coverage.
- **S4 — card response effects:** this service validates, records and delivers the researcher response.
  Approval grant creation, applying change sets and uncertain-effect reconciliation remain the domain services'
  responsibility; a card response does not bypass their authority checks. Early scope denial currently reads outline flags and their explicit `overriddenBy`;
  S4 must connect effective researcher overrides when that grant service is integrated.

No contract, fixture or schema was changed to make these requests disappear. The explicit core fake in
`runtime/test/conformance/fixture.ts` supplies hand-built outlines/instruction sources for the fixture branch
and its two parents. S5 stand-ins throw `NotImplementedError`; they are not replaced by successful empty data.

## Commands and results

All heavy commands were run from `agent/`, with the shared lock held for the complete command and its children.
The final validation commands are:

```text
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx tsc --noEmit -p packages/pi-adapter
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/pi-adapter
[exit 0]

NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx tsc --noEmit -p packages/runtime
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/runtime
[exit 0]

NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx vitest run packages/pi-adapter packages/runtime test/integration
npm notice run aitp-agent@0.1.0 npx
npm notice run 'vitest' run packages/pi-adapter packages/runtime test/integration

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s3a/agent

 Test Files  12 passed (12)
      Tests  56 passed (56)
   Start at  05:01:32
   Duration  11.62s (tests 78%, import 16%, transform 5%)

    Isolate  12 workers spawned · ~72ms startup each (spawn + environment, per file)
             at least ~788ms faster with isolate: false — reuses workers across files instead of one per file
[exit 0]
```

Focused development commands also ran under the same `NODE_OPTIONS` and `flock` prefix:

```text
npx vitest run packages/pi-adapter/test/conformance/port.test.ts
npx vitest run packages/pi-adapter/test/conformance/port.test.ts packages/runtime/test/conformance/session.test.ts
npx vitest run packages/runtime/test/conformance/session.test.ts
npx vitest run packages/pi-adapter
```

Useful failed checks, retained to explain corrected assumptions (copied tails):

```text
Tests  7 failed (7)
Error: Runtime storage is already locked
```

The original helper process did not establish the expected pipe handshake. It was replaced with the SQLite
lock; the idle/second-opener/SIGKILL tests now exercise the actual implementation.

```text
TypeError: Section key "aitp.identity" must match /^[a-z][a-z0-9_-]*$/
Tests  4 failed (4)
```

Native section grammar was narrower than the callable contract; section-name encoding now handles it.

```text
AssertionError: promise resolved "undefined" instead of rejecting
```

A captured tool transaction had lost its invocation binding when called from outside its original async
context. Explicit bound wrappers fixed it; retained tool/task/transaction handles now reject.

```text
FAIL ... provider errors and echoed credential text are redacted before they enter durable streaming state
AssertionError: expected ... not to match /API-KEY-SECRET|ACCESS-TOKEN-SECRET|REFRESH-TOKEN-SECRET/
Tests  1 failed | 51 passed (52)
```

Redacting message snapshots alone missed `text_end.content` and fragmented deltas. End-event content,
structured diagnostics/arguments and sanitized streaming prefixes are now handled as well. No actual
credentials were used in this test.

A final JSON validation regression rejected an explicitly undefined optional protocol field. State writes now
omit optional object fields according to JSON/Pi conventions while rejecting non-finite numbers and
non-JSON scalar values.

Typecheck iterations also corrected JSON type boundaries, Node Context's `abortSignal` name, inferred optional
object properties, the model id in the explicit fake, and one checkout type annotation. A mistaken root-CWD
`npx tsc` invocation was interrupted (exit 130) before continuing from `agent/`.

Additional checks:

```text
git diff --check
[exit 0; no output]

git branch --show-current
aitp-agent-s3a

git rev-parse --short HEAD
fdfc7d2d
```

## Known limits

- No real-provider request/sign-in, real research workspace, independent research session or scientific
  comparison was performed. These are scripted faux behavior tests and explicit fixture fakes.
- The reading locator, full-output artifact and S3-B export limits above remain explicit. Root, reading and code
  assembly branches need integration with S2/S5's concrete services; branch assembly is behaviorally tested.
- Token counts are conservative UTF-8 estimates, with a fixed image allowance, rather than provider tokenizer
  measurements. Instructions changing after input preparation can change the actual request cost. Actual
  rendering records remain authoritative, and a changed rendering is shown separately in the manifest.
- Task watches currently deliver replacement task snapshots; conversation watches deliver entries, state,
  partial/tool frames and bounded replacement snapshots. Native task faults/orphans and unanswered submissions
  retain their reasons in conversation problem frames, including for a late observer. Task view timestamps use
  native terminal/start times or the live commit-observation time, since native records have no general
  per-transition timestamp.
- The adapter's round-termination adaptation depends on the public 1.3.0 generation definition/checkpoint and
  registry-reader interface. Keep the conformance suite as an upgrade gate; do not assume a newer checkout's
  API or silently upgrade the pinned packages.
- `tool_search` inventories the same factories as S1's registry. Additional registration sources introduced
  later must be added to this shared catalog, or given an explicit registry-introspection contract.

## Acceptance evidence

These are behavioral tests, not schema/fixture checks offered as behavioral acceptance. No independent
research session is claimed.

| User item | Demonstration |
| --- | --- |
| 1. Packaging/boundaries | Both affected typechecks; the final full command, including all integration/ownership/import-boundary tests. |
| 2. Channels | `runtime/test/conformance/session.test.ts`: the actual faux request carries the verbatim kernel and applicable instructions in system messages; branch opening/Current work and both using parents are framed user data. The manifest retains source versions and explicit unavailable sources. |
| 3. Supersession | The next request after a fake note-version bump supersedes old data in the provider request. `port.test.ts` additionally preserves researcher text, an image and an unaffected item, tests multiple queued edits and historical `contextAt`, and reopens image context without artifact I/O. |
| 4. Active task | Runtime session test holds a status response, queues a changed task, checks the unchanged authority/data before placement, regresses the cache, and resumes a retained unfinished action with continue. Restart tests inspect both placement boundaries. |
| 5. Delivery boundaries | `port.test.ts` holds an actual tool round, admits steer and follow-up, checks no queued data in the running context, and verifies log/provider ordering at post-tool and final boundaries. |
| 6. Conformance A/B/C/E and open probes | A: recorded section changes/removals, historical context and supplied compaction. B: three worker conversations, cancellation, integration before a slow worker finishes, atomic predecessor/tail links under a live controller, and refusal of a completing owner; a controller also survives SIGKILL. C: evidence-dependent routes, retained choices, bounded external completions, per-step models/thinking, retryable faux failure, parallel and sequential reads. E: hook barrier, safe/unsafe SIGKILL behavior, no beforeTool replay, and continued interrupted-tool output. Host rollback and idle passive placement have direct port tests. |
| 7. Crash/replay | `pi-adapter/test/conformance/crash.test.ts`: kill and await children inside safe/unsafe reads, plus a controller waiting on an owned worker. `runtime/test/sessions/restart.test.ts`: kill after task admission before placement and after placement; preparations/original receipts agree, active task is correct, and there is exactly one new task input. Every child is killed if needed and awaited in finally. |
| 8. Compaction | Port test holds a tool while a manual summary task becomes terminal: no application event until placement. Its hook receives edited model messages. Runtime compaction test retains the active task, researcher choice and action state, then observes current-context re-delivery after application with deduplication. |
| 9. Export | Every exported line validates against `ExportLine`; header first; repeated records agree up to cutoff. Native instruction text and null removals are retained. Export reads native historical entries and immutable audit entries, not watch notifications. |
| 10. Cards | Runtime tests check one required choice ends a run, repeated response idempotency, body mismatch rejection, a required card sharing a round with a read and an unavailable call, and the plan/close payloads and their different run effects. |
| 11. Credentials | Credential tests check 0600, serialized atomic mutations, stable device id, stub login events/prompts, failure redaction and secret-free model stream/completion results. No real credential/provider is used. |

Passing these checks does not establish scientific correctness or superiority.
