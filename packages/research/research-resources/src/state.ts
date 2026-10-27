/** One bounded operational owner for source connections and saved reference sets. */
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SourceError } from './files.ts'
import { parseMaterialLocator } from './protocol.ts'
import type {
  RootConnection, SaveSourceSetRequest, SourceSelection, SourceSet, SourceSetId,
  SourceSetPage, SourceSetQuery, SourceSetReceipt, SourceSetSummary, SourceSetTopic,
} from './types.ts'

/** Private path binding captured at the owner's explicit connection action. */
export interface StoredConnection extends RootConnection { readonly canonicalPath: string }
/** Operational storage bounds, separate from source-file read limits. */
export interface StateLimits {
  readonly maxStateBytes: number
  readonly maxSourceSets: number
  readonly maxStateOperations: number
  readonly maxSourceSetCharacters: number
  readonly maxSelectionCharacters: number
  readonly maxSourceSetSelections: number
  readonly maxTitleCharacters: number
  readonly maxPageSize: number
}
interface StoredOperation {
  readonly payload: string
  readonly receipt: SourceSetReceipt
}
interface State {
  readonly format: 1
  readonly revision: number
  readonly connections: Readonly<Record<string, StoredConnection>>
  readonly sourceSets: Readonly<Record<string, SourceSet>>
  readonly operations: Readonly<Record<string, StoredOperation>>
}

const topicSchema = z.object({ workspaceId: z.string().min(1), topicId: z.string().min(1) }).strict()
const selectionSchema = z.object({ ref: z.object({ rootId: z.string().min(1), sourceId: z.string().min(1) }).strict(),
  locator: z.unknown().optional(), selectedText: z.string().optional() }).strict()
const setSchema = z.object({ id: z.string().min(1), title: z.string().min(1), selectionCount: z.number().int().nonnegative(),
  selections: z.array(selectionSchema), topics: z.array(topicSchema), createdAt: z.string(), updatedAt: z.string() }).strict()
const receiptSchema = z.object({ operationId: z.string().min(1), id: z.string().min(1),
  state: z.enum(['saved', 'removed']), committedAt: z.string() }).strict()
const stateSchema = z.object({ format: z.literal(1), revision: z.number().int().nonnegative(),
  connections: z.record(z.string(), z.object({ workspaceId: z.string().min(1), rootId: z.string().min(1), canonicalPath: z.string().min(1),
    domains: z.array(z.enum(['knowledge', 'literature', 'code'])).optional(), connectedAt: z.string() }).strict()),
  sourceSets: z.record(z.string(), setSchema),
  operations: z.record(z.string(), z.object({ payload: z.string(), receipt: receiptSchema }).strict()),
}).strict()

/** A failed publish/readback cannot be treated as a definite unsaved operation. */
export class OperationalOutcomeUnknown extends Error {
  /** @param operationId - stable request identity retained for recovery. */
  constructor(readonly operationId: string) { super('The operational save outcome is unknown; retry the unchanged request with its original identity.') }
}

function selected(value: z.infer<typeof selectionSchema>): SourceSelection {
  let locator: SourceSelection['locator']
  try { locator = value.locator === undefined ? undefined : parseMaterialLocator(JSON.stringify(value.locator)) }
  catch (error) { void error; throw new SourceError('invalid-request', 'The selected source location is invalid.') }
  return { ref: { rootId: value.ref.rootId as SourceSelection['ref']['rootId'], sourceId: value.ref.sourceId as SourceSelection['ref']['sourceId'] },
    ...(locator === undefined ? {} : { locator }),
    ...(value.selectedText === undefined ? {} : { selectedText: value.selectedText }) }
}

function topics(values: readonly z.infer<typeof topicSchema>[]): readonly SourceSetTopic[] {
  return values.map(value => ({ workspaceId: value.workspaceId as SourceSetTopic['workspaceId'], topicId: value.topicId as SourceSetTopic['topicId'] }))
}

function summary(source: SourceSet): SourceSetSummary {
  const { selections: _selections, ...metadata } = source
  return metadata
}

/** Atomic, cooperative single-Host operational state, outside every scientific source root. */
export class ResourceState {
  private state: State | undefined
  private loading: Promise<State> | undefined
  private pending: Promise<void> = Promise.resolve()
  private uncertain = false

  /**
   * @param directory - existing Harness-home child, or undefined on hosts without operational storage.
   * @param limits - complete store, set, quote and page limits.
   * @param validateDirectory - checks that operational storage remains outside scientific sources.
   */
  constructor(readonly directory: string | undefined, readonly limits: StateLimits,
    private readonly validateDirectory: (path: string) => Promise<void>) {}

