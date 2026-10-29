---
description: "Browse the existing AITP shared-knowledge collection through the common material reader."
kind: "package-reference"
---

# AITP knowledge library

English | [中文](README.zh.md)

## Summary

Open the existing AITP knowledge collection without creating a conversation. Browse its recorded entry kinds, support, researcher review, reading coverage and origins; open the source or select it for a scoped question.

## Table of Contents

- [Configuration and behavior](#configuration-and-behavior)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Configuration and behavior

This browser plugin registers an article index, source header and wiki reader with [shared material views](../ui-aitp-materials/README.md). The catalogue presents entry titles and short descriptions in one list, with a type filter for the loaded entries. Collection guides and full source/review details are collapsed by default; provisional research status remains visible. Original support and review text is retained on expansion. The reader uses Harness Markdown and math typography. Opening Contents reads the headings rendered in this article; selecting one scrolls to that exact heading, including duplicate headings, without inventing source anchors. Empty articles and articles without headings have explicit states. The Host knowledge provider owns index interpretation and source reads. No alternate knowledge store, topic tree or chat runtime is created.

The original [portable collection](../../../aitp/plugins/aitp/skills/aitp-memory/references/shared-knowledge.md) remains authoritative. Atoms, source readings, learning stories and optional author collections keep their existing locations and navigation. Provisional research pointers open the owning argument. Source support, researcher review and reading coverage remain separate as recorded. Selecting or saving a response does not promote a research result to an atom; the portable confirmation rule still applies.

## Dev Note

The module contributes keyed `aitp.materials.catalog.body`, `aitp.materials.reader.header` and `aitp.materials.reader.body` entries using JSON-compatible observed data and callbacks. Article text uses the shared `aitp.materials.markdown` factory, which composes the native document reader with guarded local-image reads and source-owned links. The common reader retains raw source mode, exact selection, related-source navigation, scoped discussion and return behavior. The contents list is local navigation over rendered headings, not a persisted citation locator. Focused tests cover provisional pointers, separate support/review/coverage, duplicate-heading navigation and the source-aware Markdown handoff; shared lifecycle tests verify independent plugin removal. Provider semantics remain in the corresponding Host package.

## Model Experience

Indirectly, through shared material selections and the Host study handler; browsing an entry alone supplies no model input.

#### KV Cache effect

The shared Host context integration owns model request assembly and cache changes.

## Known Limitations and Deferred Work

- Knowledge interpretation depends on the connected Host provider and its observed index coverage. This module does not certify scientific claims, invent missing classifications or implement independent review or atom promotion.
