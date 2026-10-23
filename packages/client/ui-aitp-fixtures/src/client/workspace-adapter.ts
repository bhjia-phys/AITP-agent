/** Async in-memory adapter for the opt-in fixture; storage and model delivery are absent. */
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {
  ActivityItem, ActivityPage, ActivityQuery, ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview,
  ContextQuery, ContextRead, Project, ReadEnvelope, ReadOptions, ResearchEvent, ResearchProvider,
  ResearchWorkspaceAdapter, Resource, ResourceId, Result, Revision, Topic, TopicId, TopicPage,
  TopicQuery, WorkspaceTopicSummary as TopicSummary, VersionedTarget, WorkspaceError,
} from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import { createWorkspaceFixtureData, fixtureAccountMarkdown } from './workspace-data.ts'

interface StoredTopic { topic: Topic; revision: Revision }
interface StoredPreview { readonly intent: ChangeIntent; readonly preview: ReadEnvelope<ChangePreview> }
interface AppliedOperation { readonly previewId: string; readonly receipt: ReadEnvelope<ApplyReceipt> }

const rev = (value: number): Revision => `fixture-revision-${value}` as Revision
const actor = { id: 'fixture-researcher', kind: 'researcher', label: 'Demonstration researcher' } as const
const failed = <T>(code: Extract<WorkspaceError, { retryable: boolean }>['code'], message: string, retryable = false): Result<T> => ({ ok: false, error: { code, message, retryable } })

/** Isolated, disposable demonstration state owned by one Harness Workspace. */
export class FixtureWorkspaceAdapter implements ResearchWorkspaceAdapter {
  readonly provider: ResearchProvider = {
    id: 'aitp-workspace-fixture', origin: 'fixture',
    capabilities: { read: true, readContext: true, readActivity: true, previewChanges: true, applyChanges: true, changeEvents: true, commands: ['update-scope', 'record-answer'] },
  }

  private readonly data = createWorkspaceFixtureData()
  private readonly topics = new Map<TopicId, StoredTopic>(this.data.topics.map(topic => [topic.id, { topic, revision: rev(1) }]))
  private readonly resources = new Map<ResourceId, Resource>(this.data.resources.map(resource => [resource.id, resource]))
  private readonly previews = new Map<string, StoredPreview>()
  private readonly operations = new Map<string, AppliedOperation>()
  private readonly activity: ActivityItem[] = []
  private readonly listeners = new Set<(event: ResearchEvent) => void>()
  private readonly instanceId = randomUUID()
  private sequence = 1
  private previewSequence = 0
  private connected = true

  /** @param workspaceId - Harness Workspace whose fixture state this instance owns. */
  constructor(readonly workspaceId: WorkspaceId) {}

  /** @param options - read cancellation. @returns the synthetic project. */
  async getProject(options?: ReadOptions): Promise<Result<ReadEnvelope<Project>>> {
    return this.read(() => this.envelope(this.data.project), options)
  }

  /** @param query - parent and pagination selection. @param options - cancellation. @returns the requested page. */
  async listTopics(query: TopicQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<TopicPage>>> {
    return this.read(() => {
      const cursor = this.cursor(query.cursor, query.parentId === undefined ? '*' : query.parentId ?? 'roots')
      if (!cursor.ok) return cursor
      if (query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit <= 0)) return failed('invalid-request', 'A positive integer page limit is required.')
      const all = [...this.topics.values()].filter(({ topic }) => query.parentId === undefined || topic.parentId === query.parentId)
      const limit = query.limit ?? all.length
      const page = all.slice(cursor.value, cursor.value + limit)
      const next = cursor.value + page.length
      return this.envelope({
        items: page.map(({ topic, revision }) => this.observation(this.summary(topic), revision)),
        nextCursor: next < all.length ? this.makeCursor(next, query.parentId === undefined ? '*' : query.parentId ?? 'roots') : null,
        completeness: 'complete',
      })
    }, options)
  }

  /** @param topicId - stable topic identity. @param options - cancellation. @returns the topic or an explicit missing result. */
  async getTopic(topicId: TopicId, options?: ReadOptions): Promise<Result<ReadEnvelope<Topic>>> {
    return this.read(() => {
      const stored = this.topics.get(topicId)
      return stored === undefined ? failed('not-found', 'The requested topic is not in this demonstration.') : this.envelope(stored.topic, stored.revision)
    }, options)
  }

