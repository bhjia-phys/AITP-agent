/** Rebuildable topic membership over the existing live and persisted Session corpus. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionRecord, SessionObservation } from '@deepseek-ai/dsh-session-query'
import type { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { scopeKey } from './working-state.ts'
import type { ResearchWorkingState } from './working-types.ts'

interface Membership {
  readonly allowed: boolean
  readonly scopes: ReadonlySet<string>
}

interface ScopeSummary extends Membership {
  readonly eventCount: number
}

interface ColdStamp {
  readonly identity: symbol
  readonly revision: SessionPersistenceRevision
  readonly lifecycle: string
}

type IndexedScope =
  | { readonly kind: 'known'; readonly summary: ScopeSummary }
  | { readonly kind: 'oversized' }

type ScopeLookup = IndexedScope
  | { readonly kind: 'unknown'; readonly stamp?: ColdStamp }
  | { readonly kind: 'unavailable' }

interface ColdScope {
  readonly stamp: ColdStamp
  readonly value: IndexedScope
}

function lifecycle(header: SessionHeader): string {
  return JSON.stringify([header.version, header.id, header.createdAt, header.cwd, header.parentSession,
    header.isSeeded, header.origin, header.delegationDepth, header.agentPreset])
}

function membership(state: ResearchWorkingState): Membership {
  const origins = [...state.humans, ...state.items, ...state.writes,
    ...state.pending.filter(call => call.name === 'ask_user_question')].map(item => item.origin)
  return {
    allowed: state.ownerOrigin && !state.restricted,
    scopes: new Set(origins.map(scopeKey)),
  }
}

/** Live projection membership and compact cold scope metadata checked against the current stored revision. */
export class TopicHistoryIndex {
  private readonly cold = new Map<SessionId, ColdScope>()
  private readonly live = new WeakMap<ResearchWorkingState, Membership>()

  /**
   * @param ctx Existing Session, projection and optional persistence services; no new storage is created.
   * @param maximumEvents Maximum log size admitted for a full research fold.
   */
  constructor(private readonly ctx: Context, private readonly maximumEvents: number) {}

  /**
   * Drop entries no longer in the observed corpus; retained entries contain no raw log or source text.
   * @param records Complete metadata listing from the current Session query service.
   */
  prune(records: readonly SessionRecord[]): void {
    const ids = new Set(records.map(record => record.header.id))
    for (const id of this.cold.keys()) if (!ids.has(id)) this.cold.delete(id)
  }

  /**
   * Read current live membership or a revision-validated compact cold classification.
   * @param record Listed candidate; a changed lifecycle is not inspected under the old metadata.
   * @param signal Optional cancellation observed before and after stored metadata reads.
   * @returns Known membership, a bounded-log rejection, or explicit unknown/unavailable coverage.
   */
  async lookup(record: SessionRecord, signal?: AbortSignal): Promise<ScopeLookup> {
    signal?.throwIfAborted()
    const expected = lifecycle(record.header)
    const live = this.ctx.get('sessions')?.get(record.header.id)
    if (live !== undefined) {
      if (lifecycle(live.header) !== expected) return { kind: 'unavailable' }
      if (live.seq > this.maximumEvents) return { kind: 'oversized' }
      const state = this.ctx.sessionProjections.stateOf(live, 'researchWorking')
      if (state === undefined) return { kind: 'unknown' }
      let summary = this.live.get(state)
      if (summary === undefined) {
        summary = membership(state)
        this.live.set(state, summary)
      }
      return { kind: 'known', summary: { ...summary, eventCount: live.seq } }
    }
    const persistence = this.ctx.get('sessionPersistence')
    if (persistence === undefined) return { kind: 'unknown' }
    const snapshot = await persistence.stat(record.header.id, signal === undefined ? undefined : { signal })
    signal?.throwIfAborted()
    if (snapshot === undefined || lifecycle(snapshot.header) !== expected) return { kind: 'unavailable' }
    const stamp = { identity: persistence.identity, revision: snapshot.revision, lifecycle: expected }
    const cached = this.cold.get(record.header.id)
    if (cached?.stamp.identity === stamp.identity && cached.stamp.revision === stamp.revision
      && cached.stamp.lifecycle === stamp.lifecycle) return cached.value
    if (snapshot.eventCount !== undefined && snapshot.eventCount > this.maximumEvents) {
      this.cold.set(record.header.id, { stamp, value: { kind: 'oversized' } })
      return { kind: 'oversized' }
    }
    return { kind: 'unknown', stamp }
  }

  /**
   * Retain only membership/access from a fully observed cut, never a borrowed log or lease.
   * @param lookup Unknown classification that preceded the source observation; without its stamp nothing is cached.
   * @param observed Fresh caller-owned Session observation.
   * @param state Fully folded research state, or absent when the log exceeds the absolute event bound.
   */
  remember(lookup: ScopeLookup, observed: SessionObservation, state?: ResearchWorkingState): void {
    if (lookup.kind !== 'unknown' || lookup.stamp === undefined || observed.source !== 'prepared'
      || observed.revision === undefined || lifecycle(observed.header) !== lookup.stamp.lifecycle
      || this.ctx.get('sessionPersistence')?.identity !== lookup.stamp.identity) return
    const count = observed.cursor + 1
    const value: IndexedScope | undefined = count > this.maximumEvents ? { kind: 'oversized' }
      : state === undefined ? undefined : { kind: 'known', summary: { ...membership(state), eventCount: count } }
    if (value === undefined) return
    this.cold.set(observed.header.id, {
      stamp: { ...lookup.stamp, revision: observed.revision }, value,
    })
  }
}