  /**
   * Observe storage support without opening a scientific root.
   * @returns whether this Host declares an operational storage directory.
   */
  get supported(): boolean { return this.directory !== undefined }

  /**
   * Wait for already admitted operational publications.
   * @returns completion after every admitted operational publication has settled.
   */
  async close(): Promise<void> { await this.pending }

  private async loaded(): Promise<State> {
    if (this.directory === undefined) throw new SourceError('unavailable', 'This Host has no operational storage for research libraries.')
    await this.validateDirectory(this.directory)
    if (this.state !== undefined && !this.uncertain) return this.state
    if (this.loading === undefined) this.loading = this.read().then((value) => {
      this.state = value
      this.uncertain = false
      return value
    }).finally(() => { this.loading = undefined })
    return this.loading
  }

  private async read(): Promise<State> {
    if (this.directory === undefined) throw new SourceError('unavailable', 'This Host has no operational storage for research libraries.')
    const path = join(this.directory, 'state.json')
    let bytes: Buffer
    try {
      const info = await lstat(path)
      if (!info.isFile() || info.isSymbolicLink()) throw new SourceError('unavailable', 'The library operation store is not a regular file.')
      if (info.size > this.limits.maxStateBytes) throw new SourceError('unavailable', 'The library operation store exceeds its byte limit.')
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const buffer = Buffer.alloc(this.limits.maxStateBytes + 1)
        let length = 0
        while (length < buffer.length) {
          const chunk = await file.read(buffer, length, buffer.length - length, length)
          if (chunk.bytesRead === 0) break
          length += chunk.bytesRead
        }
        bytes = buffer.subarray(0, length)
      } finally { await file.close() }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { format: 1, revision: 0, connections: {}, sourceSets: {}, operations: {} }
      }
      throw error
    }
    if (bytes.length > this.limits.maxStateBytes) throw new SourceError('unavailable', 'The library operation store exceeds its byte limit.')
    const raw = stateSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    if (Object.keys(raw.sourceSets).length > this.limits.maxSourceSets
      || Object.keys(raw.operations).length > this.limits.maxStateOperations) {
      throw new SourceError('unavailable', 'The complete library operation store exceeds its configured entry limits.')
    }
    if (Object.entries(raw.connections).some(([key, entry]) => key !== entry.workspaceId)
      || Object.entries(raw.operations).some(([key, entry]) => key !== entry.receipt.operationId)) {
      throw new SourceError('unavailable', 'A saved operation or connection identity is inconsistent.')
    }
    const sourceSets: Record<string, SourceSet> = {}
    for (const [id, source] of Object.entries(raw.sourceSets)) {
      if (id !== source.id || source.selectionCount !== source.selections.length) {
        throw new SourceError('unavailable', 'A saved source-set identity is inconsistent.')
      }
      try {
        sourceSets[id] = { ...source, id: source.id as SourceSetId,
          selections: source.selections.map(selected), topics: topics(source.topics) }
      } catch (error) { void error; throw new SourceError('unavailable', 'A saved source-set location is invalid.') }
    }
    return { format: 1, revision: raw.revision, sourceSets,
      connections: Object.fromEntries(Object.entries(raw.connections).map(([key, entry]) => {
        const { domains, ...connection } = entry
        return [key, { ...connection, ...(domains === undefined ? {} : { domains }),
          workspaceId: entry.workspaceId as WorkspaceId, rootId: entry.rootId as StoredConnection['rootId'] }]
      })),
      operations: Object.fromEntries(Object.entries(raw.operations).map(([key, entry]) => [key, { ...entry,
        receipt: { ...entry.receipt, id: entry.receipt.id as SourceSetId } }])) }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.pending.then(operation)
    // A failed operation must not prevent a later exact retry from reconciling disk state.
    this.pending = pending.then(() => {}, (error: unknown) => { void error })
    return pending
  }

  private async publish(next: State, operationId: string): Promise<void> {
    if (this.directory === undefined) throw new SourceError('unavailable', 'This Host has no operational storage for research libraries.')
    const text = `${JSON.stringify(next)}\n`
    if (Buffer.byteLength(text) > this.limits.maxStateBytes) throw new SourceError('unavailable', 'The complete library operation store exceeds its byte limit; nothing was discarded.')
    await this.validateDirectory(this.directory)
    await mkdir(this.directory, { recursive: true })
    await this.validateDirectory(this.directory)
    const target = join(this.directory, 'state.json')
    const temporary = join(this.directory, `.state-${randomUUID()}.tmp`)
    try {
      const file = await open(temporary, 'wx', 0o600)
      try { await file.writeFile(text); await file.sync() }
      finally { await file.close() }
      await rename(temporary, target)
      if (await readFile(target, 'utf8') !== text) throw new OperationalOutcomeUnknown(operationId)
      this.state = next
    } catch (error) {
      this.uncertain = true
      try {
        if (await readFile(target, 'utf8') === text) { this.state = next; this.uncertain = false; return }
      } catch (readError) { void readError }
      if (error instanceof SourceError) throw error
      throw new OperationalOutcomeUnknown(operationId)
    } finally {
      // Temporary-file cleanup cannot change an already published historical receipt.
      await rm(temporary, { force: true }).catch((cleanupError: unknown) => { void cleanupError })
    }
  }

  /**
   * Read the persisted local-root connections.
   * @returns the existing connection records, without creating directories or scientific notes.
   */
  async connections(): Promise<readonly StoredConnection[]> { return Object.values((await this.loaded()).connections) }

  /**
   * Look up the saved read connection for an existing Workspace.
   * @param workspaceId - existing Host Workspace.
   * @returns the connection record, or absence for an unconnected Workspace.
   */
  async connection(workspaceId: WorkspaceId): Promise<StoredConnection | undefined> {
    const connections = (await this.loaded()).connections
    return Object.hasOwn(connections, workspaceId) ? connections[workspaceId] : undefined
  }

  /**
   * Persist an explicit read connection; unchanged retries retain its original timestamp.
   * @param connection - canonical path captured from the existing Workspace registry.
   * @returns acknowledged connection record.
   */
  async connect(connection: StoredConnection): Promise<StoredConnection> {
    return this.serialize(async () => {
      const current = await this.loaded()
      const previous = Object.hasOwn(current.connections, connection.workspaceId) ? current.connections[connection.workspaceId] : undefined
      if (previous !== undefined && previous.canonicalPath === connection.canonicalPath
        && JSON.stringify(previous.domains) === JSON.stringify(connection.domains)) return previous
      const next = { ...current, revision: current.revision + 1,
        connections: { ...current.connections, [connection.workspaceId]: connection } }
      await this.publish(next, `connect:${connection.workspaceId}`)
      return connection
    })
  }

  /**
   * Remove one saved read connection while retaining other roots.
   * @param workspaceId - explicitly connected Workspace.
   * @returns whether a runtime grant was removed.
   */
  async disconnect(workspaceId: WorkspaceId): Promise<boolean> {
    return this.serialize(async () => {
      const current = await this.loaded()
      if (!Object.hasOwn(current.connections, workspaceId)) return false
      const connections = Object.fromEntries(Object.entries(current.connections).filter(([id]) => id !== workspaceId))
      await this.publish({ ...current, revision: current.revision + 1, connections }, `disconnect:${workspaceId}`)
      return true
    })
  }

  /**
   * List one bounded page of saved source-set summaries.
   * @param query - bounded list filters.
   * @returns summaries without copying selected excerpts into the index.
   */
  async listSets(query: SourceSetQuery): Promise<SourceSetPage> {
    const state = await this.loaded()
    const topic = query.topic
    const entries = Object.values(state.sourceSets).filter(set => topic === undefined
      || set.topics.some(item => item.workspaceId === topic.workspaceId && item.topicId === topic.topicId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    const limit = query.limit ?? this.limits.maxPageSize
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.limits.maxPageSize) throw new SourceError('invalid-request', 'The source-set page exceeds its configured limit.')
    const key = JSON.stringify([topic ?? null, limit])
    let offset = 0
    if (query.cursor !== undefined) {
      if (query.cursor.length > 4096) throw new SourceError('invalid-request', 'The source-set cursor exceeds its size limit.')
      let cursor: unknown
      try { cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()) }
      catch (error) { void error; throw new SourceError('invalid-request', 'The source-set cursor is invalid.') }
      if (!Array.isArray(cursor) || cursor.length !== 3 || cursor[0] !== state.revision || cursor[1] !== key
        || !Number.isSafeInteger(cursor[2]) || cursor[2] < 0) {
        throw new SourceError('invalid-request', 'The source-set cursor expired or belongs to another query.')
      }
      offset = cursor[2] as number
    }
    return { items: entries.slice(offset, offset + limit).map(summary),
      nextCursor: offset + limit < entries.length ? Buffer.from(JSON.stringify([state.revision, key, offset + limit])).toString('base64url') : null }
  }

  /**
   * Reopen one persisted source set without asserting current source availability.
   * @param id - durable source-set identity.
   * @returns its current references and selected quotations.
   */
  async getSet(id: SourceSetId): Promise<SourceSet> {
    const sets = (await this.loaded()).sourceSets
    const set = Object.hasOwn(sets, id) ? sets[id] : undefined
    if (set === undefined) throw new SourceError('not-found', 'The saved source set is unavailable.')
    return set
  }

  private operation(state: State, operationId: string, payload: string): SourceSetReceipt | undefined {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new SourceError('invalid-request', 'A source-set save needs a stable operation identity.')
    const old = Object.hasOwn(state.operations, operationId) ? state.operations[operationId] : undefined
    if (old !== undefined && old.payload !== payload) throw new SourceError('invalid-request', 'This operation identity already belongs to different source-set content.')
    if (old === undefined && Object.keys(state.operations).length >= this.limits.maxStateOperations) {
      throw new SourceError('unavailable', 'The operation-receipt limit was reached; existing retry identities were retained.')
    }
    return old?.receipt
  }

  /**
   * Publish one explicit source-set save or recover its unchanged operation receipt.
   * @param request - exact save request and stable retry identity.
   * @returns its durable historical receipt.
   */
  async saveSet(request: SaveSourceSetRequest): Promise<SourceSetReceipt> {
    return this.serialize(async () => {
      if (!request.title.trim() || request.title.length > this.limits.maxTitleCharacters || /[\r\n]/.test(request.title)) {
        throw new SourceError('invalid-request', 'A source set needs a short single-line title.')
      }
      if (request.selections.length > this.limits.maxSourceSetSelections) throw new SourceError('invalid-request', 'The source set has too many selections.')
      const parsedSelections = z.array(selectionSchema).safeParse(request.selections)
      if (!parsedSelections.success) throw new SourceError('invalid-request', 'The selected source references are invalid.')
      const selections = parsedSelections.data.map(selected)
      if (selections.some(item => (item.selectedText?.length ?? 0) > this.limits.maxSelectionCharacters
        || (item.locator?.kind === 'text' ? item.locator.quote.length : item.locator?.kind === 'pdf-page' ? item.locator.quote?.length ?? 0 : 0) > this.limits.maxSelectionCharacters)) {
        throw new SourceError('invalid-request', 'An explicitly selected quotation exceeds its configured character limit.')
      }
      const parsedTopics = z.array(topicSchema).safeParse(request.topics ?? [])
      if (!parsedTopics.success) throw new SourceError('invalid-request', 'The associated topic references are invalid.')
      const associated = topics(parsedTopics.data)
      const payload = JSON.stringify({ kind: 'save', id: request.id ?? null, title: request.title, selections, topics: associated })
      if (payload.length > this.limits.maxSourceSetCharacters) throw new SourceError('invalid-request', 'The complete source-set request exceeds its character limit.')
      const current = await this.loaded()
      const old = this.operation(current, request.operationId, payload)
      if (old !== undefined) return old
      const id = request.id ?? randomUUID() as SourceSetId
      const previous = Object.hasOwn(current.sourceSets, id) ? current.sourceSets[id] : undefined
      if (request.id !== undefined && previous === undefined) throw new SourceError('not-found', 'The source set to update no longer exists.')
      if (previous === undefined && Object.keys(current.sourceSets).length >= this.limits.maxSourceSets) throw new SourceError('unavailable', 'The saved source-set limit was reached.')
      const now = new Date().toISOString()
      const set: SourceSet = { id, title: request.title, selections, selectionCount: selections.length, topics: associated,
        createdAt: previous?.createdAt ?? now, updatedAt: now }
      const receipt: SourceSetReceipt = { operationId: request.operationId, id, state: 'saved', committedAt: now }
      await this.publish({ ...current, revision: current.revision + 1, sourceSets: { ...current.sourceSets, [id]: set },
        operations: { ...current.operations, [request.operationId]: { payload, receipt } } }, request.operationId)
      return receipt
    })
  }

  /**
   * Remove one operational source set without deleting its scientific sources.
   * @param operationId - stable removal retry identity.
   * @param id - existing set.
   * @returns the durable removal receipt.
   */
  async removeSet(operationId: string, id: SourceSetId): Promise<SourceSetReceipt> {
    return this.serialize(async () => {
      const current = await this.loaded()
      const payload = JSON.stringify({ kind: 'remove', id })
      const old = this.operation(current, operationId, payload)
      if (old !== undefined) return old
      if (!Object.hasOwn(current.sourceSets, id)) throw new SourceError('not-found', 'The source set to remove no longer exists.')
      const sets = Object.fromEntries(Object.entries(current.sourceSets).filter(([key]) => key !== id))
      const receipt: SourceSetReceipt = { operationId, id, state: 'removed', committedAt: new Date().toISOString() }
      await this.publish({ ...current, revision: current.revision + 1, sourceSets: sets,
        operations: { ...current.operations, [operationId]: { payload, receipt } } }, operationId)
      return receipt
    })
  }
}
