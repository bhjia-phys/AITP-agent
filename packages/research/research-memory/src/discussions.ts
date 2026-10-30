/** Ordinary Session discovery and exact-scope continuation; no second transcript or persisted index. */
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session, SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { acceptHumanInput, contentText, emptyWorkingState, scopeKey } from './working-state.ts'
import { replaySessionWorkingState } from './session-view.ts'
import type { ResearchOrigin, ResearchWorkingState } from './working-types.ts'
import type { DiscussionPage } from './types.ts'

interface DiscussionSnapshot {
  readonly session: Session
  readonly seq: number
  readonly state: ResearchWorkingState
  readonly hasHumanInput: boolean
}

/** Resolve a research state without assuming that its selected origin lives in the native Session log. */
export type DiscussionStateResolver = (session: Session) => ResearchWorkingState

function pendingState(agent: Agent, state: ResearchWorkingState): ResearchWorkingState {
  for (const message of [...agent.inbox.nextTurn, ...agent.inbox.nextStep]) state = acceptHumanInput(state, message, -1)
  return state
}

/**
 * Verify a blank Session using an explicit native read; bound discussions use the maintained projection.
 * @param ctx - Existing Session query and projection owners.
 * @param agent - Native Agent resolved by SessionController.
 * @param maximumEvents - Maximum records examined when proving a Session is blank.
 * @param signal - Cancels the read before prompt admission.
 * @param resolveState - Optional owner for the Session's durable research binding.
 * @returns Exact scope and blank evidence, rechecked against the live sequence before admission.
 */
export async function readDiscussion(ctx: Context, agent: Agent, maximumEvents: number, signal: AbortSignal,
  resolveState?: DiscussionStateResolver): Promise<DiscussionSnapshot> {
  const projected = resolveState?.(agent.session) ?? ctx.sessionProjections.stateOf(agent.session, 'researchWorking')
  if (projected?.origin !== undefined && projected.origin !== null) return {
    session: agent.session, seq: agent.session.seq, state: pendingState(agent, projected), hasHumanInput: true,
  }
  const query = ctx.get('sessionQuery')
  if (query === undefined || agent.session.seq > maximumEvents) throw new RemoteError('research/session-unavailable',
    'The conversation scope cannot be verified on this host. Open a new discussion when history is available.', {})
  using observed = await query.observeSession(agent.id, { signal, projectionMode: 'none' })
  if (observed.events.length > maximumEvents || observed.cursor + 1 !== agent.session.seq) {
    throw new RemoteError('research/session-unavailable', 'The conversation changed while its scope was being checked. Retry the question.', {})
  }
  return { session: agent.session, seq: agent.session.seq,
    state: pendingState(agent, projected ?? replaySessionWorkingState(observed.events)),
    hasHumanInput: observed.events.some(event => event.type === 'user/message'),
  }
}

/**
 * Reject implicit topic changes and recheck the exact live projection after asynchronous attachment admission.
 * @param ctx - Existing projection services.
 * @param agent - Native Agent about to accept the exact attributed message.
 * @param origin - Frozen per-message research/source scope.
 * @param root - Canonical Workspace root, absent only for global library study.
 * @param snapshot - Earlier explicit read used only to prove an otherwise unbound Session is blank.
 * @param resolveState - Optional owner for the Session's durable research binding.
 */
export function assertDiscussionScope(ctx: Context, agent: Agent, origin: ResearchOrigin,
  root: string | undefined, snapshot: DiscussionSnapshot, resolveState?: DiscussionStateResolver): void {
  const header = agent.session.header
  if (agent.session !== snapshot.session || header.parentSession !== undefined || header.origin === 'subagent'
    || root !== undefined && (header.cwd === undefined || resolve(header.cwd) !== resolve(root))) {
    throw new RemoteError('research/session-unavailable', 'This conversation belongs to a different Workspace or delegated scope. Open a new discussion here.', {})
  }
  const state = pendingState(agent, resolveState?.(agent.session)
    ?? ctx.sessionProjections.stateOf(agent.session, 'researchWorking') ?? snapshot.state)
  const hasHumanInput = snapshot.hasHumanInput || agent.inbox.nextTurn.length > 0 || agent.inbox.nextStep.length > 0
  if (state.restricted || state.origin === null && (hasHumanInput || snapshot.seq !== agent.session.seq)
    || state.origin !== null && (!state.ownerOrigin || scopeKey(state.origin) !== scopeKey(origin))) {
    throw new RemoteError('research/session-unavailable', 'This conversation is not bound to this research direction. Return to its direction or open a new discussion.', {})
  }
  for (const message of [...agent.inbox.nextTurn, ...agent.inbox.nextStep]) {
    if (message.source.kind === 'aitp-research' && scopeKey(message.source.origin) !== scopeKey(origin)) {
      throw new RemoteError('research/session-unavailable', 'A queued question belongs to another research direction. Open a new discussion.', {})
    }
  }
}

interface Summary {
  readonly scope: string | undefined
  readonly title: string
  readonly updatedAt: number
}
interface CachedSummary {
  readonly persistence: symbol
  readonly revision: SessionPersistenceRevision
  readonly lifecycle: string
  readonly summary: Summary
}
function lifecycle(header: SessionHeader): string {
  return JSON.stringify(header)
}
function summarize(header: SessionHeader, events: readonly SessionEvent[], state: ResearchWorkingState): Summary {
  const title = events.findLast(event => event.type === 'session/title')
  const first = events.find(event => event.type === 'user/message' && (event.data.source.kind === 'user' || event.data.source.kind === 'aitp-research'))
  return {
    scope: state.ownerOrigin && !state.restricted && state.origin !== null ? scopeKey(state.origin) : undefined,
    title: title?.type === 'session/title' ? title.data.title
      : first?.type === 'user/message' ? contentText(first.data.content).trim().slice(0, 160) || 'Untitled discussion' : 'Untitled discussion',
    updatedAt: events.at(-1)?.time ?? header.createdAt,
  }
}

