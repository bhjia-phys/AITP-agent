# 02. Architecture

**Earlier implementation design.** The canonical target architecture is now
[10](10-project-workspace.md); current scope and progress are in [14](14-implementation-blueprint.md).
This document retains package/runtime design detail and its history. Where its desktop,
authoring, identity or startup proposals conflict with 10, use the explicitly revised
target in 10 and record any remaining code gap. Descriptions below do not establish
that their services are implemented. The current CLI supports only the read-only profile.

> **Current researcher instruction (2026-10-21): hash-related checks are disabled, including runtime file-version, conflict and approval-digest checks.** Legacy digest fields are optional historical metadata and never authorize, reject, match or certify content. This supersedes the hash-based requirements below. Current reads and explicit refresh replace checksum freshness checks; authority-bearing writes remain unavailable in the present slice. Stable opaque IDs and provider authentication protocols are separate from content-integrity checks.

Revised after design round 1 with GPT-6 Astra. The main changes:

- a separate Pi adapter;
- a richer execution port;
- an allowlist sandbox with typed outward operations;
- write serialization with honest guarantees;
- an action state machine for authority.

## Layers

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workbench (browser / installed PWA window on Windows)      apps/workbench   │
│   interaction and presentation only; no scientific ownership decisions      │
└───────────────▲───────────────────────────────────────────▲─────────────────┘
                │ local HTTP (REST)                          │ WebSocket (events)
