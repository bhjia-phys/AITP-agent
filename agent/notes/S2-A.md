# S2-A: research core reading

## Implemented

- `config/`: environment and home defaults, inferred workspace root, protocol validation with field paths; retain the actual configuration directory for the read guard.
- `paths/`: canonical allowed roots and hidden-path checks, traversal and symlink rejection, bounded reads, content hashes and observation times, extension MIME types, inclusive byte ranges, and bounded directory enumeration. Linux reads recheck the opened descriptor's real path. No research writes.
- `notes/`: pure Markdown parsing through micromark-backed mdast with GFM and math; reference definitions, autolinks, heading slugs, explicit HTML anchors, raw fallback and warnings. Best-effort TeX title/opening/sections/labels/items. Current work preserves complete entry text and inclusive spans, gives pointers precedence, normalizes dispositions, dates, states, scope, and labelled continuation suggestions.
- `plans/`: level-two phases, full phase spans, operative heading or first bold sentence.
- `instructions/`: workspace rules, standing family passages, applicable root agreement items, checkout AGENTS/CLAUDE, and named Markdown guidance; exact passages, hashes, and fixed kind ordering.
- `board/`: one row per entry, owner context, state/owner/grouping filters including secondary grouping membership.
- `locations/`: link/map/configuration discovery, exclusions, scientific parents, graph, acyclic navigation projection with multiple users and Unmapped, direction/family groupings and display overrides, asynchronous target/anchor/pointer/plan resolution, using passages, refresh, and subscriptions. Scientific graph cycles remain intact.
- `index/`: lazy disposable SQLite WAL storage, heading-split FTS5 for main and linked supporting notes and knowledge, scoped bounded search with versioned passage references, namespaced JSON cache, content-hash incremental passage replacement, stale-document removal, status and rebuild. Connections close after each operation.
- Tests cover every S2 projection in `expected.json`, independent entry-boundary scans with exact text equality, instruction source slices and hashes, 3,500 generated malformed Markdown/TeX/CJK inputs, security boundaries, index behavior, plans, board filtering, refresh and navigation cycles. The real-workspace test is opt-in and uses temporary storage.

`documents/` remains the S2-B placeholder. No poller, runtime, manifests, dependencies, contracts or package entry points changed. No commits.

## Deviations and decisions

- Standalone HTML anchors are replaced with same-line HTML comments only for mdast tokenization; anchors and every returned passage are read from the original lines. CommonMark otherwise consumes a following heading into an HTML block. This is exercised by the fixture and a heading-with-lists regression.
- Default reads are limited to 8 MiB; listings count at most 2,001 raw entries, with a maximum returned limit of 2,000; search returns at most 200 passages. Enumeration stops even when entries are hidden.
- `groupings.json` has no shared wire schema. The implemented local form is an array of `{ id, title, members }`; matching ids replace display groupings, unknown members are ignored, and scientific parents remain unchanged.
- Discovery and indexing have defensive ceilings of 10,000 discovery documents and 20,000 index documents. Neither recursively walks directories. Unmapped discovery probes `research.md` exactly one directory level beneath known note directories, skipping truncated listings.
- The final real check keeps the requested threshold of 40 non-family main notes. This workspace currently exposes 38, plus four family maps. Earlier diagnostic runs counting 42 location records passed, but do **not** satisfy the stricter main-note criterion. The final test checks and prints the other observations before failing this threshold; it does not count family maps to manufacture success.

## Integration requests

No exports, dependency additions or edits to another stream are needed for the implemented fixture surface. No temporary service mocks were used.

The real-workspace acceptance threshold remains unmet: 38 main notes are link-reachable, rather than 40. A separate link-only index traversal found no additional `research.md` or `story.md` documents. The integrator should provide declarations for any established unusual/TeX main notes omitted by the test configuration, or reconcile the threshold with the present workspace. No research notes were created or modified to change the count.

Two contract limits remain for the integrator:

1. `onChange({ path, version })` cannot represent deletion. Refresh removes a deleted document from projections, but emits versions only for content that exists. S2-B should obtain a deletion event shape before promising deletion notifications. No mock masks this limitation.
2. `ResearchLocation.id`, `Outline.location` and pointer targets are `WorkspacePath`s, while configuration permits a knowledge root outside `workspace.root`. The filesystem can read separately allowed absolute roots, and ordinary absolute file links resolve, but external learning-location identities need an address-based contract or a requirement that `workspace.root` contain the knowledge root. Fixture and real checks use a common parent; no mock masks this limitation.

## Known gaps and limits

- **Acceptance item 5 is incomplete:** the present real workspace exposes 38 non-family main notes; the final strict run fails the required 40-note threshold. The graph, Current work, pointer, exclusion and index assertions pass before that count assertion.
- The opt-in real check demonstrates reading and derived indexing, not an independent agent research session, scientific correctness, or superiority.
- TeX parsing is best effort and does not expand macros or follow `\input` files.
- `refresh(paths)` requires the caller to name affected files; the S2-B poller is not implemented here. Deleted files have the notification limitation above.
- The disposable index persists search passages and generic cache values. The workspace model currently derives its graph and board in memory; other S2-B/S5 projections can use the namespaced cache. It does not implement the future full list of adapters in 03 §13.
- Absolute file links are resolved through the guard. The pointer contract still identifies workspace-relative locations only.
- Search treats supplied words literally rather than exposing the FTS query language.

