---
description: "Save provisional study notes and real Harness answers with their recorded sources."
kind: "package-reference"
---

# Research study drafts

English | [中文](README.zh.md)

## Summary

Save a handwritten note or explicitly capture a completed answer from an ordinary Harness conversation. Each draft keeps its source selections and recorded context, remains provisional, and can be reopened as a source when the shared research-source service is present. Saving a draft changes neither a research decision nor an AITP knowledge atom.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

Mount `@deepseek-ai/dsh-research-study` with Typert. Host storage comes only from `dshHomePath('research-study')`; a Host without it reports `unsupported`. The optional shared-source bridge registers only its empty `sources` child and a synthetic draft reader. It never grants access to the Harness home or Session directories.

| Method | Effect |
| --- | --- |
| `getSetup` | Report storage, answer-capture and source-bridge availability. |
| `listArtifacts` / `getArtifact` | Page through summaries, then open complete content and references. |
| `saveNote` | Save handwritten Markdown or an explicit edit, with human-linked source selections. |
| `captureAnswer` | Observe an existing Session and save its selected completed textual answer. |
| `removeArtifact` | Remove only this plugin's draft; retain its historical operation receipts. |
| `exportMarkdown` | Return portable Markdown as data; the client chooses an export destination. |

The namespace is `researchStudy`. All methods require the Host owner. Capture additionally declares its Session resource and uses `sessionQuery.observeSession`; no Agent, model or replacement chat is created. It accepts the final textual assistant message in a completed turn, rejecting failed attempts, interrupted prefixes, unfinished turns and tool-call messages.

Creation, edits and removal need a stable `operationId`. Retry the unchanged request with that identity after losing an acknowledgement or receiving an unknown outcome. A reused identity with changed content returns `conflict`. A version labels the observed saved draft; it is not a save approval condition. Limits retain existing records and receipts rather than pruning them automatically.

| Config | Default | Meaning |
| --- | --- | --- |
| `maxStateBytes` | `16777216` | Complete operational store bytes. |
| `maxArtifacts` / `maxOperations` | `1000` / `4000` | Draft and retained retry-receipt counts. |
| `maxArtifactCharacters` | `128000` | Complete draft including preserved context. |
| `maxTitleCharacters` / `maxPageSize` | `200` / `100` | Single-line title and summary page bounds. |
| `lockWaitMs` | `15000` | Cooperative writer-lock wait bound. |
| `maxCaptureEvents` | `20000` | Canonical Session events processed per capture. |
| `exposeSources` | `true` | Enable the optional shared-source contribution. |

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

One bounded `state.json` holds drafts and unchanged-operation receipts. The existing atomic writer and file lock serialize publications across cooperative owners, while a local queue drains admitted saves on unload. Atomic replacement supports process restart; power-loss fsync durability follows the existing atomic-write implementation. No Markdown mirror or scientific-source copy is maintained.

Capture preserves the actual assistant Session ID, sequence, message ID, provider and model. Human-selected sources remain `selected`; material references in retained named runtime context are `recorded-context`; paired successful `research_read_source` results are `recorded-source-read`. Direct reads use the retained projected result. PTC dispatch events alone establish no model delivery: a nested read also needs its paired successful enclosing chain and its complete logged text in the retained `run_code` result, verbatim or as an exact JSON string encoding. Its capture sequence names that parent result. Missing, unreturned, partially retained or paraphrased child text supplies no inferred delivery evidence. Failed reads and context whose text was projected away supply no such evidence. These labels do not establish model understanding, that every page was read or that a scientific claim was verified. Editing retains the original answer reference and marks the draft edited.

The optional provider projects `kind: note` in the knowledge domain, with explicit `study-draft`, generated/handwritten and provisional labels. It uses the same operational store for reads, preserves exact text selections, withdraws missing drafts, and disposes its own provider and narrow root lease on unload. The literature, knowledge and code plugins remain independently usable.

</details>

## Further Exploration

- [Shared sources](../research-resources/README.md) — root-qualified references and ordinary study conversations.
- [Research memory](../research-memory/README.md) — scoped context and scientific records.
- [Knowledge sources](../research-knowledge/README.md) — existing AITP knowledge ownership.

## Model Experience

### Provisional drafts as optional sources

#### What the model sees

This package adds no prompt, tool or generated answer. When a person explicitly selects a saved draft, the existing shared-source and research-memory route supplies its actual Markdown, references and `Study draft: ...; provisional; ...` status line. A report, comparison, outline, flashcard set or mind map is generated only through the normal Harness conversation.

#### Token effect

Browsing summaries and saving drafts add no model tokens. Selecting a draft uses the existing source-context budget; captured context can make a draft larger, and over-limit drafts fail without silent truncation.

#### KV Cache effect

No model prefix or cache policy changes here. Normal selected-source context remains owned and logged by the existing conversation integration.

## Known Limitations and Deferred Work

- The plugin saves textual answers and user-authored Markdown. It does not generate fixed-template reports, execute Skills, publish scientific conclusions, promote atoms, export nontext attachments, or provide Audio/Video Overviews.
- Existing Session observation may read a complete cold log before the capture event bound applies. Removed or changed external sources remain historical references and must be reopened through their current owners.

### Dev Note

The [tests](tests/service.spec.ts) exercise genuine Session observation, complete-answer controls, attributed edits and synthetic-source reuse. The [Loader check](tests/loader.spec.ts) validates restart, unchanged retry receipts, source withdrawal and independent libraries without altering their scientific files. These engineering checks do not establish research quality or NotebookLM feature equivalence.
