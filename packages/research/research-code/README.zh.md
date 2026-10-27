---
description: "检查已授权本地 checkout 身份、源码范围、修改和历史。"
kind: "package-reference"
---

# AITP 代码来源

[English](README.md) | 中文

## Summary

浏览已授权源文件及实际 checkout、分支、HEAD 和未提交状态。读取代码范围、工作树或暂存差异、提交修改和有界历史，不执行 fetch、编辑或研究程序。Detached 工作树保留独立身份；来源目录不会静默替换为其父仓库。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

将 `@deepseek-ai/dsh-research-code` 与[共享科研来源](../research-resources/README.md)一起加载。Git 视图应授权实际 checkout 根。其他已授权目录仍可浏览文件，并如实显示 Git 是否可用。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `gitExecutable` | `git` | 不通过 shell 命令字符串调用的本地 Git 可执行文件。 |
| `gitTimeoutMs` | `15000` | 单次 Git 进程的期限。 |
| `maxGitOutputBytes` | `1048576` | 输出上限；超限的观察被拒绝而非截断。 |
| `maxHistoryEntries` | `40` | 单次历史请求最多返回的提交数。 |

代码行号从一开始。版本名称在读取源码或提交差异前解析为实际 commit ID，观察结果保留该版本。选中文件的 Git 视图始终限制在该路径，定位器省略路径时也不会扩大范围；指定另一个路径会被拒绝。查看整个工作树需要明确选择工作树来源。工作树和暂存修改分别表示，这些差异和当前状态不接受无法实际使用的历史版本；提交历史和提交差异支持明确解析的版本。没有其他记录支持时，dirty 路径归属哪个会话仍为未知。根登记只授予读取，不授予代码执行或修改。

## Understand the implementation

<details>
<summary>实现细节 — 点击展开</summary>

Provider 消费共享文件发现及受控来源读取。只读 Git 命令禁用 optional locks、fsmonitor、hooks、已配置的 clean／process filters、external diff 和 textconv。输出与时间限制在呈现完整观察前生效；提交源码读取拒绝符号链接及 submodule。[领域组合测试](../research-knowledge/tests/libraries-loader.spec.ts)同时启动真实插件，读取 dirty diff，并验证单独卸载不会修改源文件或 Git index。

启用有界来源监听时，已观察的检出还会监听至多五个 Git 元数据目录，以发现 HEAD、当前分支引用、index 或 packed refs 的变化。Git 自身解析普通检出和 worktree 的元数据位置；监听不会将这些目录开放为可读来源。变化会使观察失效，后续读取重新建立监听；无法建立监听时，共享服务提示需要手动刷新。

</details>

## Further Exploration

- [共享科研来源](../research-resources/README.md) — 根身份与读权限。
- [科研记忆](../research-memory/README.md) — 课题上下文与人的原话。
- [代码界面](../../../docs/agent/12-desktop-interface.md#code-workspace) — 从公式到实现的阅读。

## Model Experience

### Checkout and source observations

#### What the model sees

本插件不注册模型工具或提示词。独立上下文消费者可以交付所选代码行或 Git 观察，以及 `ResourceBody` 中实际观察到的 `revision` 和 `startLine`。Git 读取成功不证明算法或数值结果在科学上正确。

#### Token effect

浏览不增加模型 token。接纳的文字先受本插件限制，再受记忆消费者的完整请求预算约束。

#### KV Cache effect

阅读器不组装模型请求。来源变化或选择新版本可以改变科研记忆提供的上下文块。

## Known Limitations and Deferred Work

- Git 操作仅限本地只读。远程 fetch、提交、编辑器／调试器整合和研究运行回执不属于此 provider。
- 工作树文件删除后，明确的历史代码范围仍可重新读取普通 blob。已安装的读取器必须解析真实 commit，共享路径检查仍排除内部路径和符号链接祖先；卸载读取器后，专用定位明确不受支持。
- 源码发现与 Git 输出都有上限。文件修改或未提交 diff 不说明它属于哪个会话。

### Dev Note

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