## Acceptance evidence

1. Locked core typecheck and full core/integration test command below, including ownership and import boundaries. These are packaging and behavioral fixture checks, not evidence about science.
2. `notes/parser.test.ts` compares every expected thread field (including pointer, suggestion, anchors and plan) and every entry's independently computed complete span/text. `locations/fixture.test.ts` compares kind, format, scientific parent sets, complete stated scope projections, Unmapped and exclusions. `instructions/fixture.test.ts` compares kinds, paths, headings, full source slices and content hashes. Separate plans, board and index tests exercise behavior.
3. `notes/parser.test.ts`: 3,500 deterministic generated inputs, no new dependency, never throws and each result satisfies `Outline`.
4. `paths/guard.test.ts` and `config/config.test.ts`: outside roots, traversal, escaping symlinks, every exported built-in hidden home path, configured hidden paths and their aliases, runtime/config directories, size/range limits and a 2,005-file directory reported truncated.
5. `locations/workspace.real.test.ts`: skipped without `AITP_REAL_WORKSPACE`; explicit read-only run checks graph/index timing, reachable locations, every detected Current work section and preserved entry text, pointer success or warnings, and exclusions. All writes are fixture/index files in temporary directories. The final strict threshold fails at 38/40; four family maps are reported separately. Other checks pass before this assertion. This is a scripted read-only check, not an independent session.

## Commands and copied output tails

All successful compiler/test commands run from `agent/`, with the shared lock and `NODE_OPTIONS=--max-old-space-size=1024`. `npx --offline` uses installed dependencies without network. The two mistaken offline invocations from the worktree root failed before running compiler/tests; an earlier non-offline root invocation was interrupted with no output and no installed dependency changes. The initial index-file heredoc used the wrong relative directory and was immediately rewritten in the owned path.

### Initial compiler pass (before index body)

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Compiler after index

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Compiler after test additions

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Initial behavioral run

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  3 failed | 9 passed | 1 skipped (13)
      Tests  3 failed | 30 passed | 1 skipped (34)
   Start at  03:44:39
   Duration  8.04s (tests 71%, import 23%, transform 6%, worker 1%)

    Isolate  13 workers spawned · ~68ms startup each (spawn + environment, per file)
             at least ~818ms faster with isolate: false — reuses workers across files instead of one per file

```

### Mistaken root offline test command

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/vitest failed: cache mode is 'only-if-cached' but no cached response is available.
npm error Log files were not written due to an error writing to the directory: /home/bhjia/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### After HTML and parent fixes

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  33 passed | 1 skipped (34)
   Start at  03:45:35
   Duration  8.72s (tests 75%, import 19%, transform 5%)

    Isolate  13 workers spawned · ~68ms startup each (spawn + environment, per file)
             at least ~816ms faster with isolate: false — reuses workers across files instead of one per file

```