┌───────────────┴───────────────────────────────────────────┴─────────────────┐
│ Server                                                    packages/server    │
│   CLI · routes · WebSocket hub · security · static files                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Runtime (AITP agent policy)                               packages/runtime   │
│   sessions and active tasks · instruction resolution · context assembly     │
│   tools and authorized-tool wrapper · actions and grants · sandbox driver   │
│   artifacts · controllers · review · method use · episodes · export         │
│                │ ExecutionPort (09 §10)                                       │
│ Pi adapter     ▼                                          packages/pi-adapter│
│   task shells · translation to pi-durable and pi-ai · only package importing│
│   @earendil-works/*                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Core (research model; no model, no Pi)                    packages/core      │
│   locations graph · note parsing · board · instructions · plans · knowledge │
│   works/editions/artifacts · checkouts · runs/campaigns · methods index      │
│   documents (change sets, locks, snapshots, journal) · derived index         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Protocol (serializable contracts, identifiers, schemas)   packages/protocol  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Name | Responsibility | May depend on |
| --- | --- | --- | --- |
| `agent/packages/protocol` | `@aitp/protocol` | Serializable contracts (09): identifiers, resource references, locators, manifests, actions, change sets, events, API types; zod schemas; JSON fixtures | `zod` |
| `agent/packages/core` | `@aitp/core` | Source interpretation, documents, provenance and derived indexes (03) | protocol, small parsing libraries |
| `agent/packages/runtime` | `@aitp/runtime` | Agent policy (04, 05): sessions, context, tools, authorization, sandbox, artifacts, controllers, review, method use, episodes, export. Programs only against `ExecutionPort` | core, protocol |
| `agent/packages/pi-adapter` | `@aitp/pi-adapter` | `ExecutionPort` on pi-durable and pi-ai: harness, extensions, task shells, model providers and credentials, event translation | protocol, runtime interfaces, Pi packages |
| `agent/packages/server` | `@aitp/server` | `aitp-agent` CLI, HTTP routes, WebSocket hub, security, static serving | runtime, pi-adapter, core, protocol |
| `agent/apps/workbench` | `@aitp/workbench` | The workbench UI (06) | protocol only |

Rules:

- **Pi is isolated.** Only `pi-adapter` imports `@earendil-works/*`. The runtime sees Pi through
  `ExecutionPort`, whose contract (09 §10) covers what the runtime actually depends on:
  - checkpointed task shells, ownership and cancellation;
  - submit, steer and follow-up;
  - context operations (deliver, supersede, reconstruct at a point);
  - effect receipts;
  - observation;
  - export.

  The import restriction is checked by a test.
- **Plain TypeScript on the server side.** Node 24 type stripping: erasable syntax only, `.ts` import
  extensions, `tsc --noEmit` for checking. The workbench is built with Vite.
- **Integration owns the shared files.** Only the integration stream changes the workspace configuration,
  dependency versions and the lockfile (08).

## Process model

- **One runtime process.** `aitp-agent serve` (Node 24) owns the pi-durable store, the derived index, the
  snapshot and artifact stores, and the write locks. A lock file in the data directory prevents a second
  instance, because pi-durable allows one process per storage. Browser windows are clients.
- **Subprocesses** each have a timeout, resource limits, an output cap, and cancellation through the task's
  abort signal:
  - sandboxed commands (bubblewrap);
  - `ssh` for typed cluster operations;
  - `git` for typed repository operations;
  - `rg` for search;
  - TeX engines for document builds.
- **Outbound network** (model providers, literature services) goes through the proxy configured in the
  environment (`HTTPS_PROXY`, `NO_PROXY`). The launcher starts Node with `NODE_USE_ENV_PROXY=1` so that `fetch`
  honours it; on this machine direct connections time out.
- **Crash and restart.** Startup runs in a fixed order (`server/src/compose.ts`):
  1. open the store without scheduling;
  2. recover interrupted change-set applications from their journals;
  3. scan the action records: records left in `reserved` or `executing` become `interrupted`, then `uncertain`
     for external effects or `failed` for local operations (04 §7);
  4. start scheduling.

  Replay-safe reads rerun; unsafe tools never rerun. The UI re-syncs from committed state on a new connection
  epoch (07).

## Pi integration

| Item | Choice |
| --- | --- |
| Packages | `@earendil-works/pi-ai`, `pi-durable`, `chord` at exactly `1.3.0`; `npm ci --ignore-scripts`. Implementations follow the installed 1.3.0 typings; the newer source checkout has unreleased behaviour (`sleepUntil`, crash-loop parking, a schema v2 migration) that must not be assumed |
| Storage | `openNodeSqliteStorage(<data>/runtime.sqlite)`; backed up before any upgrade |
| Settings | Compaction, retry, tool execution and progress as in the earlier review, overridable in configuration |
| Models | `createModels({ credentials: FileCredentialStore })`; providers `openai` (default; Sign in with ChatGPT or API key), `deepseek`, `anthropic`, `moonshotai` (reviewers by API key), `openai-codex` (legacy, off unless configured), `faux` (tests, demo) |
| Tools to Pi | AITP tools are registered through `defineTool`, each wrapped by the authorized-tool wrapper (04 §6). Specialist groups are `deferred` and loaded with `tool_search` (04 §5). Code mode is not used in version 1 |
| Upgrades | Never automatic. The conformance suite (probes A–E as tests) and the live GPT checklist gate every upgrade |

## Data locations

| Path | Content |
| --- | --- |
| `~/.config/aitp-agent/config.json` | Configuration (below) |
| `~/.local/share/aitp-agent/runtime.sqlite` | pi-durable store: conversations, entries, tasks, documents (session metadata, active tasks, actions, grants, controller state, method-use records, review coverage) |
| `…/index.sqlite` | Derived index; deletable, rebuilt from files |
| `…/snapshots/` | Immutable, content-addressed copies of note versions AITP observed or wrote; referenced versions are pinned (03 §12) |
| `…/journal/` | Change-set application journals for recovery after partial application |
| `…/episodes/` | Episodes of closed sessions (03 §11); not part of the disposable index |
| `…/locks/` | Per-path write locks among AITP writers |
| `…/scratch/<task>/` | Per-task sandbox scratch, removed after its outputs are exported |
| `…/artifacts/<id>/` | Exported outputs with a provenance record (inputs, script, command, checks, environment) |
| `…/exports/` | Reviewer-readable session exports (09 §11) |
| `…/credentials.json` (0600), `…/device-id`, `…/server.json` (0600), `…/logs/` | Credentials, installation id, server token, logs without message contents |

`AITP_AGENT_HOME` and `AITP_AGENT_CONFIG` override both roots. Every test uses temporary ones. The normative
schema is `Config` in `@aitp/protocol`; its shape:

```ts
type Config = {
  workspace: {
    root: string;                        // base of workspace-relative paths; default: parent of topicsRoot
    topicsRoot: string; knowledgeRoot?: string;
    extraReadRoots: string[];            // code checkouts outside topics, AITP checkout, skill sets
    locations: { path: string; kind?: "topic" | "branch" | "learning" | "record" }[];  // explicit main notes (TeX mains, stories)
    writeMode: "off" | "pilot" | "on"; pilotTopics: string[];
    previews: { openings: boolean; conclusions: boolean; parents: boolean };   // researcher preferences, default false
  };
  aitp: { checkout: string; extraSkillRoots: string[]; methodsBranchWorktree?: string };
  researcher?: string;                   // background and teaching preferences, free text
  models: {
    main: ModelChoice; reviewer?: ModelChoice; workers?: Record<string, ModelChoice>;
    budget?: { maxRequestFraction?: number };   // of the model's context window; default 0.6
  };
  clusters: { name: string; sshHost: string; scheduler: "slurm" }[];
  sandbox: {
    engine: "bwrap" | "none";
    readRoots: string[];                 // in addition to workspace roots: toolchains, interpreters, site-packages
    hiddenPaths: string[];               // never mounted, even if under a read root
    limits: { addressSpaceMB: number; processes: number; fileSizeMB: number; wallSeconds: number };
    maxConcurrentHeavy: number;          // default 1
  };
  python?: { interpreter: string };
  server: { port: number; host: "127.0.0.1" };
  ui: { theme: "system" | "light" | "dark"; language: "en" };
};
type ModelChoice = { provider: string; modelId: string; thinkingLevel?: "low" | "medium" | "high" };
```

## Security

- **Network exposure.** The server listens on `127.0.0.1` only. It checks `Host`, rejects cross-origin
  `Origin`, and sends no CORS headers. A 32-byte token in `<data>/server.json` is exchanged once for an
  `HttpOnly`, `SameSite=Strict` cookie; every request needs the cookie or a bearer header.
- **Path guard.** Every file access resolves real paths and must fall under a configured root, and no
  configured hidden path may be reached. Reads are size-limited. Writes go only through the document service,
  the code-change tools inside granted roots, or the sandbox's writable mounts.
- **Secrets stay server-side.** Credentials, tokens and the data directory are never readable by the model, the
  sandbox or the UI. This is achieved by mounting, not by scanning output.
- **Instructions are not data.** Text from notes, papers, files and the web reaches the model as framed data
  (04 §3), never as instructions, and never changes permissions.

## Sandbox for commands

The sandbox mounts an allowlist. Nothing outside it exists inside the sandbox. Bubblewrap applies mounts in
order, and a later bind can expose what an earlier mask hid, so **protective mounts come last**:

```text
bwrap --die-with-parent --new-session --unshare-all [--share-net only for a typed tool that needs it]
      --ro-bind /usr /usr --ro-bind /lib /lib --ro-bind /lib64 /lib64 --ro-bind /bin /bin
      --ro-bind /etc/alternatives /etc/alternatives --ro-bind /etc/ssl /etc/ssl   (minimal /etc)
      --ro-bind <each read root> <same path>                 # research roots, interpreter, site-packages
      --bind <data>/scratch/<task> /work                     # per-task scratch, the default writable place
      --bind <granted output root> <same path>               # zero or more, from an approved action
      --ro-bind <git dir> <same path>                        # every .git dir or file below a writable root, and the
                                                             #   git directory a worktree's .git file points to
      --tmpfs <each hidden path>                             # last: masks credentials and control stores
      --dev /dev --proc /proc --tmpfs /tmp --chdir /work
      --clearenv --setenv PATH … --setenv HOME /work --setenv LANG C.UTF-8
      -- prlimit --as=<bytes> --nproc=<n> --fsize=<bytes> -- /bin/bash -s     # the script arrives on stdin
```

- **Overlaps are refused.** A granted output root that contains a hidden path, the data directory or an AITP
  note store (`topics/`, `knowledge/` outside a granted research folder) is refused before the command runs.
- **Repositories below a writable root** are found at mount time (bounded search for `.git` entries, nested
  repositories and worktree metadata included) and bound read-only.

- **Hidden by default:** `~/.ssh`, `~/.gnupg`, `~/.codex`, `~/.claude`, `~/.config/aitp-agent`,
  `~/.local/share/aitp-agent` and browser profiles. Configured `hiddenPaths` add the rest, such as other agents'
  credential stores.
- **No network in the generic shell.** Outward operations are typed tools that run outside the sandbox with
  their own checks: literature metadata, paper fetch, cluster queries and submissions, and git operations.
  Commits are not possible from the shell, because `.git` is read-only; they go through `git_commit` under a
  grant.
- **Scripts by stdin.** Python analysis runs as `python3 -I -` with the script on stdin, so nothing depends on
  a host `/tmp`. Outputs are written under `/work/out/`.
- **Artifact export.** Before the scratch directory is removed, declared outputs (figures, tables, data) are
  copied to `<data>/artifacts/<id>/` with a provenance record: inputs and their hashes, the script, the
  command, the environment, exit status and the checks reported. The workbench shows artifacts with this
  provenance. "Add to note" proposes copying the artifact into an established research location through a
  change set.
- **Admission.** At most `maxConcurrentHeavy` commands at once (default 1). Others queue in the runtime, with
  their position shown.
- **Fallback.** Without a working bubblewrap (self-test at start), every command needs an approval card naming
  the exact command and its working directory. Such a command is **not contained**: the card and the receipt say
  so (`SandboxResult.contained = false`), and approval does not substitute for containment.

## Writes and their guarantees

| Writer | Guarantee |
| --- | --- |
| AITP writers (this runtime, its workers, the researcher through the workbench) | **Serialized and journalled.** Per-path locks, and compare-and-swap against the version read. Filesystem observers may see a change set partly applied. Recovery completes or compensates only where version checks permit; otherwise it preserves evidence and reports `recovery-required`. A rollback never overwrites an intervening external edit |
| External editors (Codex, Claude Code, Obsidian, a shell) | **Best-effort detection, not prevention.** The version read is copied immutably into the snapshot store. Before the rename, the original inode is also hard-linked, as an extra detection aid: a hard link follows later in-place writes and is not a snapshot. After the rename, the result is compared with the expected base. An external save detected inside the window is reported as a conflict, its content kept where it could be captured, and the merge view opens. Races remain when an editor writes or renames within the window; they are documented and narrowed, not excluded |

## Desktop delivery from WSL

The workbench is a PWA:

- manifest and icons;
- a service worker caching only the app shell;
- installable in Edge or Chrome on Windows as its own window.

`aitp-agent open` starts the server if needed, waits for health, and opens an Edge app window
(`cmd.exe /c start "" msedge --app=…`). It falls back to Chrome, then to `explorer.exe`, then to printing the
URL.

## Observability and limits

- Structured JSON logs without message contents; `GET /api/health`.
- `aitp-agent doctor` checks configuration, roots, AITP checkout, the bubblewrap self-test (including that
  hidden paths are invisible and the network is absent), `rg`, `prlimit`, TeX engines and `ssh` hosts. It
  makes no network connection unless `--network` is given.
- **Memory.** The server stays under 500 MB resident on a workstation shared with editors and other agents.
  Indexing is incremental. Notes are watched by polling; there are no recursive watchers on data trees.
  Builds run with `NODE_OPTIONS=--max-old-space-size=1024`.

## Repository restructure

This earlier layout described the original shared protocol worktree. The standalone
repository now links the protocol through `aitp/`; see the current [layout](../../README.md#relationship-to-aitp).
The original design intent remains:

| Path | Change |
| --- | --- |
| `plugins/aitp/` | Stays where Claude Code loads it and Codex installs it. Skills stay host-agnostic; no Pi concepts enter them |
| `plugins/aitp/agents/aitp-reviewer.md` | Names the exported workbench log (`aitp.workbench-log@1`) and its coverage limitations as a readable log format |
| `agent/` | New: npm workspace (protocol, core, runtime, pi-adapter, server, workbench), fixtures, tests |
| `docs/agent/` | New: this design |
| `AGENTS.md`, `README.md`, manifests | Describe the two surfaces. Plugin installation stays free of Node and runtime requirements. Public fixtures are generic; real-project trial records and screenshots stay outside the tree and its history |
| `.gitignore` | `agent/**/node_modules`, `agent/**/dist`, `agent/**/.vite` |