/** Revision-checked lightweight metadata over native live/cold Sessions; cached entries never contain source text. */
export class ResearchDiscussions {
  private readonly cold = new Map<SessionId, CachedSummary>()
  private readonly live = new WeakMap<Agent['session'], { seq: number; summary: Summary }>()

  /** @param ctx - Native query/projection services. @param maximumEvents - Maximum cold events folded per read.
   * @param resolveLive - Optional standard-host sidecar-aware live state resolver.
   * @param resolveCold - Optional standard-host sidecar-aware cold state resolver. */
  constructor(private readonly ctx: Context, private readonly maximumEvents: number,
    private readonly resolveLive?: DiscussionStateResolver,
    private readonly resolveCold?: (header: SessionHeader, events: readonly SessionEvent[]) => ResearchWorkingState) {}

  /**
   * List current-scope discussions without creating Agents or running models.
   * @param root - Canonical authorized research directory.
   * @param origin - Exact Workspace/root or topic identity.
   * @param limit - Maximum rows returned.
   * @param signal - Cancels metadata and cold-log reads.
   * @returns Bounded current rows with explicit incomplete coverage.
   */
  async list(root: string, origin: ResearchOrigin, limit: number, signal: AbortSignal): Promise<DiscussionPage> {
    const query = this.ctx.get('sessionQuery')
    if (query === undefined) return { items: [], completeness: 'partial', issues: ['Conversation history is unavailable on this host.'] }
    const records = (await query.listSessions(signal)).filter(record => record.header.cwd !== undefined
      && resolve(record.header.cwd) === resolve(root) && record.header.parentSession === undefined && record.header.origin !== 'subagent')
      .sort((a, b) => Number(b.live) - Number(a.live) || b.header.createdAt - a.header.createdAt)
    const retained = new Set(records.map(record => record.header.id))
    for (const id of this.cold.keys()) if (!retained.has(id)) this.cold.delete(id)
    const items: DiscussionPage['items'][number][] = []
    const issues = new Set<string>()
    let budget = this.maximumEvents
    const maximumCandidates = Math.max(limit * 4, 100)
    if (records.length > maximumCandidates) issues.add('Live and recently created conversations were inspected first; older discussions may be omitted.')
    for (const record of records.slice(0, maximumCandidates)) {
      signal.throwIfAborted()
      try {
        let summary: Summary | undefined
        const session = this.ctx.get('sessions')?.get(record.header.id)
        const agent = this.ctx.agents.get(record.header.id)
        if (session !== undefined) {
          const cached = this.live.get(session)
          if (cached?.seq === session.seq) summary = cached.summary
          else if (session.seq <= this.maximumEvents) {
            using observed = await query.observeSession(record.header.id, { signal, projectionMode: 'none' })
            if (observed.events.length <= this.maximumEvents && lifecycle(observed.header) === lifecycle(record.header)) {
              summary = summarize(observed.header, observed.events,
                this.resolveCold?.(observed.header, observed.events) ?? replaySessionWorkingState(observed.events))
              this.live.set(session, { seq: observed.cursor + 1, summary })
            }
          }
          if (summary !== undefined && agent !== undefined) {
            const pending = pendingState(agent, this.resolveLive?.(session)
              ?? this.ctx.sessionProjections.stateOf(session, 'researchWorking') ?? emptyWorkingState())
            const scope = pending.ownerOrigin && !pending.restricted && pending.origin !== null ? scopeKey(pending.origin) : undefined
            summary = { ...summary, scope }
          }
        } else {
          const persistence = this.ctx.get('sessionPersistence')
          const stamp = await persistence?.stat(record.header.id, { signal })
          const cached = this.cold.get(record.header.id)
          if (stamp !== undefined && cached !== undefined && cached.persistence === persistence?.identity
            && cached.revision === stamp.revision && cached.lifecycle === lifecycle(stamp.header)) summary = cached.summary
          else if (budget > 0 && (stamp?.eventCount === undefined || stamp.eventCount <= budget)) {
            using observed = await query.observeSession(record.header.id, { signal, projectionMode: 'none' })
            if (observed.events.length <= budget && lifecycle(observed.header) === lifecycle(record.header)) {
              summary = summarize(observed.header, observed.events,
                this.resolveCold?.(observed.header, observed.events) ?? replaySessionWorkingState(observed.events))
              if (persistence !== undefined && observed.revision !== undefined && observed.source === 'prepared') {
                this.cold.set(record.header.id, { persistence: persistence.identity, revision: observed.revision,
                  lifecycle: lifecycle(observed.header), summary })
              }
            }
            budget = Math.max(0, budget - observed.events.length)
          }
        }
        if (summary === undefined) { issues.add('Some conversations exceeded the history read limit and were omitted.'); continue }
        if (summary.scope !== scopeKey(origin)) continue
        items.push({ sessionId: record.header.id, title: summary.title, updatedAt: new Date(summary.updatedAt).toISOString(),
          busy: agent !== undefined && (agent.status !== 'idle' || agent.inbox.nextTurn.length > 0 || agent.inbox.nextStep.length > 0) })
      } catch {
        signal.throwIfAborted()
        issues.add('Some conversation records could not be read and were omitted.')
      }
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (items.length > limit) issues.add('Older matching discussions are omitted from this bounded list.')
    return { items: items.slice(0, limit), completeness: issues.size === 0 ? 'complete' : 'partial', issues: [...issues] }
  }
}
