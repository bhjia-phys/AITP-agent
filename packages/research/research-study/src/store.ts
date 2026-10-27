/** Bounded operational draft store using the Host's atomic writer and stable receipts. */
import { constants } from 'node:fs'
import { lstat, mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { parseMaterialLocator } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { z } from 'zod'
import type {
  StudyAnswerCapture, StudyArtifact, StudyArtifactId, StudyArtifactPage, StudyArtifactQuery,
  StudyArtifactReceipt, StudyArtifactSummary, StudyArtifactVersion, StudyCitation, StudyFailure,
} from './types.ts'

/** Deployment bounds for complete draft content and preserved operation identities. */
export interface StudyStoreLimits {
  /** Maximum UTF-8 bytes in the complete operational state file. */
  readonly maxStateBytes: number
  /** Maximum retained drafts; reaching the limit never prunes existing content. */
  readonly maxArtifacts: number
  /** Maximum retained operation receipts needed for unchanged retries. */
  readonly maxOperations: number
  /** Maximum complete draft characters, including preserved source context. */
  readonly maxArtifactCharacters: number
  /** Maximum characters in one single-line draft title. */
  readonly maxTitleCharacters: number
  /** Maximum summaries returned in one list page. */
  readonly maxPageSize: number
  /** Maximum milliseconds spent acquiring the cooperative operation-store lock. */
  readonly lockWaitMs: number
}
/** A deliberate business failure, preserved by the Remote service. */
export class StudyError extends Error {
  /** @param failure - explicit operational failure and retry guidance. */
  constructor(readonly failure: StudyFailure) { super(failure.message) }
}

/** Supported product labels; parsing never generates a product. */
export const kindSchema = z.enum(['note', 'report', 'comparison', 'outline', 'flashcards', 'mind-map'])
const idSchema = z.string().min(1).transform(value => value as StudyArtifactId)
const versionSchema = z.string().min(1).transform(value => value as StudyArtifactVersion)
/** Reuse the shared locator parser for manually linked or persisted selections. */
export const selectionSchema = z.object({
  ref: z.object({ rootId: z.string().min(1), sourceId: z.string().min(1) }).strict(),
  locator: z.unknown().optional(), selectedText: z.string().optional(),
}).strict().transform((value): SourceSelection => {
  const locator = value.locator === undefined ? undefined : parseMaterialLocator(JSON.stringify(value.locator))
  return { ref: { rootId: value.ref.rootId as SourceSelection['ref']['rootId'], sourceId: value.ref.sourceId as SourceSelection['ref']['sourceId'] },
    ...(locator === undefined ? {} : { locator }), ...(value.selectedText === undefined ? {} : { selectedText: value.selectedText }) }
})
const citationSchema = z.object({ selection: selectionSchema,
  basis: z.enum(['human-linked', 'selected', 'recorded-context', 'recorded-source-read']),
  sessionId: z.string().min(1).optional(), seq: z.number().int().nonnegative().optional(),
}).strict().transform((value): StudyCitation => ({ selection: value.selection, basis: value.basis,
  ...(value.sessionId === undefined ? {} : { sessionId: value.sessionId as NonNullable<StudyCitation['sessionId']> }),
  ...(value.seq === undefined ? {} : { seq: value.seq as NonNullable<StudyCitation['seq']> }),
}))
const captureSchema = z.object({ sessionId: z.string().min(1), seq: z.number().int().nonnegative(),
  messageId: z.string().min(1), provider: z.string(), model: z.string(), actor: z.literal('model'),
  contexts: z.array(z.object({ seq: z.number().int().nonnegative(), name: z.string(), text: z.string() }).strict()),
}).strict().transform((value): StudyAnswerCapture => ({ ...value,
  sessionId: value.sessionId as StudyAnswerCapture['sessionId'], seq: value.seq as StudyAnswerCapture['seq'],
  contexts: value.contexts.map(item => ({ ...item, seq: item.seq as StudyAnswerCapture['seq'] })),
}))
const artifactSchema = z.object({ id: idSchema, version: versionSchema,
  title: z.string().min(1), kind: kindSchema, status: z.literal('provisional'),
  origin: z.enum(['handwritten', 'captured-answer']), edited: z.boolean(), citationCount: z.number().int().nonnegative(),
  createdAt: z.string(), updatedAt: z.string(), savedBy: z.literal('host-owner'), markdown: z.string(),
  citations: z.array(citationSchema), capture: captureSchema.optional(),
}).strict().transform(({ capture, ...value }): StudyArtifact => ({ ...value, ...(capture === undefined ? {} : { capture }) }))
const receiptSchema = z.object({ operationId: z.string().min(1), id: idSchema, version: versionSchema,
  state: z.enum(['saved', 'removed']), committedAt: z.string() }).strict()
const stateSchema = z.object({ format: z.literal(1), revision: z.number().int().nonnegative(),
  artifacts: z.record(z.string(), artifactSchema), operations: z.record(z.string(),
    z.object({ payload: z.string(), receipt: receiptSchema }).strict()),
}).strict()
interface State {
  readonly format: 1
  readonly revision: number
  readonly artifacts: Readonly<Record<string, StudyArtifact>>
  readonly operations: Readonly<Record<string, { readonly payload: string; readonly receipt: StudyArtifactReceipt }>>
}
/** Input assembled by this plugin after observing the actual answer or the explicit handwritten edit. */
export interface StudyDraft {
  readonly id?: StudyArtifactId
  readonly title: string
  readonly kind: StudyArtifact['kind']
  readonly markdown: string
  readonly citations: readonly StudyCitation[]
  readonly capture?: StudyAnswerCapture
}

function summary(artifact: StudyArtifact): StudyArtifactSummary {
  const { markdown: _markdown, citations: _citations, capture: _capture, ...value } = artifact
  return value
}

/**
 * A single operational owner. Reads do not enumerate, alter, or copy research source directories.
 * Atomic replacement survives process restart; power-loss fsync durability follows atomic-write.
 */
export class StudyStore {
  private pending: Promise<void> = Promise.resolve()
  private admissionOpen = true

  /**
   * @param directory - the fixed dshHomePath('research-study') child, absent on unsupported Hosts.
   * @param limits - complete-state limits.
   */
  constructor(readonly directory: string | undefined, readonly limits: StudyStoreLimits) {}

  /**
   * Observe support without creating the draft store.
   * @returns whether the Host declares operational storage.
   */
  get supported(): boolean { return this.directory !== undefined }

  /**
   * Prepare the separate identity root for optional draft-source reading.
   * @returns a narrow empty directory used only to authorize synthetic artifact source identities.
   */
  async sourceDirectory(): Promise<string> {
    const directory = await this.prepare()
    const sources = join(directory, 'sources')
    await mkdir(sources, { recursive: true, mode: 0o700 })
    const info = await lstat(sources)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new StudyError({ code: 'unavailable', message: 'The study-source directory is not an ordinary directory.', retryable: false })
    return sources
  }

  /**
   * Close admission and wait for pending draft saves.
   * @returns after every admitted save has settled; later saves fail visibly.
   */
  async close(): Promise<void> { this.admissionOpen = false; await this.pending }

  private async prepare(): Promise<string> {
    if (this.directory === undefined) throw new StudyError({ code: 'unsupported', message: 'This Host has no operational storage for study drafts.', retryable: false })
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const info = await lstat(this.directory)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new StudyError({ code: 'unavailable', message: 'The study store is not an ordinary Host directory.', retryable: false })
    return this.directory
  }

  private async read(): Promise<State> {
    const path = join(await this.prepare(), 'state.json')
    let text: string
    try {
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const info = await file.stat()
        if (!info.isFile() || info.size > this.limits.maxStateBytes) throw new StudyError({ code: 'unavailable', message: 'The complete study store exceeds its file limit or is not a regular file.', retryable: false })
        const bytes = Buffer.alloc(Math.min(info.size + 1, this.limits.maxStateBytes + 1))
        const read = await file.read(bytes, 0, bytes.length, 0)
        if (read.bytesRead > this.limits.maxStateBytes || read.bytesRead > info.size) throw new StudyError({ code: 'unavailable', message: 'The study store changed while reading; retry the operation.', retryable: true })
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, read.bytesRead))
      } finally { await file.close() }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { format: 1, revision: 0, artifacts: {}, operations: {} }
      }
      throw error
    }
    const state = stateSchema.parse(JSON.parse(text))
    if (Object.keys(state.artifacts).length > this.limits.maxArtifacts
      || Object.keys(state.operations).length > this.limits.maxOperations) {
      throw new StudyError({ code: 'unavailable', message: 'The saved study store exceeds its configured item limits; existing records were retained.', retryable: false })
    }
    for (const [id, artifact] of Object.entries(state.artifacts)) {
      if (id !== artifact.id || artifact.citationCount !== artifact.citations.length
        || artifact.origin === 'captured-answer' !== (artifact.capture !== undefined)) {
        throw new StudyError({ code: 'unavailable', message: 'A saved study draft has inconsistent identity or attribution.', retryable: false })
      }
      this.validate(artifact)
    }
    return state
  }

  private validate(draft: Pick<StudyDraft, 'title' | 'markdown' | 'citations' | 'capture'>): void {
    if (!draft.title.trim() || /[\r\n]/.test(draft.title) || draft.title.length > this.limits.maxTitleCharacters) {
      throw new StudyError({ code: 'invalid-request', message: 'A study draft needs a short single-line title.', retryable: false })
    }
    if (!draft.markdown.trim() || JSON.stringify(draft).length > this.limits.maxArtifactCharacters) {
      throw new StudyError({ code: 'invalid-request', message: 'The complete draft is empty or exceeds its character limit; no content was truncated.', retryable: false })
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.admissionOpen) return Promise.reject(new StudyError({ code: 'unavailable', message: 'The study plugin is unloading; retry after it reconnects.', retryable: true }))
    const pending = this.pending.then(operation)
    this.pending = pending.then(() => {}, () => {})
    return pending
  }

  private previous(state: State, operationId: string, payload: string): StudyArtifactReceipt | undefined {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new StudyError({ code: 'invalid-request', message: 'A save needs a stable operation identity of at most 128 letters, numbers, underscores or dashes.', retryable: false })
    const previous = Object.hasOwn(state.operations, operationId) ? state.operations[operationId] : undefined
    if (previous !== undefined && previous.payload !== payload) throw new StudyError({ code: 'conflict', message: 'This operation identity already belongs to different study content; retain it only for an unchanged retry.', retryable: false })
    if (previous === undefined && Object.keys(state.operations).length >= this.limits.maxOperations) throw new StudyError({ code: 'unavailable', message: 'The study operation-receipt limit was reached; retry identities were retained.', retryable: false })
    return previous?.receipt
  }

  private async publish(next: State, operationId: string): Promise<void> {
    const text = `${JSON.stringify(next)}\n`
    if (Buffer.byteLength(text) > this.limits.maxStateBytes) throw new StudyError({ code: 'unavailable', message: 'The complete study store exceeds its byte limit; nothing was discarded.', retryable: false })
    const path = join(await this.prepare(), 'state.json')
    try { await writeFileAtomic(path, text, { mode: 0o600, dirMode: 0o700 }) }
    catch (error) {
      try { if (JSON.stringify(await this.read()) === JSON.stringify(next)) return }
      catch (readError) { void readError }
      void error
      throw new StudyError({ code: 'unknown', message: 'The study save outcome is unknown. Retry the unchanged request with its original operation identity.', retryable: true, operationId })
    }
  }

  /**
   * List saved draft summaries from the current operational state.
   * @param query - bounded summary filters and revision-bound cursor.
   * @returns a page without draft bodies.
   */
  async list(query: StudyArtifactQuery): Promise<StudyArtifactPage> {
    const state = await this.read()
    const limit = query.limit ?? this.limits.maxPageSize
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.limits.maxPageSize) throw new StudyError({ code: 'invalid-request', message: 'The requested study page exceeds its configured limit.', retryable: false })
    const key = JSON.stringify([query.kind ?? null, limit])
    let offset = 0
    if (query.cursor !== undefined) {
      const cursor = z.tuple([z.number().int().nonnegative(), z.string(), z.number().int().nonnegative()])
        .parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString()))
      if (cursor[0] !== state.revision || cursor[1] !== key) throw new StudyError({ code: 'invalid-request', message: 'The study list changed; reopen its first page.', retryable: true })
      offset = cursor[2]
    }
    const values = Object.values(state.artifacts).filter(item => query.kind === undefined || item.kind === query.kind)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    return { items: values.slice(offset, offset + limit).map(summary),
      nextCursor: offset + limit < values.length ? Buffer.from(JSON.stringify([state.revision, key, offset + limit])).toString('base64url') : null }
  }

  /**
   * Read the current body and provenance of one saved draft.
   * @param id - saved operational identity.
   * @returns current complete draft, or an explicit missing failure.
   */
  async get(id: StudyArtifactId): Promise<StudyArtifact> {
    const artifacts = (await this.read()).artifacts
    const artifact = Object.hasOwn(artifacts, id) ? artifacts[id] : undefined
    if (artifact === undefined) throw new StudyError({ code: 'not-found', message: 'This study draft was removed or is unavailable.', retryable: false })
    return artifact
  }

  /**
   * Project drafts for the optional shared source provider.
   * @returns all bounded source summaries from one complete store observation, without draft bodies.
   */
  async catalog(): Promise<readonly StudyArtifactSummary[]> { return Object.values((await this.read()).artifacts).map(summary) }

  /**
   * Serialize one explicit save; an existing receipt is recovered before the answer is re-observed.
   * @param operationId - stable unchanged retry identity.
   * @param payload - normalized original request, not a reconstructed Session snapshot.
   * @param build - observes original answer only when this save has not already committed.
   * @returns historical receipt retained across edit, removal and restart.
   */
  save(operationId: string, payload: string, build: () => StudyDraft | Promise<StudyDraft>): Promise<StudyArtifactReceipt> {
    return this.enqueue(async () => withFileLock(join(await this.prepare(), 'state.json'), async () => {
      const current = await this.read()
      const old = this.previous(current, operationId, payload)
      if (old !== undefined) return old
      const draft = await build()
      this.validate(draft)
      const id = draft.id ?? randomUUID() as StudyArtifactId
      const previous = Object.hasOwn(current.artifacts, id) ? current.artifacts[id] : undefined
      if (draft.id !== undefined && previous === undefined) throw new StudyError({ code: 'not-found', message: 'The draft to edit was removed.', retryable: false })
      if (previous === undefined && Object.keys(current.artifacts).length >= this.limits.maxArtifacts) throw new StudyError({ code: 'unavailable', message: 'The saved study-draft limit was reached.', retryable: false })
      const now = new Date().toISOString(), version = randomUUID() as StudyArtifactVersion
      const capture = previous?.capture ?? draft.capture
      const citations = [...previous?.citations ?? [], ...draft.citations].filter((item, index, array) =>
        array.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index)
      const artifact: StudyArtifact = { id, version, title: draft.title, kind: draft.kind, markdown: draft.markdown,
        status: 'provisional', origin: capture === undefined ? 'handwritten' : 'captured-answer',
        edited: previous !== undefined, savedBy: 'host-owner', citationCount: citations.length, citations,
        createdAt: previous?.createdAt ?? now, updatedAt: now, ...(capture === undefined ? {} : { capture }) }
      this.validate(artifact)
      const receipt: StudyArtifactReceipt = { operationId, id, version, state: 'saved', committedAt: now }
      await this.publish({ ...current, revision: current.revision + 1, artifacts: { ...current.artifacts, [id]: artifact },
        operations: { ...current.operations, [operationId]: { payload, receipt } } }, operationId)
      return receipt
    }, { waitMs: this.limits.lockWaitMs }))
  }

  /**
   * Remove only the selected operational draft and retain its retry receipt.
   * @param operationId - stable removal identity.
   * @param id - plugin-owned draft.
   * @returns historical removal receipt.
   */
  remove(operationId: string, id: StudyArtifactId): Promise<StudyArtifactReceipt> {
    return this.enqueue(async () => withFileLock(join(await this.prepare(), 'state.json'), async () => {
      const current = await this.read(), payload = JSON.stringify({ action: 'remove', id })
      const old = this.previous(current, operationId, payload)
      if (old !== undefined) return old
      const artifact = Object.hasOwn(current.artifacts, id) ? current.artifacts[id] : undefined
      if (artifact === undefined) throw new StudyError({ code: 'not-found', message: 'This study draft was removed or is unavailable.', retryable: false })
      const artifacts = Object.fromEntries(Object.entries(current.artifacts).filter(([key]) => key !== id))
      const receipt: StudyArtifactReceipt = { operationId, id, version: artifact.version, state: 'removed', committedAt: new Date().toISOString() }
      await this.publish({ ...current, revision: current.revision + 1, artifacts,
        operations: { ...current.operations, [operationId]: { payload, receipt } } }, operationId)
      return receipt
    }, { waitMs: this.limits.lockWaitMs }))
  }
}
