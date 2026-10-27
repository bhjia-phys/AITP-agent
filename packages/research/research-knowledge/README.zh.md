---
description: "浏览已有 AITP 知识索引、原文精读和科研结果指针。"
kind: "package-reference"
---

# AITP 知识来源

[English](README.md) | 中文

## Summary

浏览已有 AITP 知识集合，保留解释原有位置和科研结论的唯一归属。目录沿用索引与明确链接，保留原记录的依据和审阅标签，并直接打开临时研究指针指向的课题原文。浏览不会创建科研文件，也不会启动模型会话。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

将 `@deepseek-ai/dsh-research-knowledge` 与[共享科研来源](../research-resources/README.md)一起加载。共享服务负责本地根的读授权；本插件不增加路径权限。根的 `domains` 可以只选择知识，也可以组合其他已加载领域。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `indexPaths` | `["index.md", "README.md"]` | 根目录内已有的相对索引入口。路径缺失时不创建文件。 |

索引行保留其问题、原类型、依据文字和来源链接。唯一明确的 Note／owner 链接直接打开对应来源，也可以指向另一已授权根。多个竞争目标继续作为索引行的链接保留。已有 frontmatter 可以表明知识原子、原文精读、学习问题链和可选作者研究；陌生原文不会被自动归类为知识原子。

[可移植知识指南](../../../aitp/plugins/aitp/skills/aitp-memory/references/shared-knowledge.md)拥有知识维护规则。源于研究的结果在研究者确认前保留为临时索引指针，确认后才可提升为知识原子。此阅读器既不执行提升，也不为普通阅读笔记增加确认要求。

## Understand the implementation

<details>
<summary>实现细节 — 点击展开</summary>

Provider 消费一次共享目录发现及 Markdown／YAML 原文事实解析。它检查配置的索引及明确链接的原文，保留源位置和原始链接。共享服务负责跨根解析、新鲜有界读取、目录分页，以及 Cordis fiber 卸载时的 provider 撤销。[领域组合测试](tests/libraries-loader.spec.ts)通过真实 Loader 同时加载三个库插件，并逐个卸载。

</details>

## Further Exploration

- [共享科研来源](../research-resources/README.md) — 来源身份、授权与读取。
- [科研记忆](../research-memory/README.md) — 实际问题上下文与恢复。
- [知识界面](../../../docs/agent/12-desktop-interface.md#knowledge) — 有原文依据的导航。

## Model Experience

### Located knowledge observations

#### What the model sees

本插件不增加提示词或模型工具。独立的科研记忆消费者接纳所选来源后，可以交付实际原文、`SourceLocator` 和已记录的限制。临时指针标明问题与原文归属，不复制结论，也不建立科学有效性。

#### Token effect

目录浏览不增加模型 token。选择、实际交付和完整请求预算由上下文消费者负责。

#### KV Cache effect

本插件不组装模型请求。重新读取的来源发生变化时，科研记忆维护的上下文块可能变化。

## Known Limitations and Deferred Work

- 目录沿用配置的索引；未进入索引的解释不会自动分类，也不被宣称已完整语义检索。
- 多个链接、缺失来源和未知元数据保持可见。文件名相似不能解决归属争议或建立科学支持。
- 本插件只读来源。知识编辑、索引整合和研究者审阅由各自限定范围的流程负责。

### Dev Note

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
