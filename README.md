# aitp-agent

English | [中文](README.zh.md)

A modular research workbench for theoretical physics, developed on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and guided by the [AITP Research Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol). The research design stays centered on ordinary scientific records, explicit goals and boundaries, autonomous routine work, editable collaboration rules, and interfaces that show the information needed for the current decision.

The active application uses Harness plugins, services, Web UI and desktop infrastructure. AITP is designed to retrieve, prioritize, deliver and maintain important research memory through runtime services; portable Skills guide how the agent uses it. The agent chooses research actions flexibly from the question and evidence, without a fixed action-policy workflow. The current integration prepares the host, naming, method discovery and GPT login. The [runtime integration design](docs/agent/10-project-workspace.md#aitp-runtime-integration) and [development dependencies](docs/agent/14-implementation-blueprint.md#runtime-integration-plan) describe the research layer still to build. The earlier Pi implementation is retained under `agent/` as a reference and comparison baseline; its previous checks do not certify these workflows on Harness.

## Start here

- [current.md](current.md): design gaps, implementation boundaries and correction evidence.
- [Architecture](docs/agent/10-project-workspace.md): component responsibilities, cooperation and data ownership.
- [Development plan](docs/agent/14-implementation-blueprint.md): the sole owner of implementation scope, progress and acceptance.
- [Research cases](docs/agent/13-research-journeys.md): theoretical-physics tasks and actual coverage.
- [Development Skill](.agents/skills/develop-aitp-agent/SKILL.md) and [AGENTS.md](AGENTS.md): contributor entry and maintenance rules.
- [Harness integration evidence](agent/notes/harness-integration.md): the current source baseline, focused checks and remaining GPT validation.
- [Harness architecture](docs/architecture.md) and [development guide](docs/development.md): the application framework being extended.

Update the affected design, plan, cases and current.md together when behavior or evidence changes. Portable research procedures stay in the upstream AITP Skills; the application does not maintain a competing copy.

<a id="relationship-to-aitp"></a>
## Repositories and branches

The public repository remains [bhjia-phys/AITP-agent](https://github.com/bhjia-phys/AITP-agent). The `harness` branch inherits official DeepSeek Harness history and merges the previous AITP-agent history without rewriting it. `main` retains the previous published Pi baseline. The selected upstream baseline is `687f282e86` (`0.2.1-rc.2`), verified against the official `master` on 2026-10-22.

```sh
git clone --branch harness --recurse-submodules https://github.com/bhjia-phys/AITP-agent.git
cd AITP-agent
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
git fetch upstream
```

A Git remote is local checkout configuration, so each clone adds `upstream` once. Preserve the `origin` URL above. Future upstream updates are ordinary reviewed merges into `harness`; verify AITP plugins and retained research contracts before publishing. Keeping this repository address does not change GitHub's repository-network fork label.

The pinned [`aitp/`](aitp/) submodule links the portable protocol and Skills to their owner. Initialize it in an existing clone with `git submodule update --init --recursive`.

```text
packages/, apps/    Active Harness application and plugin/service implementations
docs/agent/        AITP architecture, plan, cases and design prototype
current.md         AITP design gaps and implementation boundaries
aitp/              Upstream portable research protocol and Skills (submodule)
agent/             Retained Pi application, synthetic fixtures and prior evidence
```

<a id="run"></a>
<a id="run-from-source"></a>
## Development and GPT access

Use the Node.js and pnpm versions declared in [package.json](package.json). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm aitp-agent build
pnpm aitp-agent auth list
pnpm aitp-agent auth login openai-codex
pnpm aitp-agent web --no-open
```

The launcher delegates to normal Harness profiles and applies AITP configuration. It defaults to `~/.aitp-agent` for settings, credentials and sessions; an explicit `DSH_HOME` overrides that location. It loads the pinned AITP Skills through the existing filesystem provider. An explicit `DSH_BUNDLED_SKILL_DIR` can select another protocol checkout. Build through `aitp-agent build` so the browser title is embedded as `aitp-agent`. The [development guide](docs/development.md) owns native prerequisites and the remaining upstream build commands.

`auth list` reports available methods and whether credentials are stored; it does not display credential values. `auth login openai-codex` starts the provider's normal interactive ChatGPT login. Complete its browser instructions, then select an available model from that provider in the Web application. The API-key route uses `auth login openai`; credentials are entered at the terminal prompt, not as command-line arguments. Authentication and account entitlement remain required for a real model request.

GPT API-key access and ChatGPT subscription sign-in are separate provider routes. The latter needs its own supported authorization flow; a Codex CLI login is not silently imported. Keep credentials, sessions, scratch experiments and actual research outside the published tree.

## Upstream and license

DeepSeek Harness supplies the application framework; AITP supplies the research design and its extensions. Internal `@deepseek-ai/dsh-*` package names and provider identities retain their upstream meaning. The product name is `aitp-agent`. DeepSeek upstream attribution and third-party notices remain intact; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