  /**
   * @param resourceId - stable material identity.
   * @param options - cancellation.
   * @returns complete text or explicit unavailable content.
   */
  async getResource(resourceId: ResourceId, options?: ReadOptions): Promise<Result<ReadEnvelope<Resource>>> {
    return this.read(() => {
      const resource = this.resources.get(resourceId)
      if (resource === undefined) return failed('not-found', 'The requested material is not in this demonstration.')
      const stored = resource.ownerTopicId === null ? undefined : this.topics.get(resource.ownerTopicId)
      if (stored !== undefined && stored.topic.accountResourceId === resourceId) {
        const topic = stored.topic
        return this.envelope({ ...resource, content: { kind: 'markdown', text: fixtureAccountMarkdown(topic) } }, stored.revision)
      }
      return this.envelope(resource, rev(1))
    }, options)
  }

  /**
   * @param query - topic and page.
   * @param options - cancellation.
   * @returns synthetic applied-change activity, never fabricated Sessions.
   */
  async getActivity(query: ActivityQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ActivityPage>>> {
    return this.read(() => {
      if (!this.topics.has(query.topicId)) return failed('not-found', 'The requested topic is not in this demonstration.')
      const cursor = this.cursor(query.cursor, `activity:${query.topicId}`)
      if (!cursor.ok) return cursor
      if (query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit <= 0)) return failed('invalid-request', 'A positive integer page limit is required.')
      const all = this.activity.filter(item => item.topicId === query.topicId)
      const items = all.slice(cursor.value, cursor.value + (query.limit ?? all.length))
      const next = cursor.value + items.length
      return this.envelope({ items, nextCursor: next < all.length ? this.makeCursor(next, `activity:${query.topicId}`) : null, completeness: 'complete' })
    }, options)
  }

