/** Only IDs and opaque query cursors cross browser source addresses. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type { StudyArtifact, StudyArtifactId, StudyArtifactPage, StudyArtifactQuery, StudySetup } from '@deepseek-ai/dsh-research-study/types'
import type { StudyConnection } from './connection.ts'
import { studyFailure } from './connection.ts'

/** Current Host storage and answer-capture availability. */
export const STUDY_SETUP = 'dsh-resource://aitp-study-setup/'
/** Product intents; selecting one does not create model content. */
export const STUDY_KINDS = ['note', 'report', 'comparison', 'outline', 'flashcards', 'mind-map'] as const

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-study-setup': StudySetup
    'aitp-study-list': StudyArtifactPage
    'aitp-study-note': StudyArtifact
  }
}

/**
 * Address one bounded saved-artifact index page.
 * @param query - the owner's cursor and product filter.
 * @returns the framework reading identity.
 */
export function studyListAddress(query: StudyArtifactQuery): string {
  const params = new URLSearchParams()
  if (query.kind !== undefined) params.set('kind', query.kind)
  if (query.cursor !== undefined) params.set('cursor', query.cursor)
  return `dsh-resource://aitp-study-list/?${params}`
}
/**
 * Address one current saved artifact without copying its body.
 * @param id - stable operational artifact identity.
 * @returns the saved draft's framework reading address.
 */
export function studyArtifactAddress(id: StudyArtifactId): string { return `dsh-resource://aitp-study-note/${encodeURIComponent(id)}` }

/**
 * Register setup, index and artifact observations through framework resources.
 * @param ctx - plugin owning these removable protocol contributions.
 * @param connection - the current reversible generated namespace transport.
 */
export function registerStudyResources(ctx: Context, connection: StudyConnection): void {
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-study-setup',
    open: (_address, { signal }) => connection.frames(signal, (transport, current) => transport.setup(current)),
  }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-study-list', open: (address, { signal }) => {
    const params = new URL(address).searchParams
    const kind = params.get('kind')
    const cursor = params.get('cursor')
    if (kind !== null && !STUDY_KINDS.includes(kind as typeof STUDY_KINDS[number])) return invalid()
    const query: StudyArtifactQuery = { ...kind === null ? {} : { kind: kind as typeof STUDY_KINDS[number] },
      ...cursor === null ? {} : { cursor } }
    return connection.frames(signal, (transport, current) => transport.list(query, current))
  } }))
  ctx.effect(() => ctx.resources.register({ protocol: 'aitp-study-note', open: (address, { signal }) => {
    let id: string
    try { id = decodeURIComponent(new URL(address).pathname.slice(1)) }
    catch { return invalid() }
    if (!id || id.includes('\0')) return invalid()
    return connection.frames(signal, (transport, current) => transport.read(id as StudyArtifactId, current))
  } }))
}

// oxlint-disable-next-line typescript/require-await -- Framework parse failures use the same async frame contract as reads.
async function* invalid() {
  yield studyFailure({ code: 'invalid-request', message: 'Invalid study resource address', retryable: false })
}
