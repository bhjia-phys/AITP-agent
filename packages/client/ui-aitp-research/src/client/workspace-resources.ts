/** Framework-resource adapters: one async read stream per workspace address. */
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {
  ResearchChangeQuery, ResearchChangeView, DiscussionPage, ActivityPage, Project, ReadEnvelope, ResearchWorkspaceAdapter, Resource,
  ResourceId, Result, Topic, TopicId, TopicPage, TopicQuery, WorkspaceError, WorkspaceRead, ResearchSetup, ResearchProvider,
} from './workspace-contract.ts'
import type { ResearchWorkspaceRegistry } from './workspace-service.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-workspace-provider': ResearchProvider
    'aitp-workspace-change': ResearchChangeView
    'aitp-workspace-discussions': DiscussionPage
    'aitp-workspace-setup': ResearchSetup
    'aitp-workspace-project': WorkspaceRead<Project>
    'aitp-workspace-topics': WorkspaceRead<TopicPage>
    'aitp-workspace-topic': WorkspaceRead<Topic>
    'aitp-workspace-resource': WorkspaceRead<Resource>
    'aitp-workspace-activity': WorkspaceRead<ActivityPage>
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Research adapter failure; preserves its domain code and outcome details. */
    'aitp/workspace': WorkspaceError
  }
}

const enc = encodeURIComponent

/**
 * Observe this Workspace's actual provider capabilities, including before enrollment.
 * @param workspaceId - Harness Workspace identity.
 * @returns the provider resource address.
 */
export function workspaceProviderAddress(workspaceId: WorkspaceId): string {
  return `dsh-resource://aitp-workspace-provider/workspace/${enc(workspaceId)}`
}

/**
 * Address an existing Session-owned receipt without creating a new operation.
 * @param workspaceId - Authorized source Workspace.
 * @param sessionId - Original ordinary Session.
 * @param operationId - Native tool result's recorded operation identity.
 * @returns The bounded change-inspection resource address.
 */
export function workspaceChangeAddress(workspaceId: WorkspaceId, sessionId: SessionId, operationId: string): string {
  return `dsh-resource://aitp-workspace-change/workspace/${enc(workspaceId)}?session=${enc(sessionId)}&operation=${enc(operationId)}`
}

/**
 * Address native discussions belonging to the visible Workspace/root or direction.
 * @param workspaceId - Harness Workspace.
 * @param topicId - Exact topic identity; omission means the root account.
 * @returns A read-only discussion-list resource address.
 */
export function workspaceDiscussionsAddress(workspaceId: WorkspaceId, topicId?: string): string {
  return `dsh-resource://aitp-workspace-discussions/workspace/${enc(workspaceId)}${topicId === undefined ? '' : `?topic=${enc(topicId)}`}`
}

/**
 * Read enrollment before attempting research-content reads.
 * @param workspaceId - Harness Workspace identity.
 * @returns the setup resource address.
 */
export function workspaceSetupAddress(workspaceId: WorkspaceId): string {
  return `dsh-resource://aitp-workspace-setup/workspace/${enc(workspaceId)}`
}

/**
 * Address the project overview without creating a Session.
 * @param workspaceId - Harness Workspace.
 * @returns its project resource address.
 */
export function workspaceProjectAddress(workspaceId: WorkspaceId): string {
  return `dsh-resource://aitp-workspace-project/workspace/${enc(workspaceId)}`
}

/**
 * Address a selected page of the topic hierarchy.
 * @param workspaceId - Harness Workspace.
 * @param query - optional parent, page and limit selection; omission reads all topics.
 * @returns the topic-page resource address.
 */
export function workspaceTopicsAddress(workspaceId: WorkspaceId, query: TopicQuery = {}): string {
  const params = new URLSearchParams()
  if (query.parentId === null) params.set('roots', 'true')
  else if (query.parentId !== undefined) params.set('parent', query.parentId)
  if (query.cursor !== undefined) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const suffix = params.size === 0 ? '' : `?${params.toString()}`
  return `dsh-resource://aitp-workspace-topics/workspace/${enc(workspaceId)}${suffix}`
}

/**
 * Address one topic's current detail projection.
 * @param workspaceId - Harness Workspace.
 * @param topicId - stable topic identity.
 * @returns its topic resource address.
 */
export function workspaceTopicAddress(workspaceId: WorkspaceId, topicId: TopicId): string {
  return `dsh-resource://aitp-workspace-topic/workspace/${enc(workspaceId)}/topic/${enc(topicId)}`
}

/**
 * Address a material by identity rather than by its current path.
 * @param workspaceId - Harness Workspace.
 * @param resourceId - stable material identity.
 * @returns its material resource address.
 */
export function workspaceResourceAddress(workspaceId: WorkspaceId, resourceId: ResourceId): string {
  return `dsh-resource://aitp-workspace-resource/workspace/${enc(workspaceId)}/resource/${enc(resourceId)}`
}

