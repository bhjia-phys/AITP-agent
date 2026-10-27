/** Scoped research sources and conversations exposed through Harness services. */
import { realpath } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService, principalOf } from '@deepseek-ai/dsh-typert-protocol'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionPromptRequest, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionQueryError } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SourceId, SourceRootLease, StudyRequest, StudyReceipt, ResourceResult, TopicAssociationProvider } from '@deepseek-ai/dsh-research-resources/types'
import { sourceIdForPath } from '@deepseek-ai/dsh-research-resources/identity'
import { BoundedSourceWatcher } from '@deepseek-ai/dsh-research-resources/files'
import { pathForResourceId, pathForTopicId } from './markdown-files.ts'
import { MarkdownWorkspace, resourceIdForPath } from './markdown.ts'
import { ResearchChanges } from './changes.ts'
import { ResearchOnboarding } from './onboarding.ts'
import { onboardingFailure } from './onboarding-files.ts'
import { researchChangeView } from './change-view.ts'
import { ResearchDiscussions, assertDiscussionScope, readDiscussion } from './discussions.ts'
import { installRuntime } from './runtime.ts'
import { installWriteTools } from './write-tools.ts'
import { createSessionRecovery } from './recovery.ts'
import { buildSessionMemoryView, replaySessionWorkingState } from './session-view.ts'
import { readStudyContext } from './study-context.ts'
import { sourceSelectionSchema } from './study-schema.ts'
import { installStudyTools } from './study-tools.ts'
import type { SessionMemoryView } from './session-view-types.ts'
import type { ResearchOrigin, ResearchContextRead } from './working-types.ts'
import type {
  ResearchChangeView, ResearchChangeQuery, DiscussionPage, DiscussionQuery, ActivityPage, ActivityQuery,
  ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview,
  ContextQuery, ContextRead, Project, ReadEnvelope, ResearchProvider, ResearchQuestion,
  Resource, ResourceId, Result, Topic, TopicId, TopicPage, TopicQuery,
  ResearchEvent, ResearchSetup, ResearchInitializeRequest, CreateTopicRequest, CreateTopicReceipt,
} from './types.ts'

export type * from './types.ts'

const addressedWorkspace = (request: { workspaceId: WorkspaceId }): WorkspaceId => request.workspaceId
const addressedResearchSession = (request: { sessionId: SessionId }): SessionId => request.sessionId

interface SourceObservation {
  reader: MarkdownWorkspace
  workspaceId: WorkspaceId
  dirty: boolean
  forceNewRevision: boolean
  refreshing: Promise<void> | undefined
  watcher: FSWatcher | BoundedSourceWatcher | undefined
  watchFailure: string | undefined
  partialCoverage: boolean
}

/** One caller may stop waiting without cancelling the refresh shared by other readers. */
async function waitForObservation(refreshing: Promise<void>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const aborted = (): void => {
      signal.removeEventListener('abort', aborted)
      const reason: unknown = signal.reason
      reject(reason instanceof Error ? reason : new DOMException('Source observation cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', aborted, { once: true })
    void refreshing.then(() => { signal.removeEventListener('abort', aborted); resolve() }, (error: unknown) => {
      signal.removeEventListener('abort', aborted)
      reject(error instanceof Error ? error : new Error(String(error)))
    })
  })
}

/** Explicit host access and bounds for configured research roots. */
export interface Config {
  /** Only these roots can be read through this service. */
  roots?: {
    /** Absolute directory containing the scientific sources. */
    path: string
    /** Explicit identity for headless compositions without a Workspace registry. */
    id?: string
    /** Enable source writes on this configured scratch root; defaults to false. */
    writable?: boolean
    /** Durable operation receipts outside the scientific source tree. */
    stateDirectory?: string
  }[]
  /** Maximum directory entries inspected by discovery, including directories. */
  maxFiles?: number
  /** Enable source-change notifications; false rescans on each read instead. */
  watchSources?: boolean
  /** Use bounded directory watches rather than a recursive whole-tree watch. */
  watchMode?: 'recursive' | 'bounded'
  /** Maximum UTF-8 bytes read from one source file. */
  maxFileBytes?: number
  /** Maximum complete research-context characters, including labels and omissions. */
  maxContextCharacters?: number
  /** Maximum provisional model items in the current direction. */
  maxWorkingItems?: number
  /** Maximum characters in one provisional item field. */
  maxItemCharacters?: number
  /** Maximum original human inputs included in one request. */
  maxHumanInputs?: number
  /** Maximum characters allocated to original human inputs in one request. */
  maxHumanCharacters?: number
  /** Maximum characters accepted from the question form. */
  maxQuestionCharacters?: number
  /** Maximum UTF-8 bytes in a complete durable operation receipt. */
  maxOperationBytes?: number
  /** Maximum serialized model write-tool result characters. */
  maxResultCharacters?: number
  /** Maximum matching-topic conversations selected for historical delivery. */
  maxRecoverySessions?: number
  /**
   * Maximum records folded for cold topic classification and selected histories per recovery.
   * The query provider may still read a complete cold log before this processing bound applies.
   */
  maxRecoveryEvents?: number
  /** Maximum serialized historical evidence characters before the final request bound. */
  maxRecoveryCharacters?: number
}

type ResolvedConfig = Required<Config>

declare module '@deepseek-ai/cordis' {
  interface Context { researchMemory: ResearchMemory }
}

/** One source adapter per explicitly configured research root. */
export class ResearchMemory extends TypertRemoteService {
  static inject = ['typert', 'agents', 'sessions', 'systemPrompt', 'tools', 'sessionProjections']
  static Config: z<Config, ResolvedConfig> = z.object({
    roots: z.array(z.object({
      path: z.string().required(), id: z.string(), writable: z.boolean().default(false), stateDirectory: z.string(),
    })).default([]),
    maxFiles: z.natural().min(1).default(2000),
    watchSources: z.boolean().default(true),
    watchMode: (z.union(['recursive', 'bounded']) as z<'recursive' | 'bounded'>).default('recursive'),
    maxFileBytes: z.natural().min(1).default(1_048_576),
    maxContextCharacters: z.natural().min(1024).default(24_000),
    maxWorkingItems: z.natural().min(1).default(32),
    maxItemCharacters: z.natural().min(1).default(2000),
    maxHumanInputs: z.natural().min(1).default(16),
    maxHumanCharacters: z.natural().min(1).default(10_000),
    maxQuestionCharacters: z.natural().min(1).default(8000),
    maxOperationBytes: z.natural().min(1).default(2_097_152),
    maxResultCharacters: z.natural().min(1024).default(12_000),
    maxRecoverySessions: z.natural().min(1).default(24),
    maxRecoveryEvents: z.natural().min(1).default(10_000),
    maxRecoveryCharacters: z.natural().min(1024).default(12_000),
  })

