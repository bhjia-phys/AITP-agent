---
description: "Browse explicitly granted local research sources through shared guarded reads and replaceable library projections."
kind: "package-reference"
---

# Research resources

## Summary

Browse local literature, knowledge and code catalogs without creating a conversation. Keep equal canonical roots shared, distinguish same-named files in different roots, and open current text or domain-specific readings with their locations and missing-coverage reports. Source files remain authoritative. This package supplies no model, scientific database or source writer; separately composed providers interpret their own domains, and the existing research-memory integration handles explicit questions.

## Configuration and behavior

The service mounts as `@deepseek-ai/dsh-research-resources` and starts with no roots. Operators can configure absolute local `roots` with stable `id` values. Existing research enrollment can instead contribute an already-authorized root through `registerRoot`, retaining its current authority with the Host-only `isAuthorized` callback. Browser methods accept root/source identities, never filesystem-root paths. Remote reads and study submission are Host-owner-only.

Equal canonical directories share one root identity and counted leases. Disposing a lease withdraws only that contributor; the final lease withdraws the root. A live authority callback is checked on catalog and source operations, so removal or movement of a Workspace cannot silently retain its old read grant. Another independently configured grant remains effective. Root `domains` classify catalog projections and merge across current grants; omitting them offers the root to every installed domain. They do not grant access to another directory or enable source writes.

With `workspaceRootsInCatalog: false`, an uncategorized Workspace connection remains readable but is not automatically projected into global libraries. Configured roots and explicitly categorized contributions still appear. This is opt-in; the default preserves existing catalogs. Domain and root filters restrict the providers scanned for that catalog while authorized roots remain available to resolve actual links. The code provider can also list one immediate folder, with a folder-specific pagination cursor and the same path guard, without recursively scanning the checkout.

Directory pagination binds its cursor to the observed entries, so a changed listing rejects an old cursor even when automatic watching is unavailable. Providers may install their own bounded metadata observations while a root is active; disposal or invalidation withdraws them, and failure is reported rather than presented as automatic coverage.

`maxFiles` bounds discovered entries, including directories; `maxFileBytes` bounds complete text readings, and `maxBinaryBytes` bounds complete binary readings. Catalog-entry, page-size, complete-result, question and selection limits are configured separately. Oversized readings are rejected instead of truncated. Discovery excludes symlinks, Git internals, dependencies and research runtime state. Selected regular files require the same guarded path checks. Existing Markdown reads reuse [GuardedFiles](src/files.ts); [research-memory](../research-memory/README.md) retains its path IDs and topic interpretation.

A source read may name its requested library domain. The domain chooses that library's recorded title and metadata when a single file has several projections; it does not change the root/source identity or read authority. Old addresses without a domain remain valid. Code/Git and PDF-page locators require their corresponding readers, and inconsistent domain/locator requests are rejected. Markdown readings also expose actual authored links through the existing authorized-root resolver, bounded by the configured catalog-entry limit; omitted links remain an explicit reading issue.

For local `.pdf` links, a standalone `#page=N` fragment names the one-based physical page when `N` is a positive safe integer written in decimal digits. The PDF reader checks whether that page exists. Other decoded fragments retain anchor locators, including invalid page values and combined parameters; they are not silently opened at another PDF page. Markdown fragments remain anchors. Encoded filenames and cross-root links use the same existing path and authority checks.

Explicit archived-code readings may outlive deletion from the working tree. The shared guard still checks path spelling, excluded directories and existing ordinary ancestors; the installed code reader must verify a normal commit blob and return its actual immutable commit. A successful historical reading can supply an honest provider/path summary even when the current catalog has no file entry. A code, Git or PDF-page location without its specialized reader reports unsupported instead of returning a current whole file with a historical location.

Domain plugins contribute catalog projections and optional specialized readers through `registerProvider`. Every provider consumes the same bounded scan and file-access implementation. Provider failures, parser omissions and discovery limits remain visible; missing providers are not reported as empty complete libraries. A catalog entry can point from a knowledge index to a separately authorized research owner while retaining its catalog root. Local link resolution creates no new grant and leaves unknown or external links unresolved.

The public read methods list roots, browse/search catalogs, open sources and follow invalidations. Watching invalidates projections; a platform without recursive watching rescans on each read. Set `watchSources: false` to use the same fresh-read fallback without allocating recursive watches. External changes then require an explicit refresh in an already-open view. Set `watchMode: bounded` with watching enabled to watch only directories visited by bounded discovery and ancestors of opened sources. The per-root limit is the smaller of `maxFiles` and 1,024 directories; on failure or exhaustion the service reports that updates require refresh. Undiscovered unopened paths remain outside automatic coverage. Changes to the authorized-root set also rebuild cross-root links. Refresh does not fetch or alter scientific files. Disposing a provider removes its projections, while other providers continue to operate. The pure [protocol helpers](src/protocol.ts) encode source/locator links for both Host citations and browser readers.

