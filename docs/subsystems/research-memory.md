# Research memory

The [research-memory plugin](../../packages/research/research-memory/README.md) owns the `researchMemory` service. It reads explicitly configured workspace roots and contributes scoped research context and tools to the existing Harness loop. [The AITP memory design](../agent/11-research-memory.md#scoped-topic-backend) owns scientific scope and selective writeback; this page describes the implementation's data ownership.

| Data | Owner | Recovery |
| --- | --- | --- |
| Scientific accounts and materials | Existing Markdown files | Fresh scoped reads; unfamiliar forms remain readable text |
| Original human inputs, assistant questions and model working items | Existing Session events | `researchWorking` projection; bounded Session query for the same workspace and topic |
| Topic links and source observations | `MarkdownWorkspace` instance | Rebuild from files; path identities survive process restart, unknown renames remain unresolved |
| Prepared edits and application outcomes | Scratch writer runtime directory outside the source tree | Durable operation ID, observed per-file outcome and separate current-source observation |
| Project enrollment and topic creation | Application-owned grants and creation receipts outside scientific files | Fresh canonical Workspace authority, persisted write choice and original creation identity |
| Browser data | Existing Harness resources | Generated Remote transport and invalidation followed by fresh reads |

The root `research.md` is the project account. Explicit links determine topic parents and material ownership; directory proximity alone does not. Shared materials retain multiple possible owners. An unavailable configured root does not disable another successfully authorized root. A question carries its workspace, topic, material and optional selected passage; unresolved ownership stays visible instead of choosing a nearby topic.

Context reads select recognized question and current-answer sections as core account units, with explicit complete-unit budget omissions. A failed filesystem watcher triggers fresh discovery on reads; unchanged source membership and text retain pagination identity, while selected-source admission, changed sources or explicit refresh invalidate old cursors.

Partial discovery can admit a known selected in-root regular file and bounded relevant accounts recognized through explicit links. Reserved directories and symlink paths remain excluded; path probes do not infer parents. Established relationships survive unrelated selections, while competing explicit links retain ambiguity. This supplements the initial bounded scan without completing the inventory: incoming parent links and other material owners can remain unknown.

The required context section is delivered on actual model requests and retained by Harness's existing context records. Original human input, provisional model items, scientific source passages and historical content remain distinct. Historical input does not transfer action permissions. The current owner-only question producer and conservative history policy prevent a non-owner continuation from acquiring access to other conversations.

Unanswered assistant questions contribute their original wording and offered options to current and same-topic recovered context, with exact Session references that `research_read_context` can reopen. A missing linked structured reply establishes no human decision; later ordinary human answers and corrections retain authority. Whole-unit omissions remain explicit.

Historical recovery selects matching-topic conversations before applying the configured conversation limit. Its transient membership index uses current live projections or cold classifications validated against persistence identity, revision and Session lifecycle, and prunes removed Sessions. Unchanged unrelated classifications avoid body rereads. Cold classification and selected histories share a finite event-processing budget, with explicit incomplete-coverage notices; metadata enumeration remains unpaginated and a cold observation can still read a complete log. The index retains no raw log or scientific text and rebuilds after restart.

The browser and model tools share one literal-passage scratch writer. A prepared change may be `no-change`, `pending` or an edit; application reports complete, partial or uncertain outcomes. Applying text does not complete the proposal's remaining scientific integration. The writer preserves the source UTF-8 BOM and serializes source publication through one owning writer, so resource aliases share the same publication boundary. It coordinates its own calls only; arbitrary external editing and multi-file transactions remain outside its guarantees. [Package configuration and limitations](../../packages/research/research-memory/README.md) define the concrete bounds.

The owner explicitly enrolls a registered Workspace from Research; observing setup grants no source access. Read-only enrollment creates no scientific file. Writable initialization preserves an existing project account, and topic creation adds only the person's opening and explicit parent links. Creation shares the source-publication boundary with edits; both recheck the current write grant there. Provider disposal refuses new onboarding requests and drains already admitted source and receipt work. Static operator-configured limits retain precedence over enrollment.

The owner-scoped `getSessionMemory` read projects existing accepted Session events and registered message projections without starting an Agent or rereading scientific sources. It exposes exact named request-context snapshots with current, condensed, projected or superseded state; current files open through a separate note read. Per-file links retain unknown delivery state, and prose does not establish rule adoption. Output bounds report omitted complete units. The existing cold-history API can still load an entire Session before projection bounds apply.

The same plugin composes `researchMaterialFiles` for explicit new-file publication. `getLocation` resolves a recognized account and directory at any depth; `saveText` and `importPdf` exclusively create the chosen file and optionally add one ordinary account/index link. The model tools obtain authority from their actual Session and recheck it after waiting for the source queue. File publication, link outcome and current read-back remain separate. Payloads and receipts stay outside scientific sources; unknown writes are inspected rather than repeated, and existing names are never overwritten. PDF bytes require an already admitted source; a read-only library connection does not permit writing.

`automaticResearch: false` leaves explicit source operations available. A per-Session `setResearchMode` choice uses a native user-message source marker, survives replay and cannot be replaced by an older queued source submission. Off stops future automatic account/ancestor/recovery delivery, while selected materials and earlier history remain. A control choice does not enter the scientific-question index or start a model turn.

## Local libraries and source study

Local body discovery uses `SourceBodyQuery`, `SourceBodyHit` and `SourceBodySearch` through `researchResources.searchBodies`. It searches literal terms in admitted text/code and extracted PDF pages, keeping metadata/title search separate. Exact root-qualified source references and locators support a fresh guarded reread; coverage, excluded formats/directories and logical byte limits remain explicit. Unchanged observations can be cached after grant and file-metadata checks. The model tools `research_search_sources` and `research_read_local_source` expose this route without selecting message sources or granting writes.

Request context prioritizes original corrections and selected/observed evidence ahead of provisional items and routine receipts. An active account with unfamiliar headings remains readable as original text within the configured budget, or as a precisely located prefix when final request overhead requires an excerpt; absence of an overview projection does not establish absence of a conclusion. The optional task-card approach uses existing provisional state, and its correction action prepares an attributed draft rather than sending it or changing scientific files.

The source authority is [`research-resources`](../../packages/research/research-resources/README.md). Literature, knowledge and code are separate providers with independent Client plugins. They share root grants, root-qualified source identities, bounded discovery, source reading, invalidation and source links. Disabling one domain withdraws its entries without creating another chat runtime or changing the other domains' grants. The AITP overlay enables these plugins; the generic Harness profile keeps them disabled.

A person connects an existing registered Workspace for read access. A connection does not create or edit research files. Canonically identical roots share counted grants; each read rechecks current authority. A source identity includes its root, so equal filenames in different collections remain distinct. Deleting a file, disconnecting a root or removing a provider produces an explicit unavailable location. Source paths do not establish scientific scope.

The knowledge provider reads the existing AITP collection: its index, reusable atoms, source-ordered readings, question-led stories and optional author collections. Support, review and reading coverage retain separate meanings. Drafts and provisional research pointers do not become verified atoms. Literature reads existing PDF text with physical page locations, Markdown, bibliography and TeX sources. Code reads the existing checkout, status, diff and history without fetching or running repository helpers. Image-only PDFs require an additional transcription provider.

Authored links from a recognized `research.md` associate a material with its using topic and preserve the using passage as the reason. Cross-root resolution requires both roots to be authorized. The browser offers global library panels and the same reader within a topic. Entering a child-owned material from its parent's view keeps the explicitly selected parent question; ownership of evidence does not silently switch the conversation's scope.

Saved source sets are operational application data under `research-resources`, outside scientific files. They preserve selections and optional topic scope with stable operation identities for retry and restart. A Global study uses its source-set or study identity without inventing a topic or Workspace. An explicit topic study combines the topic account with its selected materials in the existing Harness Session. Human questions and corrections remain original Session evidence through compaction and recovery.

Current source passages carry exact text offsets, Markdown anchors, physical PDF pages or code revision/line locations. Long source retrieval uses bounded lexical matching, including Chinese pairs; it is not semantic search and does not establish complete reading. The final request assembler can refit eligible source excerpts to its complete envelope while preserving exact source offsets and blank lines; explicit original quotations remain complete or visibly omitted. Source locators are encoded once in their reopenable address. Omissions and stale selections remain visible. `research_read_source` can reopen only a currently selected source; normal source authorization and output bounds still apply. A historical selected quote is labelled separately from a fresh source observation.

[`research-study`](../../packages/research/research-study/README.md) saves editable notes and captures a completed answer from its actual Session event. One operational store owns these provisional drafts, their capture provenance and source references. Selected sources, recorded request context and successful source-tool results are distinct forms of evidence; none establishes that the model fully read a file. A draft may be exported or explicitly used as a source, retaining its generated/provisional identity. Saving a draft does not promote a research result into the knowledge collection or invoke a second research-file writer.

The first implementation supports local source reading, source sets, cited ordinary conversations and provisional text study products. It does not provide OCR, media transcription, generated audio/video, hosted sharing or automatic scientific promotion. Existing AITP Skills and the owning scientific notes retain their authority. The staged acceptance boundaries are in the [local-library implementation plan](../agent/14-implementation-blueprint.md#local-libraries).

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxresearchmaterialfiles--researchmaterialfiles"></a>

### `ctx.researchMaterialFiles` — `ResearchMaterialFiles`

The optional material service neither owns scientific records nor creates source grants.

```ts cordis-catalog
/**
 * Resolve the existing account at any depth without choosing a new file layout.
 * @param request - admitted Workspace and optional recognized topic.
 * @param signal - cancels source observation.
 * @returns real paths and separately configured write availability.
 */
@Remote({ name: 'getLocation', resources: { workspace: addressedWorkspace } }) async getLocation(request: { workspaceId: WorkspaceId; topicId?: TopicId }, signal: AbortSignal): Promise<Result<MaterialLocation>>

/**
 * Create a text, code or result file without replacing an existing path.
 * @param request - exact text, explicit destination and stable retry identity.
 * @param signal - cancels before publication admission; an admitted write retains its receipt.
 * @returns file and link outcomes independently, with exact current read-back.
 */
@Remote({ name: 'saveText', resources: { workspace: addressedWorkspace } }) async saveText(request: SaveMaterialRequest & { text: string }, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>>

/**
 * Copy an explicitly selected authorized PDF to a new destination.
 * @param request - existing source identity and separately writable destination.
 * @param signal - cancels source reading or waiting before publication admission.
 * @returns separate destination/link outcomes; the original PDF remains in place.
 */
@Remote({ name: 'importPdf', resources: { workspace: addressedWorkspace } }) async importPdf(request: SaveMaterialRequest & { source: SourceRef }, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>>

/**
 * Publish for an actual tool execution, rechecking its Session policy when the source lock is held.
 * @param request - bound destination and authored text or authorized PDF identity.
 * @param authorize - re-reads current scope and file permissions, never supplied by a remote caller.
 * @param signal - cancels before source publication admission.
 * @returns independent material outcomes retained by the writer.
 */
async publishForAgent(request: SaveMaterialRequest & ({ kind: 'text'; text: string } | { kind: 'pdf'; source: SourceRef }), authorize: () => Promise<void>, signal: AbortSignal): Promise<Result<MaterialWriteReceipt>>
```

Types: [WorkspaceId](workspace.md)

Source: [`packages/research/research-memory/src/material-service.ts`](../../packages/research/research-memory/src/material-service.ts)

<a id="ctxresearchmemory--researchmemory"></a>

### `ctx.researchMemory` — `ResearchMemory`

One source adapter per explicitly configured research root.

```ts cordis-catalog
/**
 * Observe owner setup before any source root has been authorized.
 * @param request - existing Workspace identity, resolved by the host registry.
 * @returns current access and explicit enrollment availability, without reading scientific content.
 */
@Remote({ name: 'getSetup', resources: { workspace: addressedWorkspace } }) async getSetup(request: { workspaceId: WorkspaceId }): Promise<Result<ResearchSetup>>

/**
 * Explicitly enroll a registered Workspace and create its root account only when absent.
 * @param request - Workspace and the owner's chosen source-write authorization.
 * @returns durable setup; configured deployment policy cannot be broadened here.
 */
@Remote({ name: 'initialize', resources: { workspace: addressedWorkspace } }) async initialize(request: { workspaceId: WorkspaceId } & ResearchInitializeRequest): Promise<Result<ResearchSetup>>

/**
 * Create a new ordinary topic account and append an explicit parent/child relationship.
 * @param request - Workspace, human-authored opening and stable retry identity.
 * @returns durable source identities, or an honest rejected, partial or unknown outcome.
 */
@Remote({ name: 'createTopic', resources: { workspace: addressedWorkspace } }) async createTopic(request: { workspaceId: WorkspaceId } & CreateTopicRequest): Promise<Result<CreateTopicReceipt>>

/**
 * Read provider capabilities for one explicitly configured root.
 * @param request - addressed Workspace; its root must be explicitly configured.
 * @param signal - cancels this caller while shared source refresh remains owned by the service.
 * @returns actual read/write and live-watcher capabilities, with any observation warning.
 */
@Remote({ name: 'provider', resources: { workspace: addressedWorkspace } }) async provider(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<ResearchProvider>

/**
 * Read the research overview.
 * @param request - Workspace whose root account is read.
 * @param signal - caller cancellation for source reads.
 * @returns a fresh project observation or a typed source failure.
 */
@Remote({ name: 'getProject', resources: { workspace: addressedWorkspace } }) async getProject(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Project>>>

/**
 * Read a bounded page of authored topic relationships.
 * @param request - Workspace and parent/cursor selection.
 * @param signal - caller cancellation for discovery and reads.
 * @returns a bounded topic page with explicit incompleteness or a source failure.
 */
@Remote({ name: 'listTopics', resources: { workspace: addressedWorkspace } }) async listTopics(request: { workspaceId: WorkspaceId; query: TopicQuery }, signal: AbortSignal): Promise<Result<ReadEnvelope<TopicPage>>>

/**
 * Read one topic from its source.
 * @param request - Workspace and provider-owned topic identity.
 * @param signal - caller cancellation for this read.
 * @returns the current topic account or an explicit unavailable result.
 */
@Remote({ name: 'getTopic', resources: { workspace: addressedWorkspace } }) async getTopic(request: { workspaceId: WorkspaceId; topicId: TopicId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Topic>>>

/**
 * Read one material, retaining explicit unavailable content.
 * @param request - Workspace and material identity.
 * @param signal - caller cancellation for this read.
 * @returns source content or its typed missing/unsupported state.
 */
@Remote({ name: 'getResource', resources: { workspace: addressedWorkspace } }) async getResource(request: { workspaceId: WorkspaceId; resourceId: ResourceId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Resource>>>

/**
 * Prepare bounded source material; this is not a model-delivery receipt.
 * @param request - Workspace, topic and requested context bounds.
 * @param signal - caller cancellation for source preparation.
 * @returns complete qualified source units and omissions, or a typed read failure.
 */
@Remote({ name: 'readContext', resources: { workspace: addressedWorkspace } }) async readContext(request: { workspaceId: WorkspaceId; query: ContextQuery }, signal: AbortSignal): Promise<Result<ReadEnvelope<ContextRead>>>

/**
 * Read original inputs, provisional items and recorded context at one immutable Session cut.
 * @param request - existing Session identity; reading never creates an Agent or a conversation.
 * @param signal - cancels observation and configured-root authorization.
 * @returns bounded memory, null for an ordinary unbound Session, or an explicit unavailable result.
 * @throws when the caller is not the owner or the recorded root is outside configured access.
 */
@Remote({ name: 'getSessionMemory', resources: { session: addressedResearchSession } }) async getSessionMemory(request: { sessionId: SessionId }, signal: AbortSignal): Promise<Result<SessionMemoryView | null>>

/**
 * Explicitly rescan a root after external edits or a reconnect.
 * @param request - Workspace to invalidate and rebuild.
 * @param signal - cancels this caller without cancelling another reader.
 * @throws if the root is unavailable or the shared rebuild fails.
 */
@Remote({ name: 'refresh', resources: { workspace: addressedWorkspace } }) async refresh(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<void>

/**
 * Every connection begins with a baseline; unenrolled owner feeds carry setup invalidations only.
 * @param request - Workspace whose observations are followed.
 * @param signal - ends the stream and immediately detaches observation listeners.
 * @returns coalesced invalidations; source values must be reread after each one.
 */
@Remote({ name: 'follow', mode: 'stream', resources: { workspace: addressedWorkspace } }) async *follow(request: { workspaceId: WorkspaceId }, signal: AbortSignal): AsyncIterable<ResearchEvent>

/**
 * Unsupported history stays explicit until its durable producer is connected.
 * @param request - Workspace and activity selection, validated without inventing history.
 * @param signal - cancels before activity admission.
 * @returns unsupported; this adapter does not supply an activity feed.
 */
@Remote({ name: 'getActivity', resources: { workspace: addressedWorkspace } }) async getActivity(request: { workspaceId: WorkspaceId; query: ActivityQuery }, signal: AbortSignal): Promise<Result<ReadEnvelope<ActivityPage>>>

/**
 * Prepare a source change; unsupported writing never advertises a successful preview.
 * @param request - Workspace and proposed UI field change.
 * @returns a retained scratch preview or typed refusal; no scientific source is changed.
 * @throws when the caller is not the owner or root access is unavailable.
 */
@Remote({ name: 'previewChange', resources: { workspace: addressedWorkspace } }) async previewChange(request: { workspaceId: WorkspaceId; intent: ChangeIntent }): Promise<Result<ReadEnvelope<ChangePreview>>>

/**
 * Apply only through the configured writer.
 * @param request - Workspace, preview and durable retry identity.
 * @returns historical publication and separate current observations, or partial/unknown/refused outcome.
 * @throws when the caller is not the owner or root access is unavailable.
 */
@Remote({ name: 'applyChange', resources: { workspace: addressedWorkspace } }) async applyChange(request: { workspaceId: WorkspaceId; request: ApplyRequest }): Promise<Result<ReadEnvelope<ApplyReceipt>>>

/**
 * Submit a human-authored question with its selected topic/material origin.
 * @param request - exact submitted words and the displayed origin.
 * @param signal - cancels before admission; admitted messages remain in their Session.
 * @returns the created normal Session identity or an unresolved-origin/service failure.
 * @throws when the caller is not the owner or the created Session cannot be reached.
 */
@Remote({ name: 'ask', resources: { workspace: addressedWorkspace, session: (request: ResearchQuestion) => request.sessionId } }) async ask(request: ResearchQuestion, signal: AbortSignal): Promise<Result<{ sessionId: SessionId }>>

/**
 * Admit the normal composer's explicit Research choice without relabelling existing ordinary history.
 * @param request - real native Session, actual Workspace and complete immutable prompt.
 * @param signal - native submission cancellation.
 * @returns the native acceptance; source-specific composers keep their own admission.
 */
@Remote({ name: 'promptWorkflow', resources: { workspace: addressedWorkspace, session: addressedResearchSession } }) async promptWorkflow(request: SessionPromptRequest & { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<{ accepted: true }>

/**
 * Inspect a recorded operation without writing sources or resuming an Agent.
 * @param request - Actual Workspace, owning Session and operation identity.
 * @param signal - Cancels source authorization and Session observation before receipt inspection.
 * @returns Bounded immutable before/after text plus the separately rechecked present source state.
 */
@Remote({ name: 'getChange', resources: { workspace: addressedWorkspace, session: addressedResearchSession } }) async getChange(request: { workspaceId: WorkspaceId } & ResearchChangeQuery, signal: AbortSignal): Promise<Result<ResearchChangeView>>

/**
 * List ordinary discussions in the exact current research scope without starting any Agent.
 * @param request - Workspace and optional topic; omission means the root account.
 * @param signal - Cancels the bounded history read.
 * @returns Live metadata and explicit omitted-history coverage.
 */
@Remote({ name: 'listDiscussions', resources: { workspace: addressedWorkspace } }) async listDiscussions(request: { workspaceId: WorkspaceId } & DiscussionQuery, signal: AbortSignal): Promise<Result<DiscussionPage>>

/**
 * Record an explicit mode choice in an already bound native conversation without starting a model turn.
 * @param request - owning Session and the researcher's selected mode; original question and sources remain bound.
 * @param signal - cancels before admission; an appended native input is not rolled back.
 * @returns the recorded choice, effective at the next model request; historical content remains intact.
 */
@Remote({ name: 'setResearchMode', resources: { session: addressedResearchSession } }) async setResearchMode(request: { sessionId: SessionId; enabled: boolean }, signal: AbortSignal): Promise<{ enabled: boolean }>
```

Types: [SessionId](core.md) · [SessionPromptRequest](session.md) · [WorkspaceId](workspace.md)

Source: [`packages/research/research-memory/src/index.ts`](../../packages/research/research-memory/src/index.ts)

<a id="ctxresearchresources--researchresources"></a>

### `ctx.researchResources` — `ResearchResources`

Shared local reads; model execution and scientific writing remain separately owned consumers.

```ts cordis-catalog
/**
 * Contribute a Host-authorized local root; equal canonical roots share one source identity.
 * @param registration - configured or already-enrolled root; never browser-supplied paths.
 * @returns a counted lease whose disposal withdraws only this contributor's grant.
 * @throws when the path is unavailable, not absolute, or its identity conflicts with another root.
 */
async registerRoot(registration: SourceRootRegistration): Promise<SourceRootLease>

/**
 * Install one domain projection; every catalog and reader is withdrawn on disposal.
 * @param provider - trusted plugin contribution, consuming the shared guarded source context.
 * @returns an idempotent disposer; the caller retains it in its plugin effect.
 */
registerProvider(provider: ResourceProvider): () => void

/**
 * Connect the single existing-conversation owner without importing a model runtime here.
 * @param handler - research-memory integration creating ordinary Harness conversations.
 * @returns an idempotent disposer for this handler's lifecycle.
 */
registerStudyHandler(handler: StudyHandler): () => void

/**
 * Contribute explicit source relationships from existing scientific owners.
 * @param provider - source-backed batched reader; it cannot register roots or infer scientific support.
 * @returns an idempotent disposer removing this contributor and invalidating the projected catalog.
 */
registerTopicAssociations(provider: TopicAssociationProvider): () => void

/**
 * Resolve an authored local link through already authorized roots without reading its target.
 * @param request - a known source and its original href.
 * @param signal - cancellation while current Host grants are checked.
 * @returns a root-qualified location, or undefined for unregistered, external or malformed links.
 */
async resolveLocalLink(request: { from: SourceRef; href: string }, signal: AbortSignal): Promise<{ ref: SourceRef; locator?: SourceLocator } | undefined>

/**
 * Resolve many owned-note links using one current authorized-root observation.
 * @param request - original source and href pairs; output positions match input positions.
 * @param signal - cancellation for the complete bounded relationship read.
 * @returns source locations or undefined without reading unregistered targets.
 */
async resolveLocalLinks(request: { links: readonly { from: SourceRef; href: string }[] }, signal: AbortSignal): Promise<readonly ({ ref: SourceRef; locator?: SourceLocator } | undefined)[]>

/**
 * Inspect operational capabilities without granting any filesystem access.
 * @param request - reserved existing Workspace selection; it is never a path.
 * @param signal - cancellation for this capability read.
 * @returns availability of read-only attachment and Host-owned saved source sets.
 */
@Remote({ name: 'getSetup' }) async getSetup(request: { workspaceId?: WorkspaceId }, signal: AbortSignal): Promise<ResourceResult<ResourceSetup>>

/**
 * Explicitly attach a registered Workspace as a read-only library root.
 * @param request - Host Workspace identity and catalog domains; no browser-controlled root path.
 * @param signal - cancellation before admitting the operational connection.
 * @returns a durable connection to the captured canonical path, without creating scientific files.
 */
@Remote({ name: 'connectWorkspace' }) async connectWorkspace(request: { workspaceId: WorkspaceId; domains?: readonly ResourceDomain[] }, signal: AbortSignal): Promise<ResourceResult<RootConnection>>

/**
 * Withdraw only the saved Workspace connection, preserving independent configured/research grants.
 * @param request - existing or retained Workspace identity to disconnect.
 * @param signal - cancellation before operational publication.
 * @returns whether a runtime connection record was removed; scientific files are untouched.
 */
@Remote({ name: 'disconnectWorkspace' }) async disconnectWorkspace(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<ResourceResult<{ disconnected: boolean }>>

/**
 * List saved operational collections without returning their selected quotations.
 * @param request - bounded page and optional actual topic filter.
 * @param signal - cancellation for this read.
 * @returns source-set summaries with opaque pagination.
 */
@Remote({ name: 'listSourceSets' }) async listSourceSets(request: SourceSetQuery, signal: AbortSignal): Promise<ResourceResult<SourceSetPage>>

/**
 * Open a saved set; its references may now be missing and are never replaced by title guesses.
 * @param request - durable source-set identity.
 * @param signal - cancellation for this read.
 * @returns complete bounded references and explicit quotations, not fresh source content.
 */
@Remote({ name: 'getSourceSet' }) async getSourceSet(request: { id: SourceSetId }, signal: AbortSignal): Promise<ResourceResult<SourceSet>>

/**
 * Save source references and short selected quotations in Host operational storage.
 * @param request - exact title, references, optional topic associations and stable retry identity.
 * @param signal - cancellation before admitting the bounded publication.
 * @returns its durable operation receipt; the current set is read separately.
 */
@Remote({ name: 'saveSourceSet' }) async saveSourceSet(request: SaveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>>

/**
 * Remove one operational set without deleting its sources or scientific notes.
 * @param request - set identity and stable removal operation identity.
 * @param signal - cancellation before publication admission.
 * @returns the durable historical removal receipt, including unchanged retries.
 */
@Remote({ name: 'removeSourceSet' }) async removeSourceSet(request: RemoveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>>

/**
 * List roots explicitly contributed by Host configuration or an existing research grant.
 * @param request - optional exact root filter, without a browser-controlled path.
 * @param signal - cancellation for this observer.
 * @returns canonical root metadata; duplicate grants appear once.
 */
@Remote({ name: 'listRoots' }) async listRoots(request: { rootId?: SourceRootId }, signal: AbortSignal): Promise<ResourceResult<readonly SourceRoot[]>>

/**
 * Search observed source bodies without changing catalog title-search semantics.
 * @param request - literal terms, optional admitted root/directory and result limit.
 * @param signal - cancels discovery, metadata checks and body reads.
 * @returns located candidates with actual byte/file coverage and exclusions.
 */
@Remote({ name: 'searchBodies' }) async searchBodies(request: SourceBodyQuery, signal: AbortSignal): Promise<ResourceResult<SourceBodySearch>>

/**
 * Browse a bounded domain catalog with explicit missing discovery coverage.
 * @param request - source/root/topic filters and an opaque page cursor.
 * @param signal - cancellation for this observer, not for another reader's shared scan.
 * @returns a catalog page; rejected or stale cursors require a fresh first page.
 */
@Remote({ name: 'listResources' }) async listResources(request: ResourceQuery, signal: AbortSignal): Promise<ResourceResult<ResourcePage>>

/**
 * Search domain titles, descriptions and authored metadata within the same bounded catalog.
 * @param request - search text and the same explicit root/topic filters as browsing.
 * @param signal - cancellation for this read.
 * @returns matching catalog entries and the actual discovery limits.
 */
@Remote({ name: 'search' }) async search(request: ResourceQuery, signal: AbortSignal): Promise<ResourceResult<ResourcePage>>

/**
 * Read a complete authorized PDF or image for native preview without expanding any source grant.
 * @param request - root-qualified current local-file identity, never an arbitrary Host path.
 * @param signal - cancellation propagated through the root lifetime and complete bounded read.
 * @returns preview bytes through binary transport, or an explicit rejection without partial bytes.
 */
@Remote({ name: 'readSourceBytes' }) async readSourceBytes(request: { ref: SourceRef }, signal: AbortSignal): Promise<ResourceResult<ResourceBytes>>

/**
 * Open a known source or a newly selected guarded local file in an authorized root.
 * @param request - root-qualified identity and optional located reading.
 * @param signal - cancellation propagated to the provider and bounded source read.
 * @returns current complete content or an explicit unsupported/missing reading.
 */
@Remote({ name: 'readResource' }) async readResource(request: ResourceReadRequest, signal: AbortSignal): Promise<ResourceResult<ResourceReading>>

/**
 * Mark current catalogs stale; this neither fetches remote material nor modifies source files.
 * @param request - optional registered root, or every currently authorized root.
 * @param signal - cancellation before invalidation.
 * @returns whether the requested invalidation was admitted.
 */
@Remote({ name: 'refresh' }) async refresh(request: { rootId?: SourceRootId }, signal: AbortSignal): Promise<ResourceResult<true>>

/**
 * Submit explicit selected evidence through the existing conversation integration.
 * @param request - the person's words, optional actual topic and eligible source selections.
 * @param signal - cancellation before the integration admits a normal Session input.
 * @returns that Session's identity; no domain reader starts its own model loop.
 */
@Remote({ name: 'askStudy', resources: { workspace: (request: StudyRequest) => request.workspaceId, session: (request: StudyRequest) => request.sessionId } }) async askStudy(request: StudyRequest, signal: AbortSignal): Promise<ResourceResult<StudyReceipt>>

/**
 * Observe source/provider invalidation and an initial resync baseline.
 * @param request - reserved empty filter; all events remain Host-owner scoped.
 * @param signal - caller cancellation or plugin disposal closes the subscription.
 * @returns source events; clients reread current authoritative values after each invalidation.
 */
@Remote({ name: 'follow', mode: 'stream' }) async *follow(request: { rootId?: SourceRootId }, signal: AbortSignal): AsyncIterable<ResourceEvent>
```

Types: [WorkspaceId](workspace.md)

Source: [`packages/research/research-resources/src/index.ts`](../../packages/research/research-resources/src/index.ts)

<a id="ctxresearchstudy--researchstudy"></a>

### `ctx.researchStudy` — `ResearchStudy`

Single draft owner; no model provider, new Session log or scientific writeback is created here.

```ts cordis-catalog
/**
 * Report the Host capabilities available to this plugin.
 * @returns explicit availability without reading a Session or research source.
 */
@Remote({ name: 'getSetup' }) async getSetup(): Promise<StudySetup>

/**
 * Browse saved draft summaries without retrieving their bodies.
 * @param request - bounded summary filters.
 * @returns a revision-bound page without bodies or context excerpts.
 */
@Remote({ name: 'listArtifacts' }) listArtifacts(request: StudyArtifactQuery): Promise<StudyResult<StudyArtifactPage>>

/**
 * Open an explicitly saved study draft.
 * @param request - existing plugin-owned identity.
 * @returns full saved content and original source evidence.
 */
@Remote({ name: 'getArtifact' }) getArtifact(request: { id: StudyArtifactId }): Promise<StudyResult<StudyArtifact>>

/**
 * Save a handwritten note or an explicit edit without changing scientific records.
 * @param request - explicit handwritten content or edit with an unchanged retry identity.
 * @returns historical save receipt.
 */
@Remote({ name: 'saveNote' }) saveNote(request: SaveStudyNoteRequest): Promise<StudyResult<StudyArtifactReceipt>>

/**
 * Capture only the selected real completed answer through the existing authorized Session observer.
 * @param request - existing answer reference and stable save identity, with no client-supplied answer text.
 * @param signal - cancellation before a new capture is admitted; admitted writes drain on unload.
 * @returns durable provisional-draft receipt, including unchanged retry recovery after restart.
 */
@Remote({ name: 'captureAnswer', resources: { session: addressedSession } }) captureAnswer(request: CaptureStudyAnswerRequest, signal: AbortSignal): Promise<StudyResult<StudyArtifactReceipt>>

/**
 * Remove this plugin's draft while retaining its original sources and retry receipt.
 * @param request - existing plugin-owned identity and stable removal identity.
 * @returns historical deletion receipt.
 */
@Remote({ name: 'removeArtifact' }) removeArtifact(request: RemoveStudyArtifactRequest): Promise<StudyResult<StudyArtifactReceipt>>

/**
 * Export actual saved content and its recorded references.
 * @param request - existing saved draft.
 * @returns portable Markdown as data; the client chooses an explicit export destination.
 */
@Remote({ name: 'exportMarkdown' }) exportMarkdown(request: { id: StudyArtifactId }): Promise<StudyResult<{ filename: string; markdown: string }>>
```

Source: [`packages/research/research-study/src/index.ts`](../../packages/research/research-study/src/index.ts)
<!-- END GENERATED cordis-surface -->
