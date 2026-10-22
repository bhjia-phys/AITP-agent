# AITP-agent

A research workbench for theoretical physics, built around ordinary research notes,
source material and the [AITP Research Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol).
Pi supplies model transport and durable execution; AITP supplies research and memory guidance.

The current application is a **partial read-only workbench** with note navigation,
search, persistent sessions, context inspection and model sign-in. The larger project
workspace, knowledge wiki, literature readers, independent review and controlled
authoring are under design. A passing software test does not establish scientific
correctness or researcher acceptance.

## Start here

- [current.md](current.md): design holes, implementation gaps and evidence still needed.
- [Architecture](docs/agent/10-project-workspace.md): how the completed components cooperate.
- [Development plan](docs/agent/14-implementation-blueprint.md): stage, authorized scope and progress.
- [Research cases](docs/agent/13-research-journeys.md): 21 concrete situations and actual coverage.
- [Development Skill](.agents/skills/develop-aitp-agent/SKILL.md) and [AGENTS.md](AGENTS.md):
  what contributors and coding agents should read and maintain.
- [Implementation guide](agent/README.md) and [design index](docs/agent/README.md): package commands and supporting documents.

Update affected architecture, plan, cases and `current.md` in the same change when
behavior, design or its evidence changes. The plan is the sole progress owner.

## Relationship to AITP

This is an independent application repository. [`aitp/`](aitp/) is a Git submodule
of the public AITP protocol repository, pinned to a specific revision. Its portable
Skills remain usable in Claude Code and Codex without this application. Changes to
those Skills belong upstream; this repository owns the workbench and its development Skill.

```text
agent/          Application, package contracts, tests and synthetic fixtures
docs/agent/     Architecture, development plan, research cases and design prototype
current.md      Current design and implementation issues
.agents/skills/ Repository-specific development guidance
aitp/           Pinned upstream AITP protocol checkout (Git submodule)
```

Clone with the dependency:

```sh
git clone --recurse-submodules https://github.com/bhjia-phys/AITP-agent.git
cd AITP-agent
# For an existing clone without the submodule:
git submodule update --init --recursive
```

The CLI defaults to this checkout's `aitp/`. An existing separate AITP checkout can
be selected with `init --aitp /path/to/AITP-Research-Protocol`. Upgrading the submodule
is an explicit dependency change: select an upstream revision, run the affected
checks, update the relevant development documents, and commit the new Git submodule entry.

## Run the read-only workbench

Requires Node.js **24.10 or newer** and npm. From the repository root:

```sh
cd agent
npm ci --ignore-scripts
npm run build:ui
node packages/server/src/cli.ts init --topics /path/to/topics --knowledge /path/to/knowledge
npm run doctor
npm start
```

`init` requires an existing topics directory; `--knowledge` is optional. It creates
a local configuration and refuses to overwrite one. To keep configuration and
runtime state isolated, use the CLI's `--config FILE` and `--data DIRECTORY` options.
The server prints a local access URL; sign in through its Settings view. `--faux`
uses a simulated provider. Keep configuration, credentials, sessions and actual
research outside the published tree. Only synthetic research fixtures are included.

## Origin and license

This repository starts from a selected snapshot of the original protocol repository's
`aitp-agent` worktree: its `fdfc7d2d` base plus the subsequent application integration
and design work present at extraction on 2026-10-22. The original worktree and its
history are retained separately; this initial commit does not import unrelated
protocol history or private trial records. See the [integration evidence](agent/notes/integration.md)
for historical checks and their limitations. Licensed under [MIT](LICENSE).