  private readonly readers = new Map<string, SourceObservation>()
  private readonly config: ResolvedConfig
  private readonly changes = new Map<string, ResearchChanges>()
  private readonly notifications = new EventEmitter().setMaxListeners(0)
  private readonly lifetime = new AbortController()
  private readonly onboarding: ResearchOnboarding
  private readonly onboardingOperations = new Set<Promise<void>>()
  private readonly discussions: ResearchDiscussions
  private sourceInvalidator: ((root: string) => Promise<void>) | undefined
  private sourceContributor: ((workspaceId: WorkspaceId, root: string) => Promise<void>) | undefined

  /** @param ctx - composed Harness host. @param config - authorized source roots and bounds. */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'researchMemory', { namespace: 'researchMemory' })
    this.config = ResearchMemory.Config(config)
    this.discussions = new ResearchDiscussions(ctx, this.config.maxRecoveryEvents)
    ctx.on('session/event', (session, event) => {
      if (event.type === 'user/message' || event.type === 'session/title' || event.type === 'turn/start'
        || event.type === 'turn/end' || event.type === 'agent/inbox/spliced') {
        if (session.header.cwd !== undefined) this.notifications.emit(session.header.cwd)
      }
    })
    ctx.on('agent/status', ({ agent }) => {
      if (agent.session.header.cwd !== undefined) this.notifications.emit(agent.session.header.cwd)
    })
    const homePath = ctx.get('dshHomePath')
    this.onboarding = new ResearchOnboarding(homePath === undefined ? undefined : () => homePath('research-memory'),
      this.config.maxOperationBytes, this.config.maxFileBytes)
    ctx.effect(() => async () => {
      this.lifetime.abort()
      const refreshing: Promise<void>[] = []
      for (const observed of this.readers.values()) {
        observed.watcher?.close()
        observed.watcher = undefined
        if (observed.refreshing !== undefined) refreshing.push(observed.refreshing)
      }
      await Promise.allSettled([...refreshing, ...this.onboardingOperations])
    }, 'research-memory: source observations and admitted onboarding')
    installRuntime(ctx, this.config, (origin, signal, question) => this.contextFor(origin, signal, question),
      createSessionRecovery(ctx, this.config))
    const resourceBridge = ctx.inject(['researchResources', 'tools', 'sessionProjections'], (scope) => {
      const resources = scope.researchResources
      const roots = new Map<string, Promise<SourceRootLease>>()
      const materialUses = new Map<string, { key: string; values: Awaited<ReturnType<TopicAssociationProvider['read']>> }>()
      let active = true
      const contribute = async (workspaceId: WorkspaceId, root: string): Promise<void> => {
        if (!active) return
        let pending = roots.get(root)
        if (pending === undefined) {
          pending = resources.registerRoot({ id: `workspace:${workspaceId}`, path: root, workspaceId,
            isAuthorized: async () => {
              try { return active && await this.workspaceRoot(workspaceId) === root
                && (await this.configuredRoots(root)).length > 0 }
              catch { return false }
            } })
          roots.set(root, pending)
        }
        try { await pending } catch (error) {
          if (roots.get(root) === pending) roots.delete(root)
          throw error
        }
      }
      const invalidate = async (root: string): Promise<void> => {
        const lease = await roots.get(root)
        if (lease === undefined || !active) return
        const result = await resources.refresh({ rootId: lease.rootId }, this.lifetime.signal)
        if (!result.ok) throw new Error(result.error.message)
      }
      scope.effect(() => {
        this.sourceInvalidator = invalidate
        this.sourceContributor = contribute
        return async () => {
          active = false
          if (this.sourceContributor === contribute) this.sourceContributor = undefined
          if (this.sourceInvalidator === invalidate) this.sourceInvalidator = undefined
          await Promise.allSettled([...roots.values()].map(async (root) => { (await root).dispose() }))
        }
      }, 'research-memory: existing root grants')
      scope.effect(() => resources.registerStudyHandler((request, signal) => this.askStudy(request, signal)),
        'research-memory: normal source-study conversations')
      scope.effect(() => installStudyTools(scope, resources, this.config.maxResultCharacters),
        'research-memory: selected-source follow-up reads')
      scope.effect(() => resources.registerTopicAssociations({ id: 'research-memory-explicit-material-links',
        read: async (signal, reportIssue) => {
          const registered = await resources.listRoots({}, signal)
          if (!registered.ok) throw new Error(registered.error.message)
          const rootKey = JSON.stringify(registered.value.map(root => [root.id, root.displayPath, root.domains]).sort())
          const result: Awaited<ReturnType<TopicAssociationProvider['read']>>[number][] = []
          for (const observed of [...this.readers.values()]) {
            try {
              const reader = await this.reader(observed.workspaceId, signal)
              const lease = await roots.get(reader.root)
              if (lease === undefined) throw new Error('The research-material relationship root is unavailable.')
              const authored = reader.materialLinks()
              const key = JSON.stringify([authored.revision, rootKey])
              let cached = materialUses.get(reader.root)
              if (cached?.key !== key) {
                const resolved = await resources.resolveLocalLinks({ links: authored.links.map(link => ({
                  from: { rootId: lease.rootId, sourceId: sourceIdForPath(link.accountPath) }, href: link.href,
                })) }, signal)
                const values = authored.links.flatMap((link, index) => {
                  const target = resolved[index]
                  if (target === undefined) return []
                  const topic = { workspaceId: observed.workspaceId, topicId: link.topicId, reason: link.reason }
                  const root = registered.value.find(item => item.id === target.ref.rootId)
                  const checkout = root !== undefined && (root.domains === undefined || root.domains.includes('code'))
                    && target.ref.sourceId.startsWith('source:')
                    ? [{ ref: { rootId: target.ref.rootId, sourceId: 'git:checkout' as SourceId }, topic }] : []
                  return [{ ref: target.ref, topic }, ...checkout]
                })
                cached = { key, values }
                materialUses.set(reader.root, cached)
              }
              result.push(...cached.values)
            } catch {
              signal.throwIfAborted()
              reportIssue?.({ reason: `Authored material uses are unavailable for Workspace ${observed.workspaceId}; its relationships are omitted.` })
            }
          }
          return result
        },
      }), 'research-memory: authored material uses')
      return Promise.all([...this.readers.values()].map(observed => contribute(observed.workspaceId, observed.reader.root))).then(() => {})
    })
    ctx.effect(() => () => resourceBridge.dispose(), 'research-memory: optional source service bridge')
    installWriteTools(ctx, {
      maxResultCharacters: this.config.maxResultCharacters,
      resolveTarget: async (origin) => {
        if (origin.scope === 'global' || origin.workspaceId === undefined) return undefined
        const changes = await this.writer(origin.workspaceId as WorkspaceId)
        if (changes === undefined) return undefined
        const reader = await this.reader(origin.workspaceId as WorkspaceId)
        const provider = await this.provider({ workspaceId: origin.workspaceId as WorkspaceId }, new AbortController().signal)
        return { writer: changes.writer, root: reader.root, writable: provider.capabilities.applyChanges }
      },
      onApplied: async (origin) => {
        const reader = await this.reader(origin.workspaceId as WorkspaceId)
        this.markDirty(reader.root)
        await this.sourceInvalidator?.(reader.root)
      },
    })
  }

  private markDirty(root: string): void {
    const observed = this.readers.get(root)
    if (observed !== undefined) observed.dirty = true
    this.notifications.emit(root)
  }

  private watchOpenedSource(root: string, path: string): void {
    const observed = this.readers.get(root)
    if (!(observed?.watcher instanceof BoundedSourceWatcher)) return
    try { observed.watcher.includeFile(path) }
    catch (error) { observed.watchFailure = 'Bounded source notifications are unavailable; sources are rescanned on each read.'
      observed.watcher.close(); observed.watcher = undefined; this.markDirty(root); void error }
  }

  private admitOnboarding(): Disposable | undefined {
    if (this.lifetime.signal.aborted) return undefined
    let release: () => void = () => {}
    const settled = new Promise<void>((resolve) => { release = resolve })
    this.onboardingOperations.add(settled)
    return { [Symbol.dispose]: () => {
      this.onboardingOperations.delete(settled)
      release()
    } }
  }

  private stopping(): Result<never> {
    return { ok: false, error: { code: 'unavailable', message: 'The research service is stopping; no new setup operation was admitted.', retryable: true } }
  }

  /** Unavailable configured paths grant no access and do not disable other canonical matches. */
  private async configuredRoots(root: string, signal?: AbortSignal): Promise<ResolvedConfig['roots']> {
    const resolved = await Promise.allSettled(this.config.roots.map(async item => ({ ...item, path: await realpath(item.path) })))
    signal?.throwIfAborted()
    const configured = resolved.flatMap(item => item.status === 'fulfilled' && item.value.path === root ? [item.value] : [])
    if (configured.length > 0) return configured
    const enrolled = await this.onboarding.enrolled(root)
    signal?.throwIfAborted()
    return enrolled === undefined ? [] : [enrolled]
  }

  private async workspaceRoot(workspaceId: WorkspaceId, registered = false): Promise<string> {
    const workspace = this.ctx.get('workspaceRegistry')?.get(workspaceId)
    const path = workspace?.path ?? (registered ? undefined : this.config.roots.find(item => item.id === workspaceId)?.path)
    if (path === undefined) throw new RemoteError('research/workspace-missing', 'The Workspace is unavailable.', {})
    return realpath(path)
  }

  private async reader(workspaceId: WorkspaceId, signal?: AbortSignal, refresh = false): Promise<MarkdownWorkspace> {
    const lifetime = signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    const root = await this.workspaceRoot(workspaceId)
    lifetime.throwIfAborted()
    const allowed = await this.configuredRoots(root, lifetime)
    if (allowed.length === 0) throw new RemoteError('research/root-not-configured', 'This research root has not been configured for access.', {})
    let observed = this.readers.get(root)
    if (observed === undefined) {
      observed = {
        reader: new MarkdownWorkspace({ root, maxFiles: this.config.maxFiles,
          maxFileBytes: this.config.maxFileBytes, maxContextCharacters: this.config.maxContextCharacters,
          onDirectories: (directories, partial) => {
            const current = this.readers.get(root)
            if (!(current?.watcher instanceof BoundedSourceWatcher)) return
            current.partialCoverage = partial
            try { current.watcher.sync(directories) }
            catch (error) { current.watchFailure = 'Bounded source notifications are unavailable; sources are rescanned on each read.'
              current.watcher.close(); current.watcher = undefined; this.markDirty(root); void error }
          },
        }),
        workspaceId,
        dirty: true, forceNewRevision: false, refreshing: undefined, watcher: undefined, watchFailure: undefined, partialCoverage: false,
      }
      this.readers.set(root, observed)
      const owner = observed
      const failed = (error: unknown): void => {
        owner.watchFailure = `Source notifications are unavailable: ${error instanceof Error ? error.message : String(error)}. Sources will be rescanned on every read.`
        owner.watcher?.close()
        owner.watcher = undefined
        this.markDirty(root)
      }
      if (this.config.watchSources) {
        try {
          owner.watcher = this.config.watchMode === 'bounded'
            ? new BoundedSourceWatcher(root, Math.min(this.config.maxFiles, 1024), () => { this.markDirty(root) })
            : watch(root, { recursive: true }, () => { this.markDirty(root) })
          owner.watcher.on('error', failed)
        } catch (error: unknown) { failed(error) }
      } else owner.watchFailure = 'Automatic source notifications are disabled. Sources are rescanned on each read.'
    }
    if (refresh) observed.forceNewRevision = true
    if (refresh || observed.watcher === undefined) observed.dirty = true
    if (observed.refreshing === undefined && observed.dirty) {
      const owner = observed
      owner.refreshing = (async () => {
        while (owner.dirty) {
          this.lifetime.signal.throwIfAborted()
          owner.dirty = false
          const forceNewRevision = owner.forceNewRevision
          owner.forceNewRevision = false
          try {
            const result = await owner.reader.rebuild({ signal: this.lifetime.signal,
              preserveUnchangedRevision: owner.watcher === undefined && !forceNewRevision })
            if (!result.ok) throw new RemoteError('research/refresh-failed', result.error.message, {})
          } catch (error: unknown) {
            owner.dirty = true
            owner.forceNewRevision ||= forceNewRevision
            throw error
          }
        }
      })().finally(() => { owner.refreshing = undefined })
    }
    if (observed.refreshing !== undefined) await waitForObservation(observed.refreshing, lifetime)
    lifetime.throwIfAborted()
    await this.sourceContributor?.(workspaceId, root)
    return observed.reader
  }

  private async writer(workspaceId: WorkspaceId): Promise<ResearchChanges | undefined> {
    const reader = await this.reader(workspaceId)
    const configured = (await this.configuredRoots(reader.root))[0]
    if (configured?.stateDirectory === undefined) return undefined
    let changes = this.changes.get(reader.root)
    if (changes === undefined) {
      changes = new ResearchChanges(reader, { writableRoot: reader.root,
        stateDirectory: configured.stateDirectory, maxOperationBytes: this.config.maxOperationBytes }, async () => {
        const current = (await this.configuredRoots(reader.root))[0]
        return current?.writable === true && current.stateDirectory === configured.stateDirectory
      })
      this.changes.set(reader.root, changes)
    }
    return changes
  }

  /**
   * Observe owner setup before any source root has been authorized.
   * @param request - existing Workspace identity, resolved by the host registry.
   * @returns current access and explicit enrollment availability, without reading scientific content.
   */
  @Remote({ name: 'getSetup', resources: { workspace: addressedWorkspace } })
  async getSetup(request: { workspaceId: WorkspaceId }): Promise<Result<ResearchSetup>> {
    this.requireOwner()
    try {
      const root = await this.workspaceRoot(request.workspaceId)
      const allowed = await this.configuredRoots(root)
      const staticRoot = await Promise.allSettled(this.config.roots.map(item => realpath(item.path)))
      const configured = staticRoot.some(item => item.status === 'fulfilled' && item.value === root)
      return { ok: true, value: { configured: allowed.length > 0,
        writable: allowed.some(item => item.writable && item.stateDirectory !== undefined),
        canInitialize: !configured && this.ctx.get('workspaceRegistry')?.get(request.workspaceId) !== undefined
          && await this.onboarding.available(root) } }
    } catch (error) {
      if (error instanceof RemoteError) throw error
      return { ok: false, error: onboardingFailure(error) }
    }
  }

  /**
   * Explicitly enroll a registered Workspace and create its root account only when absent.
   * @param request - Workspace and the owner's chosen source-write authorization.
   * @returns durable setup; configured deployment policy cannot be broadened here.
   */
  @Remote({ name: 'initialize', resources: { workspace: addressedWorkspace } })
  async initialize(request: { workspaceId: WorkspaceId } & ResearchInitializeRequest): Promise<Result<ResearchSetup>> {
    this.requireOwner()
    using operation = this.admitOnboarding()
    if (operation === undefined) return this.stopping()
    const setup = await this.getSetup(request)
    if (!setup.ok) return setup
    if (!setup.value.canInitialize) return { ok: false, error: { code: 'read-only',
      message: 'Research access for this Workspace is controlled by host configuration, or application enrollment is unavailable.', retryable: false } }
    const root = await this.workspaceRoot(request.workspaceId, true)
    const previous = this.changes.get(root)
    const enroll = () => this.onboarding.initialize(root, request)
    const result = previous === undefined ? await enroll() : await previous.writer.serializeSources(enroll)
    if (!result.ok) return result
    this.markDirty(root)
    return { ok: true, value: { configured: true, writable: result.value.writable, canInitialize: true } }
  }

  /**
   * Create a new ordinary topic account and append an explicit parent/child relationship.
   * @param request - Workspace, human-authored opening and stable retry identity.
   * @returns durable source identities, or an honest rejected, partial or unknown outcome.
   */
  @Remote({ name: 'createTopic', resources: { workspace: addressedWorkspace } })
  async createTopic(request: { workspaceId: WorkspaceId } & CreateTopicRequest): Promise<Result<CreateTopicReceipt>> {
    this.requireOwner()
    using operation = this.admitOnboarding()
    if (operation === undefined) return this.stopping()
    const reader = await this.reader(request.workspaceId)
    const allowed = (await this.configuredRoots(reader.root))[0]
    if (!allowed?.writable || allowed.stateDirectory === undefined) return { ok: false, error: {
      code: 'read-only', message: 'Saving topics is disabled for this research root.', retryable: false,
    } }
    const changes = await this.writer(request.workspaceId)
    if (changes === undefined) return { ok: false, error: { code: 'read-only', message: 'This root has no operation storage.', retryable: false } }
    const result = await changes.writer.serializeSources(async (): Promise<Result<CreateTopicReceipt>> => {
      const current = (await this.configuredRoots(reader.root))[0]
      if (!current?.writable || current.stateDirectory === undefined) return { ok: false, error: {
        code: 'read-only', message: 'Saving topics was disabled before publication.', retryable: false,
      } }
      return this.onboarding.create(reader, current.stateDirectory, request)
    })
    if (result.ok || result.error.code === 'partial-apply' || result.error.code === 'outcome-unknown') {
      this.markDirty(reader.root)
      // Source receipts remain authoritative if a derived refresh fails after publication.
      try { await this.reader(request.workspaceId, undefined, true) }
      catch (error) {
        if (!(error instanceof Error)) throw error
        if (!this.lifetime.signal.aborted) this.ctx.logger.warn('Research topic was published; its index needs a refresh.')
      }
    }
    return result
  }

  /**
   * Read provider capabilities for one explicitly configured root.
   * @param request - addressed Workspace; its root must be explicitly configured.
   * @param signal - cancels this caller while shared source refresh remains owned by the service.
   * @returns actual read/write and live-watcher capabilities, with any observation warning.
   */
  @Remote({ name: 'provider', resources: { workspace: addressedWorkspace } })
  async provider(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<ResearchProvider> {
    signal.throwIfAborted()
    const root = await this.workspaceRoot(request.workspaceId)
    const allowed = await this.configuredRoots(root, signal)
    if (allowed.length === 0) {
      this.requireOwner()
      return { id: 'aitp-markdown', origin: 'runtime', capabilities: {
        read: false, readContext: false, readActivity: false, previewChanges: false,
        applyChanges: false, changeEvents: true, commands: [],
      } }
    }
    const reader = await this.reader(request.workspaceId, signal)
    const configured = await this.configuredRoots(reader.root, signal)
    const writable = principalOf(this.ctx.invocation) === undefined
      && configured.some(item => item.writable && item.stateDirectory !== undefined)
    const observed = this.readers.get(reader.root)
    const notice = observed?.watchFailure ?? (observed?.watcher instanceof BoundedSourceWatcher && observed.partialCoverage
      ? 'Automatic updates cover discovered folders and opened sources; undiscovered folders require refresh.' : undefined)
    return { id: 'aitp-markdown', origin: 'runtime',
      ...(notice === undefined ? {} : { notice }), capabilities: {
        read: true, readContext: true, readActivity: false, previewChanges: writable,
        applyChanges: writable, changeEvents: observed?.watcher !== undefined, commands: writable ? ['update-scope', 'record-answer'] : [],
      } }
  }

  /**
   * Read the research overview.
   * @param request - Workspace whose root account is read.
   * @param signal - caller cancellation for source reads.
   * @returns a fresh project observation or a typed source failure.
   */
  @Remote({ name: 'getProject', resources: { workspace: addressedWorkspace } })
  async getProject(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Project>>> {
    return (await this.reader(request.workspaceId, signal)).getProject({ signal })
  }

  /**
   * Read a bounded page of authored topic relationships.
   * @param request - Workspace and parent/cursor selection.
   * @param signal - caller cancellation for discovery and reads.
   * @returns a bounded topic page with explicit incompleteness or a source failure.
   */
  @Remote({ name: 'listTopics', resources: { workspace: addressedWorkspace } })
  async listTopics(request: { workspaceId: WorkspaceId; query: TopicQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<TopicPage>>> {
    return (await this.reader(request.workspaceId, signal)).listTopics(request.query, { signal })
  }

  /**
   * Read one topic from its source.
   * @param request - Workspace and provider-owned topic identity.
   * @param signal - caller cancellation for this read.
   * @returns the current topic account or an explicit unavailable result.
   */
  @Remote({ name: 'getTopic', resources: { workspace: addressedWorkspace } })
  async getTopic(request: { workspaceId: WorkspaceId; topicId: TopicId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Topic>>> {
    const reader = await this.reader(request.workspaceId, signal)
    const result = await reader.getTopic(request.topicId, { signal })
    if (result.ok) this.watchOpenedSource(reader.root, pathForTopicId(request.topicId))
    return result
  }

  /**
   * Read one material, retaining explicit unavailable content.
   * @param request - Workspace and material identity.
   * @param signal - caller cancellation for this read.
   * @returns source content or its typed missing/unsupported state.
   */
  @Remote({ name: 'getResource', resources: { workspace: addressedWorkspace } })
  async getResource(request: { workspaceId: WorkspaceId; resourceId: ResourceId },
    signal: AbortSignal): Promise<Result<ReadEnvelope<Resource>>> {
    const reader = await this.reader(request.workspaceId, signal)
    const result = await reader.getResource(request.resourceId, { signal })
    if (result.ok && result.value.value.content.kind !== 'unavailable') this.watchOpenedSource(reader.root, pathForResourceId(request.resourceId))
    return result
  }

  /**
   * Prepare bounded source material; this is not a model-delivery receipt.
   * @param request - Workspace, topic and requested context bounds.
   * @param signal - caller cancellation for source preparation.
   * @returns complete qualified source units and omissions, or a typed read failure.
   */
  @Remote({ name: 'readContext', resources: { workspace: addressedWorkspace } })
  async readContext(request: { workspaceId: WorkspaceId; query: ContextQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<ContextRead>>> {
    return (await this.reader(request.workspaceId, signal)).readContext(request.query, { signal })
  }

  /**
   * Read original inputs, provisional items and recorded context at one immutable Session cut.
   * @param request - existing Session identity; reading never creates an Agent or a conversation.
   * @param signal - cancels observation and configured-root authorization.
   * @returns bounded memory, null for an ordinary unbound Session, or an explicit unavailable result.
   * @throws when the caller is not the owner or the recorded root is outside configured access.
   */
  @Remote({ name: 'getSessionMemory', resources: { session: addressedResearchSession } })
  async getSessionMemory(request: { sessionId: SessionId }, signal: AbortSignal): Promise<Result<SessionMemoryView | null>> {
    this.requireOwner()
    signal.throwIfAborted()
    const query = this.ctx.get('sessionQuery')
    if (query === undefined) return { ok: false, error: { code: 'unsupported', message: 'This host does not provide Session observation.', retryable: false } }
    try {
      using observed = await query.observeSession(request.sessionId, { signal, projectionMode: 'none' })
      const state = replaySessionWorkingState(observed.events)
      if (state.origin === null || !state.ownerOrigin || state.restricted) return { ok: true, value: null }
      if (state.origin.scope !== 'global' && state.origin.workspaceId !== undefined) {
        await this.reader(state.origin.workspaceId as WorkspaceId, signal)
      }
      const value = buildSessionMemoryView(observed, state, {
        maxItems: this.config.maxWorkingItems + this.config.maxHumanInputs + 8,
        maxCharacters: this.config.maxContextCharacters * 2,
      }, this.ctx.sessions.messageProjections)
      signal.throwIfAborted()
      return { ok: true, value: value ?? null }
    } catch (error) {
      if (signal.aborted) throw error
      if (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
        return { ok: false, error: { code: 'not-found', message: 'The Session is unavailable.', retryable: false } }
      }
      throw error
    }
  }

  /**
   * Explicitly rescan a root after external edits or a reconnect.
   * @param request - Workspace to invalidate and rebuild.
   * @param signal - cancels this caller without cancelling another reader.
   * @throws if the root is unavailable or the shared rebuild fails.
   */
  @Remote({ name: 'refresh', resources: { workspace: addressedWorkspace } })
  async refresh(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<void> {
    const reader = await this.reader(request.workspaceId, signal, true)
    this.notifications.emit(reader.root)
  }

  /**
   * Every connection begins with a baseline; unenrolled owner feeds carry setup invalidations only.
   * @param request - Workspace whose observations are followed.
   * @param signal - ends the stream and immediately detaches observation listeners.
   * @returns coalesced invalidations; source values must be reread after each one.
   */
  @Remote({ name: 'follow', mode: 'stream', resources: { workspace: addressedWorkspace } })
  async *follow(request: { workspaceId: WorkspaceId }, signal: AbortSignal): AsyncIterable<ResearchEvent> {
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    const root = await this.workspaceRoot(request.workspaceId)
    const allowed = await this.configuredRoots(root, lifetime)
    if (allowed.length === 0) this.requireOwner()
    else await this.reader(request.workspaceId, lifetime)
    lifetime.throwIfAborted()
    let dirty = false
    let wake: (() => void) | undefined
    const changed = (): void => { dirty = true; wake?.() }
    const detach = (): void => {
      this.notifications.off(root, changed)
      lifetime.removeEventListener('abort', stopped)
    }
    const stopped = (): void => { changed(); detach() }
    this.notifications.on(root, changed)
    lifetime.addEventListener('abort', stopped, { once: true })
    try {
      lifetime.throwIfAborted()
      yield { kind: 'resync-required', reason: allowed.length === 0 ? 'research-workspace-not-initialized'
        : this.readers.get(root)?.watcher === undefined ? 'automatic-source-notifications-unavailable' : 'connected-or-reconnected' }
      const isAborted = (): boolean => lifetime.aborted
      const hasChanges = (): boolean => dirty
      while (!isAborted()) {
        if (!hasChanges()) await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
        if (isAborted()) break
        dirty = false
        yield { kind: 'resync-required', reason: this.readers.get(root)?.watcher === undefined
          ? 'automatic-source-notifications-unavailable' : 'source-changed' }
      }
    } finally { detach() }
  }

  /**
   * Unsupported history stays explicit until its durable producer is connected.
   * @param request - Workspace and activity selection, validated without inventing history.
   * @param signal - cancels before activity admission.
   * @returns unsupported; this adapter does not supply an activity feed.
   */
  @Remote({ name: 'getActivity', resources: { workspace: addressedWorkspace } })
  async getActivity(request: { workspaceId: WorkspaceId; query: ActivityQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<ActivityPage>>> {
    signal.throwIfAborted()
    await this.reader(request.workspaceId)
    return { ok: false, error: { code: 'unsupported', message: 'Research activity is not available from this source adapter.', retryable: false } }
  }

  /**
   * Prepare a source change; unsupported writing never advertises a successful preview.
   * @param request - Workspace and proposed UI field change.
   * @returns a retained scratch preview or typed refusal; no scientific source is changed.
   * @throws when the caller is not the owner or root access is unavailable.
   */
  @Remote({ name: 'previewChange', resources: { workspace: addressedWorkspace } })
  async previewChange(request: { workspaceId: WorkspaceId; intent: ChangeIntent }): Promise<Result<ReadEnvelope<ChangePreview>>> {
    this.requireOwner()
    const writer = await this.writer(request.workspaceId)
    if (writer !== undefined) return writer.preview(request.intent)
    return { ok: false, error: { code: 'read-only', message: 'Writing is not enabled for this research root.', retryable: false } }
  }

  /**
   * Apply only through the configured writer.
   * @param request - Workspace, preview and durable retry identity.
   * @returns historical publication and separate current observations, or partial/unknown/refused outcome.
   * @throws when the caller is not the owner or root access is unavailable.
   */
  @Remote({ name: 'applyChange', resources: { workspace: addressedWorkspace } })
  async applyChange(request: { workspaceId: WorkspaceId; request: ApplyRequest }): Promise<Result<ReadEnvelope<ApplyReceipt>>> {
    this.requireOwner()
    const writer = await this.writer(request.workspaceId)
    if (writer !== undefined) {
      const result = await writer.apply(request.request, { id: 'host-owner', kind: 'researcher', label: 'Researcher' })
      if (result.ok || result.error.code === 'partial-apply' || result.error.code === 'outcome-unknown') {
        const root = (await this.reader(request.workspaceId)).root
        this.markDirty(root)
        try { await this.sourceInvalidator?.(root) } catch (error) {
          this.ctx.logger.warn(`Research files were processed but material refresh failed: ${String(error)}`)
          if (result.ok) return { ok: true, value: { ...result.value, value: { ...result.value.value,
            notificationWarning: 'The file outcome is recorded; material views could not be notified. Reload them before relying on their contents.' } } }
        }
      }
      return result
    }
    return { ok: false, error: { code: 'read-only', message: 'Writing is not enabled for this research root.', retryable: false } }
  }

  /**
   * Submit a human-authored question with its selected topic/material origin.
   * @param request - exact submitted words and the displayed origin.
   * @param signal - cancels before admission; admitted messages remain in their Session.
   * @returns the created normal Session identity or an unresolved-origin/service failure.
   * @throws when the caller is not the owner or the created Session cannot be reached.
   */
  @Remote({ name: 'ask', resources: { workspace: addressedWorkspace,
    session: (request: ResearchQuestion) => request.sessionId } })
  async ask(request: ResearchQuestion, signal: AbortSignal): Promise<Result<{ sessionId: SessionId }>> {
    this.requireOwner()
    signal.throwIfAborted()
    const question = this.questionText(request)
    if (!this.validQuestion(question, request.content)) {
      return { ok: false, error: { code: 'invalid-request', message: 'The question is empty or exceeds the configured limit.', retryable: false } }
    }
    const reader = await this.reader(request.workspaceId, signal)
    if ((request.selectedText?.length ?? 0) > this.config.maxContextCharacters) return { ok: false, error: { code: 'invalid-request', message: 'The selected passage exceeds the configured context limit.', retryable: false } }
    const resolved = await reader.resolveOrigin(request, { signal })
    if (!resolved.ok) return resolved
    if (resolved.value.status === 'ambiguous') return { ok: false, error: { code: 'invalid-request', message: resolved.value.reason ?? 'This material serves several topics. Open it from the intended topic before asking.', retryable: false } }
    const selectionMissing = (request.selectedText !== undefined || request.anchor !== undefined || request.selectedRange !== undefined)
      && resolved.value.selectedPassage === undefined
    if (resolved.value.status === 'missing' && (selectionMissing || request.topicId !== undefined || request.resourceId !== undefined && request.resourceId !== resourceIdForPath('research.md'))) return { ok: false, error: { code: 'invalid-request', message: resolved.value.reason ?? 'The selected source has no resolved topic.', retryable: false } }
    const { question: _question, content: _content, sessionId: _sessionId, requestId: _requestId, mode: _mode, ...selected } = request
    const origin = { ...selected,
      ...(resolved.value.topicId === undefined ? {} : { topicId: resolved.value.topicId }),
      ...(resolved.value.resourceId === undefined ? {} : { resourceId: resolved.value.resourceId }),
      ...(resolved.value.selectedRange === undefined ? {} : { selectedRange: resolved.value.selectedRange }),
    }
    if (JSON.stringify(origin).length > this.config.maxContextCharacters) {
      return { ok: false, error: { code: 'invalid-request', message: 'The complete selected-source location exceeds the configured context limit. Select a smaller passage.', retryable: false } }
    }
    return this.admitDiscussion(request, origin, signal)
  }

  /**
   * Inspect a recorded operation without writing sources or resuming an Agent.
   * @param request - Actual Workspace, owning Session and operation identity.
   * @param signal - Cancels source authorization and Session observation before receipt inspection.
   * @returns Bounded immutable before/after text plus the separately rechecked present source state.
   */
  @Remote({ name: 'getChange', resources: { workspace: addressedWorkspace, session: addressedResearchSession } })
  async getChange(request: { workspaceId: WorkspaceId } & ResearchChangeQuery,
    signal: AbortSignal): Promise<Result<ResearchChangeView>> {
    this.requireOwner()
    const query = this.ctx.get('sessionQuery')
    if (query === undefined) return { ok: false, error: { code: 'unsupported', message: 'Conversation history is unavailable.', retryable: false } }
    using observed = await query.observeSession(request.sessionId, { signal, projectionMode: 'none' })
    if (observed.events.length > this.config.maxRecoveryEvents) return { ok: false, error: {
      code: 'unavailable', message: 'The conversation exceeds the receipt-verification read limit; inspect its original tool record.', retryable: false,
    } }
    const state = replaySessionWorkingState(observed.events)
    const write = state.writes.find(item => item.operationId === request.operationId && item.origin.workspaceId === request.workspaceId
      && item.origin.scope !== 'global')
    if (!state.ownerOrigin || state.restricted || write === undefined) return { ok: false, error: {
      code: 'permission-denied', message: 'This operation is not a recorded source edit of the addressed conversation and Workspace.', retryable: false,
    } }
    signal.throwIfAborted()
    const changes = await this.writer(request.workspaceId)
    if (changes === undefined) return { ok: false, error: { code: 'unavailable', message: 'The original source-edit receipt store is unavailable.', retryable: false } }
    const recovered = await changes.writer.recover(request.operationId, { sessionId: request.sessionId, workspaceId: request.workspaceId,
      ...(write.origin.topicId === undefined ? {} : { topicId: write.origin.topicId }) })
    if (!recovered.ok) return recovered
    signal.throwIfAborted()
    return { ok: true, value: researchChangeView(recovered.value, request, this.config.maxContextCharacters) }
  }

  /**
   * List ordinary discussions in the exact current research scope without starting any Agent.
   * @param request - Workspace and optional topic; omission means the root account.
   * @param signal - Cancels the bounded history read.
   * @returns Live metadata and explicit omitted-history coverage.
   */
  @Remote({ name: 'listDiscussions', resources: { workspace: addressedWorkspace } })
  async listDiscussions(request: { workspaceId: WorkspaceId } & DiscussionQuery, signal: AbortSignal): Promise<Result<DiscussionPage>> {
    this.requireOwner()
    if (request.limit !== undefined && (!Number.isSafeInteger(request.limit) || request.limit < 1)) {
      return { ok: false, error: { code: 'invalid-request', message: 'Discussion limit must be a positive integer.', retryable: false } }
    }
    const reader = await this.reader(request.workspaceId, signal)
    if (request.topicId !== undefined) {
      const topic = await reader.getTopic(request.topicId, { signal })
      if (!topic.ok) return topic
    }
    return { ok: true, value: await this.discussions.list(reader.root, {
      workspaceId: request.workspaceId, ...(request.topicId === undefined ? {} : { topicId: request.topicId }),
    }, Math.min(request.limit ?? this.config.maxRecoverySessions, this.config.maxRecoverySessions), signal) }
  }

  private questionText(request: Pick<ResearchQuestion, 'question' | 'content'>): string {
    return request.content === undefined ? request.question
      : request.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
  }

  private validQuestion(question: string, content: ResearchQuestion['content']): boolean {
    return question.length <= this.config.maxQuestionCharacters
      && (question.trim().length > 0 || content?.some(part => part.type !== 'text') === true)
  }

  private async admitDiscussion(request: Pick<StudyRequest, 'sessionId' | 'workspaceId' | 'question' | 'content' | 'requestId' | 'mode'>,
    origin: ResearchOrigin, signal: AbortSignal): Promise<{ ok: true; value: { sessionId: SessionId } }
    | { ok: false; error: { code: 'unsupported'; message: string; retryable: false } }> {
    const controller = this.ctx.get('sessionController')
    if (controller === undefined) return { ok: false, error: { code: 'unsupported', message: 'This host does not provide conversation admission.', retryable: false } }
    const root = request.workspaceId === undefined ? undefined : await this.workspaceRoot(request.workspaceId)
    signal.throwIfAborted()
    const sessionId = request.sessionId
      ?? (await controller.create(request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId })).sessionId
    // Once created/admitted, a cancelled waiter cannot revoke the native Session or its message.
    const prompt: SessionPromptRequest = { sessionId, requestId: request.requestId ?? brandString<SessionRequestId>(randomUUID()),
      mode: request.mode ?? 'queue', content: request.content ?? [{ type: 'text', text: request.question }] }
    const resolved = await controller.resolveAgent(sessionId)
    if ('error' in resolved) throw resolved.error
    const snapshot = await readDiscussion(this.ctx, resolved.agent, this.config.maxRecoveryEvents, signal)
    const guard = (agent: Agent): void => {
      signal.throwIfAborted()
      assertDiscussionScope(this.ctx, agent, origin, root, snapshot)
    }
    await controller.promptAttributed(prompt, { kind: 'aitp-research', actor: 'human', origin }, guard)
    if (root !== undefined) this.notifications.emit(root)
    return { ok: true, value: { sessionId } }
  }

  private requireOwner(): void {
    if (principalOf(this.ctx.invocation) !== undefined) throw new RemoteError('research/owner-required', 'Research source writes, conversations and memory views are available to the workspace owner.', {})
  }

  private async askStudy(request: StudyRequest, signal: AbortSignal): Promise<ResourceResult<StudyReceipt>> {
    this.requireOwner()
    signal.throwIfAborted()
    const question = this.questionText(request)
    if (!this.validQuestion(question, request.content)) {
      return { ok: false, error: { code: 'invalid-request', message: 'The question is empty or exceeds the configured limit.', retryable: false } }
    }
    const global = request.scope === 'global' || request.scope !== 'workspace' && request.topicId === undefined
    if (request.scope === 'global' && request.topicId !== undefined) return { ok: false, error: { code: 'invalid-request', message: 'Global source study cannot also name a research direction.', retryable: false } }
    if (!global && request.workspaceId === undefined) {
      return { ok: false, error: { code: 'invalid-request', message: 'A selected research direction needs its actual Workspace.', retryable: false } }
    }
    const parsed = sourceSelectionSchema.array().min(1).safeParse(request.selections)
    if (!parsed.success) return { ok: false, error: { code: 'invalid-request', message: 'Select valid source locations before asking.', retryable: false } }
    let studyId = request.sourceSetId
    if (global && request.sessionId !== undefined) {
      const controller = this.ctx.get('sessionController')
      if (controller === undefined) return { ok: false, error: { code: 'unsupported', message: 'Conversation admission is unavailable.', retryable: false } }
      const resolved = await controller.resolveAgent(request.sessionId)
      if ('error' in resolved) throw resolved.error
      const existing = (await readDiscussion(this.ctx, resolved.agent, this.config.maxRecoveryEvents, signal)).state.origin
      if (existing?.scope === 'global') {
        if (studyId !== undefined && existing.studyId !== studyId) return { ok: false, error: {
          code: 'invalid-request', message: 'This discussion belongs to another source selection. Open a new discussion.', retryable: false,
        } }
        studyId = existing.studyId
      }
    }
    const origin: ResearchOrigin = {
      ...(request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId }),
      ...(global ? { scope: 'global', studyId: studyId ?? randomUUID() }
        : request.topicId === undefined ? {} : { topicId: request.topicId }),
      selections: parsed.data,
    }
    if (JSON.stringify(origin).length > this.config.maxContextCharacters) {
      return { ok: false, error: { code: 'invalid-request', message: 'The complete selected-source request exceeds the configured context limit.', retryable: false } }
    }
    if (!global && request.workspaceId !== undefined) {
      const reader = await this.reader(request.workspaceId, signal)
      if (request.topicId !== undefined) {
        const topic = await reader.getTopic(request.topicId, { signal })
        if (!topic.ok) return { ok: false, error: { code: 'invalid-request', message: topic.error.message, retryable: false } }
      }
    }
    const resources = this.ctx.get('researchResources')
    if (resources === undefined) return { ok: false, error: { code: 'unsupported', message: 'The local-source service is unavailable.', retryable: false } }
    const observed = await readStudyContext(resources, parsed.data, question, this.config.maxContextCharacters, signal)
    if (observed.invalidSelections.length > 0) return { ok: false, error: {
      code: 'invalid-request', message: observed.invalidSelections.join('\n'), retryable: false,
    } }
    return this.admitDiscussion(request, origin, signal)
  }

  private async contextFor(origin: ResearchOrigin, signal?: AbortSignal, question = ''): Promise<ResearchContextRead> {
    const resources = this.ctx.get('researchResources')
    const selected = origin.selections === undefined ? { entries: [], omissions: [] }
      : resources === undefined ? { entries: [], omissions: ['The selected local-source service is unavailable.'] }
        : await readStudyContext(resources, origin.selections, question, this.config.maxContextCharacters, signal ?? this.lifetime.signal)
    if (origin.scope === 'global') return selected
    const topic = await this.topicContextFor(origin, signal)
    return { entries: [...selected.entries, ...topic.entries], omissions: [...selected.omissions, ...topic.omissions] }
  }

  private async topicContextFor(origin: ResearchOrigin, signal?: AbortSignal): Promise<ResearchContextRead> {
    if (origin.workspaceId === undefined) return { entries: [], omissions: ['The original research Workspace is unavailable.'] }
    const reader = await this.reader(origin.workspaceId as WorkspaceId, signal)
    const options = signal === undefined ? undefined : { signal }
    if (origin.topicId === undefined && (origin.resourceId === undefined || origin.resourceId === resourceIdForPath('research.md'))) {
      const root = await reader.readSource(resourceIdForPath('research.md'), options)
      if (!root.ok) return { entries: [], omissions: [root.error.message] }
      const omissions: string[] = []
      if (origin.anchor !== undefined || origin.selectedText !== undefined) {
        const selected = await reader.resolveOrigin({ resourceId: root.value.resourceId,
          ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
          ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
          ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
          ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }), question: '',
        }, options)
        if (!selected.ok) omissions.push(selected.error.message)
        else if (selected.value.selectedPassage === undefined) omissions.push(selected.value.reason ?? 'The original root selection could not be resolved.')
      }
      return { entries: [{ label: 'Research root account', text: root.value.text, source: { target: root.value.resourceId } }], omissions }
    }
    const resolved = await reader.resolveOrigin({
      ...(origin.topicId === undefined ? {} : { topicId: origin.topicId as TopicId }),
      ...(origin.resourceId === undefined ? {} : { resourceId: origin.resourceId as ResourceId }),
      ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
      ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
      ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
      ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }), question: '',
    }, options)
    const omissions = !resolved.ok ? [resolved.error.message] : resolved.value.status === 'resolved' ? []
      : [resolved.value.reason ?? `The original research selection is ${resolved.value.status}.`]
    // The explicit topic can still supply general evidence when its original selection is no longer valid.
    const topicId = origin.topicId as TopicId | undefined ?? (resolved.ok ? resolved.value.topicId : undefined)
    if (topicId === undefined) return { entries: [], omissions: [
      ...omissions, 'No single topic has been selected; resolve the question origin before assuming an owner.',
    ] }
    const read = await reader.readContext({ topicId, include: ['ancestors', 'work', 'resources'], maxCharacters: this.config.maxContextCharacters }, options)
    if (!read.ok) return { entries: [], omissions: [...omissions, read.error.message] }
    return {
      entries: [
        ...(!resolved.ok || resolved.value.status !== 'resolved' || resolved.value.selectedPassage === undefined ? []
          : [{ label: 'Selected source passage', text: resolved.value.selectedPassage, source: { target: resolved.value.resourceId ?? topicId } }]),
        ...read.value.value.entries.map(entry => ({ label: entry.label, text: entry.text, source: { target: entry.source.target.id } })),
      ],
      omissions: [...omissions, ...read.value.value.omissions.map(item => item.reason)],
    }
  }
}

export default ResearchMemory
