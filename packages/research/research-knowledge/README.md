---
description: "Browse existing AITP knowledge indexes, source readings and research pointers."
kind: "package-reference"
---

# AITP knowledge sources

English | [中文](README.zh.md)

## Summary

Browse an existing AITP knowledge collection without moving its explanations or copying research conclusions. The catalog follows authored indexes and links, preserves the recorded support and review labels, and opens provisional research pointers at their actual owners. Browsing creates no scientific files and starts no model conversation.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

Mount `@deepseek-ai/dsh-research-knowledge` beside [shared research sources](../research-resources/README.md). The shared service admits local roots; this plugin adds no path permissions. A root's `domains` can select knowledge alone or combine it with other installed domains.

| Field | Default | Meaning |
| --- | --- | --- |
| `indexPaths` | `["index.md", "README.md"]` | Existing root-relative index entry points. Missing paths do not create files. |

Index rows retain their question, authored kind, support text and source links. A single explicit Note/owner link opens that source, including another admitted root. Several competing targets stay as links on the index row. Existing frontmatter can identify atoms, source readings, learning stories and optional author collections; unfamiliar text remains available without being classified as an atom.

The [portable knowledge guide](../../../aitp/plugins/aitp/skills/aitp-memory/references/shared-knowledge.md) owns knowledge maintenance. A research-derived result remains a provisional index pointer until the researcher's confirmation permits promotion. This reader neither promotes entries nor adds an approval requirement to ordinary reading notes.

An explicitly linked Markdown note can also appear under its selected research topic without an index row. This projection reads only that note, preserves its authored title and metadata, and exposes its links without following them into additional catalog entries. It does not promote the note to accepted knowledge.

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The provider consumes one shared root scan and the shared Markdown/YAML fact reader. It inspects configured indexes and explicitly linked owners, preserving source offsets and original links. The shared service resolves cross-root targets, performs fresh guarded reads, handles catalog pagination and withdraws this provider when its Cordis fiber unloads. [The domain-composition test](tests/libraries-loader.spec.ts) boots all three library plugins through the actual Loader and unloads each separately.

</details>

## Further Exploration

- [Shared research sources](../research-resources/README.md) — source identity, authorization and reading.
- [Research memory](../research-memory/README.md) — actual question context and recovery.
- [Knowledge interface](../../../docs/agent/12-desktop-interface.md#knowledge) — source-backed navigation.

## Model Experience

### Located knowledge observations

#### What the model sees

The plugin adds no prompt or model tool. When a separate research-memory consumer admits a selected source, it can deliver the actual owner text, `SourceLocator` and recorded limitations. A provisional pointer identifies the question and owner; it does not supply a duplicated conclusion or scientific validation.

#### Token effect

Catalog browsing contributes no model tokens. The context consumer owns selection, delivery and complete request bounds.

#### KV Cache effect

This plugin does not assemble requests. Reread source changes can change the context block owned by research memory.

## Known Limitations and Deferred Work

- The catalog follows configured indexes; unindexed explanations are not automatically classified or presented as a complete semantic inventory.
- Multiple links, missing sources and unknown metadata remain explicit. Filename similarity does not resolve a disputed owner or establish support.
- The plugin reads sources only. Knowledge editing, index integration and researcher review use their separately scoped owners.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
