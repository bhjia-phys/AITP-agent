---
description: "Inspect admitted local checkout identity, source ranges, changes and history."
kind: "package-reference"
---

# AITP code sources

English | [中文](README.zh.md)

## Summary

Browse admitted source files with their actual checkout, branch, HEAD and dirty state. Read code ranges, working or staged diffs, committed changes and bounded history without fetching, editing or running research code. Detached worktrees remain distinct; a source directory never silently substitutes its parent checkout.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

Mount `@deepseek-ai/dsh-research-code` beside [shared research sources](../research-resources/README.md). Admit the actual checkout root for Git views. Other admitted directories remain browsable files with Git availability stated honestly.

| Field | Default | Meaning |
| --- | --- | --- |
| `gitExecutable` | `git` | Local Git executable, invoked without a shell command string. |
| `gitTimeoutMs` | `15000` | Deadline for one Git process. |
| `maxGitOutputBytes` | `1048576` | Output bound; oversized observations are rejected rather than truncated. |
| `maxHistoryEntries` | `40` | Maximum commits returned by one history request. |

Code lines are one-based. Revision names resolve to actual commit IDs before source or committed-diff reads; the observed revision is retained with the result. Git views on a selected file remain restricted to that path, including when the locator omits a path; a different path is rejected. Select the checkout source explicitly to inspect a whole-checkout view. Working-tree and staged changes remain separate, and neither those diffs nor current status accept a historical revision they cannot use. History and committed diffs support explicit resolved revisions. Dirty paths have unknown Session attribution unless another record establishes it. Root registration grants reading, not code execution or mutation.

A topic may explicitly link an implementation, input or saved result outside the discovered checkout catalog. The exact-file projection labels checkout state as uninspected and does not launch Git, execute code or traverse surrounding directories. Markdown explanations, paper artifacts and images stay with their own readers; selected JSON/CSV/array outputs remain data entries in this code view.

A paper or thesis source archive in a general research root does not become computational code. Archives in explicitly classified code roots remain data entries at their original paths, with an unsupported inline-preview result; the reader does not unpack them or treat binary bytes as source text.

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The provider consumes the shared file scan and guarded source reader. Local Git commands disable optional locks, fsmonitor, hooks, configured clean/process filters, external diff and textconv. Output and time limits apply before presenting an observation as complete. Committed source reads reject symlinks and submodules. [The domain-composition test](../research-knowledge/tests/libraries-loader.spec.ts) boots actual plugins together, reads a dirty diff and verifies independent unloading without changing the source or Git index.

With bounded source watching, an observed checkout also watches up to five Git-owned metadata directories for changes to HEAD, the current branch reference, the index or packed references. Git resolves the metadata locations for ordinary checkouts and worktrees; the watcher does not expose those directories as readable sources. Changes invalidate the observation and a subsequent read reattaches the watches. If a watch cannot be established, the shared service reports that manual refresh is required.

</details>

## Further Exploration

- [Shared research sources](../research-resources/README.md) — root identity and read authority.
- [Research memory](../research-memory/README.md) — topic context and original human inputs.
- [Code interface](../../../docs/agent/12-desktop-interface.md#code-workspace) — formula-to-implementation reading.

## Model Experience

### Checkout and source observations

#### What the model sees

This plugin registers no model tool or prompt. A separate context consumer can deliver selected source lines or a Git observation with the observed `revision` and `startLine` from `ResourceBody`. A successful Git read is not evidence that an algorithm or numerical result is scientifically correct.

#### Token effect

Browsing contributes no model tokens. Admitted text is bounded here and again by the request-owning memory consumer.

#### KV Cache effect

This reader does not assemble requests. Changed source or selected revisions can change the context block supplied by research memory.

## Known Limitations and Deferred Work

- Git operations are local and read-only. Remote fetch, commits, editor/debugger integration and research execution receipts are outside this provider.
- Explicit historical code ranges can reopen a regular blob after the working file was deleted. The installed reader must resolve the commit, and the shared path checks still exclude internal paths and symbolic-link ancestors; unloading the reader makes specialized locations unsupported.
- Source scanning and Git output are bounded. File modification or an uncommitted diff does not identify which Session produced it.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
