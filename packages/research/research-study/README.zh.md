---
description: "保存临时研读笔记和真实 Harness 回答，保留已记录的来源。"
kind: "package-reference"
---

# 科研研读草稿

[English](README.md) | 中文

## Summary

保存手写笔记，或明确捕获普通 Harness 对话里已经完成的回答。草稿保留来源选择和记录的上下文，始终标为临时产物；安装共享科研来源服务后，还能重新作为来源打开。保存草稿不会改变科研决定，也不会晋升为 AITP 知识 atom。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

将 `@deepseek-ai/dsh-research-study` 与 Typert 一起加载。Host 存储只能来自 `dshHomePath('research-study')`；不提供此路径的 Host 明确返回 `unsupported`。可选共享来源桥只注册其空 `sources` 子目录和合成草稿读取器，不授权 Harness 主目录或 Session 目录。

| 方法 | 效果 |
| --- | --- |
| `getSetup` | 返回存储、回答捕获和来源桥是否可用。 |
| `listArtifacts` / `getArtifact` | 先分页浏览摘要，再打开完整内容和引用。 |
| `saveNote` | 保存手写 Markdown 或明确的编辑，保留人关联的来源选段。 |
| `captureAnswer` | 观察已有 Session，保存选中的已完成文字回答。 |
| `removeArtifact` | 只删除本插件的草稿，保留历史操作回执。 |
| `exportMarkdown` | 以数据返回可移植 Markdown，由客户端选择导出位置。 |

命名空间是 `researchStudy`。所有方法仅限 Host owner。捕获同时声明其 Session 资源，并使用 `sessionQuery.observeSession`，不创建 Agent、模型或另一套聊天。它接受已完成 turn 的最后一条文字 assistant message，拒绝失败 attempt、中断前缀、未完成 turn 和工具调用消息。

创建、编辑和删除都需要稳定的 `operationId`。响应丢失或返回结果未知时，用原身份重试完全相同的请求。同一身份改了内容会返回 `conflict`。版本只标记观察到的保存结果，不是批准保存的条件。达到上限时保留已有记录与回执，不自动清理。

| 配置 | 默认值 | 含义 |
| --- | --- | --- |
| `maxStateBytes` | `16777216` | 完整操作存储的字节上限。 |
| `maxArtifacts` / `maxOperations` | `1000` / `4000` | 草稿数量与保留的重试回执数量。 |
| `maxArtifactCharacters` | `128000` | 包括保留上下文的完整草稿字符数。 |
| `maxTitleCharacters` / `maxPageSize` | `200` / `100` | 单行标题长度与摘要分页上限。 |
| `lockWaitMs` | `15000` | 协作写入锁的等待上限。 |
| `maxCaptureEvents` | `20000` | 每次捕获处理的 canonical Session 事件上限。 |
| `exposeSources` | `true` | 是否启用可选共享来源贡献。 |

## Understand the implementation

<details>
<summary>实现细节 — 点击展开</summary>

一个有界 `state.json` 保存草稿与不变操作的回执。复用已有原子写入器和文件锁，串行发布协作 owner 的修改；本地队列在卸载时等待已接纳保存结束。原子替换支持进程重启，断电 fsync 持久性沿用已有 atomic-write 实现。不另存 Markdown 镜像，也不复制科研来源。

捕获保存真实 assistant 的 Session ID、序号、message ID、provider 和 model。人选择的来源仍是 `selected`；保留的具名运行上下文中的资料引用是 `recorded-context`；配对成功的 `research_read_source` 结果是 `recorded-source-read`。直接读取使用投影后保留的工具结果。PTC 子调用事件本身不能证明模型收到内容：嵌套读取还须有完整配对且成功的父调用链，其日志文本须完整出现在保留的 `run_code` 结果中，形式为原文或精确的 JSON 字符串编码；捕获序号指向该父结果。缺失、未返回、仅部分保留或转述的子调用文本不据此推断为已交付。失败读取和文字已被投影移除的上下文不产生这些证据。这些标记不表示模型已经理解内容、整篇资料已经读完或科学结论已验证。编辑保留原始回答引用，并将草稿标为已编辑。

可选 provider 在知识域投影 `kind: note`，明确标注 `study-draft`、模型生成或手写及临时状态。读取仍来自同一个操作存储，精确选段会校验原文，已删除草稿明确不可用；卸载会撤销自己的 provider 与狭窄根租约。文献、知识和代码插件仍可独立使用。

</details>

## Further Exploration

- [共享来源](../research-resources/README.md) — 带根身份的引用与普通研读对话。
- [科研记忆](../research-memory/README.md) — 有范围的上下文与科研记录。
- [知识来源](../research-knowledge/README.zh.md) — 既有 AITP 知识归属。

## Model Experience

### 临时草稿作为可选来源

#### What the model sees

本插件不添加 prompt、工具或生成回答。人明确选择草稿后，已有共享来源与科研记忆路径提供真实 Markdown、引用及 `Study draft: ...; provisional; ...` 状态行。报告、比较表、提纲、闪卡和思维导图只能由普通 Harness 对话实际生成。

#### Token effect

浏览摘要与保存草稿不增加模型 token。选择草稿沿用已有来源上下文预算；保留的上下文可能增大草稿，超过上限时明确失败，不静默截断。

#### KV Cache effect

本插件不改变模型前缀或缓存策略。正常的选中来源上下文仍由既有对话接入负责，并记录在日志中。

## Known Limitations and Deferred Work

- 插件保存文字回答和人编写的 Markdown，不生成固定模板报告、不执行 Skill、不发布科学结论、不晋升 atom、不导出非文字附件，也不提供 Audio/Video Overview。
- 已有 Session 观察可能先读取完整冷日志，再应用捕获事件上限。外部来源被删除或修改后仍保留历史引用，需要向当前归属方重新打开。

### Dev Note

[测试](tests/service.spec.ts) 覆盖真实 Session 观察、完成回答的限制、带归属的编辑和合成来源复用。[Loader 检查](tests/loader.spec.ts) 验证重启、不变重试回执、来源撤销和三库独立使用，不修改科研原文。这些工程验证不代表科研质量，也不代表与 NotebookLM 的功能等价。
