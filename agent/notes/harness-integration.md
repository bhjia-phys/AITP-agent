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

Four specific failures are corrected in their owning layers; transport shutdown is mitigated separately:

- `tool-fs` rejected a repeated effective sandbox mode with an absent/empty reason; the pre-fix fixture failed for both workspace-write and full access. Filesystem and PowerShell tools now recognize the effective mode before validating a widening request. They preserve the standing filesystem policy; genuinely wider requests retain approval, and narrower/unknown or unavailable modes remain errors. PowerShell coverage uses a scripted executor, not native Windows.
- Automatic compaction selected its previous checkpoint as the entire replacement span. A pre-fix fixture returned that one-node range; selection now declines it, including on repeated steps, while a checkpoint plus new history remains eligible. Manual region selection is unchanged. This corrects a mechanism in reports #7212/#8733, not every cause of repeated compaction. Repeated failures on unchanged raw history, tiny reductions, fixed overhead and smaller-window summarization remain open.
- The inherited headless bundle disables the local credential service, so a fresh AITP login still produced `Provider is not configured: openai-codex` in an actual headless run. The AITP overlay enables its credential service; route definitions and user-supplied later overlays remain intact.
- A source launch from a scratch research directory could not resolve `tsx`. The wrapper now resolves its child loader relative to itself and supplies the repository TypeScript configuration unless explicitly overridden. Lifecycle checks run outside the checkout.

Full tasks using the provider's automatic transport completed their answers but repeatedly failed to exit naturally. The first trial required termination after 240 seconds; subsequent 180-, 60- and 90-second watchdogs also fired. These are failures even when the termination handler returned exit code 0. Inspection found a retained network connection and timer after task completion. The adapter now aborts outstanding requests on unload, prevents delayed credential resolution from starting a new request, and closes only its nonempty Codex session IDs. These ownership/cancellation regressions pass, but they did not eliminate the full-task hang; the exact remaining auto/WebSocket cause is unresolved. A short automatic-mode request did exit normally in 10.2 seconds, so the failure is not universal.

AITP's application overlay therefore selects `openai-codex.transport: sse` as the current compatibility default. The same read/edit/run fixture then finished naturally in 36.5 seconds, with exit code 0 and no watchdog intervention. This is a tested mitigation, not proof that automatic/WebSocket transport is repaired or that SSE is faster. User profile settings or a later overlay can opt into another transport; replacing a provider object in a patch must preserve whichever settings the user intends. API-key routes and the generic adapter's defaults are unchanged.

The new Codex SSE tests exercise real adapter conversion with a synthetic grant and local server: serialized opaque reasoning, two parallel tool calls and results, cancellation/connection closure, and single HTTP attempts for 401/429/503. Later tests cover plugin unload during a waiting response, empty-ID cleanup ownership and dispatch prevention after delayed credential resolution. Those SSE/unit tests do not establish real WebSocket shutdown. The opt-in provider suite separately opens an explicitly selected Harness credential store; it never infers or copies the Codex CLI store. Existing protocol tests retain cross-provider roundtrip and streamed-argument checks.

| Executed check | Result and limit |
| --- | --- |
| Filesystem/PowerShell/compaction focused suites | 284 passed in three files before the later positive selection assertion; synthetic tool executors and compaction fixtures |
| Provider/auth/conversion suites | 106 passed in eight files, including five new Codex SSE cases and the explicit live-case selection test; no network credentials used |
| Actual headless recorded-session replay | Five passed: new same-mode filesystem case, existing bash case and three compaction cases; complete expected workspace checked for the file write |
| Fresh ChatGPT authorization | Browser flow succeeded; device-code flow failed with unclassified cause |
| Live `openai-codex`, `gpt-6.1-sol` provider tests | Two passed (text/usage/native replay and tool-call/result follow-up), five other-provider cases skipped; three live requests in total, not a quality benchmark |
| Launcher and lifecycle regressions | Final adapter/Codex/launcher selection passed 73 cases in four files; the remaining headless-composition case passed on correction in an eight-case headless/Codex rerun. These counts overlap and must not be summed |
| Actual AITP headless composition | Fresh synthetic stored grant, scratch cwd, application-selected SSE transport, one response and natural process exit passed; the watchdog firing is a test failure even if termination returns code 0 |
| Full live AITP scratch task | SSE default: natural exit 0 in 36.5 seconds, unchanged fixture input, correct code/result and no additional files. Automatic transport trials above remain failures |
| Artifact construction | All seven steps passed after the adapter lifecycle change; the initial nullable-message compile failure was corrected. No native installer acceptance |
| Dependency policy | All 85 policy-managed packages passed; the new OAuth fixtures declare their local credential-provider test dependency |
| Documentation and changed-code lint | All 15 edited Markdown files passed relative-link/fragment checks; changed TypeScript passed staged lint. Existing non-type-aware unused-disable warnings remain; no AITP translation hashes were generated |
| Type validation | Client aggregate passed. Full host aggregate failed from heap exhaustion at 1536/2048/2560 MB or system SIGKILL at 3072 MB under host memory pressure. A temporary configuration checked all 17 changed TypeScript files against the same project references and passed after correcting branded test IDs and an isolated declaration import. The scoped pass does not substitute for a passing full host aggregate; publication is pending that check |

Live provider command:

```sh
DSH_PI_AI_CODEX_CREDENTIALS="$HOME/.aitp-agent/.credentials.yaml" DSH_PI_AI_CODEX_MODEL=gpt-6.1-sol node node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts packages/llm/llm-pi-ai/tests/provider-apis.e2e.ts -t openai-codex --maxWorkers=1
```

A full source-launcher trial uses a private scratch directory with two Pauli matrices, a deliberately incorrect `AB + BA` implementation and an explicit expected `AB - BA`. Its task authorizes only reading the two fixture files, fixing the implementation and running `node check.mjs`; it forbids changing the inputs, networking, delegation and extra files. The model reports `FIXTURE_OK [[0,2],[-2,0]]` and limits the result to the finite matrix check. Independent file inspection confirmed unchanged inputs, subtraction in the implementation, exactly the original three scratch files, and a successful local rerun. The SSE trial exited naturally; earlier automatic-mode trials did not. The compressed session log was independently decoded with the owning Zstandard frame scanner: it records two reads, one edit, one `bash` call running `node check.mjs`, and a completed turn. It also records one visible `TRANSPORT` retry (`fetch failed`) before step three; the recovered run is not an error-free transport claim. This is an engineering smoke for C08, not a many-body result or comparison against Codex + AITP. Local authentication and trial records stay outside the repository.

The remaining public-report cases and source URLs are owned by [14](../../docs/agent/14-implementation-blueprint.md#gpt-integration-readiness). No API-key live run, expired-grant refresh, reliable full-task automatic/WebSocket shutdown, native Windows run, long-conversation scientific continuity or matched Codex + AITP comparison has been established by this slice. Independent review corrected the empty-ID cleanup hazard, required cancellation during unload, and narrowed stale validation claims in 10 and 14. Credential resolution itself is not cancellable here; its eventual completion is prevented from dispatching after disposal.

## Executed checks and their limits

All checks below used this isolated checkout. Auth process/PTY fixtures used temporary homes and synthetic credentials; none performed real sign-in or a model request.

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

The final combined `pnpm aitp-agent build` ran after the auth, launcher, browser-test and documentation-tooling changes: all nine artifact and aggregate-check steps passed in 60.70 seconds with one gate worker. This supersedes the earlier build attempts for the final source state.
