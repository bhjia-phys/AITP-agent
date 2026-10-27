/** Read only the research writer's durable tool-result metadata, including nested PTC calls. */
import type { ResearchChangeView } from './workspace-contract.ts'

/** The result identity is enough to request its independently authorized, bounded receipt. */
export interface ResearchChangePointer {
  readonly operationId: string
  readonly state: ResearchChangeView['state']
  readonly seq: number
}

const WRITER_TOOLS = new Set(['research_prepare_change', 'research_apply_change', 'research_recover_change'])

/** One registration's memoized observation of immutable native tool trees. */
export interface ResearchChangeReader {
  /**
   * Find the latest writer result without parsing model prose or generic file tools.
   * @param nodes - Conversation-owned Chat nodes, narrowed at this consumer boundary.
   * @returns a stable pointer within this lifetime, or null after disposal or without a writer result.
   */
  readonly read: (nodes: readonly { readonly kind: string; readonly data: unknown }[]) => ResearchChangePointer | null
  /** Release cached observations and make subsequent reads return null. */
  readonly dispose: () => void
}

/**
 * Allocate a change reader for one plugin registration lifetime.
 * @returns the reader and its owner-invoked disposal operation; separate readers never share pointers.
 */
export function createResearchChangeReader(): ResearchChangeReader {
  let cache: WeakMap<object, ResearchChangePointer | null> | undefined = new WeakMap()
  return {
    read(nodes) { return cache === undefined ? null : latestResearchChange(nodes, cache) },
    dispose() { cache = undefined },
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function writeState(value: unknown): ResearchChangeView['state'] | undefined {
  switch (value) {
    case 'prepared': case 'no-change': case 'pending': case 'applying':
    case 'applied': case 'not-applied': case 'partial': case 'unknown': return value
    default: return undefined
  }
}
function newestInCall(value: unknown, cache: WeakMap<object, ResearchChangePointer | null>): ResearchChangePointer | null {
  if (!record(value)) return null
  const found = cache.get(value)
  if (found !== undefined) return found
  let latest: ResearchChangePointer | null = null
  if (value.kind === 'tool-result' && value.isError === false && typeof value.name === 'string'
    && WRITER_TOOLS.has(value.name) && typeof value.seq === 'number' && Number.isSafeInteger(value.seq)
    && record(value.meta) && record(value.meta.researchWrite)) {
    const outcome = value.meta.researchWrite
    const state = writeState(outcome.state)
    if (state !== undefined && typeof outcome.operationId === 'string' && outcome.operationId !== '') {
      latest = { operationId: outcome.operationId, state, seq: value.seq }
    }
  }
  if (Array.isArray(value.subCalls)) {
    for (const child of value.subCalls) {
      const candidate = newestInCall(child, cache)
      if (candidate !== null && (latest === null || candidate.seq > latest.seq)) latest = candidate
    }
  }
  // Native tool trees are immutable. Streaming unrelated answers reuse this exact result identity.
  cache.set(value, latest)
  return latest
}

function latestResearchChange(nodes: readonly { readonly kind: string; readonly data: unknown }[],
  cache: WeakMap<object, ResearchChangePointer | null>): ResearchChangePointer | null {
  let latest: ResearchChangePointer | null = null
  for (const node of nodes) {
    if (node.kind !== 'tool-call' || !record(node.data)) continue
    const candidate = newestInCall(node.data.root, cache)
    if (candidate !== null && (latest === null || candidate.seq > latest.seq)) latest = candidate
  }
  return latest
}
