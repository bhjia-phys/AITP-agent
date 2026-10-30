---
description: "Shared TeX math syntax for Markdown parsers that need rendering and source-link discovery to preserve source positions."
kind: "package-library"
---

# Markdown math syntax

English | [中文](README.zh.md)

## Summary

Use `mathCompatibility()` to recognize TeX backslash delimiters in Markdown. Renderers and research-source parsers share the same syntax, so mathematical text keeps its meaning during display and link discovery. The helper preserves source positions and adds no model prompts or tools.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

### When to use it

Choose this helper when a Markdown parser needs TeX backslash delimiters to coexist with source links and selected passages.

### Entry point

Register the helper beside the upstream math extension and its MDAST adapter:

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

The parser returns math nodes while retaining source positions for consumers.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The helper adds micromark text and flow tokenizers using the existing math token vocabulary. Renderers and source parsers share it so formulas keep their Markdown meaning when consumers inspect links or selections. The former `ui-primitives` import path re-exports the same helper.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Browser Markdown parser](../../client/ui-primitives/README.md)
- [Research source parsing](../../research/research-resources/README.md)

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through renderers and source-link consumers that share the parsed math tokens.

#### KV Cache effect

None; this helper contributes no prompt text or tool definition.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The helper recognizes Markdown syntax only:

- It does not evaluate formulas or check physical or mathematical correctness; unclosed delimiters retain ordinary Markdown interpretation.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Consumer and source-parser checks own parsing behavior coverage.

</details>
