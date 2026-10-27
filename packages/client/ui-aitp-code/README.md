---
description: "Browse actual local code checkouts, observed changes and source revisions."
kind: "package-reference"
---

# AITP code libraries

English | [中文](README.zh.md)

## Summary

Inspect connected local checkouts and their observed branch, revision and changed-path count. Open source or retained Git observations, select the relevant material and ask about it in the existing research conversation flow.

## Table of Contents

- [Configuration and behavior](#configuration-and-behavior)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Configuration and behavior

The plugin registers an independent Code entry in [shared material views](../ui-aitp-materials/README.md). The Host code provider owns checkout identity, bounded Git reads and source access; the browser cannot grant arbitrary paths or execute a Git operation. Two checkouts or two roots containing the same filename remain distinct.

The repository overview shows the observed branch and local-change count once per checkout. Opening a repository reveals a folder browser with retained breadcrumbs; search lists matching paths directly. Folders are derived from the returned source page, so the shared partial-results notice and pagination still apply. Topic-filtered results work without requiring a synthetic checkout entry.

The reader uses the native `document.code.reader` factory for highlighted source, numbered lines and copy/wrap controls. Markdown source files open through the shared native Markdown reader, with authorized local images and source links; raw mode keeps the original text. Source, Changes and History switch through the existing guarded read interface. Changes shows the real working-tree, staged or selected-commit patch, including for Markdown files. History displays only actual returned commits and opens their immutable revision. There is no invented commit activity or write action. Selecting a file, quoting source and opening the native research discussion retain the shared source identity, topic scope and return path.

Source text retains the revision and line origin supplied by the provider. Displayed changes are observations rather than claims that this conversation caused them or that a scientific calculation is valid. The current question scope remains independent of the source's maintenance owner.

## Dev Note

The module owns the `code` keyed catalog, reader-header and reader-body contributions declared by the shared materials plugin. Domain tests cover folder boundaries, topic-filtered repositories, real patch/history locators and malformed-observation fallback. Shared composition keeps transport, selection, loading, scope and plugin lifecycle in one owner. Provider semantics remain in the corresponding Host package.

## Model Experience

Indirectly, through shared material selections and the Host study handler; browsing a checkout alone supplies no model input.

#### KV Cache effect

The Host owns request assembly, rereads and any resulting cache changes.

## Known Limitations and Deferred Work

- This module adds no editor, debugger, execution permission or research-linked run receipt. Existing Harness editing and execution keep their own permissions. Unavailable checkouts, incomplete history and provider limits are shown as observed.
