# 为 AITP-agent 作出贡献

[English](CONTRIBUTING.md) | 中文

AITP-agent 欢迎大家参与科研工作台、GPT 适配、插件、文档和场景测试的开发。`main` 是集成分支和默认分支。从它建立任务分支，并向 `main` 提交 PR；通过 PR 确定范围，在合并前审阅实际行为。仓库配置和保留的 Pi 历史见 [README](README.zh.md)。

先读 [AGENTS.md](AGENTS.md) 和仓库[开发 Skill](.agents/skills/develop-aitp-agent/SKILL.md)，再按任务查看相关的[当前设计缺口](current.md)、[开发分工与依赖](docs/agent/14-implementation-blueprint.md#development-crosswalk)、[架构](docs/agent/10-project-workspace.md)和[科研场景](docs/agent/13-research-journeys.md)。开发规划维护当前范围和进度；计划中的功能不能当作已经实现的能力。

并行开发前，在 issue 或 PR 中明确具体问题、对应场景、文件归属和共享接口。Claude 已交付文档 12 的 UI 设计与合成原型；Codex 负责客户端逐步实现、GPT、底层服务和共享定义的集成，客户端改动应按该交接协调。其他开发者可按规划中的分工认领范围明确的 provider 或回归案例。保留其他贡献者尚未提交的工作。可移植的科研方法由固定版本的 `aitp/` 上游项目维护；相关修改应向该项目提出，不在应用中另写一套。

每个 PR 聚焦具体问题，说明改动后的行为和相关验证，并在同一变更中更新受影响的架构、规划、场景和 `current.md`。遵守[测试规范](docs/testing.md)和[推送前指导](.agents/skills/dsh-pre-push-checks/SKILL.md)，运行与变更行为相称的检查，报告实际结果。区分源码检查、回放或模拟测试、真实模型测试与人工科学判断；保留失败、跳过和无法运行的检查。相关科研功能还需进行规划中的 [Codex + AITP 对照](docs/agent/13-research-journeys.md#comparative-evaluation)，或明确说明该对照为什么尚不能完成。

使用合成 fixture 或隔离副本。凭据、私人研究资料和本地试验记录不进入提交；文档或开发工作不授权真实笔记写入。遵守 AITP 文档的手动维护规则：已有双语版本应同步准确更新，不运行 AITP 的 hash 相关检查，也不生成翻译哈希。

本地 hooks 提供有限检查，包括推送时的类型检查。继承的远程工作流仍需适配本仓库的 runner、分支名称和审阅配置；`main` 尚无强制远程检查或审阅保护。因此，推送成功不代表 CI 通过或科研验收。在完成这些保障之前，通过 PR 审阅并如实报告已有证据。
