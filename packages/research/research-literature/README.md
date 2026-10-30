---
description: "Read local paper artifacts and exact PDF pages through shared source access."
kind: "package-reference"
---

# AITP literature sources

English | [中文](README.zh.md)

## Summary

Browse admitted PDF, TeX and bibliography files alongside existing source-reading notes. Read actual PDF page text, retain the original PDF, and return an exact physical page or quote to a conversation consumer. Unknown work and edition metadata stay unknown; the reader does not download or modify papers.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

Mount `@deepseek-ai/dsh-research-literature` beside [shared research sources](../research-resources/README.md). Root admission and binary-size limits remain shared. This plugin projects existing artifacts and follows authored Markdown reading links from configured entry points.

| Field | Default | Meaning |
| --- | --- | --- |
| `readingIndexPaths` | `["index.md", "README.md"]` | Existing root-relative reading entry points. |
| `primaryPdfOnly` | `false` | Opt into a PDF-only catalog, excluding extracted `source` directories; canonical `arxiv/<id>/paper.pdf` uses its actual local arXiv identifier as the display title. |
| `maxReadingNotes` | `256` | Maximum distinct linked Markdown readings inspected in one catalog projection. |
| `maxPdfBytes` | `33554432` | Requested PDF-byte bound, further limited by shared source access. |
| `initialPdfPages` | `4` | Physical pages extracted when no page is explicitly selected. |
| `maxPdfTextCharacters` | `120000` | Complete extracted-text bound; excess text is not silently truncated. |
| `maxInlinePdfBytes` | `1048576` | Maximum original PDF bytes embedded in a text reading, including located pages; native binary preview uses the shared source-byte bound separately. |

PDF pages are one-based. PDF page labels, when present, are kept separately from physical page numbers. A selected quote must occur exactly once in the current extracted page. The initial page window reports remaining coverage; other pages can be read explicitly. A filename is a display title, not evidence of a work or edition. Authored reading metadata stays with its reading and does not silently establish the identity of every linked PDF.

Selected topic links can project exact PDF, TeX, bibliography and qualifying source-reading files beyond automatic discovery. Explicitly chosen artifacts are not filtered out by the global `primaryPdfOnly` discovery preference. Reading-note links remain navigable without recursive catalog expansion; work, edition and support remain unassigned unless actually recorded.

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The shared service supplies bounded bytes and registered root identity. [PDF.js](https://mozilla.github.io/pdf.js/) parses actual pages through its Node entry; cancellation destroys the loading task and releases pages. The provider returns page text and embeds original PDF bytes within the explicit inline limit, including when a citation opens an exact page. The shared complete-result limit may omit embedded bytes while retaining readable text. Native preview obtains complete bytes separately through `researchResources.readSourceBytes`, under unchanged root authorization and `maxBinaryBytes`; routine omission of embedded bytes is not a reading issue and does not mean the original cannot be displayed. Extraction coverage remains explicit. Oversized or unauthorized binary reads still report their actual failure. Linked Markdown readings reuse shared source-fact parsing. [The domain-composition test](../research-knowledge/tests/libraries-loader.spec.ts) validates actual PDF extraction while independently unloading each library plugin.

</details>

## Further Exploration

- [Shared research sources](../research-resources/README.md) — bounded source reads.
- [Research memory](../research-memory/README.md) — actual context delivery.
- [Literature interface](../../../docs/agent/12-desktop-interface.md#literature-library-and-reader) — versions, reading notes and source navigation.

## Model Experience

### Paper and page observations

#### What the model sees

This plugin creates no model request. A context consumer may deliver actual selected page text, one-based `page`, optional document-declared `pageLabel` and source limitations. Viewing a PDF is separate from model delivery, and extracted text does not establish that mathematical notation was interpreted correctly.

#### Token effect

Browsing contributes no model tokens. Only admitted extracted text enters a request; the memory consumer owns its final budget. Original PDF bytes are a reading artifact, not prompt text.

#### KV Cache effect

Source extraction itself changes no request cache. A newly selected page or changed source can alter the context assembled by research memory.

## Known Limitations and Deferred Work

- Scanned pages require a separate OCR provider. Empty extracted text is reported without claiming the page was read by a model.
- Precise rectangular region extraction, password entry, bibliographic import and network discovery are unavailable in this reader. Exact page/quote locators remain supported.
- Unknown editions stay unresolved. PDF text extraction may lose mathematical layout; retain the original page for inspection.
- Reading-note traversal is bounded and reports uninspected links. No bibliography, highlight or source file is written here.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
