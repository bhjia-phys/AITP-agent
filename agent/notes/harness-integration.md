# Harness application integration

This receipt owns the checks for the Harness-derived aitp-agent application. [14](../../docs/agent/14-implementation-blueprint.md) owns authorized scope and progress; [current.md](../../current.md) owns design gaps. The [Pi receipt](integration.md) and [synthetic Pi defect reproductions](review-2026-10-22.md) retain their original scope and do not establish behavior in this runtime.

## Source and preservation

On 2026-10-22, the official `deepseek-ai/deepseek-harness` `master`, the user's `bhjia-phys/deepseek-harness` `master`, and the original local checkout all resolved to `687f282e8625c6b8d11ff58211a90524be2e4317`, release `0.2.1-rc.2`. The new `harness` branch was created from that source and merges the previously published AITP-agent `4eaa9eaf449d5d6f8149872f427dc51aeb29f56f` history. It also carries the six latest uncommitted design files from the standalone checkout; the original files and dirty worktree are untouched.

`origin` is `bhjia-phys/AITP-agent`; `upstream` is the official Harness repository. These are Git checkout remotes, not a claim that GitHub changed the existing repository's fork-network metadata. The portable AITP submodule remains at `c2e7e3d0ddc386a2dafae244ccd71ff2d70adff3`. No old runtime stores, credentials or actual research materials are migrated.

The active application is under root `packages/` and `apps/`. The retained `agent/` tree is the earlier Pi implementation. New auth/branding integration uses supported Harness plugin/composition interfaces; isolated product state belongs outside the checkout. Internal upstream package names and legal attribution remain intact.

## GPT validation boundary

The current Harness provider supports separate API-key and ChatGPT/Codex authorization routes. Source inspection found an actual application gap: the generic authorization service had no shipped consumer for fresh Pi-provider sign-in. This change adds a terminal consumer through the normal Harness launcher; provider code and its credential store continue to own authentication. Existing Codex credentials are not silently copied.

