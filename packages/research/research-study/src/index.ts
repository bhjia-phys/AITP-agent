/** Independently saved study drafts over normal Harness answers and shared local sources. */
import { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService, principalOf } from '@deepseek-ai/dsh-typert-protocol'
import { SessionQueryError } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { resourceEntryId } from '@deepseek-ai/dsh-research-resources'
import { parseSourceMarkup } from '@deepseek-ai/dsh-research-resources/markup'
import type { ResourceProvider, SourceId, SourceRootLease, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { z } from 'zod'
import { captureCompletedAnswer } from './capture.ts'
import { exportStudyMarkdown } from './markdown.ts'
import { StudyError, StudyStore, kindSchema, selectionSchema, type StudyStoreLimits } from './store.ts'
import type {
  CaptureStudyAnswerRequest, RemoveStudyArtifactRequest, SaveStudyNoteRequest,
  StudyArtifact, StudyArtifactId, StudyArtifactPage, StudyArtifactQuery, StudyArtifactReceipt,
  StudyArtifactSummary, StudyResult, StudySetup,
} from './types.ts'

export type * from './types.ts'

/** Complete local limits; the operational path is always the Host-owned research-study child. */
export interface Config extends Partial<StudyStoreLimits> {
  /** Maximum canonical Session events inspected for one explicit answer capture. */
  readonly maxCaptureEvents?: number
  /** Offer saved drafts through shared research sources when that service is installed. */
  readonly exposeSources?: boolean
}
type ResolvedConfig = Required<Config>
const addressedSession = (request: CaptureStudyAnswerRequest): SessionId => request.sessionId
const noteSchema = z.object({ operationId: z.string(), id: z.string().optional(), title: z.string(),
  kind: kindSchema, markdown: z.string(), citations: z.array(selectionSchema).optional() }).strict()
const querySchema = z.object({ cursor: z.string().optional(), limit: z.number().int().positive().optional(),
  kind: kindSchema.optional() }).strict()

declare module '@deepseek-ai/cordis' {
  interface Context { researchStudy: ResearchStudy }
}

/** Single draft owner; no model provider, new Session log or scientific writeback is created here. */
export class ResearchStudy extends TypertRemoteService {
  static inject = ['typert']
  static Config: s<Config, ResolvedConfig> = s.object({
    maxStateBytes: s.natural().min(1024).default(16_777_216),
    maxArtifacts: s.natural().min(1).default(1000),
    maxOperations: s.natural().min(1).default(4000),
    maxArtifactCharacters: s.natural().min(256).default(128_000),
    maxTitleCharacters: s.natural().min(1).default(200),
    maxPageSize: s.natural().min(1).default(100),
    lockWaitMs: s.natural().min(1).default(15_000),
    maxCaptureEvents: s.natural().min(1).default(20_000),
    exposeSources: s.boolean().default(true),
  })
  private readonly config: ResolvedConfig
  private readonly store: StudyStore
  private readonly lifetime = new AbortController()
  private sourceLease: SourceRootLease | undefined
  private sourceReady: Promise<void> = Promise.resolve()

  /** @param ctx - composed Host with optional storage, Session observation and shared sources. @param config - deployment bounds. */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'researchStudy', { namespace: 'researchStudy' })
    this.config = ResearchStudy.Config(config)
    const home = ctx.get('dshHomePath')
    this.store = new StudyStore(home?.('research-study'), this.config)
    ctx.effect(() => async () => { this.lifetime.abort(); await this.store.close() }, 'research-study: drain admitted saves')
    if (this.config.exposeSources && this.store.supported) {
      const bridge = ctx.inject(['researchResources'], async (scope) => {
        const gate = new AbortController()
        const owned: { lease?: SourceRootLease } = {}
        const active = (): boolean => !gate.signal.aborted && !this.lifetime.signal.aborted
        scope.effect(() => () => {
          gate.abort()
          if (this.sourceLease === owned.lease) this.sourceLease = undefined
          owned.lease?.dispose()
        }, 'research-study: narrow synthetic-source grant')
        const directory = await this.store.sourceDirectory()
        if (!active()) return
        const lease = await scope.researchResources.registerRoot({ id: 'research-study:artifacts', path: directory,
          title: 'Study drafts', domains: ['knowledge'], grantKind: 'host', isAuthorized: active })
        if (!active()) { lease.dispose(); return }
        owned.lease = lease
        this.sourceLease = lease
        scope.effect(() => scope.researchResources.registerProvider(this.provider(lease)), 'research-study: provisional draft provider')
      })
      if (ctx.get('researchResources') !== undefined) this.sourceReady = bridge.await().then(() => {})
      ctx.effect(() => () => bridge.dispose(), 'research-study: optional shared-source bridge')
    }
  }

  private requireOwner(): void {
    if (principalOf(this.ctx.invocation) !== undefined) throw new RemoteError('research/study-owner-required', 'Study drafts are available to the Host owner only.', {})
  }

  private async attempt<T>(operation: () => Promise<T>): Promise<StudyResult<T>> {
    try { return { ok: true, value: await operation() } }
    catch (error) {
      if (error instanceof StudyError) return { ok: false, error: error.failure }
      if (error instanceof z.ZodError) return { ok: false, error: { code: 'invalid-request', message: 'The study request or stored draft could not be decoded. Existing data was retained.', retryable: false } }
      if (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') return { ok: false, error: { code: 'not-found', message: 'The selected Session is unavailable.', retryable: false } }
      return { ok: false, error: { code: 'unavailable', message: 'The study operation could not read its Host storage or Session. Existing data was retained.', retryable: true } }
    }
  }

  private selection(id: StudyArtifactId): SourceSelection | undefined {
    return this.sourceLease === undefined ? undefined : { ref: { rootId: this.sourceLease.rootId, sourceId: `draft:${id}` as SourceId } }
  }

  private withSource<T extends StudyArtifactSummary>(artifact: T): T {
    const source = this.selection(artifact.id)
    return source === undefined ? artifact : { ...artifact, source }
  }

  private async invalidate(): Promise<void> {
    const resources = this.ctx.get('researchResources'), lease = this.sourceLease
    if (resources === undefined || lease === undefined || this.lifetime.signal.aborted) return
    // A failed catalog refresh does not revoke an already acknowledged draft save.
    try { await resources.refresh({ rootId: lease.rootId }, this.lifetime.signal) }
    catch (error) { void error }
  }

  private provider(lease: SourceRootLease): ResourceProvider {
    return { id: 'research-study', domain: 'knowledge',
      list: async (context, signal) => {
        if (context.root.id !== lease.rootId) return []
        signal.throwIfAborted()
        return (await this.store.catalog()).map((artifact) => {
          const ref = { rootId: lease.rootId, sourceId: `draft:${artifact.id}` as SourceId }
          return { id: resourceEntryId(ref), ref, title: artifact.title, kind: 'note' as const, domain: 'knowledge' as const,
            providerId: 'research-study', metadata: { entryKind: 'study-draft', artifactId: artifact.id,
              artifactKind: artifact.kind, support: 'provisional', review: 'unreviewed',
              generated: artifact.origin === 'captured-answer' ? 'true' : 'false', actor: artifact.origin === 'captured-answer' ? 'model' : 'host-owner' },
            links: [], topics: [] }
        })
      },
      read: async (context, reference, locator, signal) => {
        if (context.root.id !== lease.rootId || !reference.sourceId.startsWith('draft:')) return undefined
        signal.throwIfAborted()
        let artifact: StudyArtifact
        try { artifact = await this.store.get(reference.sourceId.slice('draft:'.length) as StudyArtifactId) }
        catch (error) {
          if (error instanceof StudyError && error.failure.code === 'not-found') return { kind: 'unavailable', reason: 'missing', detail: 'This provisional study draft was removed; its original sources were not deleted.' }
          throw error
        }
        const text = exportStudyMarkdown(artifact)
        if (locator?.kind === 'text' && text.slice(locator.start, locator.end) !== locator.quote) {
          return { kind: 'unavailable', reason: 'missing', detail: 'The saved draft changed and the original selected passage no longer resolves exactly.' }
        }
        if (locator?.kind === 'anchor') {
          const matches = parseSourceMarkup(text).anchors.filter(item => item.anchor === locator.anchor)
          if (matches.length !== 1) return { kind: 'unavailable', reason: matches.length === 0 ? 'missing' : 'ambiguous', detail: 'The selected draft anchor is missing or ambiguous.' }
        } else if (locator !== undefined && locator.kind !== 'text') {
          return { kind: 'unavailable', reason: 'unsupported', detail: 'A study draft supports Markdown text and anchors, rather than PDF or Git locations.' }
        }
        return { kind: 'text', format: 'markdown', text }
      } }
  }

  /**
   * Report the Host capabilities available to this plugin.
   * @returns explicit availability without reading a Session or research source.
   */
  @Remote({ name: 'getSetup' })
  async getSetup(): Promise<StudySetup> {
    this.requireOwner()
    await this.sourceReady
    return { canSave: this.store.supported, canCapture: this.store.supported && this.ctx.get('sessionQuery') !== undefined,
      asSources: this.sourceLease !== undefined }
  }

  /**
   * Browse saved draft summaries without retrieving their bodies.
   * @param request - bounded summary filters.
   * @returns a revision-bound page without bodies or context excerpts.
   */
  @Remote({ name: 'listArtifacts' })
  listArtifacts(request: StudyArtifactQuery): Promise<StudyResult<StudyArtifactPage>> {
    this.requireOwner()
    return this.attempt(async () => {
      const parsed = querySchema.parse(request)
      const page = await this.store.list({ ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
        ...(parsed.limit === undefined ? {} : { limit: parsed.limit }), ...(parsed.kind === undefined ? {} : { kind: parsed.kind }) })
      return { ...page, items: page.items.map(item => this.withSource(item)) }
    })
  }

  /**
   * Open an explicitly saved study draft.
   * @param request - existing plugin-owned identity.
   * @returns full saved content and original source evidence.
   */
  @Remote({ name: 'getArtifact' })
  getArtifact(request: { id: StudyArtifactId }): Promise<StudyResult<StudyArtifact>> {
    this.requireOwner()
    return this.attempt(async () => this.withSource(await this.store.get(request.id)))
  }

  /**
   * Save a handwritten note or an explicit edit without changing scientific records.
   * @param request - explicit handwritten content or edit with an unchanged retry identity.
   * @returns historical save receipt.
   */
  @Remote({ name: 'saveNote' })
  saveNote(request: SaveStudyNoteRequest): Promise<StudyResult<StudyArtifactReceipt>> {
    this.requireOwner()
    return this.attempt(async () => {
      const input = noteSchema.parse(request)
      const payload = JSON.stringify({ action: 'note', ...input, citations: input.citations ?? [] })
      const receipt = await this.store.save(input.operationId, payload, () => ({
        ...(input.id === undefined ? {} : { id: input.id as StudyArtifactId }), title: input.title,
        kind: input.kind, markdown: input.markdown,
        citations: (input.citations ?? []).map(selection => ({ selection, basis: 'human-linked' as const })),
      }))
      await this.invalidate()
      return receipt
    })
  }

  /**
   * Capture only the selected real completed answer through the existing authorized Session observer.
   * @param request - existing answer reference and stable save identity, with no client-supplied answer text.
   * @param signal - cancellation before a new capture is admitted; admitted writes drain on unload.
   * @returns durable provisional-draft receipt, including unchanged retry recovery after restart.
   */
  @Remote({ name: 'captureAnswer', resources: { session: addressedSession } })
  captureAnswer(request: CaptureStudyAnswerRequest, signal: AbortSignal): Promise<StudyResult<StudyArtifactReceipt>> {
    this.requireOwner()
    return this.attempt(async () => {
      signal.throwIfAborted()
      const input = z.object({ operationId: z.string(), title: z.string(), kind: kindSchema,
        sessionId: z.string().min(1), seq: z.number().int().nonnegative() }).strict().parse(request)
      const payload = JSON.stringify({ action: 'capture', ...input })
      const receipt = await this.store.save(input.operationId, payload, async () => {
        const query = this.ctx.get('sessionQuery')
        if (query === undefined) throw new StudyError({ code: 'unsupported', message: 'This Host has no Session observation service for answer capture.', retryable: false })
        using observed = await query.observeSession(request.sessionId, { signal, projectionMode: 'none' })
        const answer = captureCompletedAnswer(request.sessionId, observed.events, request.seq,
          this.ctx.get('sessions')?.messageProjections ?? [], this.config.maxCaptureEvents)
        return { title: input.title, kind: input.kind, ...answer }
      })
      await this.invalidate()
      return receipt
    })
  }

  /**
   * Remove this plugin's draft while retaining its original sources and retry receipt.
   * @param request - existing plugin-owned identity and stable removal identity.
   * @returns historical deletion receipt.
   */
  @Remote({ name: 'removeArtifact' })
  removeArtifact(request: RemoveStudyArtifactRequest): Promise<StudyResult<StudyArtifactReceipt>> {
    this.requireOwner()
    return this.attempt(async () => {
      const receipt = await this.store.remove(request.operationId, request.id)
      await this.invalidate()
      return receipt
    })
  }

  /**
   * Export actual saved content and its recorded references.
   * @param request - existing saved draft.
   * @returns portable Markdown as data; the client chooses an explicit export destination.
   */
  @Remote({ name: 'exportMarkdown' })
  exportMarkdown(request: { id: StudyArtifactId }): Promise<StudyResult<{ filename: string; markdown: string }>> {
    this.requireOwner()
    return this.attempt(async () => {
      const artifact = await this.store.get(request.id)
      return { filename: `study-${artifact.id}.md`, markdown: exportStudyMarkdown(artifact) }
    })
  }
}

export default ResearchStudy