### First real check (stricter non-family count)

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts
```

```text
     29|     for (const l of locations) {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  03:45:52
   Duration  4.85s (tests 91%, transform 5%, import 3%)

```

### Diagnostic real rerun (private paths omitted from tail)

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts
```

```text
     30|     for (const l of locations) {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  03:47:49
   Duration  6.21s (tests 91%, transform 5%, import 4%)

```

### Mistaken root offline compiler command

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p agent/packages/core
```

```text
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/tsc failed: cache mode is 'only-if-cached' but no cached response is available.
npm error Log files were not written due to an error writing to the directory: /home/bhjia/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
```

### Expanded checks

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Navigation/config checks

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Disposition/date checks

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Absolute-link/grouping checks

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Expanded fixture run

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  35 passed | 1 skipped (36)
   Start at  03:49:21
   Duration  10.04s (tests 76%, import 19%, transform 5%)

    Isolate  13 workers spawned · ~74ms startup each (spawn + environment, per file)
             at least ~894ms faster with isolate: false — reuses workers across files instead of one per file

```

### Navigation/config fixture run

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  37 passed | 1 skipped (38)
   Start at  03:52:34
   Duration  12.39s (tests 77%, import 18%, transform 5%)

    Isolate  13 workers spawned · ~90ms startup each (spawn + environment, per file)
             at least ~1.08s faster with isolate: false — reuses workers across files instead of one per file

```

### Disposition/date fixture run

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  37 passed | 1 skipped (38)
   Start at  03:53:55
   Duration  20.38s (tests 75%, import 18%, transform 7%)

    Isolate  13 workers spawned · ~136ms startup each (spawn + environment, per file)
             at least ~1.63s faster with isolate: false — reuses workers across files instead of one per file

```

### Absolute-link/grouping fixture run

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  39 passed | 1 skipped (40)
   Start at  03:57:41
   Duration  9.91s (tests 77%, import 18%, transform 5%)

    Isolate  13 workers spawned · ~71ms startup each (spawn + environment, per file)
             at least ~854ms faster with isolate: false — reuses workers across files instead of one per file

```

### Live run with location-count interpretation

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts
```

```text
npm notice run 'vitest' run packages/core/test/locations/workspace.real.test.ts

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:49:35
   Duration  50.38s (tests 99%)

```

### Live console-output probe

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts --disableConsoleIntercept
```

```text
npm notice run 'vitest' run packages/core/test/locations/workspace.real.test.ts --disableConsoleIntercept

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:51:08
   Duration  56.91s (tests 99%, transform 1%)

```

### Live verbose run

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts --silent=false --reporter=verbose
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent

 ✓ |node| packages/core/test/locations/workspace.real.test.ts > reads the real workspace without recursive traversal or research writes 58330ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:55:09
   Duration  58.94s (tests 99%, transform 1%)

```

Other verification: `git diff --check` returned no output. A locked Node-only read diagnostic printed aggregate kind counts and kept its data in a temporary fixture directory; its exploratory output and the real-run diagnostic source paths stay outside this published tree.

## Final verification and remaining acceptance failure

The final strict live run observed 42 locations: **38 non-family main notes and four family maps**. Its graph took 3.933 s, its index took 35.545 s and held 1,079 documents. All 31 detected Current work sections parsed; their 101 entries preserved their line slices; all 38 pointers resolved; exclusions held. The threshold assertion runs after these checks and fails at 38/40. Counting four maps would conceal that failure, so the final test does not do so.

A locked, read-only diagnostic compared the index's link traversal against location discovery. It returned `{"extraMainCount":0,"extra":[]}`. No additional main-note path is being hidden behind the supporting-note link chains indexed here. No research files were changed.

### Final strict real-workspace run

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts
```

Copied aggregate output:

```text
{"locations":42,"reachable":38,"nonFamily":38,"families":4,"unmapped":0,"currentWork":31,"entries":101,"pointers":38,"unresolved":0,"graphMs":3933,"indexMs":35545,"indexed":1079}
```

Copied tail:

```text
{"locations":42,"reachable":38,"nonFamily":38,"families":4,"unmapped":0,"currentWork":31,"entries":101,"pointers":38,"unresolved":0,"graphMs":3933,"indexMs":35545,"indexed":1079}
 ❯ |node| packages/core/test/locations/workspace.real.test.ts (1 test | 1 failed) 45678ms
   × reads the real workspace without recursive traversal or research writes 45676ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |node| packages/core/test/locations/workspace.real.test.ts > reads the real workspace without recursive traversal or research writes
AssertionError: expected 38 to be greater than or equal to 40
 ❯ packages/core/test/locations/workspace.real.test.ts:44:30


⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  04:03:25
   Duration  46.24s (tests 99%, transform 1%)

```

### Final compiler

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline tsc --noEmit -p packages/core
```

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'tsc' --noEmit -p packages/core
```

### Final core and integration tests

```sh
NODE_OPTIONS=--max-old-space-size=1024 flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core test/integration
```

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  40 passed | 1 skipped (41)
   Start at  04:04:42
   Duration  9.57s (tests 77%, import 18%, transform 5%)

    Isolate  13 workers spawned · ~68ms startup each (spawn + environment, per file)
             at least ~816ms faster with isolate: false — reuses workers across files instead of one per file

```

The same compiler/test pair was also run immediately before the final heading-imperative regression; its compiler output was the two npm notice lines and its test tail was:

```text

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent


 Test Files  12 passed | 1 skipped (13)
      Tests  39 passed | 1 skipped (40)
   Start at  04:03:15
   Duration  9.78s (tests 78%, import 17%, transform 4%)

    Isolate  13 workers spawned · ~68ms startup each (spawn + environment, per file)
             at least ~821ms faster with isolate: false — reuses workers across files instead of one per file

```

### Summary-output live rerun before restoring the strict threshold

```sh
NODE_OPTIONS=--max-old-space-size=1024 AITP_REAL_WORKSPACE=/home/bhjia/physics/topics AITP_REAL_KNOWLEDGE=/home/bhjia/physics/knowledge flock /home/bhjia/physics/repo/AITP-agent-streams/.locks/heavy.lock npx --offline vitest run packages/core/test/locations/workspace.real.test.ts
```

This diagnostic counted maps and is superseded by the strict failure above. Copied tail:

```text
npm notice run aitp-agent@0.1.0 npx
npm notice run 'vitest' run packages/core/test/locations/workspace.real.test.ts

 RUN  v5.0.3 /home/bhjia/physics/repo/AITP-agent-streams/s2a/agent

{"locations":42,"reachable":42,"nonFamily":38,"families":4,"unmapped":0,"currentWork":31,"entries":101,"pointers":38,"unresolved":0,"graphMs":4069,"indexMs":34818,"indexed":1079}

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:58:43
   Duration  45.71s (tests 99%)

```
