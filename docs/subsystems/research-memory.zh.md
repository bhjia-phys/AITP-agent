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
@Remote({ name: 'ask', resources: { workspace: addressedWorkspace } }) async ask(request: ResearchQuestion, signal: AbortSignal): Promise<Result<{ sessionId: SessionId }>>
```

Types: [SessionId](core.zh.md) · [WorkspaceId](workspace.zh.md)

Source: [`packages/research/research-memory/src/index.ts`](../../packages/research/research-memory/src/index.ts)
<!-- END GENERATED cordis-surface -->
