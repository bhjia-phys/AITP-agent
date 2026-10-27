/** Root-qualified material resource addresses and their framework-owned read streams. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type { ResourceBytes, ResourcePage, ResourceQuery, ResourceReading, ResourceSetup, SourceRoot, SourceRootId, SourceTopicId, SourceSetPage, SourceSetQuery } from '@deepseek-ai/dsh-research-resources/types'
import { parseMaterialBytes, parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MaterialsConnection } from './connection.ts'
import { failure } from './connection.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-material-roots': readonly SourceRoot[]
    'aitp-material-list': ResourcePage
    'aitp-material-source': ResourceReading
    'aitp-material-bytes': ResourceBytes
    'aitp-material-setup': ResourceSetup
    'aitp-material-source-sets': SourceSetPage
  }
}

/** Shared collection root inventory. */
export const MATERIAL_ROOTS = 'dsh-resource://aitp-material-roots/'
/** Storage/grant capabilities, observed from the authenticated Host. */
export const MATERIAL_SETUP = 'dsh-resource://aitp-material-setup/'

/**
 * Address one saved-source-set index page without filesystem paths.
 * @param query - opaque page cursor and explicit research association filter.
 * @returns the shared operational collection resource address.
 */
export function materialSourceSetsAddress(query: SourceSetQuery): string {
  const params = new URLSearchParams()
  if (query.cursor !== undefined) params.set('cursor', query.cursor)
  if (query.topic !== undefined) { params.set('workspace', query.topic.workspaceId); params.set('topic', query.topic.topicId) }
  return `dsh-resource://aitp-material-source-sets/?${params}`
}

/**
 * Build an address for one bounded library query.
 * @param query - source service query without filesystem paths.
 * @returns its resource identity.
 */
export function materialListAddress(query: ResourceQuery): string {
  const params = new URLSearchParams()
  if (query.rootId !== undefined) params.set('root', query.rootId)
  if (query.folder !== undefined) params.set('folder', query.folder)
  if (query.query !== undefined) params.set('q', query.query)
  if (query.cursor !== undefined) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.topic !== undefined) { params.set('workspace', query.topic.workspaceId); params.set('topic', query.topic.topicId) }
  return `dsh-resource://aitp-material-list/${query.domain ?? 'all'}?${params}`
}


function parseQuery(address: string): ResourceQuery {
  const url = new URL(address)
  const domain = url.pathname.slice(1)
  if (domain !== 'all' && domain !== 'knowledge' && domain !== 'literature' && domain !== 'code') throw new Error('Unknown material domain')
  const rootId = url.searchParams.get('root')
  const folder = url.searchParams.get('folder')
  const query = url.searchParams.get('q')
  const cursor = url.searchParams.get('cursor')
  const limit = url.searchParams.get('limit')
  const workspaceId = url.searchParams.get('workspace')
  const topicId = url.searchParams.get('topic')
  if ((workspaceId === null) !== (topicId === null)) throw new Error('A topic filter needs its Workspace')
  if (limit !== null && (!Number.isSafeInteger(Number(limit)) || Number(limit) < 1)) throw new Error('Invalid page limit')
  return { ...domain === 'all' ? {} : { domain: domain }, ...rootId === null ? {} : { rootId: rootId as SourceRootId },
    ...folder === null ? {} : { folder }, ...query === null ? {} : { query },
    ...cursor === null ? {} : { cursor }, ...limit === null ? {} : { limit: Number(limit) },
    ...workspaceId === null || topicId === null ? {}
      : { topic: { workspaceId: workspaceId as WorkspaceId, topicId: topicId as SourceTopicId } } }
}

/**
 * Register all material data through the existing client resource cache.
 * @param ctx - plugin owning the protocol contributions.
 * @param connection - sole shared resource transport.
 */
export function registerMaterialResources(ctx: Context, connection: MaterialsConnection): void {
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-setup', open: (_address, { signal }) => connection.frames(signal, (_transport, current) => connection.run(transport => transport.management?.getSetup(current))) }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-source-sets', open: (address, { signal }) => {
    const url = new URL(address)
    const workspace = url.searchParams.get('workspace')
    const topic = url.searchParams.get('topic')
    const cursor = url.searchParams.get('cursor')
    if ((workspace === null) !== (topic === null)) return invalid(new Error('A topic filter needs its Workspace'))
    const query: SourceSetQuery = { ...cursor === null ? {} : { cursor },
      ...workspace === null || topic === null ? {} : { topic: { workspaceId: workspace as WorkspaceId, topicId: topic as SourceTopicId } } }
    return connection.frames(signal, (_transport, current) => connection.run(
      transport => transport.management?.listSourceSets(query, current),
    ))
  } }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-roots', open: (_address, { signal }) => connection.frames(signal, (transport, current) => transport.listRoots(current)) }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-list', open: (address, { signal }) => {
    let query: ResourceQuery
    try { query = parseQuery(address) }
    catch (error) { return invalid(error) }
    return connection.frames(signal, (transport, current) => transport.listResources(query, current))
  } }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-bytes', open: (address, { signal }) => {
    const parsed = parseMaterialBytes(address)
    if (parsed === undefined) return invalid(new Error('Invalid material bytes address'))
    return connection.frames(signal, (_transport, current) => connection.run(transport => transport.readSourceBytes?.(parsed.ref, current)))
  } }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-material-source', open: (address, { signal }) => {
    const parsed = parseMaterialSource(address)
    if (parsed === undefined) return invalid(new Error('Invalid material source address'))
    return connection.frames(signal, (transport, current) => transport.readResource(parsed.ref, parsed.locator, current, parsed.domain))
  } }))
}

// oxlint-disable-next-line typescript/require-await -- ResourceProvider's error channel is an async iterable even for parse-only failures.
async function* invalid(error: unknown) {
  yield failure({ code: 'invalid-request', message: error instanceof Error ? error.message : 'Invalid material address', retryable: false })
}
