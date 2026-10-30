/** Durable, model-invisible source/mode bindings for standard DSH Sessions. */
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { replaySessionWorkingState } from './session-view.ts'
import { acceptHumanInput, applyWorkingEvent, emptyWorkingState, isNonOwnerInput, originSchema, scopeKey } from './working-state.ts'
import type { ResearchOrigin, ResearchWorkingState } from './working-types.ts'

/** Immutable Session fields that distinguish one persisted lifecycle from another under one id. */
const identitySchema = z.object({
  createdAt: z.number().int().nonnegative(),
  cwd: z.string().optional(),
  isSeeded: z.boolean(),
  parentSession: z.string().optional(),
  origin: z.literal('subagent').optional(),
  delegationDepth: z.number().int().nonnegative().optional(),
})
type SessionIdentity = z.infer<typeof identitySchema>

const bindingEntrySchema = z.object({
  /** Opaque operation identity used only to withdraw an unadmitted reservation. */
  id: z.string().uuid().optional(),
  /** The first real owner user input at or after this native event position receives this origin. */
  afterSeq: z.number().int().nonnegative(),
  kind: z.enum(['source', 'mode']),
  origin: originSchema,
})
type BindingEntry = z.infer<typeof bindingEntrySchema>

/** A reservation is operational metadata, not a Session event or a transcript item. */
export interface BindingLease {
  readonly sessionId: string
  readonly entryId?: string
  readonly afterSeq: number
  /** False when an existing prepared source already owns this blank Session. */
  readonly created: boolean
}

const bindingRecordSchema = z.object({
  format: z.literal(1),
  /** Repeated so an encoded table key can never bind a different native Session id. */
  sessionId: z.string(),
  identity: identitySchema,
  entries: z.array(bindingEntrySchema).max(128),
})
type BindingRecord = z.infer<typeof bindingRecordSchema>

/** Plugin-owned operational storage. It never contains prompt bodies, note text, model output or scientific conclusions. */
export const sessionBindingsDomain = defineDomain({
  name: 'aitp_source_selection',
  version: 1,
  layout: 'per-record',
  tables: { sessions: domainTable<string, BindingRecord>(bindingRecordSchema) },
})

/** JSON-backed DSH domain keys accept only a conservative alphabet; SessionId itself is intentionally arbitrary. */
function storageKey(sessionId: string): string {
  return `s_${Buffer.from(sessionId, 'utf8').toString('base64url')}`
}

function identityOf(header: SessionHeader): SessionIdentity {
  return {
    createdAt: header.createdAt,
    ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
    isSeeded: header.isSeeded,
    ...(header.parentSession === undefined ? {} : { parentSession: header.parentSession }),
    ...(header.origin === undefined ? {} : { origin: header.origin }),
    // JSONL restore normalizes an omitted root-session depth to zero. Store
    // the canonical value so a healthy Session keeps its sidecar on restart.
    delegationDepth: header.delegationDepth ?? 0,
  }
}

function sameIdentity(left: SessionIdentity, right: SessionIdentity): boolean {
  return left.createdAt === right.createdAt && left.cwd === right.cwd && left.isSeeded === right.isSeeded
    && left.parentSession === right.parentSession && left.origin === right.origin
    && (left.delegationDepth ?? 0) === (right.delegationDepth ?? 0)
}

function cloneOrigin(origin: ResearchOrigin): ResearchOrigin {
  return originSchema.parse(origin)
}

function ownerUserInput(message: UserMessage): boolean {
  return (message.source.kind === 'user' || message.source.kind === 'user-question-reply') && !isNonOwnerInput(message)
}

function ownerUserEvent(event: SessionEvent): event is Extract<SessionEvent, { type: 'user/message' }> {
  return event.type === 'user/message' && ownerUserInput(event.data)
}

function originAt(entries: readonly BindingEntry[], seq: number): ResearchOrigin | undefined {
  let result: ResearchOrigin | undefined
  for (const entry of entries) if (entry.afterSeq <= seq) result = entry.origin
  return result
}

/** Selection identity deliberately excludes the next-turn Research preference. */
function sameSelection(left: ResearchOrigin, right: ResearchOrigin): boolean {
  const { workflow: _leftWorkflow, ...leftSelection } = left
  const { workflow: _rightWorkflow, ...rightSelection } = right
  return JSON.stringify(leftSelection) === JSON.stringify(rightSelection)
}

function bindState(state: ResearchWorkingState, origin: ResearchOrigin): ResearchWorkingState {
  return { ...state, origin: cloneOrigin(origin), ownerOrigin: true }
}

/**
 * One plugin-owned source-routing sidecar. Native DSH logs retain only genuine
 * user/assistant/tool records; replay injects a selected origin immediately
 * before the real owner input that it governs.
 */
export class ResearchSessionBindings {
  private table: KvTable<string, BindingRecord> | undefined
  private domain: Domain<typeof sessionBindingsDomain> | undefined
  private readonly fallback = new Map<string, BindingRecord>()
  /** Serialize this process's read/replace operations before the domain write chain begins. */
  private readonly mutations = new Map<string, Promise<unknown>>()
  /** Resolves when the optional durable table is open and ready for use. */
  readonly ready: Promise<void>

