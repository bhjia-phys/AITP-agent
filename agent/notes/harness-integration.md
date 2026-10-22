# Harness application integration

This receipt owns the checks for the Harness-derived aitp-agent application. [14](../../docs/agent/14-implementation-blueprint.md) owns authorized scope and progress; [current.md](../../current.md) owns design gaps. The [Pi receipt](integration.md) and [synthetic Pi defect reproductions](review-2026-10-22.md) retain their original scope and do not establish behavior in this runtime.

## Source and preservation

On 2026-10-22, the official `deepseek-ai/deepseek-harness` `master`, the user's `bhjia-phys/deepseek-harness` `master`, and the original local checkout all resolved to `687f282e8625c6b8d11ff58211a90524be2e4317`, release `0.2.1-rc.2`. The new `harness` branch was created from that source and merges the previously published AITP-agent `4eaa9eaf449d5d6f8149872f427dc51aeb29f56f` history. It also carries the six latest uncommitted design files from the standalone checkout; the original files and dirty worktree are untouched.

`origin` is `bhjia-phys/AITP-agent`; `upstream` is the official Harness repository. These are Git checkout remotes, not a claim that GitHub changed the existing repository's fork-network metadata. The portable AITP submodule remains at `c2e7e3d0ddc386a2dafae244ccd71ff2d70adff3`. No old runtime stores, credentials or actual research materials are migrated.

The active application is under root `packages/` and `apps/`. The retained `agent/` tree is the earlier Pi implementation. New auth/branding integration uses supported Harness plugin/composition interfaces; isolated product state belongs outside the checkout. Internal upstream package names and legal attribution remain intact.

## GPT validation boundary

The current Harness provider supports separate API-key and ChatGPT/Codex authorization routes. Source inspection found an actual application gap: the generic authorization service had no shipped consumer for fresh Pi-provider sign-in. This change adds a terminal consumer through the normal Harness launcher; provider code and its credential store continue to own authentication. Existing Codex credentials are not silently copied.

The earlier repeated same-mode escalation and nonshrinking-summary reports concern older source. The selected baseline already includes corrections and regression cases. Passing those regressions supports their specific behavior, not general GPT quality or faithful preservation of research premises. The old live-provider test also selected only an Azure credential and used a removed inline credential field; the current change repairs route selection and tests it without secrets.

The login consumer is implemented in `apps/cli/src/aitp-auth.ts` and loaded by the ordinary headless profile with an auth overlay; it does not start a model task. The source launcher defaults to a separate `~/.aitp-agent` home. GPT defaults belong in the early base configuration: placing them in a late identity overlay was found to overwrite user provider routes/labels. The corrected profile test preserves those user settings and sees nine Codex catalog models from a synthetic grant. No personal Codex credentials were imported.

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

Actual ChatGPT sign-in, live GPT streaming/tool use, native packaged applications, accepted research cases, scientific validity and a safe AITP research-writing profile remain unverified. The first research slice and outstanding authoring/constraint-duration choices remain in [14](../../docs/agent/14-implementation-blueprint.md#runtime-integration-plan). The ordinary Harness app must not be presented as a completed AITP research-memory runtime.


## Assembled application and documentation checks

The real AITP source launcher was exercised with Chromium in an isolated temporary working directory and application home, using the required in-page picker overlay. The browser title and unique sidebar brand were `aitp-agent`, with no page errors. SIGTERM exited the wrapper with status 0, reaped the backend and closed its listening origin. This smoke plus the PWA metadata checks passed three tests in two files. No model turn or real credentials were used. The source is `apps/web/tests/aitp-brand.e2e.ts`; Windows lifecycle is not covered. This host lacked Chromium libraries, so five distro-library packages were extracted under a temporary directory and supplied through `LD_LIBRARY_PATH`; system packages were not changed.

```sh
node node_modules/vitest/vitest.mjs run --config vitest.web.config.ts apps/web/tests/aitp-brand.e2e.ts apps/web/tests/pwa-manifest.e2e.ts --maxWorkers=1 --fileParallelism=false --reporter=dot
```

The command requires installed Playwright Chromium and its runtime libraries. The executed local check additionally set `LD_LIBRARY_PATH=/tmp/aitp-chromium-libs-vmGTzS/root/usr/lib/x86_64-linux-gnu`.

Focused non-hash documentation checks passed: Markdown links (2025 files), wrap (2042), standing-document budgets, package README summary/model-experience/limitations, retained package-path references, source document references and tsconfig paths. Two focused document-scope suites passed 45 cases. The new slot/plugin/config catalog entries were added; slot and plugin-list freshness passed. Root instructions have a larger word budget to retain both fork onboarding and unchanged upstream engineering instructions. A graph-freshness check exhausted its roughly 2 GB Node heap; it produced no result or graph changes, and the owned residual process was stopped. Full upstream `doc-sync`, including hash/seal/reference checks, was not run under the retained no-hash instruction. No claim is made that every inherited upstream documentation/CI gate passes.

The final combined `pnpm aitp-agent build` ran after the auth, launcher, browser-test and documentation-tooling changes: all nine artifact and aggregate-check steps passed in 60.70 seconds with one gate worker. This supersedes the earlier build attempts for the final source state.
