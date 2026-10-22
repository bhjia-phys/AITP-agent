# aitp-agent

[English](README.md) | 中文

这是一个专注于理论物理科研与学习的 agent。我们的目的是借助 AI，更高效地探知真理：理解物理问题，检验已有认识，发现并纠正错误，逐步建立有依据的新认识。

学习与科研是同一个探索过程：阅读原始文献、理解必要的基础、展开理论推导、通过计算检验想法，并在证据变化时修正结论。项目设计重视明确的假设、可追溯的来源、可复现的检验，以及对不确定性的如实表达。进展意味着对物理有了更清楚的认识，论证过程及其局限也能由他人检查。

这个模块化科研工作台基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 开发，由 [AITP Research Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol) 提供可移植的科研方法。科研记录仍是普通文件；研究者确定目标与边界，AI 自主推进其中的常规步骤。规则编辑和只显示必要信息的科研界面仍是需要落实的设计。

当前主线使用 Harness 的插件、服务、Web 和桌面基础设施。AITP 的底层接入以科研记忆的选择、读取、上下文交付、压缩恢复和维护为核心；Skills 是其中的方法指导。AI 根据问题和证据自主选择动作，不设置固定科研动作流程。具体方案见[运行时记忆设计](docs/agent/10-project-workspace.md#aitp-runtime-integration)。`agent/` 保留此前的 Pi 实现与检查证据，不是新主线。旧测试通过不能证明新应用已完成科研记忆、上下文、独立审阅或写回；实际覆盖见规划和场景文档。

## 从哪里开始

- [current.md](current.md)：设计缺口、实现边界与纠错证据。
- [架构](docs/agent/10-project-workspace.md)：组件职责、协作关系和数据归属。
- [开发规划](docs/agent/14-implementation-blueprint.md)：当前授权、进度、依赖与验收的唯一维护处。
- [科研场景](docs/agent/13-research-journeys.md)：理论物理任务和实际支持情况。
- [仓库开发 Skill](.agents/skills/develop-aitp-agent/SKILL.md) 与 [AGENTS.md](AGENTS.md)：进入仓库后的读取与维护规则。
- [Harness 集成证据](agent/notes/harness-integration.md)：当前基线、实际检查和 GPT 验证限制。
- [Harness 架构](docs/architecture.zh.md) 与[开发指南](docs/development.zh.md)：底层框架和构建要求。

欢迎外部贡献，通过 PR 合入 `main`；范围、审阅与验证见[贡献指南](CONTRIBUTING.zh.md)。[自动化就绪情况](docs/agent/14-implementation-blueprint.md#development-readiness)区分本地检查与远程强制保障。

行为或证据变化时，同步维护受影响的架构、规划、场景和 current.md。通用科研方法仍归上游 AITP Skills，不在应用中维护另一套副本。

## 仓库与分支

公开地址保留为 [bhjia-phys/AITP-agent](https://github.com/bhjia-phys/AITP-agent)。`main` 是集成与默认分支，以快进方式接纳 Harness 主线及原 AITP-agent 历史，不改写已有提交。原 Pi `main` 保留在 `legacy/pi-foundation`；`harness` 继续保留为迁移分支。官方 Harness 是 Git `upstream`；保留原地址不会自动改变 GitHub 的 fork 网络标识。

```sh
git clone --branch main --recurse-submodules https://github.com/bhjia-phys/AITP-agent.git
cd AITP-agent
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
git fetch upstream
```

Git remote 是本地设置，新克隆需添加一次 `upstream`，`origin` 保持 AITP-agent 地址。后续在任务分支审阅官方更新，再合入 `main`，并验证 AITP 插件与科研约定。固定版本的 [`aitp/`](aitp/) 子模块连接科研协议和 Skills；已有克隆可运行 `git submodule update --init --recursive` 初始化。

```text
packages/, apps/    当前 Harness 应用与插件/服务实现
docs/agent/        AITP 架构、规划、场景和设计原型
current.md         设计缺口与实现边界
aitp/              上游可移植科研协议与 Skills 子模块
agent/             保留的 Pi 应用、合成 fixture 和历史证据
```

<a id="run"></a>
<a id="run-from-source"></a>
## 开发与 GPT 接入

使用 [package.json](package.json) 声明的 Node.js 与 pnpm 版本，在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm aitp-agent build
pnpm aitp-agent auth list
pnpm aitp-agent auth login openai-codex
pnpm aitp-agent web --no-open
```

启动入口调用正常的 Harness profile，并应用 AITP 配置。设置、凭据和会话默认位于 `~/.aitp-agent`；显式 `DSH_HOME` 可覆盖它。固定版本的 AITP Skills 通过既有文件系统 provider 加载，`DSH_BUNDLED_SKILL_DIR` 可指定其他协议路径。`aitp-agent build` 将浏览器标题设为 `aitp-agent`；原生依赖和其他构建命令以[开发指南](docs/development.zh.md)为准。

`auth list` 显示可用授权方式及是否保存凭据，不显示凭据值。`auth login openai-codex` 启动 provider 的交互式 ChatGPT 登录；按浏览器指引完成后，在 Web 中选择该 provider 可用的模型。API key 路线使用 `auth login openai`，在终端提示中输入凭据，不放进命令参数。实际登录、live GPT 请求和已运行的检查，以[集成证据](agent/notes/harness-integration.md)为准。

GPT API key 与 ChatGPT 订阅授权是不同路线；不会静默导入 Codex CLI 登录。凭据、会话、副本实验和真实科研资料都应留在发布树之外。

## 上游与许可

DeepSeek Harness 提供应用框架，AITP 提供科研设计和扩展。内部 `@deepseek-ai/dsh-*` 包名与 provider 标识保留上游含义，产品名称为 `aitp-agent`。上游归属和第三方声明保留，见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

英文与中文首页由人工审阅保持事实一致，采用 [AITP 文档维护例外](AGENTS.md)，不生成翻译哈希或配套校验文件。