The selected baseline includes corrections and regression cases for same-effective-mode escalation and rejecting nonshrinking summaries. Passing those regressions supports their specific behavior, not closure of every historical permission or repeated-compaction report. The [subsequent source/public-report review](../../docs/agent/14-implementation-blueprint.md#gpt-integration-readiness) identifies additional tool-parameter combinations, checkpoint-only/cross-step repeated compaction and model-window switching that needed reproduction at the time of that review. The subsequent GPT slice below supplies new, bounded runtime evidence. None of these recorded regressions establishes general GPT quality or faithful preservation of research premises. The old live-provider test also selected only an Azure credential and used a removed inline credential field; the current change repairs route selection and tests it without secrets.

The login consumer is implemented in `apps/cli/src/aitp-auth.ts` and loaded by the ordinary headless profile with an auth overlay; it does not start a model task. The source launcher defaults to a separate `~/.aitp-agent` home. GPT defaults belong in the early base configuration: placing them in a late identity overlay was found to overwrite user provider routes/labels. The corrected profile test preserves those user settings and sees nine Codex catalog models from a synthetic grant. No personal Codex credentials were imported.

<a id="gpt-reliability-slice"></a>
## GPT reliability slice

The 2026-10-23 slice uses the existing `openai-codex` provider and a fresh ChatGPT browser authorization in AITP's own local credential store. The researcher completed the browser callback; the auth command confirmed success. No Codex CLI grant was imported. The alternative device-code attempt produced a code but failed before authorization; its underlying cause remains unidentified. Initial source launches also warned about missing built type contributors before artifact construction. Those attempts are not recorded as successful login tests.

The initial slice and the researcher-authorized follow-up correct these bounded failure mechanisms in existing owner packages:

- Filesystem and PowerShell tools recognize a repeated effective sandbox mode before requiring a widening justification. The pre-fix filesystem test failed for workspace-write and full access. Real Loader composition now verifies both built-in spawn and fork: children inherit workspace-write and approval never, write/edit succeed with redundant same-mode parameters, and real widening creates no files. Native Windows execution remains untested.
- Automatic compaction excludes a lone prior checkpoint. The follow-up also remembers failed automatic attempts on exactly unchanged history/header/trigger during the plugin lifetime, while manual recovery remains available. Capacity admission includes the summary prompt, tools and output allowance. Oversized histories are summarized through whole, tool-balanced prefixes on the selected route; each committed checkpoint survives a later failure. A window-derived call budget stops tiny reductions from producing one paid call per message. Oversized indivisible spans fail visibly rather than being truncated or sent to another provider. Restored-session and smaller-route behavior is tested through a real Loader and agent loop. Estimated fit and token reduction do not establish preservation of scientific assumptions.
- The AITP headless overlay enables the local credential service. The source wrapper resolves its loader relative to the repository and supplies its TypeScript configuration unless explicitly overridden, so a scratch-directory launch can use the stored grant.
- Codex transport cleanup aborts outstanding requests, prevents a late credential resolution from dispatching and closes only nonempty session IDs used by this adapter. A deterministic local WebSocket test reproduced a remaining cache race: two connections acquired concurrently for one session/account overwrote ownership, leaving one socket open after plugin disposal. The SDK patch keeps the first cache entry and closes uncached/retired connections on release. Separate sessionless and cached-busy tests reproduced a cancellation race that still sent a request after connection establishment; the patch now checks cancellation immediately before send.
- The existing streaming-argument patch avoids reparsing growing JSON on every delta. New stress coverage checks two interleaved calls with 114,727 bytes per argument and 9,644 total deltas, exact IDs/content, truncation, token-limit handling and cancellation for Chat Completions and Responses. No additional production parsing defect was found. The fixture itself now emits undelayed frames iteratively instead of overflowing its recursive call stack. This does not prove that parsing caused reported gateway 500s.
- The Codex adapter previously lost HTTP status and quota/rate distinctions when the SDK flattened errors. Request-local, bounded error inspection preserves classification and valid retry delays for the existing Harness retry plugin; it does not introduce a second retry loop. Known Responses SSE/WebSocket error envelopes also retain their explicit code/type/status and supported retry headers; SDK-owned continuation recovery stays with the SDK. A final review reproduced a lost-overflow regression for absent/unknown error codes. The corrected fallback preserves established context-overflow detection without replacing known structured categories or retaining raw messages. Local wire tests exercise the actual adapter, agent loop and retry policy. Provider capacity remains external; recovery tests cannot eliminate overload.

The earlier automatic-transport trials produced answers but required termination after 240, 180, 60 and 90 seconds. A termination handler returning code 0 is still a failed exit test. A short automatic request did exit in 10.2 seconds, so the symptom was not universal. After the ownership correction, the full read/edit/run scratch task exits naturally with auto in 19.67 seconds and explicit WebSocket in 18.92 seconds; neither watchdog fired. The decoded logs each contain a title request, four tool calls (two reads, one edit and one run) and a completed turn, with no retry event. Both runs preserve the input and exactly the three original scratch files. These timings are individual observations, not a transport speed comparison.

The AITP overlay retains `openai-codex.transport: sse` as its tested compatibility default. The earlier equivalent SSE task exited naturally in 36.5 seconds and recovered from one visible `TRANSPORT` retry (`fetch failed`). A later provider overlay can select another transport; replacing a provider object must preserve intended settings. API-key routes and generic adapter defaults are unchanged. Private authorization, model output and session logs stay outside the repository.

| Executed check | Result and limit |
| --- | --- |
| Initial filesystem/PowerShell/compaction regression batch | 284 passed in three files before the later positive selection assertion; synthetic executors and compaction fixtures |
| Follow-up compaction package | 163 passed in five specs, including unchanged failures, small-window batching, bounded tiny reductions, indivisible tool spans and actual restored-loop routing |
| Recorded headless compaction replays | Three existing cases passed before the final empty-system-head and lifecycle tightening; the final package run covers those changes. The earlier filesystem/bash replays also passed |
| Integrated tool/transport regression batch after patch installation | 20 passed in four files: source-launched headless SSE/WebSocket/auto/title concurrency, concurrent connection ownership, connect/abort races, built-in child permissions and large streamed arguments |
| Codex HTTP and Responses-event recovery | Final 141 passed in five files after adding SSE/WebSocket errors and recovery, including code-less/unknown-code context overflow with sanitized messages. This includes adapter, conversion and existing retry regressions; earlier 52- and 83-case batches overlap and must not be summed |
| Fresh ChatGPT authorization | Browser flow succeeded; device-code flow failed with an unclassified cause; no Codex CLI credentials imported |
| Live provider text and tool follow-up | Two `openai-codex/gpt-6.1-sol` cases passed, five other-provider cases skipped; three live requests, not a quality benchmark |
| Live AITP scratch read/edit/run | SSE, auto and explicit WebSocket exit naturally with correct output and unchanged input; previous automatic-mode failures retained above |
| Integrated artifact/type validation | All seven artifact steps and the full Client aggregate pass after the fixes. Dependency policy passes for 85 packages; frozen offline installation passes with the SDK patch. Full Host typing exhausted local memory, including a 3 GiB heap attempt; scoped typing of 38 changed files was not treated as a substitute. The hosted run below now passes both complete programs |
| Documentation and publication checks | The initial 43-check documentation run passed 36 and failed seven. All seven failing leaf checks subsequently pass after documented repairs or environment isolation; this is not a fresh aggregate run. Independent review checked the manual-document exceptions and hosted CI definition. The hosted run below subsequently passed all 43 documentation checks together |

Live provider command:

```sh
DSH_PI_AI_CODEX_CREDENTIALS="$HOME/.aitp-agent/.credentials.yaml" DSH_PI_AI_CODEX_MODEL=gpt-6.1-sol node node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts packages/llm/llm-pi-ai/tests/provider-apis.e2e.ts -t openai-codex --maxWorkers=1
```

The live engineering fixture contains two Pauli matrices, an incorrect `AB + BA` implementation and the expected `AB - BA`. The task permits only reading its inputs, fixing `check.mjs` and running `node check.mjs` once; it forbids input/configuration changes, networking tools, delegation and extra files. All successful transport trials report `FIXTURE_OK [[0,2],[-2,0]]` and state the finite check's limits. Independent inspection confirms subtraction and unchanged matrices. This is an engineering prerequisite for C08, not a many-body result or an AITP-agent versus Codex + AITP comparison.

Public-report scope and source URLs remain in [14](../../docs/agent/14-implementation-blueprint.md#gpt-integration-readiness). No API-key live run, expired-grant refresh, native Windows run, long-conversation scientific continuity or matched Codex + AITP comparison is established. Independent review identified the empty-ID cleanup hazard, connect/abort race and summary-head double pricing and checked compaction ordering, cancellation and checkpoint durability. Credential resolution itself is not cancellable here; its eventual completion cannot dispatch after disposal.

Publication checks also exposed unrelated documentation failures. The manual AITP scope now retains historical references and existing bilingual link targets without applying upstream prose templates; active Harness code, API, metadata, link and build checks remain applicable. A generated lockfile's numeric size is no longer misread as a commit pin, while actual pins still fail their control. An old Pi design sketch now declares its generic resource type explicitly. Documentation graph generation passed with a 3 GiB heap, and CLI-help generation passed after removing proxy variables from that check's environment. These repairs and their negative controls passed; they do not change agent behavior.

The local full Host command was `node --max-old-space-size=3072 node_modules/typescript/bin/tsc -p tsconfig.host.json`; those attempts ended in heap exhaustion rather than a completed type report. An attempted incremental run also exhausted memory. Other user processes were left intact. The researcher explicitly authorized bypassing that local pre-push check to publish the temporary branch, then updating `main` only after CI passes. [Hosted run 39954328920](https://github.com/bhjia-phys/AITP-agent/actions/runs/39954328920), at `3834431a73`, completed successfully: seven artifact steps, the same full Host and Client programs sequentially with a 6 GiB heap, all 43 documentation checks and 283 keyless GPT tests in 12 files. Those 283 tests overlap the local batches; they are not additional independent trials.

Independent review then strengthened the [workflow](../../.github/workflows/aitp-validation.yml) with full history, a resolvable pre-change archive baseline and six documentation-helper regression suites. PRs use their base SHA, existing-branch pushes use the prior SHA, and new branches/manual runs use default-branch history without comparing HEAD to itself. YAML, shell syntax and seven baseline-selection cases passed locally. Runtime code is unchanged by this CI follow-up; the candidate commit must pass the strengthened workflow before `main` advances. This push-path evidence does not establish branch protection, a successful PR path, the inherited enterprise-runner matrix or native-platform validation.

## Earlier branding/auth baseline checks

The checks in this section predate the GPT reliability follow-up above and apply only to the earlier branding/auth baseline. All used this isolated checkout. Auth process/PTY fixtures used temporary homes and synthetic credentials; none performed real sign-in or a model request.

| Check | Observed result | Scope |
| --- | --- | --- |
| Provider route selection, authorization, adapter and profile composition; sandbox escalation; compaction regression | 206 tests passed in seven files | Current generic provider/loop regressions; not physics or research-agreement acceptance |
| Auth command unit tests | Five passed | Dispatch, failure/cancellation and safe output |
| Actual headless auth profile | Three passed | Interactive synthetic success, failure exit 1, EOF cancellation 130; credential persistence and user provider settings retained |
| Secret-history regression through a real PTY and the Cloudflare API-key flow | One passed; the three other cases were excluded by the test-name filter | A hidden synthetic key cannot be recalled into the subsequent visible account field; no network request is made by this flow |
| Wrapper lifecycle through an actual auth profile | Three passed | PID SIGTERM, PID SIGINT and process-group SIGINT; exactly one forwarded signal and no surviving dsh child |
| Product/packaging, Skill discovery and client registration | Focused batches of 53 and 23 tests passed, with overlapping cases | Counts must not be summed. Includes discovery of the seven portable AITP Skills and brand registration/reload/unload; does not establish a research runtime |
| Workspace constraints, package dependencies, application entrypoints, client package metadata and UI localization | Passed | The new private UI package participates in normal composition; no npm publication is claimed |
| Artifact construction | Seven build steps passed | Native addon, host/client compilation and bundling, desktop bundle and Web artifacts; not native installers |
| Aggregate type checks after artifact construction | Host and client checks passed | Test/script typing, beyond package-only compilation |
| Real-provider opt-in suite | Five skipped for absent credentials | No live GPT result |
| Manual AITP documentation-scope tests | 22 passed | Manual document families are separated from upstream translation/hash/wrap policy; no new AITP hashes generated |

The principal reproducible commands are:

```sh
pnpm exec vitest run packages/llm/llm-pi-ai/tests/provider-api-cases.spec.ts packages/llm/llm-pi-ai/tests/login.spec.ts packages/llm/llm-pi-ai/tests/auth.spec.ts packages/llm/llm-pi-ai/tests/adapter.spec.ts packages/llm/llm-pi-ai/tests/loader-composition.spec.ts packages/sandbox/sandbox/tests/escalation.spec.ts packages/compaction/compaction-basic/tests/compaction-basic.spec.ts --maxWorkers=3
pnpm exec vitest run apps/cli/tests/aitp-auth.spec.ts --maxWorkers=1
pnpm exec vitest run --config vitest.expected.config.ts apps/cli/tests/aitp-auth.expected.e2e.ts --maxWorkers=1
pnpm exec vitest run scripts/aitp-agent-lifecycle.spec.ts --maxWorkers=1
DSH_GATE_CONCURRENCY=1 RAYON_NUM_THREADS=2 NODE_OPTIONS=--max-old-space-size=2048 pnpm aitp-agent build --scope artifacts
DSH_GATE_CONCURRENCY=1 RAYON_NUM_THREADS=2 NODE_OPTIONS=--max-old-space-size=2048 pnpm aitp-agent build --scope check
```

The auth profile's three original cases and its later PTY regression passed in separate executions; the latter used `-t 'never recalls a secret'`. The command above selects all current cases. No aggregate total combines overlapping product checks or separate historical Pi results.

Two independently reproduced defects were corrected before handoff. Readline's default history could reveal a secret at the next visible prompt; the terminal consumer now disables history, with the PTY regression above. The wrapper previously exited while its child remained alive; it now supervises a separate POSIX process group, forwards SIGINT/SIGTERM once and waits for child termination. The lifecycle tests verify quiescent exit; Windows signaling remains untested.

The first artifact attempt exposed an invalid client TypeScript project reference, corrected to the locale client's composite project. A later host bundle was killed by the system OOM killer while concurrent diagnostics competed for memory. Reducing concurrent work and bounding Node/Rayon allowed all seven artifact steps to finish; host/client aggregate checks subsequently passed. These failures are retained as build evidence, not reclassified as application failures or hidden by a passing package compile.

## Integration boundaries

Brand and authentication use ordinary Harness plugin/configuration interfaces. Direct fork changes remain in product launch/build configuration, GPT provider defaults, native product naming and packaging consumers, private package registration, focused test repairs and documentation ownership. No second agent loop or AITP-specific change to the Harness execution loop is implemented. The original DeepSeek provider identities, internal package scopes and legal attribution remain.

The researcher subsequently clarified that AITP must participate in the underlying runtime. [10](../../docs/agent/10-project-workspace.md#aitp-runtime-integration) now maps memory/source access, context prioritization/delivery, working-memory recovery and evidence feedback to inspected extension points. The researcher rejected fixed research-action constraints; these functions inform the model's adaptive choices. Source inspection identified the guard-to-tool-body asynchronous interval, incomplete coverage of filesystem intent hooks, and the distinction between appended and flushed events. These are engineering-reference findings for any separately requested hard restriction, not prerequisites for the selected memory/context work. No new research-action enforcement engine is planned or implemented by this preparation.

Fresh ChatGPT browser sign-in and bounded live GPT text/tool use are verified in the [GPT slice](#gpt-reliability-slice). Native packaged applications, accepted research cases, scientific validity and a safe AITP research-writing profile remain unverified. The first research slice and outstanding authoring/constraint-duration choices remain in [14](../../docs/agent/14-implementation-blueprint.md#runtime-integration-plan). The ordinary Harness app must not be presented as a completed AITP research-memory runtime.


## Assembled application and documentation checks

The real AITP source launcher was exercised with Chromium in an isolated temporary working directory and application home, using the required in-page picker overlay. The browser title and unique sidebar brand were `aitp-agent`, with no page errors. SIGTERM exited the wrapper with status 0, reaped the backend and closed its listening origin. This smoke plus the PWA metadata checks passed three tests in two files. No model turn or real credentials were used. The source is `apps/web/tests/aitp-brand.e2e.ts`; Windows lifecycle is not covered. This host lacked Chromium libraries, so five distro-library packages were extracted under a temporary directory and supplied through `LD_LIBRARY_PATH`; system packages were not changed.

```sh
node node_modules/vitest/vitest.mjs run --config vitest.web.config.ts apps/web/tests/aitp-brand.e2e.ts apps/web/tests/pwa-manifest.e2e.ts --maxWorkers=1 --fileParallelism=false --reporter=dot
```

The command requires installed Playwright Chromium and its runtime libraries. The executed local check additionally set `LD_LIBRARY_PATH=/tmp/aitp-chromium-libs-vmGTzS/root/usr/lib/x86_64-linux-gnu`.

Focused non-hash documentation checks passed: Markdown links (2025 files), wrap (2042), standing-document budgets, package README summary/model-experience/limitations, retained package-path references, source document references and tsconfig paths. Two focused document-scope suites passed 45 cases. The new slot/plugin/config catalog entries were added; slot and plugin-list freshness passed. Root instructions have a larger word budget to retain both fork onboarding and unchanged upstream engineering instructions. A graph-freshness check exhausted its roughly 2 GB Node heap; it produced no result or graph changes, and the owned residual process was stopped. Full upstream `doc-sync`, including hash/seal/reference checks, was not run under the retained no-hash instruction. No claim is made that every inherited upstream documentation/CI gate passes.

The final combined `pnpm aitp-agent build` ran after the auth, launcher, browser-test and documentation-tooling changes: all nine artifact and aggregate-check steps passed in 60.70 seconds with one gate worker. That success supersedes earlier attempts for the branding/auth baseline only; the subsequent GPT slice has its own build/type evidence above.


<a id="topic-workspace-client"></a>
## Topic workspace client

The 2026-10-23 frontend slice reuses UI-1 on `feat/topic-workspace-client`, based on main `9fee910a562f14e94c942c696bcefa65f030278e`, in an isolated worktree. The design package was already merged through PR #11; this implementation is a separate frontend slice, subsequently authorized for integration into main. It adds the formal Harness project/topic/material route, one contextual sidebar, a shared interaction store and an asynchronous workspace adapter. The [application contract and connection guide](../../packages/client/ui-aitp-research/README.md#backend-connection) own the backend boundary. The optional fixture is synthetic, per-Workspace and memory-only; it does not read or write real research notes or deliver context to a model.

The application check is [aitp-workspace.e2e.ts](../../apps/web/tests/aitp-workspace.e2e.ts), using the shipped Harness scaffold with AITP web and fixture overlays in a temporary Workspace. It traverses three topic levels, reads full Markdown and mathematics, returns with navigation state, previews and applies scope/qualified-answer edits, and checks the refreshed cards and full account. It also checks explicit unavailable paper/code content, Chinese labels, light/dark palettes and containment at 1440, 1024, 720 and 390 px. Six accessibility snapshots replay successfully; twelve generated screenshots cover project, topic and material at wide/narrow widths in both palettes. Direct visual inspection covered the project, dark topic and narrow material views. This is application evidence, separate from the earlier HTML simulation.

Targeted regressions cover asynchronous invalidation and retained reads, provider replacement, workspace isolation, cursor pagination, conflicts and unknown write outcomes. Pending operations enter the declared store before dispatch; late responses settle the same record after panel unmount. Transport failure during an unknown-result retry cannot replace its original operation ID or enable a competing edit. That recovery lasts for the loaded client; browser-reload recovery and durable operation reconciliation remain backend responsibilities.

| Executed check | Result and limit |
| --- | --- |
| Artifact build after behavioral and theme fixes | All seven steps passed; native addon, Host/Desktop/Client bundles, package compilation and Web build. Initial resource-limited bundling failed; the final serial run with two Rayon threads passed |
| Host and Client aggregate typing | Host passed in the aggregate invocation. That invocation found two improperly typed test mocks in the Client program; after correction the complete Client program passed separately with `tsc -p tsconfig.client.json`. No scoped substitute is counted |
| Changed frontend, fixture, Session and sidebar tests | The combined run passed 180 cases and exposed one scrollbar-contract violation. Later all 136 theme cases in 19 files passed after correcting inherited borders/scrollbars, round-marker geometry and new focus-ring tokens. These runs overlap and must not be summed |
| Assembled browser replay after the fixes | One complete scenario passed, six accessibility snapshots matched; synthetic application data, no real model request |
| Type-aware lint | All 67 changed/new TypeScript source files passed; the subsequently corrected test mock passed its focused lint check |
| Client copy and package boundaries | Locale ownership passed for 1104 Client UI sources; Client package policy, dependency policy and generated tsconfig paths passed |

The complete four-worker GUI run finished with 10,866 passed, two skipped and two failed tests across 653 files. One failure was the new focus-ring color; it was corrected and the entire 136-case theme suite then passed. The other is the unchanged host file-manager resolver test. An isolated archive of baseline `9fee910a` reproduced 34 passes and the same failure: the test injects Linux and an empty display environment but leaves the real WSL kernel release visible to the native-path helper. An explicit ordinary-Linux release changes the helper result back to false. This is a pre-existing test-isolation defect; no all-green aggregate GUI result is claimed. Earlier single-worker execution overlapped source repairs and was stopped, so it is not reported as a completed run. Markdown links passed for 2031 files, prose wrapping for 2042 files, all seven budgeted documents stayed within their ceilings, and exported JSDoc and changed-file lint passed. No translation hashes were generated or checked.

Reproduction commands, from the implementation worktree:

```sh
RAYON_NUM_THREADS=2 UV_THREADPOOL_SIZE=2 DSH_GATE_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=2048 pnpm run build:artifacts
pnpm exec tsc -p tsconfig.client.json --pretty false
LD_LIBRARY_PATH=/tmp/aitp-chromium-libs-vmGTzS/root/usr/lib/x86_64-linux-gnu DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/aitp-workspace.e2e.ts --maxWorkers=1
pnpm aitp-agent web --patch apps/cli/config/aitp-ui-fixtures.cordis.patch.yml
```

The library path is this host's extracted Chromium dependency directory, not a portable requirement. The preview command enables the synthetic provider explicitly; without it or a backend provider, Research reports the missing connection. Real storage, permissions, persistent coordinated writes, model-context delivery, native Windows behavior and researcher acceptance of a real research case are not established by this slice. Backend work can proceed independently against the adapter without adopting a particular note format.
