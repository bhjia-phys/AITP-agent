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

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
@Remote({ name: 'ask', resources: { workspace: addressedWorkspace } }) async ask(request: ResearchQuestion, signal: AbortSignal): Promise<Result<{ sessionId: SessionId }>>
```

Types: [SessionId](core.md) · [WorkspaceId](workspace.md)

Source: [`packages/research/research-memory/src/index.ts`](../../packages/research/research-memory/src/index.ts)
<!-- END GENERATED cordis-surface -->
