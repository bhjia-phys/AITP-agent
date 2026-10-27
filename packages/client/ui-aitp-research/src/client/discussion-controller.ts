/** The reading workbench owns presentation; native Sessions own messages, drafts and execution. */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionReference, SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchOrigin, ResourceId } from '@deepseek-ai/dsh-research-memory/types'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './discussion-locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ResearchWorkspaceRegistry } from './workspace-service.ts'
import type { DiscussionReaderNavigation, DiscussionResourceNavigation, DiscussionStudyAdmission, ResearchDiscussions, ResearchDiscussionScope } from './discussion-contract.ts'

/** One scope's retained reading-side selection, independent of the active centre panel. */
export interface DiscussionView {
  readonly title?: string
  readonly visible: boolean
  readonly expanded: boolean
  readonly loading: boolean
  readonly reference?: SessionReference
  readonly origin?: ResearchOrigin
  readonly error?: string | undefined
  readonly draft: boolean
}
/** The store holds view state only; discussion history is read through the resource owner. */
export type DiscussionViews = Readonly<Record<string, DiscussionView>>
/** Injected capabilities shared by the pane and a topic's discussion rows. */
export interface DiscussionFace {
  readonly hooks: { readonly discussionViews: ObservableSnapshot<DiscussionViews> }
  readonly selectDiscussion: (scope: ResearchDiscussionScope, sessionId: SessionId) => Promise<void>
  readonly openDiscussion: (scope: ResearchDiscussionScope) => Promise<void>
  readonly newDiscussion: (scope: ResearchDiscussionScope) => Promise<void>
  readonly renameDiscussion: (scope: ResearchDiscussionScope, sessionId: SessionId, title: string) => Promise<void>
  readonly collapseDiscussion: (scope: ResearchDiscussionScope) => void
  readonly expandDiscussion: (scope: ResearchDiscussionScope) => void
  readonly clearDiscussionSource: (scope: ResearchDiscussionScope) => void
  readonly mountDiscussion: (scope: ResearchDiscussionScope, open?: DiscussionResourceNavigation, returnTo?: () => void) => () => void
}
interface OwnedDiscussion {
  readonly scope: ResearchDiscussionScope
  readonly reference: SessionReference
  origin: ResearchOrigin
  draft: boolean
  readonly release: () => void
}
const EMPTY: DiscussionView = { visible: false, expanded: false, loading: false, draft: false }

/** @param scope - scientific reading location. @returns collision-free scope identity. */
export function discussionScopeKey(scope: ResearchDiscussionScope): string {
  return JSON.stringify([scope.workspaceId, scope.topicId ?? null])
}
/** @param views - owned snapshots. @param scope - scientific location. @returns stable absent or current selection. */
export function discussionView(views: DiscussionViews, scope: ResearchDiscussionScope): DiscussionView {
  return views[discussionScopeKey(scope)] ?? EMPTY
}
function sourceFor(scope: ResearchDiscussionScope, source?: ResearchOrigin): ResearchOrigin {
  const { workspaceId: _workspace, topicId: _topic, scope: _global, studyId: _study, ...selection } = source ?? {}
  return structuredClone({ ...selection, workspaceId: scope.workspaceId,
    ...(scope.topicId === undefined ? {} : { topicId: scope.topicId }) })
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { researchDiscussion: unknown }
}

/** Holds only explicit native discussions, without creating a Session merely to browse research. */
export class ResearchDiscussionController implements ResearchDiscussions {
  readonly views = createSnapshotStore<DiscussionViews>({})
  private readonly owned = new Map<SessionId, OwnedDiscussion>()
  private readonly pending = new Map<string, Promise<void>>()
  private readonly readers = new Set<DiscussionReaderNavigation>()
  private readonly presentations = new Map<string, {
    open: DiscussionResourceNavigation | undefined
    returnTo: (() => void) | undefined
  }>()
  private study: DiscussionStudyAdmission | undefined
  private disposed = false

  constructor(private readonly ctx: Context, private readonly workspaces: ResearchWorkspaceRegistry,
    private readonly fallback: DiscussionReaderNavigation, private readonly t: TranslateNS<'aitp.research.discussion'>) {}