  /** @param ctx - Optional standard DSH storage-domain host capability. */
  constructor(ctx: Context) {
    const facility = ctx.get('storageDomain')
    this.ready = facility === undefined ? Promise.resolve() : facility.open(sessionBindingsDomain).then((domain) => {
      this.domain = domain
      this.table = domain.table('sessions')
    })
  }

  /** Whether bindings survive a host restart. Standard DSH profiles provide this capability. */
  get durable(): boolean { return this.table !== undefined }

  /** Close the one owned domain handle after its queued writes settle. */
  async close(): Promise<void> {
    await this.domain?.close()
  }

  /**
   * Reserve a source selection or next-turn mode choice before native admission.
   * The entry changes no DSH session event and takes effect only at a subsequent
   * genuine owner input.
   * @param session - Native Session whose next genuine owner input gets the selection.
   * @param origin - Human-selected research scope and source set to bind.
   * @param kind - Whether the selection records sources or a next-turn mode choice.
   * @returns Lease used to cancel this exact reservation if native admission fails.
   */
  async reserve(session: Session, origin: ResearchOrigin, kind: BindingEntry['kind']): Promise<BindingLease> {
    await this.ready
    const key = storageKey(session.id)
    return this.mutate(key, async () => {
      const existing = this.record(session.header)
      const existingOrigin = existing === undefined || this.hasOwnerInput(session)
        ? undefined : existing.entries.at(-1)?.origin
      if (kind === 'source' && existingOrigin !== undefined) {
        if (!sameSelection(existingOrigin, origin)) {
          throw new Error('This prepared discussion already belongs to another selected research source. Open a new discussion for the new selection.')
        }
        const entry = existing?.entries.at(-1)
        return { sessionId: session.id, ...(entry?.id === undefined ? {} : { entryId: entry.id }),
          afterSeq: entry?.afterSeq ?? session.seq, created: false }
      }
      const entryId = randomUUID()
      const entry: BindingEntry = { id: entryId, afterSeq: session.seq, kind, origin: cloneOrigin(origin) }
      const next: BindingRecord = existing === undefined
        ? { format: 1, sessionId: session.id, identity: identityOf(session.header), entries: [entry] }
        : { ...existing, entries: [...existing.entries, entry] }
      if (next.entries.length > 128) {
        throw new Error('This discussion has too many pending source or Research-mode changes. Start a new discussion before changing its scope again.')
      }
      await this.put(key, next)
      return { sessionId: session.id, entryId, afterSeq: entry.afterSeq, created: true }
    })
  }

  /**
   * Withdraw precisely one unadmitted reservation after controller admission
   * fails. A real owner input at or beyond its position wins over withdrawal.
   * @param session - Native Session whose reservation may be withdrawn.
   * @param lease - Exact reservation returned by {@link reserve}.
   */
  async cancel(session: Session, lease: BindingLease): Promise<void> {
    if (!lease.created || lease.entryId === undefined || lease.sessionId !== session.id) return
    await this.ready
    const key = storageKey(session.id)
    await this.mutate(key, async () => {
      const existing = this.record(session.header)
      if (existing === undefined || this.hasOwnerInputAtOrAfter(session, lease.afterSeq)) return
      const entries = existing.entries.filter(entry => entry.id !== lease.entryId)
      if (entries.length === existing.entries.length) return
      if (entries.length === 0) {
        if (this.table !== undefined) await this.table.delete(key)
        else this.fallback.delete(key)
        return
      }
      await this.put(key, { ...existing, entries })
    })
  }

  /**
   * The prepared selection for an otherwise blank Session, if this plugin owns one.
   * @param session - Native Session to inspect.
   * @returns Its pending source/mode selection, or `undefined` when none applies.
   */
  pendingOrigin(session: Session): ResearchOrigin | undefined {
    const record = this.record(session.header)
    if (record === undefined || this.hasOwnerInput(session)) return undefined
    const origin = record.entries.at(-1)?.origin
    return origin === undefined ? undefined : cloneOrigin(origin)
  }

  /**
   * Read-only presentation of a prepared blank Session; it never makes the selection an accepted input.
   * @param header - Native Session identity used to validate the sidecar record.
   * @param events - Current persisted events used to ensure the Session is still blank.
   * @returns Its prepared selection, or `undefined` after owner input or a lifecycle mismatch.
   */
  preparedOrigin(header: SessionHeader, events: readonly SessionEvent[]): ResearchOrigin | undefined {
    const record = this.record(header)
    if (record === undefined || events.some(ownerUserEvent)) return undefined
    const origin = record.entries.at(-1)?.origin
    return origin === undefined ? undefined : cloneOrigin(origin)
  }

