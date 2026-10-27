---
description: "Browse connected local papers and editions through the shared material reader."
kind: "package-reference"
---

# AITP literature library

English | [中文](README.zh.md)

## Summary

Browse local papers, their recorded versions and reading notes. Open an observed source or choose it for a question while keeping its physical PDF page, source identity and explicit topic scope.

## Table of Contents

- [Configuration and behavior](#configuration-and-behavior)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Configuration and behavior

This browser plugin contributes the Literature entry, bibliographic collection rows and source header to [shared material views](../ui-aitp-materials/README.md). The collection separates title, authors, year and recorded reading coverage; narrow windows stack the same fields below the title. Reading notes and source files remain distinct. Missing fields say “Not recorded”, and opening a source never marks it read. The Host literature provider owns bibliographic interpretation and authorized file access. Unknown editions remain unknown; a similar filename is not substituted for an unavailable source.

PDF page text and complete bytes come from the shared source service. Visual pages reuse the existing Harness PDF renderer and same-version Worker assets. Questions continue through ordinary Harness Sessions; displaying a paper does not mark it researcher-read or model-delivered.

## Dev Note

The module registers keyed `aitp.materials.catalog.body` and `aitp.materials.reader.header` contributions. Their owner props contain observed source data and callbacks; the common reader retains source selection, PDF rendering, physical-page state, scoped questions and return navigation. There are no cross-plugin component imports. Focused tests cover absent bibliography and exact-passage versus whole-source selection. Shared client composition and lifecycle tests exercise all three domain plugins together and verify that removing one leaves the others available. Provider semantics remain in the corresponding Host package.

## Model Experience

Indirectly, through shared material selections and the Host study handler; browsing a paper alone supplies no model input.

#### KV Cache effect

The Host owns source-context assembly and cache effects.

## Known Limitations and Deferred Work

- Bibliographic import, remote discovery, duplicate merging, annotation writes and OCR are separate capabilities. A document page label is not automatically a checked printed page number. Missing or unsupported papers retain their actual state.
