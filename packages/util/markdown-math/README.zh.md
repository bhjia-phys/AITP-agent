---
description: "供 Markdown 解析器共用的 TeX 数学语法，支持渲染和来源链接发现并保留原文位置。"
kind: "package-library"
---

# Markdown 数学语法

[English](README.md) | 中文

## 概要

使用 `mathCompatibility()` 识别 Markdown 中的 TeX 反斜杠定界符。渲染器和科研来源解析器共用同一语法，使数学文本在显示和链接发现时保持原意。该工具保留原文位置，不添加模型提示词或工具。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

### 适用场景

当 Markdown 解析器需要让 TeX 反斜杠定界符与来源链接、选中文段共存时，使用此工具。

### 入口

将此工具与上游数学扩展和 MDAST 适配器一起注册：

```ts
import { fromMarkdown } from 'mdast-util-from-markdown'
import { mathFromMarkdown } from 'mdast-util-math'
import { math } from 'micromark-extension-math'
import { mathCompatibility } from '@deepseek-ai/dsh-util-markdown-math'

fromMarkdown(source, {
  extensions: [math(), mathCompatibility()],
  mdastExtensions: [mathFromMarkdown()],
})
```

解析器会返回数学节点，并为消费者保留原文位置。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

该工具使用既有数学 token 词汇添加 micromark 文本与区块分词器。渲染器和来源解析器共用此工具，使公式在消费者检查链接或选区时保留 Markdown 含义。原 `ui-primitives` 导入路径仍会再导出同一工具。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [浏览器 Markdown 解析器](../../client/ui-primitives/README.zh.md)
- [科研来源解析](../../research/research-resources/README.md)

-----

<a id="model-experience"></a>
## 模型体验

通过共用数学 token 的渲染器和来源链接消费者间接生效。

#### KV 缓存影响

无；此工具不添加提示词文本或工具定义。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

该工具仅识别 Markdown 语法：

- 它不计算公式，也不判断物理或数学正确性；未闭合定界符仍按普通 Markdown 解释。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

解析行为覆盖由消费者和来源解析器的检查负责。

</details>