  /**
   * Resolve state from the native log plus any matching sidecar entries.
   * Legacy attributed sessions deliberately retain their native projection
   * path when no sidecar record exists.
   * @param header - Native Session identity used to validate the sidecar record.
   * @param events - Persisted events to fold in sequence order.
   * @param fallback - Existing research projection used when no sidecar record applies.
   * @returns Recovered working state with source/mode bindings applied to their owner inputs.
   */
  stateForEvents(header: SessionHeader, events: readonly SessionEvent[], fallback?: ResearchWorkingState): ResearchWorkingState {
    const record = this.record(header)
    if (record === undefined) return fallback ?? replaySessionWorkingState(events)
    let state = emptyWorkingState()
    for (const event of events) {
      const origin = ownerUserEvent(event) ? originAt(record.entries, event.seq) : undefined
      if (ownerUserEvent(event)) {
        if (origin !== undefined) state = bindState(state, origin)
      }
      state = applyWorkingEvent(state, event)
      // Question replies inherit the question's old pointer during ordinary
      // replay. Re-apply the durable next-turn choice after recording that
      // answer so an explicit mode change governs the following model turn.
      if (origin !== undefined) state = bindState(state, origin)
    }
    return state
  }

  /**
   * Scope after each persisted event, for read-only Session-memory presentation.
   * @param header - Native Session identity used to validate the sidecar record.
   * @param events - Persisted events to fold in sequence order.
   * @returns A map from event sequence to its bound research scope.
   */
  scopesForEvents(header: SessionHeader, events: readonly SessionEvent[]): ReadonlyMap<number, string> {
    const record = this.record(header)
    const scopes = new Map<number, string>()
    let state = emptyWorkingState()
    for (const event of events) {
      const origin = record !== undefined && ownerUserEvent(event) ? originAt(record.entries, event.seq) : undefined
      if (record !== undefined && ownerUserEvent(event)) {
        if (origin !== undefined) state = bindState(state, origin)
      }
      state = applyWorkingEvent(state, event)
      if (origin !== undefined) state = bindState(state, origin)
      if (state.origin !== null) scopes.set(event.seq, scopeKey(state.origin))
    }
    return scopes
  }

  /**
   * Fold a live Session; callers pass its normal projection as the legacy fallback.
   * @param session - Current native Session and event snapshot.
   * @param fallback - Existing projection used when no sidecar record applies.
   * @returns Recovered research working state for the live Session.
   */
  stateForLive(session: Session, fallback?: ResearchWorkingState): ResearchWorkingState {
    return this.stateForEvents(session.header, session.snapshotEvents(), fallback)
  }

  /**
   * Build the exact state used to prepare a pending native turn. Proposed
   * messages are not persisted or cached here, so their later real event gets
   * its actual sequence number on the next fold.
   * @param session - Current native Session and event snapshot.
   * @param proposed - Owner and non-owner inputs proposed for the pending turn.
   * @param fallback - Existing projection used when no sidecar record applies.
   * @returns Working state after applying the proposed inputs and matching bindings.
   */
  stateForProposed(session: Session, proposed: readonly UserMessage[], fallback?: ResearchWorkingState): ResearchWorkingState {
    const record = this.record(session.header)
    let state = this.stateForEvents(session.header, session.snapshotEvents(), fallback)
    if (record === undefined) {
      for (const message of proposed) state = acceptHumanInput(state, message, -1)
      return state
    }
    let seq = session.seq
    for (const message of proposed) {
      const origin = ownerUserInput(message) ? originAt(record.entries, seq) : undefined
      if (ownerUserInput(message)) {
        if (origin !== undefined) state = bindState(state, origin)
      }
      state = acceptHumanInput(state, message, -1)
      if (origin !== undefined) state = bindState(state, origin)
      seq++
    }
    return state
  }

  /**
   * True only for a matching, plugin-owned routing record; a lifecycle mismatch fails closed.
   * @param header - Native Session identity to match against the sidecar.
   * @returns Whether a valid sidecar record exists for this Session lifecycle.
   */
  has(header: SessionHeader): boolean { return this.record(header) !== undefined }

  private hasOwnerInput(session: Session): boolean {
    return session.snapshotEvents().some(ownerUserEvent)
  }

  private hasOwnerInputAtOrAfter(session: Session, afterSeq: number): boolean {
    return session.snapshotEvents().some(event => ownerUserEvent(event) && event.seq >= afterSeq)
  }

  private record(header: SessionHeader): BindingRecord | undefined {
    const key = storageKey(header.id)
    const record = this.table?.get(key) ?? this.fallback.get(key)
    if (record === undefined || record.sessionId !== header.id || !sameIdentity(record.identity, identityOf(header))) return undefined
    return record
  }

  private async put(key: string, record: BindingRecord): Promise<void> {
    // Domain writes resolve only after durability. The in-memory fallback is
    // intentionally limited to hosts that do not compose storageDomain.
    if (this.table !== undefined) await this.table.put(key, record)
    else this.fallback.set(key, record)
  }

  private async mutate<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.mutations.get(key) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(operation)
    this.mutations.set(key, current)
    const clear = (): void => { if (this.mutations.get(key) === current) this.mutations.delete(key) }
    void current.then(clear, clear)
    return current
  }
}