`readSourceBytes` supplies a current local PDF or PNG, JPEG, GIF, WebP, BMP, ICO or SVG image to the native document viewer through Connection's binary transport. It accepts the same root-qualified file reference, rechecks owner/root authority and ordinary-path discovery, and rejects unsupported files, excluded paths, symlinks and complete files above the existing `maxBinaryBytes` bound. The filename and format header must agree. Header checks are not structural validation; native renderers own decoding errors. SVG bytes belong in the native static image element, never an HTML or document iframe. Unsupported HTML and arbitrary binary formats cannot use this endpoint. Bytes use the separate `aitp-material-bytes` resource address and are not limited by inline base64 or extracted-text result budgets. Metadata remains subject to the ordinary serialized-result limit. Viewing these transient bytes neither attaches a source to a model nor creates another scientific source or Session. Ordinary image reads expose an `image` body and MIME type without embedded bytes, OCR text or invented visual conclusions. Unindexed Markdown remains a guarded ordinary note with its filename and empty inferred metadata. Authored embedded images, including reference-style images and encoded relative paths, join the reading's resolved source links under the same root permissions. The parser keeps images separate from knowledge-index owner links, so illustrations do not create knowledge entries.

`connectWorkspace` explicitly attaches the current local directory of an existing Harness Workspace ID. The saved connection binds to that canonical path and is restored only while the same Workspace still authorizes that path. Removing it withdraws only the runtime connection; root metadata keeps independently configured or research-enrollment grants visible. Connecting never creates `research.md`, enrolls a scientific writer, or changes the source directory. A Host without `dshHomePath` reports that connection persistence and saved source sets are unsupported.

The Host owns saved source sets in `dshHomePath('research-resources', 'state.json')`, outside every registered source root. `listSourceSets` returns paginated summaries; `getSourceSet` returns complete references and short explicitly selected quotations. Sets may serve multiple actual topics. They do not own scientific conclusions or change the current question's topic. Missing references remain their original identities; opening the current source performs fresh authorization and reading.

Saving and removing sets use stable operation IDs with exact normalized request content. Unchanged retries return the original historical receipt; reusing an ID for different content is rejected. Retrying an old save after removal does not recreate the set. Atomic publication, complete UTF-8 store limits, bounded sets, excerpts and retained receipts prevent silent truncation or eviction. An uncertain publish returns `outcome-unknown` with the original operation ID so a client can retry the unchanged request. A damaged existing store is not replaced with an empty one. This operational store assumes one active Host owner; it is not a multi-process scientific database.

`registerTopicAssociations` accepts explicit source uses from an existing scientific owner. Shared catalog projection adds these actual Workspace/topic relationships; domain providers do not infer topics from filenames. A contributor can report unavailable owner coverage while returning independent relationships that were actually read; the catalog remains visibly partial. Host-only `resolveLocalLinks` resolves a bounded batch against one current authorized-root observation without reading or authorizing external targets.

`registerStudyHandler` connects one existing-conversation owner. Explicit questions carry selected sources, an optional actual topic and an optional saved-source-set identity; a missing handler reports unsupported. The handler owns source admission to the model and Session creation. Catalog browsing, checkbox selection and opening a file do not establish model delivery. Host-owned source sets preserve references; the existing Session runtime preserves actual conversation delivery and recovery.

## Further Exploration

- [Research-memory implementation](../research-memory/README.md)
- [Source contracts](src/types.ts)
- [AITP collection ownership](../../../docs/agent/11-research-memory.md#knowledge-collection)
- [Materials interface](../../../docs/agent/12-desktop-interface.md#materials-panel)

## Model Experience

Indirectly, through the existing research-memory consumer, which owns actual selected-source context, model tools and normal Session delivery while this service supplies guarded readings and saved references.

#### KV Cache effect

No direct model-request effect. The context-owning consumer decides whether changed source observations replace model context.

## Known Limitations and Deferred Work

- Search covers catalog titles, descriptions and authored metadata. It is not full-text or semantic corpus retrieval.
- Source identities track explicit roots and provider/path IDs; unknown external renames are unresolved. Root registration does not resolve every physical alias across overlapping directories.
- The service is a local read capability. PDF extraction, bibliography and knowledge interpretation, Git reads and other domain semantics require their respective providers.
- Discovery and domain projections are bounded and rebuildable. An indexed relationship is navigation evidence, not proof that a scientific claim is correct or every use has been found.
- Source mutation and conversation recovery remain in their existing or separately composed owners. Domain readers cannot grant those capabilities by returning content.
- Saved sets and operation receipts have explicit limits. Reaching a limit reports unavailable without dropping history; an operator must migrate the operational store before further publication. Atomic publication and process-restart recovery do not claim protection against arbitrary filesystem or hardware loss.
