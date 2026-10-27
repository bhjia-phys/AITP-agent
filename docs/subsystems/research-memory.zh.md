# 科研记忆

[科研记忆插件](../../packages/research/research-memory/README.md)拥有 `researchMemory` 服务。它读取明确配置的工作区根目录，并把有范围的科研上下文和工具接入既有 Harness 循环。[AITP 记忆设计](../agent/11-research-memory.md#scoped-topic-backend)规定科学范围与选择性写回；本页说明实现中的数据归属。

| 数据 | 归属 | 恢复方式 |
| --- | --- | --- |
| 科学正文与材料 | 既有 Markdown 文件 | 按范围重新读取；不熟悉的写法仍作为原文保留 |
| 人的原始输入、助手问题和模型工作项 | 既有 Session 事件 | `researchWorking` 投影；限定到同一工作区、同一课题的会话查询 |
| 课题关系和来源观察 | `MarkdownWorkspace` 实例 | 从文件重建；路径身份跨重启保留，未知重命名保持未解析 |
| 修改提案和应用结果 | 源目录以外的 scratch writer 运行目录 | 持久操作 ID、逐文件结果，以及独立的当前来源观察 |
| 项目启用与课题创建 | 科研文件以外的应用授权与创建回执 | 重新核对规范工作区、持久保存的写入选择和原始创建身份 |
| 浏览器数据 | 既有 Harness resources | 生成的 Remote 调用、失效通知和重新读取 |

根 `research.md` 是项目正文。显式链接界定课题父级及材料归属，目录邻近本身不能证明从属关系。共享材料保留多个可能的归属。 一个配置根不可用时，不会禁用另一个成功匹配授权的根。提问带工作区、课题、材料和可选选中段落；范围不明确时显示未解析状态，不擅自选择附近课题。

上下文读取把已识别的主问题和当前答案作为核心正文单元，预算不足时明确报告整项遗漏。文件监听失效后，每次读取仍重新扫描；来源成员及正文不变时保留分页身份，补入选中来源、来源变化或显式刷新则使旧游标失效。

发现结果不完整时，仍可补入已知且选中的根目录内普通文件，以及通过显式链接识别的有限相关正文。内部保留目录和符号链接路径仍被排除，路径探测不推断父级。无关选择不改变已建立的关系，新的竞争显式链接则保留歧义。该操作补充最初的有界扫描，不会使目录清单完整：指向所选课题的父级链接及其他材料使用者仍可能未知。

必要上下文会进入实际模型请求，并由 Harness 原有上下文记录保存。人的原话、模型暂定工作项、科学来源和历史内容始终区分。历史输入不转移操作权限。当前仅向 owner 开放的提问入口与保守的历史读取策略，避免非 owner 的继续操作取得其他会话的访问权。

未答的助手问题把原始问句和完整选项带入当前及同课题恢复上下文，并保留可由 `research_read_context` 重新打开的精确 Session 引用。没有关联的结构化回复不表示人已经作出决定；后来人的普通回答与修正仍保有其效力。预算造成的整项遗漏继续明确报告。

历史恢复先选择同课题会话，再应用配置的会话数量上限。临时成员索引使用当前运行会话投影；冷历史分类则核对持久化服务身份、版本和 Session 生命周期，并移除已消失的会话。不变的无关分类不必重读会话正文。冷分类与选中的历史共用有限事件处理预算，超限时明确说明覆盖不完整；元数据枚举仍不分页，冷会话观察也仍可能读取完整日志。索引不保留原始日志或科研正文，重启后重新建立。

浏览器和模型工具共用原文段落 scratch writer。提案可以是不写、暂存或修改；应用返回完整、部分或不确定结果。保存文字不等于完成剩余科学整合。writer 保留源文件 UTF-8 BOM，并在同一写入器内统一串行发布来源，使资源别名共用发布边界。它只协调自身调用，不承诺任意外部编辑竞争或跨文件事务。[包配置与限制](../../packages/research/research-memory/README.md)说明具体上限。

所有者在 Research 中明确启用已注册的工作区；查看启用状态不授予来源访问。只读启用不创建科研文件。可写初始化保留已有项目正文，课题创建只加入人的初始问题与明确父子链接。创建与编辑共用来源发布边界，并在边界内重查当前写入授权。提供者卸载时拒绝新的初始化请求，并等待已接受的来源及回执操作完成。宿主明确配置的限制优先于应用启用记录。

仅所有者可调用的 `getSessionMemory` 从已有 Session 接受事件及已注册消息投影读取，不启动 Agent，也不重读科研原文。它保留实际请求中具名上下文的精确文本，区分当前、已压缩、经投影改变和已替代；打开来源另读当前文件。逐文件链接的交付状态保持未知，不能从正文推断规则已采用。有界输出报告整项遗漏；底层冷历史 API 仍可能先读完整会话。

## 本地资料库与选源研读

[`research-resources`](../../packages/research/research-resources/README.md)统一管理来源读取。文献、知识与代码分别由独立提供者和客户端插件实现，共用目录授权、带根身份的来源 ID、有界发现、读取、失效通知及定位链接。禁用一个领域会撤下它的条目，不另建对话运行时，也不改变其他领域的授权。AITP 配置启用这些插件，普通 Harness 配置保持禁用。

人在界面连接已注册的工作区以授予读取权限；连接不创建或修改科研文件。同一规范目录的授权按各自生命周期共用来源身份，每次读取重查当前权限。来源 ID 包含根身份，因此不同资料库中的同名文件不会混淆。文件删除、目录断开或提供者卸载后，原位置明确显示不可用。来源路径不决定科学问题范围。

知识提供者读取 AITP 原有知识组织：索引、可复用知识原子、按来源顺序展开的阅读、按问题展开的故事及可选作者合集。支撑、复核和阅读覆盖保持不同含义。草稿和暂定科研指针不会成为已验证知识原子。文献读取既有 PDF 的文字及物理页码、Markdown、书目信息和 TeX 原文。代码只读现有 checkout、状态、差异和历史，不拉取远程，也不运行仓库辅助程序。扫描 PDF 需要额外的文字识别提供者。

已识别的 `research.md` 中显式编写的链接把材料关联到使用它的课题，并保留原使用段落作为理由。跨根定位要求两个根均已授权。界面提供全局资料库，也在课题内复用同一阅读器。从父课题进入归属子课题的材料时，提问仍保留明确选定的父课题；证据归属不偷偷切换会话范围。

保存的资料集属于 `research-resources` 的应用数据，存放在科研文件之外。它保留选源、可选课题范围及跨重试、重启稳定的操作身份。全局研读使用资料集或研读身份，不虚构课题或工作区。明确限定课题的研读把该课题正文与选中材料接入既有 Harness Session。人的问题和修正始终作为 Session 原始证据，在压缩与恢复后保留。

当前来源段落附带精确文字偏移、Markdown 锚点、PDF 物理页或代码版本及行位置。长来源只做有界词汇匹配，包括中文相邻字组合；它不是语义检索，也不证明完整阅读。最终请求组装会按包含人的约束、范围说明和覆盖提示的完整预算重新选择来源片段，并保留精确偏移和空行；人明确选定的原始引文只会完整保留或明确遗漏，不静默截短。定位只编码进可重开的来源地址，避免重复复制引文。预算遗漏与失效选段始终明确。`research_read_source` 只能继续打开当前选中来源，仍受授权与输出预算限制。历史选段与当前重新读取的原文明确定性。

[`research-study`](../../packages/research/research-study/README.zh.md)保存可编辑笔记，也从实际 Session 事件捕获完整成功的回答。同一应用存储拥有暂定草稿、回答出处与来源引用。选中来源、实际请求中的上下文以及成功的来源工具结果是不同依据，均不等于模型已完整阅读文件。草稿可以导出或明确作为来源继续使用，并保留生成及暂定身份。保存草稿不把科研结果晋升到知识库，也不增加第二个科研文件写入器。

第一版覆盖本地来源读取、资料集、带出处的普通会话与暂定文字研读产物；尚不提供 OCR、媒体转写、音视频成品、托管分享或自动科学晋升。既有 AITP Skills 和科学正文继续拥有相应规则与结论。阶段验收边界见[本地资料库实施计划](../agent/14-implementation-blueprint.md#local-libraries)。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
```

Types: [SessionId](core.zh.md) · [WorkspaceId](workspace.zh.md)

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

Types: [WorkspaceId](workspace.zh.md)

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