  private update(scope: ResearchDiscussionScope, patch: Partial<DiscussionView>): void {
    if (this.disposed) return
    const key = discussionScopeKey(scope)
    this.views.set({ ...this.views.getSnapshot(), [key]: { ...discussionView(this.views.getSnapshot(), scope),
      ...(scope.title === undefined ? {} : { title: scope.title }), ...patch } })
  }
  private selection(scope: ResearchDiscussionScope): OwnedDiscussion | undefined {
    const id = discussionView(this.views.getSnapshot(), scope).reference?.sessionId
    return id === undefined ? undefined : this.owned.get(id)
  }
  private async perform(scope: ResearchDiscussionScope, run: () => Promise<void>): Promise<void> {
    const key = discussionScopeKey(scope)
    const existing = this.pending.get(key)
    if (existing !== undefined) return existing
    this.update(scope, { visible: true, loading: true, error: undefined })
    const task = run().catch((error: unknown) => { this.update(scope, { error: error instanceof Error ? error.message : String(error) }) })
      .finally(() => { this.pending.delete(key); this.update(scope, { loading: false }) })
    this.pending.set(key, task)
    await task
  }
  async open(scope: ResearchDiscussionScope, origin?: ResearchOrigin, prompt?: string): Promise<void> {
    if (origin !== undefined) this.setSource(scope, origin)
    this.update(scope, { visible: true })
    await this.perform(scope, async () => {
      if (this.selection(scope) === undefined) {
        const listed = await this.workspaces.listDiscussions(scope.workspaceId,
          scope.topicId === undefined ? {} : { topicId: scope.topicId })
        if (!listed.ok) throw new Error(listed.error.message)
        const id = listed.value.items[0]?.sessionId
        await this.adopt(scope, id ?? await this.ctx.sessions.create({ workspaceId: scope.workspaceId }), id === undefined)
      }
      if (origin !== undefined) this.setSource(scope, origin)
      const selected = this.selection(scope)
      if (prompt !== undefined && selected !== undefined) {
        const result = this.ctx.conversation.input.requestDraftInitialization(selected.reference.binding, { prompt })
        if (result !== 'applied') this.ctx.conversation.input.for(selected.reference.binding.ctx).notify('info', this.t('draftPreserved'))
      }
    })
  }
  async newDiscussion(scope: ResearchDiscussionScope): Promise<void> {
    await this.perform(scope, async () => {
      await this.adopt(scope, await this.ctx.sessions.create({ workspaceId: scope.workspaceId }), true)
    })
  }
  async select(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void> {
    await this.perform(scope, async () => {
      const known = this.owned.get(sessionId)
      if (known === undefined) {
        const listed = await this.workspaces.listDiscussions(scope.workspaceId,
          scope.topicId === undefined ? {} : { topicId: scope.topicId })
        if (!listed.ok) throw new Error(listed.error.message)
        if (!listed.value.items.some(item => item.sessionId === sessionId)) throw new Error(this.t('changed'))
      } else if (discussionScopeKey(known.scope) !== discussionScopeKey(scope)) throw new Error(this.t('changed'))
      await this.adopt(scope, sessionId, known?.draft ?? false)
    })
  }
  async showSession(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void> { await this.select(scope, sessionId) }
  /** Rename the retained native Session; its title projection and the authoritative discussion list own the result. */
  async renameDiscussion(scope: ResearchDiscussionScope, sessionId: SessionId, title: string): Promise<void> {
    const owned = this.owned.get(sessionId)
    if (this.disposed || owned === undefined || discussionScopeKey(owned.scope) !== discussionScopeKey(scope)) {
      throw new Error(this.t('changed'))
    }
    const result = await owned.reference.binding.session.rename(title)
    if (!result.ok) throw new Error(result.error.message)
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- unload may change this field while native rename awaits its reply.
    if (!this.disposed) this.workspaces.retry(scope.workspaceId)
  }
  private async adopt(scope: ResearchDiscussionScope, sessionId: SessionId, draft: boolean): Promise<void> {
    if (this.disposed) return
    let owned = this.owned.get(sessionId)
    if (owned === undefined) {
      const reference = this.ctx.sessions.retain(sessionId, { source: 'researchDiscussion' })
      const previous = discussionView(this.views.getSnapshot(), scope)
      const initial = draft || previous.reference === undefined ? previous.origin : undefined
      const releaseSubmission = this.ctx.conversation.submissions.register(sessionId, () => this.capture(sessionId))
      const releaseNavigation = this.ctx.uiChatNavigation.register(sessionId, (address, params) => {
        const view = discussionView(this.views.getSnapshot(), scope)
        if (!this.presentations.has(discussionScopeKey(scope)) || !view.visible || view.reference?.sessionId !== sessionId) return false
        void this.navigate(scope, address, params)
        return true
      })
      owned = { scope: { ...scope }, reference, origin: sourceFor(scope, initial), draft,
        release: () => { releaseSubmission(); releaseNavigation(); reference.release() } }
      this.owned.set(sessionId, owned)
    }
    await owned.reference.ready
    this.update(scope, { reference: owned.reference, origin: owned.origin, draft: owned.draft })
  }
  setSource(scope: ResearchDiscussionScope, origin: ResearchOrigin): void {
    const source = sourceFor(scope, origin)
    const selected = this.selection(scope)
    if (selected !== undefined) selected.origin = source
    this.update(scope, { origin: source })
  }
  collapse(scope: ResearchDiscussionScope): void { this.update(scope, { visible: false, expanded: false }) }
  suspend(scope: ResearchDiscussionScope): () => void {
    const previous = discussionView(this.views.getSnapshot(), scope)
    this.collapse(scope)
    return () => { if (previous.visible) this.update(scope, { visible: true, expanded: previous.expanded }) }
  }
  expand(scope: ResearchDiscussionScope): void {
    this.update(scope, { expanded: !discussionView(this.views.getSnapshot(), scope).expanded })
  }
  mount(scope: ResearchDiscussionScope, open?: DiscussionResourceNavigation, returnTo?: () => void): () => void {
    const key = discussionScopeKey(scope)
    if (scope.title !== undefined && discussionView(this.views.getSnapshot(), scope).title !== scope.title) {
      this.update(scope, { title: scope.title })
    }
    const occurrence = { open, returnTo }
    this.presentations.set(key, occurrence)
    return () => { if (this.presentations.get(key) === occurrence) this.presentations.delete(key) }
  }
  registerStudySubmission(submit: DiscussionStudyAdmission): () => void {
    if (this.study !== undefined) throw new Error('A research study submission provider is already registered')
    this.study = submit
    return () => { if (this.study === submit) this.study = undefined }
  }
  registerResourceNavigation(open: DiscussionReaderNavigation): () => void {
    this.readers.add(open)
    return () => { this.readers.delete(open) }
  }
  private async navigate(scope: ResearchDiscussionScope, address: string, params?: Readonly<Record<string, unknown>>): Promise<void> {
    const occurrence = this.presentations.get(discussionScopeKey(scope))
    const title = discussionView(this.views.getSnapshot(), scope).title
    const currentScope = title === undefined ? scope : { ...scope, title }
    try {
      if (occurrence?.open?.(address, params) === true) return
      for (const reader of this.readers) if (await reader(currentScope, address, params, occurrence?.returnTo)) return
      if (await this.fallback(currentScope, address, params, occurrence?.returnTo)) return
      throw new Error(this.t('unavailable'))
    } catch (error) { this.update(scope, { error: error instanceof Error ? error.message : String(error) }) }
  }
  private capture(sessionId: SessionId): SessionPromptTransport {
    const owned = this.owned.get(sessionId)
    if (owned === undefined) throw new Error('The research discussion has been released')
    // Capture before slash-command arbitration, reference expansion, and attachment upload.
    const origin = structuredClone(owned.origin)
    const study = this.study
    return async (request, signal) => {
      try {
        const result = origin.selections?.length
          ? study === undefined
            ? { ok: false as const, error: { code: 'not-connected', message: this.t('studyUnavailable') } }
            : await study(origin, request, signal)
          : await this.workspaces.ask({
            workspaceId: owned.scope.workspaceId,
            ...(owned.scope.topicId === undefined ? {} : { topicId: owned.scope.topicId }),
            ...(origin.resourceId === undefined ? {} : { resourceId: brandString<ResourceId>(origin.resourceId) }),
            ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
            ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }),
            ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
            ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
            question: request.content.filter(part => part.type === 'text').map(part => part.text).join('\n'),
            sessionId, requestId: request.requestId, content: request.content, mode: request.mode,
          }, signal === undefined ? {} : { signal })
        if (!result.ok) return { ok: false, error: new RemoteError('gateway/bad-request', result.error.message, {}) }
        if (result.value.sessionId !== sessionId) return { ok: false, error: new RemoteError('gateway/internal', 'The question was accepted by a different discussion.', {}) }
        owned.draft = false
        if (this.selection(owned.scope) === owned) this.update(owned.scope, { draft: false })
        this.workspaces.retry(owned.scope.workspaceId)
        return { ok: true, value: { accepted: true } }
      } catch (error) {
        return { ok: false, error: new RemoteError('gateway/internal', error instanceof Error ? error.message : String(error), {}) }
      }
    }
  }
  /** Release retained generations and their submission/navigation registrations together. */
  dispose(): void {
    this.disposed = true
    for (const owned of this.owned.values()) owned.release()
    this.owned.clear(); this.readers.clear(); this.presentations.clear(); this.study = undefined
  }
}
