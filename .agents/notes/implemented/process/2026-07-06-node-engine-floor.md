# Agent Note: Node engine floors for the installed workspace

Status: implemented

English | [中文](2026-07-06-node-engine-floor.zh.md)

## Problem

The root `engines.node` range is a contract for the installed workspace, including its development tools, not only for the runtime APIs the harness source calls directly. It must fit the declared Node support of the dependencies installed on each advertised branch; otherwise `pnpm install --engine-strict` rejects a supported version, and non-strict installs run outside a dependency's declared support.

## Decision

Set `engines.node` to `^22.22.2 || ^24.15.0 || >=26.0.0`. The AITP validation workflow runs keyless jsdom and real TypeScript language-server checks at `22.22.2` and `24.15.0`, independently of its main validation job on current Node 24.

The retained upstream compatibility matrix targets `['22.22.2', '24.15.0', 26]` under its repository and event conditions. Its primary Node 24 jobs own the complete typecheck and unit coverage inventory; compatibility jobs run focused source-worker, Zstandard, source-launch and [jsdom storage](../../archived/testing/2026-07-30-vitest-jsdom-webstorage-ownership.md) smokes without repeating that inventory. The real-API e2e workflow stays on Node 24 because it exercises API integration rather than the minimum patch.

The installed development dependencies determine this range: root `jsdom@30.1.1` declares `^22.22.2 || ^24.15.0 || >=26.0.0`, and the LSP provider's `typescript-language-server@6.0.0` declares `>=22.22.2`. These declarations raise the workspace's required versions without establishing that every published runtime package needs the same floor. Native addon manifests and the [bundled primary runtime](../../../../scripts/primary-runtime/lock.json) retain their independently owned contracts; this workspace change does not rewrite them.

Two source-runtime requirements also remain satisfied:

- **`node:sqlite`** — `packages/storage/storage-sqlite` imports `DatabaseSync` from `node:sqlite`, and the optional Session-query provider loads it on first search. The module dropped its `--experimental-sqlite` flag requirement at **22.13** and **23.4**.
- **Native TypeScript type-stripping** — the built-mode `apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts` smoke boots its `.ts` test-support driver under plain `node` and loads the `.ts` test adapter. Type-stripping is the default from **22.18** and **23.6**; earlier versions need `--experimental-strip-types`.

`@types/node` stays on the 22.x line to reject newer-major-only API use during typechecking. Its exact version remains owned by the root manifest, rather than a duplicated version in this note.

## Consequences

- The root range covers the installed development graph as well as the harness source requirements; Node 23 and 25 are outside the selected dependency's support range.
- The active fork workflow pins both supported LTS minima for keyless dependency checks. Broader source compatibility and Node 26 remain in the separately guarded upstream matrix. Floating `24` alone would not test the 24.x minimum patch.
- The built-mode smoke needs no version-conditional flag: type-stripping is already the default at the supported floors, so the example-owned TypeScript driver stays a plain `node fixture.ts` path.
- A future dependency or source API that raises the workspace floor must update the root `engines.node`, compatibility matrix, development guide and this Agent Note together.

## Alternatives considered

- **Keep `^22.19.0 || >=24.0.0`.** Rejected: it advertises workspace versions excluded by the selected jsdom and language-server declarations.
- **Use `>=22.22.2`.** Rejected: it also advertises Node 23, Node 24.0–24.14 and Node 25, outside jsdom's declared support.
- **Retain older development dependencies solely to preserve the old workspace floor.** Rejected: the selected dependency upgrades belong to the maintained development graph, and the supported LTS lines still have compatible patch releases.
- **Copy the workspace range into every published package and native addon.** Rejected: development-tool requirements do not establish an identical runtime requirement for those independently owned packages.
- **Matrix `[22, 24, 26]` without exact LTS floors.** Rejected: floating major entries drift upward and stop exercising the declared minimum patches.
- **Keep `@types/node` ahead of the supported LTS line.** Rejected: it permits newer-major-only APIs to compile and leaves their failure to runtime checks.