/**
 * Address one page of recorded activity for a topic.
 * @param workspaceId - Harness Workspace.
 * @param topicId - stable topic.
 * @param cursor - next page.
 * @returns its activity resource address.
 */
export function workspaceActivityAddress(workspaceId: WorkspaceId, topicId: TopicId, cursor?: string): string {
  const suffix = cursor === undefined ? '' : `?cursor=${enc(cursor)}`
  return `dsh-resource://aitp-workspace-activity/workspace/${enc(workspaceId)}/topic/${enc(topicId)}${suffix}`
}

interface ParsedAddress {
  readonly workspaceId: WorkspaceId
  readonly id: string | undefined
  readonly query: TopicQuery
  readonly topicId?: string
  readonly change?: ResearchChangeQuery
}

function parseAddress(address: string): Result<ParsedAddress> {
  let url: URL
  try {
    url = new URL(address)
  } catch (error) {
    return invalidAddress(error instanceof Error ? error.message : 'Invalid resource URL.')
  }
  const parts = url.pathname.split('/')
  if (parts[1] !== 'workspace' || !parts[2] || (parts.length !== 3 && parts.length !== 5)) return invalidAddress('Invalid workspace resource path.')
  let workspaceId: WorkspaceId, id: string | undefined
  try {
    workspaceId = decodeURIComponent(parts[2]) as WorkspaceId
    id = parts[4] === undefined ? undefined : decodeURIComponent(parts[4])
  } catch (error) {
    return invalidAddress(error instanceof Error ? error.message : 'Invalid address encoding.')
  }
  const parent = url.searchParams.get('parent')
  const cursor = url.searchParams.get('cursor')
  const limit = url.searchParams.get('limit')
  if (limit !== null && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0)) return invalidAddress('Invalid page limit.')
  const query: TopicQuery = {
    ...(url.searchParams.get('roots') === 'true' ? { parentId: null } : parent === null ? {} : { parentId: parent as TopicId }),
    ...(cursor === null ? {} : { cursor }),
    ...(limit === null ? {} : { limit: Number(limit) }),
  }
  const topicId = url.searchParams.get('topic')
  if (topicId === '') return invalidAddress('A discussion direction identity cannot be empty.')
  const session = url.searchParams.get('session'), operation = url.searchParams.get('operation')
  if ((session !== null || operation !== null) && (!session || !operation)) return invalidAddress('A change needs its original Session and operation.')
  return { ok: true, value: { workspaceId, id, query, ...(topicId === null ? {} : { topicId }),
    ...(session === null || operation === null ? {} : { change: { sessionId: brandString<SessionId>(session), operationId: operation } }),
  } }
}

function invalidAddress(message: string): Result<never> {
  return { ok: false, error: { code: 'invalid-request', message, retryable: false } }
}

function remoteFailure<T>(error: WorkspaceError): RemoteResult<T> {
  return { ok: false, error: new RemoteError('aitp/workspace', error.message, error) }
}

type Read<T> = (adapter: ResearchWorkspaceAdapter, address: ParsedAddress, signal: AbortSignal) => Promise<Result<ReadEnvelope<T>>>

/**
 * Follow invalidations while delegating snapshots and stale-value retention to resources.
 * @param registry - workspace adapter owner.
 * @param address - resource URL.
 * @param signal - final holder's release signal.
 * @param read - adapter operation for this protocol.
 * @returns success/failure frames; invalidated or aborted reads never publish.
 */
export async function* workspaceFrames<T>(
  registry: ResearchWorkspaceRegistry,
  address: string,
  signal: AbortSignal,
  read: Read<T>,
): AsyncIterable<RemoteResult<WorkspaceRead<T>>> {
  yield* providerFrames(registry, address, signal, true, async (adapter, parsed, readSignal) => {
    const result = await read(adapter, parsed, readSignal)
    return result.ok ? { ok: true, value: { ...result.value, provider: adapter.provider } } : result
  })
}

