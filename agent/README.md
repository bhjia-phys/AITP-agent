# AITP research agent: retained Pi implementation

This directory preserves the earlier Pi implementation, fixtures and receipts. Active aitp-agent development is now based on Harness under root `packages/` and `apps/`; use the [root README](../README.md) to run it and [14](../docs/agent/14-implementation-blueprint.md#harness-migration) for current scope. The commands and capabilities below apply only to the retained Pi profile. Its runtime stores are not automatically imported into Harness, and its past tests do not certify the new host. Do not use `agent/streams.json` or this npm workspace as the new application's ownership/build map.

Start with the [target architecture](../docs/agent/10-project-workspace.md),
[development plan and progress](../docs/agent/14-implementation-blueprint.md), and
[research cases](../docs/agent/13-research-journeys.md). This tree records the earlier partial implementation of that target.
Maintain the affected documents with each behavior/status change as required by [AGENTS.md](../AGENTS.md).
The contracts in
[`packages/protocol`](packages/protocol/src/index.ts) and the `contracts.ts` modules are normative
([09](../docs/agent/09-contracts.md)).

The development plan owns current stage and priority; [integration notes](notes/integration.md) retain the
implemented baseline and detailed validation evidence. The local
read-only workbench runs both simulated and real GPT sessions. A three-request live pilot has completed; full milestone and scientific acceptance remain pending. Hash-related tests and runtime checks are disabled by researcher instruction.

## Layout

| Path | Package | What |
| --- | --- | --- |
| `packages/protocol` | `@aitp/protocol` | Serializable contracts (zod), fixtures, the route and event tables |
| `packages/core` | `@aitp/core` | The research model: notes, locations, board, instructions, documents, knowledge, works, code, runs, methods, episodes, manuscripts |
| `packages/runtime` | `@aitp/runtime` | Agent policy: sessions, context, tools, authorization, sandbox, artifacts, effects, controllers, review, method use |
| `packages/pi-adapter` | `@aitp/pi-adapter` | The execution port on pi-durable and pi-ai; the only package importing Pi |
| `packages/server` | `@aitp/server` | CLI, HTTP and WebSocket server, composition root |
| `apps/workbench` | `@aitp/workbench` | The workbench UI |
| `test/support` | `@aitp/test-support` | Fixture workspace and in-memory state for tests |
| `test/integration` | — | Ownership, import boundaries, integration tests |
| `fixtures/workspace` | — | A synthetic research workspace; `expected.json` states what must be extracted from it |

Who owns which path is in [`streams.json`](streams.json).

## Commands

Run from `agent/` after `git submodule update --init --recursive` at the repository root.
Set one shared lock path for every concurrent developer process on the same machine:

```sh
export AITP_HEAVY_LOCK="${TMPDIR:-/tmp}/aitp-agent-heavy.lock"
export NODE_OPTIONS=--max-old-space-size=1024
npm ci --ignore-scripts                      # dependencies (the lockfile is owned by the integrator)
flock "$AITP_HEAVY_LOCK" npm run typecheck   # tsc --noEmit in every package
flock "$AITP_HEAVY_LOCK" npx vitest run      # all tests, one worker
AITP_REAL_WORKSPACE=/path/to/topics AITP_REAL_KNOWLEDGE=/path/to/knowledge npx vitest run real.test
flock "$AITP_HEAVY_LOCK" npm run build:ui    # the workbench bundle
```

Heavy commands run under the shared lock (one at a time across agents) with
`NODE_OPTIONS=--max-old-space-size=1024`.

To open a read-only workspace, run from this directory:

```sh
node packages/server/src/cli.ts init --topics /path/to/topics --knowledge /path/to/knowledge
npm run build:ui
npm start
```

`init` defaults to the root `aitp/` submodule; `--aitp /path/to/AITP-Research-Protocol`
selects a separate checkout. `npm run doctor` checks configured paths and the AITP memory Skill;
it does not test network access or enable research execution. The opt-in `test:real` retains
the old 40-note discovery threshold and is not a generic workspace acceptance test.

Use `--config FILE` and `--data DIRECTORY` on `serve` for an isolated installation; `--faux` uses the simulated
provider. The first start needs fresh data; later starts may reopen this profile's own configuration-bound
store. The CLI respects `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY`. Open the printed fragment-token URL locally,
then use Settings to sign in. The browser authorization link stays visible beside the optional manual callback
form. Cancel a pending flow before changing sign-in method. Credentials stay on the local server.

Browser checks require an existing Chrome/Chromium executable: set `AITP_CHROME=/path/to/chrome`
before `npm run e2e`. Set `AITP_BROWSER_LIBS` only if extra runtime library directories are needed.

## Conventions

- **Code.** Node 24 runs the server-side TypeScript directly, by type stripping:
  - erasable syntax only;
  - `import type` for types;
  - explicit `.ts` import extensions.
- **Dependencies.** Only `@aitp/protocol` imports `zod`, and only `@aitp/pi-adapter` imports `@earendil-works/*`.
  The root `node_modules` holds an older zod pulled in by SDKs, which must not be imported.
- **Tests write only under temporary directories.** Nothing here writes to a real workspace, another
  repository or the live AITP checkout.
- **Fixtures are synthetic.** No text of real research notes may enter this tree.
