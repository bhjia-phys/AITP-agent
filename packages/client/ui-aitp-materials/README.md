---
description: "Browse local research libraries, select exact sources and ask in normal Harness conversations."
kind: "package-reference"
---

# AITP material views

English | [中文](README.zh.md)

## Summary

Browse connected literature, knowledge and code libraries through independently composed modules. Open a current source, select sources or exact passages, and submit an explicitly global or topic-bound question through the existing Harness conversation path. Browsing and selection alone send no model request.

## Table of Contents

- [Configuration and behavior](#configuration-and-behavior)
- [Further Exploration](#further-exploration)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Configuration and behavior

The browser plugin mounts the shared `researchResources` Remote namespace. The Host [source service](../../research/research-resources/README.md) owns configured roots, guarded reads, provider projections and source limits. The browser accepts root and source IDs, never filesystem path grants. No fixture is selected by default. Missing connection, partial discovery and unsupported content remain visible beside retained observations.

`researchMaterials.registerModule` contributes reversible library entries. The library catalog stays in the main area on the left, while opening a source shows its details in the native document dock on the right. Global browsing keeps the library navigation; a research-scoped library retains the research tree and its topic discussions. The Materials store retains catalog filters, folder/scroll position and source-set drafts per research scope. The native dock owns document tabs separately for each library and scope, retaining mounted readers while switching tabs, libraries and topics. Source identity includes both root and source ID. A material's scientific or maintenance owner never replaces the explicitly selected question topic.

All reads use framework resources. Source notifications invalidate readings instead of publishing a second content cache. The shared reader factory renders Markdown, source text and PDF page observations; real PDF canvases use the existing document-preview PDF factory, Worker and assets. A retained document tab keeps its PDF page, zoom and scroll position while the catalog or conversation changes. An explicit citation opens at its own locator; a shorter refreshed PDF clamps the displayed page. Viewing a page does not narrow a whole-source selection or alter its citation. Native Markdown displays valid leading YAML as frontmatter fields and leaves malformed or unclosed metadata visible. The source-text view preserves the original text, and exact Markdown selections retain its original offsets. The same source address opens beside a normal Session; opening it does not attach it to the next model request.

Linked Markdown, images and source files open by their actual format in native document tabs beside the current library. The catalog remains in place; native tabs, closing and collapsing the dock control document navigation, while the library's topic-return action goes back to the originating topic. Native Markdown resolves authored local links and illustrations only through Host-observed source references. Inline images support the native enlargement, and standalone images retain native zoom and scroll position. Unsupported or unresolved local links do not fall back to Session filesystem access.

“Source sets and folders” connects an existing Harness Workspace through its ID; the Host resolves its authorized canonical path. Disconnecting withdraws that connection, while independent configured or research grants remain visible. Saved source sets live in Host operational storage and contain exact references and selected passages. Reopening them rereads titles and availability, retains missing references and preserves the question's current scope. A set's own recorded topic associations remain independent. Saving does not change any scientific source. Unknown save acknowledgements retain their original request and operation ID; the explicit check repeats that operation instead of creating another set.

An installed library contributes a related-library button to the Research-owned Topic materials extension. It opens the current topic's explicitly associated sources and invokes the owner's leave callback before navigation. Returning restores that exact topic's reading position and focus through the owner, without adding a duplicate Back destination. Removing a library removes its own button; the original material links keep working without these plugins. A bounded `sessionStorage` journal preserves unconfirmed source-set commands across reloads of the same tab. Restored commands are uncertain and never auto-submit; acknowledged completion clears the record. Unavailable or unreadable recovery storage remains visible.

Journal writes and recovery share the same record validation, pending-operation limit and encoded-byte budget. The journal does not impose another selection-count limit; the Host's configured source-set limit remains authoritative. A refused journal write preserves the previous recovery record and reports that the new operation cannot be recovered from tab storage.

With the optional research discussion service, “Discuss this source”, “Discuss this page” and “Discuss selected sources” show the current topic's native conversation in the main area on the left, keeping the document dock visible on the right. Closing that discussion returns to the retained catalog. Opening a library source supplies current reading context while no explicitly selected source set takes precedence; it does not add that file to a saved-set draft. The page action explicitly attaches the physical PDF page; ordinary page navigation and “Use this source” keep their existing locator semantics. Source selection changes prepare the next message without sending it. Reopening a saved source set updates the displayed selections and the next-message sources together, using the topic captured when loading started. A late load cannot replace newer selections or source-set edits, or a pending save/submission; typing a question does not cancel the load. Study shortcuts prepare an editable question in the same native composer. Its request ID, queue/steer mode, attachments and exact source locators go through the existing study transport together. Reply citations open the provider's material in the native dock and retain the topic return path. There is no second conversation runtime.

Global browsing, or an unavailable discussion plugin, retains the standalone question composer and opens the returned Harness Session after submission. A failed or uncertain response retains the question and selected sources; inspect existing conversations before submitting an uncertain request again. The Host owns actual context delivery and recovery. The client never marks a source delivered from a checkbox or a successful display.

The common catalog owns search, connected-folder filtering, loading/empty states and source-set commands. Its keyed `aitp.materials.catalog.body` position lets each domain supply its own list. The shared reader provides keyed `aitp.materials.reader.header` and `aitp.materials.reader.body` positions for domain-specific presentation while retaining PDF position, exact source selection and discussion actions. These positions carry observed JSON data and narrow callbacks. Domain plugins do not receive filesystem authority or import one another's components. Code folder position is retained in the existing per-scope view store.

When a later catalog page fails without retained rows, the error view keeps “First page” available. This explicit action clears only the page cursor, preserving the search and source-folder filters; refreshing does not silently discard the current page.

Source actions appear above the body; physical PDF text, source location and observation metadata are expandable. Empty source selection no longer reserves a blank composer: selecting a source reveals the existing question flow, and a retained question or uncertain operation remains visible. Library controls use Harness primitives, icons, fonts and theme tokens, with wrapping layouts down to 390 CSS pixels.

The reader's `presentation: 'dock'` mode fills the native sidebar without adding a second document heading or PDF paging toolbar. Native PDF and image viewers own their zoom and scrolling; the PDF's physical page still supplies precise discussion and quotation coordinates. Markdown retains its authored title and native frontmatter presentation, with source text available for exact selection. Ordinary Markdown notes omit repository controls, including when indexed by a code root. Source metadata and related links remain in a compact disclosure below the content. Code and patches use the shared `document.code.reader` factory; genuine repository views retain their guarded Changes and History navigation.

## Further Exploration

- [Knowledge module](../ui-aitp-knowledge/README.md)
- [Literature module](../ui-aitp-literature/README.md)
- [Code module](../ui-aitp-code/README.md)
- [Interface design](../../../docs/agent/12-desktop-interface.md#knowledge)

## Dev Note

Client declarations and module contributions remain reversible. Package tests cover the shared transport, source locations, explicit scope and failure recovery; the independent study surface also checks genuine answer coordinates and source-grounded task preparation. The [implementation plan](../../../docs/agent/14-implementation-blueprint.md#native-source-readers) tracks real provider and browser validation separately from component and registration tests.

PDF sources use the native document reader's `document.pdf.reader` factory for continuous pages, selectable text and zoom. The existing root-qualified source grant supplies complete bounded bytes through `aitp-material-bytes`; page text is a separate located source observation. Page, zoom and scroll position remain in the current research scope, with retired-view callbacks ignored. A quotation requires one physical page and a unique match in its current text; whitespace introduced by layout is mapped back to the source. Browsing never changes an already-selected source or submits a question. A missing binary provider or denied/oversized file remains visibly unavailable. The reader does not add OCR, PDF editing or annotation persistence.

Markdown and images use the native document plugin's `document.markdown.reader` and `document.image.reader` root factories. The materials owner supplies current text, authorized image bytes and source-navigation callbacks; it owns local image subscriptions and releases their Blob URLs when readings change. Image bytes use the same bounded `aitp-material-bytes` transport as PDF, and SVG stays in the native static image element. Previewing provides no OCR text, image-region quotation or automatic model image input.

## Model Experience

Indirectly, through the shared Host study handler and ordinary Harness conversations; only explicitly submitted questions deliver chosen references and excerpts.

#### KV Cache effect

The browser transport does not assemble model requests. The Host research-memory integration owns source-context updates and any resulting request-prefix change.

## Known Limitations and Deferred Work

- Question drafts and viewing state last for the loaded client. Pending source-set commands survive same-tab reload when session storage is available; closing the tab can discard that recovery metadata. Saved sets and operation receipts remain Host-owned.
- A missing question acknowledgement is not proof that no Session was created; automatic resubmission is disabled.
- Mathematical or cross-source rich selections need a separate located-selection adapter. Source-text selection refuses repeated or unlocatable quotes.
- Saved reading-note authoring, media generation and broad library curation require their separately scoped Host APIs and workflows.
- The PDF reader uses authorized complete bytes and physical page numbers. Office research reading, image-region selection, OCR, annotation persistence and editing are not provided by this view.