async function* providerFrames<T>(
  registry: ResearchWorkspaceRegistry,
  address: string,
  signal: AbortSignal,
  requiresRead: boolean,
  read: (adapter: ResearchWorkspaceAdapter, parsed: ParsedAddress, signal: AbortSignal) => Promise<Result<T>>,
): AsyncIterable<RemoteResult<T>> {
  const parsed = parseAddress(address)
  if (!parsed.ok) {
    yield remoteFailure(parsed.error)
    return
  }
  let generation = 0
  let dirty = true
  let wake: (() => void) | undefined
  let active: AbortController | undefined
  const changed = (): void => {
    generation += 1
    dirty = true
    active?.abort()
    wake?.()
  }
  const stop = (): void => { active?.abort(); wake?.() }
  const released = (): boolean => signal.aborted
  const unsubscribe = registry.subscribe(parsed.value.workspaceId, changed)
  signal.addEventListener('abort', stop, { once: true })
  try {
    while (!released()) {
      if (!dirty) await new Promise<void>((resolve) => { wake = resolve })
      wake = undefined
      if (released()) return
      dirty = false
      const observedGeneration = generation
      const resolved = registry.resolve(parsed.value.workspaceId)
      if (!resolved.ok) {
        yield remoteFailure(resolved.error)
        continue
      }
      const adapter = resolved.value
      if (requiresRead && !adapter.provider.capabilities.read) {
        yield remoteFailure({ code: 'unsupported', message: 'This provider cannot read research data.', retryable: false })
        continue
      }
      active = new AbortController()
      const controller = active
      let abortRead: (() => void) | undefined
      const cancelled = new Promise<undefined>((resolve) => {
        abortRead = () => { resolve(undefined) }
        controller.signal.addEventListener('abort', abortRead, { once: true })
      })
      const result = await Promise.race([read(adapter, parsed.value, controller.signal), cancelled])
      if (abortRead !== undefined) controller.signal.removeEventListener('abort', abortRead)
      active = undefined
      if (released()) return
      if (observedGeneration !== generation || result === undefined) continue
      yield result.ok ? result : remoteFailure(result.error)
    }
  } finally {
    active?.abort()
    unsubscribe()
    signal.removeEventListener('abort', stop)
  }
}

/**
 * Register resource protocols for a workspace registry; the context owns their lifetime.
 * @param ctx - owning client plugin context.
 * @param registry - adapter registry to resolve for every observation.
 */
export function registerWorkspaceResources(ctx: Context, registry: ResearchWorkspaceRegistry): void {
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-provider',
    open: (address, { signal }) => providerFrames(registry, address, signal, false,
      adapter => Promise.resolve({ ok: true, value: adapter.provider })),
  }), 'research: provider capabilities resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-change',
    open: (address, { signal }) => providerFrames(registry, address, signal, false, async (adapter, parsed, readSignal) => {
      if (parsed.change === undefined) return invalidAddress('The original Session and operation are required.')
      if (adapter.getChange === undefined) return { ok: false, error: { code: 'unsupported', message: 'This connection cannot inspect source edits.', retryable: false } }
      return adapter.getChange(parsed.change, { signal: readSignal })
    }),
  }), 'research: source change resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-discussions',
    open: (address, { signal }) => providerFrames(registry, address, signal, false,
      async (adapter, parsed, readSignal) => adapter.listDiscussions === undefined
        ? { ok: false, error: { code: 'unsupported', message: 'This connection cannot list research discussions.', retryable: false } }
        : adapter.listDiscussions({ ...(parsed.topicId === undefined ? {} : { topicId: brandString<TopicId>(parsed.topicId) }),
          ...(parsed.query.limit === undefined ? {} : { limit: parsed.query.limit }) }, { signal: readSignal })),
  }), 'research: discussion list resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-setup',
    open: (address, { signal }) => providerFrames(registry, address, signal, false,
      async adapter => adapter.getSetup === undefined
        ? { ok: false, error: { code: 'unsupported', message: 'This connection does not support project setup.', retryable: false } }
        : adapter.getSetup()),
  }), 'research: setup resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-project',
    open: (address, { signal }) => workspaceFrames(registry, address, signal,
      (adapter, _address, readSignal) => adapter.getProject({ signal: readSignal })),
  }), 'research: project resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-topics',
    open: (address, { signal }) => workspaceFrames(registry, address, signal,
      (adapter, parsed, readSignal) => adapter.listTopics(parsed.query, { signal: readSignal })),
  }), 'research: topic page resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-topic',
    open: (address, { signal }) => workspaceFrames(registry, address, signal, async (adapter, parsed, readSignal) => parsed.id === undefined
      ? invalidAddress('A topic identity is required.')
      : adapter.getTopic(parsed.id as TopicId, { signal: readSignal })),
  }), 'research: topic resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-resource',
    open: (address, { signal }) => workspaceFrames(registry, address, signal, async (adapter, parsed, readSignal) => parsed.id === undefined
      ? invalidAddress('A material identity is required.')
      : adapter.getResource(parsed.id as ResourceId, { signal: readSignal })),
  }), 'research: material resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-workspace-activity',
    open: (address, { signal }) => workspaceFrames(registry, address, signal, async (adapter, parsed, readSignal) => parsed.id === undefined
      ? invalidAddress('A topic identity is required.')
      : !adapter.provider.capabilities.readActivity
        ? { ok: false, error: { code: 'unsupported', message: 'This provider cannot read topic activity.', retryable: false } }
        : adapter.getActivity({ topicId: parsed.id as TopicId, ...parsed.query }, { signal: readSignal })),
  }), 'research: activity resource')
}
