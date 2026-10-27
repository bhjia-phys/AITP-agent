---
description: "通过共享来源权限读取本地论文及准确 PDF 页面。"
kind: "package-reference"
---

# AITP 文献来源

[English](README.md) | 中文

## Summary

浏览已授权的 PDF、TeX、书目文件和已有原文阅读笔记。读取实际 PDF 页文字，保留原 PDF，并向会话消费者提供准确物理页或选中文字。论文身份和版本未知时保持未知；阅读器不下载或修改论文。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

将 `@deepseek-ai/dsh-research-literature` 与[共享科研来源](../research-resources/README.md)一起加载。根授权和二进制大小限制仍由共享服务负责。本插件投影已有文件，并从配置入口沿原文明确的 Markdown 阅读链接导航。

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `readingIndexPaths` | `["index.md", "README.md"]` | 根目录内已有的相对阅读入口。 |
| `primaryPdfOnly` | `false` | 可选仅列 PDF，排除解压出的 `source` 目录；标准 `arxiv/<id>/paper.pdf` 用实际的本地 arXiv 编号作为显示标题。 |
| `maxReadingNotes` | `256` | 一次目录投影最多检查的不同 Markdown 阅读笔记数。 |
| `maxPdfBytes` | `33554432` | 请求的 PDF 字节上限，仍受共享来源权限的更小限制约束。 |
| `initialPdfPages` | `4` | 未明确选择页码时，初次抽取的物理页数。 |
| `maxPdfTextCharacters` | `120000` | 完整抽取文字上限，超出时不静默截断。 |
| `maxInlinePdfBytes` | `1048576` | 文字阅读结果中内嵌的原 PDF 字节上限，精确定位页面也适用；原生二进制预览单独遵守共享来源的字节上限。 |

PDF 页码从一开始。PDF 自带页标签与物理页码分别保存。所选引文必须在当前抽取页面恰好出现一次。初始页面窗口会说明剩余阅读覆盖，其他页面可明确请求。文件名用于显示，不能证明论文或版本身份。阅读笔记的元数据仍属于该笔记，不会静默证明所有相链 PDF 的身份。

## Understand the implementation

<details>
<summary>实现细节 — 点击展开</summary>

共享服务提供有界字节和已登记来源根。[PDF.js](https://mozilla.github.io/pdf.js/) 的 Node 入口解析真实页面；取消会销毁加载任务并释放页面。Provider 返回页面文字，并在明确的内嵌上限内附带原 PDF 字节，引用打开精确页面时也适用。共享完整结果预算可以省略内嵌字节，同时保留可读文字。原生预览通过 `researchResources.readSourceBytes` 单独读取完整字节，继续遵守来源根授权和 `maxBinaryBytes`；正常省略内嵌字节不作为阅读问题提示，也不意味着原文不能显示；抽取覆盖范围仍明确说明。超出完整字节上限或失去授权时仍明确报告实际失败。链接的 Markdown 阅读笔记复用共享原文事实解析。[领域组合测试](../research-knowledge/tests/libraries-loader.spec.ts)验证实际 PDF 抽取，并逐个独立卸载库插件。

</details>

## Further Exploration

- [共享科研来源](../research-resources/README.md) — 有界来源读取。
- [科研记忆](../research-memory/README.md) — 实际上下文交付。
- [文献界面](../../../docs/agent/12-desktop-interface.md#literature-library-and-reader) — 版本、阅读笔记及原文导航。

## Model Experience

### Paper and page observations

#### What the model sees

本插件不创建模型请求。上下文消费者可以交付实际所选页面文字、一基 `page`、可选的文档声明 `pageLabel` 及来源限制。查看 PDF 与交付模型是不同的事实；文字抽取也不证明数学符号被正确理解。

#### Token effect

浏览不增加模型 token。只有接纳的抽取文字进入请求，最终预算由记忆消费者负责。原 PDF 字节是阅读材料，不是提示词正文。

#### KV Cache effect

来源抽取本身不改变请求缓存。新页面选择或来源变化可以影响科研记忆组装的上下文。

## Known Limitations and Deferred Work

- 扫描页需要独立 OCR provider。抽取文字为空时会报告，不宣称模型已经读过该页。
- 精确矩形区域抽取、密码输入、书目导入和网络发现尚不可用；准确页码和文字引文定位已支持。
- 未知版本仍未解析。PDF 抽取可能丢失数学排版，需保留原页面用于检查。
- 阅读笔记遍历有界，并报告未检查链接。这里不写书目、批注或来源文件。

### Dev Note

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
