# Integrated read-only workbench

The W1 core-reading and Pi/session/context deliveries are integrated on `aitp-agent`. A partial W2 surface
connects them to a local server and React workbench. Real ChatGPT sign-in and three read-only research requests
have run successfully. **W2 and M1 are not accepted yet:** the authority service is still a placeholder, the
matched Codex comparison is outstanding, and live use exposed tool-declaration and presentation defects whose repairs have now been replayed, with a matched Codex comparison still outstanding. The strict main-note discovery gate remains at **38/40**.

The original [S2-A](S2-A.md) and [S3-A](S3-A.md) reports describe their deliveries before integration; their
source worktrees are preserved. Their post-W0 changes were uncommitted in the original worktree;
the standalone repository includes the selected application/design snapshot. Private workspace material, prompts,
answers, source audits and measurements stay outside the published tree.

## Implemented surface

- W1 transfer preserved 46 source files from the two stream worktrees against their common `fdfc7d2d` base.
  Integration preserves `SubmissionReceipt.reason`, keeps explicitly root-listed topics from being reclassified
  as branches, recognizes additional analytic-only scope wording, and rejects workspace configurations whose
  topics or knowledge roots cannot be represented by workspace-relative location identities.
- Workspace tools provide bounded current-source reads with observation times, FTS search, outlines and the board. They return research
  data in an explicit frame. They do not register command execution or research-file writes.
- The local HTTP/WebSocket server checks Host, Origin and authentication, exchanges fragment tokens for an
  HttpOnly SameSite cookie, validates protocol boundaries, streams session state with fresh epochs, and serves
  research files through the path guard. Raw HTML/SVG is sandboxed from the authenticated application origin.
  Unimplemented endpoints fail as unavailable rather than returning successful empty projections.
- The CLI initializes configuration without creating research notes and starts, opens or diagnoses the
  read-only workbench. Node's proxy API applies the environment proxy to provider requests.
- The workbench has project navigation, grouping/topic/note views, complete opening and thread text,
  mathematics, board, search, themes, a session dock, source/context views and sign-in settings. Session choice
  is retained locally by location. The composer exposes queue/steer delivery and preserves a task during an
  explicit interjection. Session restoration and the resulting dock passed the final browser run.
- Sign-in retains the browser link alongside the optional manual callback, replays both after reconnect,
  reuses a pending provider flow, permits cancellation without deleting earlier credentials, and displays
  allowlisted error diagnostics. Provider exception bodies and credentials are not exposed. An actual
  researcher sign-in succeeded after the original link-overwrite/duplicate-flow failure was repaired.
- Compaction persists a deduplicated review request and an actual session export. Reviewer execution and
  assessment are **unavailable until S3-B**; a queued request is not a performed review.

## Contract changes and deliberate deviations

- Read-only first startup remains fresh. Its own store may be reopened when a profile marker matches the
  workspace/AITP configuration identity and write mode remains off. Unknown/full stores and change-set journals
  are rejected. This permits the required restart experiment without enabling write-bearing recovery; the
  startup plan and composition comments were revised together.
- React and React DOM are pinned through root overrides to one installed version. A duplicate peer version
  caused a blank application during the first browser run; the repaired bundle subsequently passed.
- Optional provider token counters now travel in assistant transcript/export records, separate from context
  budget estimates. The protocol fixtures include these counters and rejected-submission reasons.
- `close_report` now derives its parameter schema from the shared `CloseReportPayload`, including the complete source-reference structure. The previous generic object declaration made a real model guess invalid source references and retry. The later researcher instruction separately removed digest/version validation; it is an explicit policy change, not a claimed check of the earlier failure.
- Required choice cards now project a waiting task and prevent Continue from bypassing an unanswered decision.
  A status interjection still retains the same active task. The server also reports waiting state consistently on live state changes and reconnect snapshots. The final synthetic regression run includes the waiting and Continue-guard assertions; the live replay confirms waiting state and task retention.
- **Researcher instruction: all hash-related checks are disabled, including runtime checks.** Current file reads no longer compute content digests; the index rebuild rereads its sources instead of comparing digests; explicit refresh rereads and emits observations without checksum freshness detection. Selected materials are not rejected for changed hashes, instruction renderings are shown separately without certifying equality to prepared text, and grants/change sets no longer require digest binding. Legacy digest fields remain optional, unvalidated historical metadata and do not affect request matching. New request matching uses explicit JSON bodies with legacy digest metadata excluded; old opaque fingerprints are ignored. The read-only store marker compares explicit configuration instead of a digest and upgrades its recognized legacy marker without checking the old digest. File-hash assertions and the pilot's before/after hashing were removed. Existing opaque ID generation and provider authentication protocols are unrelated to content-integrity checks and are retained.

## Validation evidence

Commands run from `agent/`, with one heavy command holding the shared lock throughout:

```text
NODE_OPTIONS=--max-old-space-size=1024 flock "$AITP_HEAVY_LOCK" npm run typecheck
[exit 0 in all seven workspaces, after the sign-in repair]

NODE_OPTIONS=--max-old-space-size=1024 flock "$AITP_HEAVY_LOCK" npm test
Test Files  25 passed | 1 skipped (26)
Tests       203 passed | 1 skipped (204)
[after token counters, close schema, waiting-task projection and hash-check removal]

NODE_OPTIONS=--max-old-space-size=1536 flock "$AITP_HEAVY_LOCK" npm run build:ui
✓ built in 1.18s
index JavaScript: 117.97 kB gzip; lazy Markdown JavaScript: 132.76 kB gzip

NODE_OPTIONS=--max-old-space-size=1024 flock "$AITP_HEAVY_LOCK" npm run e2e
passed: authentication, navigation, topic, themes, session, streaming, context,
1024x768 overflow, settings, sign-in link and optional callback, sign-in reconnect, cancel and retry
errors: []

NODE_OPTIONS=--max-old-space-size=1024 flock "$AITP_HEAVY_LOCK" npx vitest run packages/protocol packages/pi-adapter/test/conformance/port.test.ts packages/runtime/test/conformance/session.test.ts
Test Files  4 passed (4)
Tests       130 passed (130)
[after token-counter and close-schema changes, before waiting-task projection]
```

The initial W1-only integrated run was 181 passed / 1 skipped; it is superseded for tested surface by the
203-test run above. The opt-in real-directory count check has not been waived or changed: the original stream
observed 38 non-family main notes plus four maps and failed its 40-main-note gate. A later bounded inventory
found no additional active main notes; this does not settle whether the original survey and gate counted the
same population. No family map was counted as a main note to manufacture acceptance.

The real GPT pilot recovered qualified conclusions, stopped at a researcher choice, and preserved that task
during a parent-context status question. Its three end-to-end times were about 70, 85 and 43 seconds. This is a
scripted live pilot, not a completed matched comparison or scientific validation. The first request had three invalid `close_report` calls and one unresolved section lookup before recovery. The repaired replay took about 50, 52 and 43 seconds, with no close-report payload error; it retained one ordinary missing-path lookup followed by recovery. The successful replay does not erase the first-run failures. Authentication and the waiting task survived restart. Forced compaction retained that task and queued one review request in about 30 seconds. A fresh browser opened the real session and a citation to its main source without JavaScript errors; the renderer regression passes separately.

## Standalone repository validation

On 2026-10-22 the researcher authorized extracting and publishing the independent public
`bhjia-phys/AITP-agent` repository. The selected application/design snapshot retains the original
worktree's implementation; the original worktrees remain untouched. The `aitp/` Git submodule
points to upstream main revision `c2e7e3d0`, confirmed against the public remote. Local Git objects
were used to populate it after network clones stalled; `.gitmodules` retains the public HTTPS URL.
No unrelated protocol history, private research, runtime state, credentials or trial outputs enter
the application commit. The upstream repository remains the owner of the portable protocol.

Packaging changes are limited to the CLI's default protocol checkout and help, portable browser
test configuration, the opt-in workspace test's knowledge-root configuration, ownership of the
imported review note, and the repository/documentation entry points. The default and external
protocol paths were checked from a different working directory. The concurrent
[design-review observations](review-2026-10-22.md) are imported historical evidence, not rerun here;
their public-availability limits and the narrower Q06/Q14 interpretations are retained in current.md.

Validation used Node 24.18.0 / npm 12.0.1 with one heavy command at a time under the shared lock
and `NODE_OPTIONS=--max-old-space-size=1024`:

```text
npm ci --ignore-scripts --offline --fetch-retries=0 --fetch-timeout=15000
added 392 packages in 15s

npm run typecheck
[exit 0 in all seven workspaces]

npm test
Test Files  26 passed | 1 skipped (27)
Tests       204 passed | 1 skipped (205)

npm run build:ui
2306 modules transformed; built in 1.02s

Temporary CLI smoke: init / doctor / overwrite refusal, from an unrelated cwd
default aitp/ submodule: passed
explicit --aitp fixture checkout: passed
```

The initial full test run had 203 passes, one failure and one skip: the new review note had no
entry in `streams.json`. Adding integrator ownership for `notes/review-*.md` fixed that packaging
failure; the complete rerun above passed. Network installation attempts stalled, and an initial
offline attempt lacked cached packages. After filling the missing public registry cache entry,
the final clean offline install succeeded without changing the dependency lockfile.

The skipped test is the opt-in real-workspace discovery test; its old 40-note threshold remains
unresolved. Browser/E2E, live models, the private reproduction scripts, real research and scientific
acceptance were not rerun. Software checks and repository publication do not accept P1 or close
the design issues in current.md. Skill metadata and repository documentation links were also checked.

## Remaining work and acceptance boundary

S4-A still needs the action/grant wrapper, explicit authority records, once-grant concurrency and revocation/recovery tests. Checksum argument/target binding is disabled and is not a remaining requirement. Authority-bearing card responses and full execution are unavailable. The read-only
tool registry is the operative boundary in this milestone.

S6-A still needs a busy-turn delivery browser exercise, broader card behavior, hover previews and measured
contrast/accessibility acceptance. The broad reader, derivation, code, campaign and manuscript views remain
future work. S2-B documents, the command sandbox, effects, controllers, worker/reviewer execution and most S5
adapters remain placeholders. Source changes are refreshed on reads; there is no background external-change
poller yet. Reviewer exports explicitly report missing worker/reviewer and full-output coverage.

M1 still requires the matched usual-Codex comparison. An external-change exercise must respect the prohibition on modifying real
research files. Packaging, faux behavior and source-recovery success do not establish scientific correctness
or comparative quality. Breadth beyond the M1 gate is not accepted.

The subsequent fixture change removing synthetic source digests passed 28 targeted runtime/port/index tests. The same-note citation regression and source-link parser passed two UI tests, and the workbench typecheck passed. The full 203-test result predates the final same-note renderer test; it is not reported as a later full-suite rerun.
