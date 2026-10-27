/** Read only the research writer's durable tool-result metadata, including nested PTC calls. */
import type { ResearchChangeView } from './workspace-contract.ts'

/** The result identity is enough to request its independently authorized, bounded receipt. */
export interface ResearchChangePointer {
  readonly operationId: string
  readonly state: ResearchChangeView['state']
  readonly seq: number
}

const cache = new WeakMap<object, ResearchChangePointer | null>()
const WRITER_TOOLS = new Set(['research_prepare_change', 'research_apply_change', 'research_recover_change'])

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
function newestInCall(value: unknown): ResearchChangePointer | null {
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
      const candidate = newestInCall(child)
      if (candidate !== null && (latest === null || candidate.seq > latest.seq)) latest = candidate
    }
  }
  // Native tool trees are immutable. Streaming unrelated answers reuse this exact result identity.
  cache.set(value, latest)
  return latest
}

/**
 * Find a writer result in the loaded native transcript, without parsing model prose or generic file tools.
 * @param nodes - Conversation-owned Chat nodes; arbitrary node payloads are narrowed at this consumer boundary.
 * @returns the latest native writer result, with stable identity across unrelated streaming updates.
 */
export function latestResearchChange(nodes: readonly { readonly kind: string; readonly data: unknown }[]): ResearchChangePointer | null {
  let latest: ResearchChangePointer | null = null
  for (const node of nodes) {
    if (node.kind !== 'tool-call' || !record(node.data)) continue
    const candidate = newestInCall(node.data.root)
    if (candidate !== null && (latest === null || candidate.seq > latest.seq)) latest = candidate
  }
  return latest
}