  /**
   * @param query - bounded source selection.
   * @param options - cancellation.
   * @returns complete qualified units; no model request is made.
   */
  async readContext(query: ContextQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ContextRead>>> {
    return this.read(() => {
      const stored = this.topics.get(query.topicId)
      if (stored === undefined) return failed('not-found', 'The requested topic is not in this demonstration.')
      if ((query.maxItems !== undefined && (!Number.isSafeInteger(query.maxItems) || query.maxItems <= 0)) || (query.maxCharacters !== undefined && (!Number.isSafeInteger(query.maxCharacters) || query.maxCharacters <= 0))) return failed('invalid-request', 'Context limits must be positive integers.')
      const include = query.include ?? ['ancestors', 'children', 'statements', 'work', 'resources']
      const selected = new Map<TopicId, StoredTopic>([[query.topicId, stored]])
      if (include.includes('children')) for (const childId of stored.topic.childIds) {
        const child = this.topics.get(childId)
        if (child !== undefined) selected.set(childId, child)
      }
      if (include.includes('ancestors')) {
        let parentId = stored.topic.parentId
        while (parentId !== null) {
          const parent = this.topics.get(parentId)
          if (parent === undefined) break
          selected.set(parentId, parent)
          parentId = parent.topic.parentId
        }
      }
      const entries: ContextRead['entries'][number][] = [], omissions: ContextRead['omissions'][number][] = []
      let characters = 0
      for (const { topic, revision } of selected.values()) {
        const parts = [topic.question, topic.scope]
        if (topic.currentAnswer !== null) parts.push(topic.currentAnswer.text, topic.currentAnswer.qualification)
        if (topic.gap !== null) parts.push(topic.gap)
        if (include.includes('statements')) for (const statement of topic.statements) parts.push(statement.text, statement.qualification)
        if (include.includes('work')) for (const item of topic.workItems) parts.push(item.title, item.description)
        if (include.includes('resources')) for (const resource of topic.resources) parts.push(`${resource.title} (${resource.id}); content requires a separate material read.`)
        const text = parts.join('\n\n'), target = { kind: 'topic', id: topic.id } as const
        if (entries.length >= (query.maxItems ?? Number.POSITIVE_INFINITY)
        || characters + text.length > (query.maxCharacters ?? Number.POSITIVE_INFINITY)) {
          omissions.push({ target, reason: 'The complete qualified topic exceeds the requested context bound.' })
        } else {
          entries.push({ source: { target, revision }, label: topic.title, text })
          characters += text.length
        }
      }
      return this.envelope({ topicId: query.topicId, entries, completeness: omissions.length === 0 ? 'complete' : 'partial', omissions })
    }, options)
  }

  /** @param intent - supported serializable change with its expected revision. @returns a stable preview without mutation. */
  async previewChange(intent: ChangeIntent): Promise<Result<ReadEnvelope<ChangePreview>>> {
    await Promise.resolve()
    if (!this.connected) return failed('not-connected', 'The demonstration connection is unavailable.', true)
    const stored = this.topics.get(intent.topicId)
    if (stored === undefined) return failed('not-found', 'The requested topic is not in this demonstration.')
    if (intent.expectedRevision !== stored.revision) return this.conflict(intent.topicId, stored.revision)
    const command = intent.command
    if (command.kind !== 'update-scope' && command.kind !== 'record-answer') return failed('unsupported', 'This demonstration supports scope and current-answer edits only.')
    if (command.kind === 'update-scope' && command.scope.trim() === '') return failed('invalid-request', 'Scope must not be empty.')
    if (command.kind === 'record-answer' && (command.text.trim() === '' || command.qualification.trim() === '')) return failed('invalid-request', 'An answer and its qualification are required.')
    if (command.kind === 'record-answer' && command.sourceResourceIds.some(id => !this.resources.has(id))) return failed('not-found', 'An answer source is unavailable.')
    const before = command.kind === 'update-scope' ? stored.topic.scope : stored.topic.currentAnswer === null ? null : `${stored.topic.currentAnswer.text}\n\n${stored.topic.currentAnswer.qualification}`
    const after = command.kind === 'update-scope' ? command.scope : `${command.text}\n\n${command.qualification}`
    const target = { kind: 'topic', id: intent.topicId } as const
    const preview = this.observation<ChangePreview>({
      previewId: `fixture-preview-${this.instanceId}-${++this.previewSequence}`,
      summary: command.kind === 'update-scope' ? 'Update topic scope' : 'Record a qualified current answer',
      bases: [{ target, revision: stored.revision }],
      edits: [{ target, label: stored.topic.title, before, after }],
      pendingIntegration: ['Related scientific arguments require separate assessment.'],
    })
    this.previews.set(preview.value.previewId, { intent: structuredClone(intent), preview })
    return { ok: true, value: structuredClone(preview) }
  }

  /** @param request - bound preview and operation identity. @returns an idempotent receipt, conflict or unsupported result. */
  async applyChange(request: ApplyRequest): Promise<Result<ReadEnvelope<ApplyReceipt>>> {
    await Promise.resolve()
    if (!this.connected) return failed('not-connected', 'The demonstration connection is unavailable.', true)
    if (request.operationId.trim() === '') return failed('invalid-request', 'An operation identity is required.')
    const applied = this.operations.get(request.operationId)
    if (applied !== undefined) return applied.previewId === request.previewId
      ? { ok: true, value: structuredClone(applied.receipt) }
      : failed('operation-reused', 'This operation identity was already used for a different preview.')
    const prepared = this.previews.get(request.previewId)
    if (prepared === undefined) return failed('preview-expired', 'The preview is unavailable; prepare the change again.')
    const { intent } = prepared
    const stored = this.topics.get(intent.topicId)
    if (stored === undefined) return failed('not-found', 'The preview topic is unavailable.')
    if (stored.revision !== intent.expectedRevision) return this.conflict(intent.topicId, stored.revision)
    const command = intent.command
    if (command.kind === 'update-scope') stored.topic = { ...stored.topic, scope: command.scope }
    else if (command.kind === 'record-answer') stored.topic = {
      ...stored.topic,
      currentAnswer: { text: command.text, qualification: command.qualification, attribution: { actor, sourceResourceIds: command.sourceResourceIds, recordedAt: this.timestamp(), explanation: 'Applied to the synthetic fixture only.' } },
    }
    else return failed('unsupported', 'This preview operation is not supported.')
    this.sequence += 1
    stored.revision = rev(this.sequence)
    const changed: VersionedTarget[] = [
      { target: { kind: 'topic', id: intent.topicId }, revision: stored.revision },
      { target: { kind: 'project', id: this.data.project.id }, revision: rev(this.sequence) },
    ]
    if (stored.topic.accountResourceId !== undefined) changed.push({ target: { kind: 'resource', id: stored.topic.accountResourceId }, revision: stored.revision })
    const committedAt = this.timestamp(), changeId = `fixture-change-${this.instanceId}-${this.sequence}`, eventId = `fixture-event-${this.instanceId}-${this.sequence}`
    const receipt = this.observation<ApplyReceipt>({ operationId: request.operationId, changeId, committedAt, actor, changed, eventId })
    this.operations.set(request.operationId, { previewId: request.previewId, receipt })
    this.activity.unshift({ kind: 'change', changeId, topicId: intent.topicId, summary: prepared.preview.value.summary, recordedAt: committedAt, actor })
    this.emit({ kind: 'invalidate', eventId, targets: changed })
    return { ok: true, value: structuredClone(receipt) }
  }

  /** @param options - prior cursor, if any. @param listener - change listener. @returns the listener disposer. */
  subscribeChanges(options: { readonly afterEventId?: string }, listener: (event: ResearchEvent) => void): () => void {
    this.listeners.add(listener)
    if (options.afterEventId !== undefined) listener({ kind: 'resync-required', reason: 'The fixture does not retain a replayable event history.' })
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Simulate a connection transition and notify the active fixture readers.
   * @param connected - fixture connection state; used by adapter integration tests.
   */
  setConnected(connected: boolean): void {
    this.connected = connected
    this.emit({ kind: 'connection', state: connected ? 'connected' : 'disconnected' })
  }

  private emit(event: ResearchEvent): void { for (const listener of this.listeners) listener(event) }

  private summary(topic: Topic): TopicSummary {
    return {
      id: topic.id, title: topic.title, parentId: topic.parentId, childIds: topic.childIds,
      ...(topic.shortTitle === undefined ? {} : { shortTitle: topic.shortTitle }),
      ...(topic.directionId === undefined ? {} : { directionId: topic.directionId }),
      currentAnswer: topic.currentAnswer, gap: topic.gap, work: topic.work, resourceCount: topic.resourceCount,
    }
  }

  private timestamp(): string { return new Date(Date.UTC(2026, 9, 23) + this.sequence * 1000).toISOString() }

  private observation<T>(value: T, revision = rev(this.sequence)): ReadEnvelope<T> {
    return { origin: 'fixture', revision, observedAt: this.timestamp(), value: structuredClone(value) }
  }

  private envelope<T>(value: T, revision = rev(this.sequence)): Result<ReadEnvelope<T>> {
    return { ok: true, value: this.observation(value, revision) }
  }

  private async read<T>(read: () => Result<ReadEnvelope<T>>, options?: ReadOptions): Promise<Result<ReadEnvelope<T>>> {
    if (options?.signal?.aborted) return failed('cancelled', 'The read was cancelled.')
    await Promise.resolve()
    if (options?.signal?.aborted) return failed('cancelled', 'The read was cancelled.')
    if (!this.connected) return failed('not-connected', 'The demonstration connection is unavailable.', true)
    return read()
  }

  private conflict<T>(topicId: TopicId, revision: Revision): Result<T> {
    return { ok: false, error: { code: 'revision-conflict', message: 'The topic changed after this edit began. Read its current version before preparing a new preview.', current: [{ target: { kind: 'topic', id: topicId }, revision }] } }
  }

  private makeCursor(offset: number, selection: string): string { return JSON.stringify({ revision: this.sequence, offset, selection }) }

  private cursor(cursor: string | undefined, selection: string): Result<number> {
    if (cursor === undefined) return { ok: true, value: 0 }
    let parsed: unknown
    try { parsed = JSON.parse(cursor) } catch (error) { return failed('invalid-request', error instanceof Error ? error.message : 'Invalid cursor.') }
    if (typeof parsed !== 'object' || parsed === null || !('revision' in parsed) || parsed.revision !== this.sequence || !('selection' in parsed) || parsed.selection !== selection || !('offset' in parsed) || typeof parsed.offset !== 'number' || !Number.isSafeInteger(parsed.offset) || parsed.offset < 0) return failed('invalid-request', 'This cursor is invalid or its snapshot changed; restart the list.')
    return { ok: true, value: parsed.offset }
  }
}
