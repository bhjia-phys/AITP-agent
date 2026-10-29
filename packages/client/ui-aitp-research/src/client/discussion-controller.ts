/** The reading workbench owns presentation; native Sessions own messages, drafts and execution. */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionReference, SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
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
  readonly native?: boolean
  readonly loading: boolean
  readonly reference?: SessionReference
  readonly origin?: ResearchOrigin
  readonly error?: string | undefined
  readonly draft: boolean
  readonly sessionIds?: readonly SessionId[]
}
/** View state and retained native identities; authoritative topic lists remain resource-owned. */
export type DiscussionViews = Readonly<Record<string, DiscussionView>>
/** Retained next-message sources, addressed by the Session that actually submits them. */
export interface DiscussionSessionView {
  readonly scope: ResearchDiscussionScope
  readonly origin: ResearchOrigin
  readonly canReturn: boolean
}
/** The controller's source choices survive switching the selected discussion within a reading scope. */
export type DiscussionSessionViews = Readonly<Record<string, DiscussionSessionView>>
/** Injected capabilities shared by the pane and a topic's discussion rows. */
export interface DiscussionFace {
  readonly hooks: {
    readonly discussionViews: ObservableSnapshot<DiscussionViews>
    readonly discussionSessions: ObservableSnapshot<DiscussionSessionViews>
  }
  readonly selectDiscussion: (scope: ResearchDiscussionScope, sessionId: SessionId) => Promise<void>
  readonly openDiscussion: (scope: ResearchDiscussionScope) => Promise<void>
  readonly newDiscussion: (scope: ResearchDiscussionScope) => Promise<void>
  readonly renameDiscussion: (scope: ResearchDiscussionScope, sessionId: SessionId, title: string) => Promise<void>
  readonly collapseDiscussion: (scope: ResearchDiscussionScope) => void
  readonly expandDiscussion: (scope: ResearchDiscussionScope) => void
  readonly clearDiscussionSource: (scope: ResearchDiscussionScope) => void
  readonly clearSessionSource: (sessionId: SessionId) => void
  readonly openFullDiscussion: (scope: ResearchDiscussionScope, restore?: () => void) => void
  readonly returnToReading: (scope: ResearchDiscussionScope) => void
  readonly returnSessionToReading: (sessionId: SessionId) => Promise<void>
  readonly mountDiscussion: (scope: ResearchDiscussionScope, open?: DiscussionResourceNavigation, returnTo?: () => void) => () => void
}
interface OwnedDiscussion {
  readonly scope: ResearchDiscussionScope
  readonly reference: SessionReference
  draft: boolean
  readonly release: () => void
}
const EMPTY: DiscussionView = { visible: false, expanded: false, loading: false, draft: false }

/**
 * Identify a discussion scope independently of its presentation title.
 * @param scope - scientific reading location.
 * @returns collision-free scope identity.
 */
export function discussionScopeKey(scope: ResearchDiscussionScope): string {
  return JSON.stringify([scope.workspaceId, scope.topicId ?? null])
}
/**
 * Read the retained presentation state for one discussion scope.
 * @param views - owned snapshots.
 * @param scope - scientific location.
 * @returns stable absent or current selection.
 */
export function discussionView(views: DiscussionViews, scope: ResearchDiscussionScope): DiscussionView {
  return views[discussionScopeKey(scope)] ?? EMPTY
}
function sourceFor(scope: ResearchDiscussionScope, source?: ResearchOrigin): ResearchOrigin {
  const { workspaceId: _workspace, topicId: _topic, scope: _global, studyId: _study, ...selection } = source ?? {}
  return structuredClone({ ...selection, ...(scope.workspaceId === undefined ? { scope: 'global' as const }
    : { workspaceId: scope.workspaceId, ...(scope.topicId === undefined ? {} : { topicId: scope.topicId }) }) })
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { researchDiscussion: unknown }
}

/** Holds only explicit native discussions, without creating a Session merely to browse research. */
export class ResearchDiscussionController implements ResearchDiscussions {
  /** Retained discussion presentation state keyed by scientific scope. */
  readonly views = createSnapshotStore<DiscussionViews>({})
  /** One source-choice owner for both native and reading-side submission and display. */
  readonly sessionViews = createSnapshotStore<DiscussionSessionViews>({})
  private readonly owned = new Map<SessionId, OwnedDiscussion>()
  private readonly pending = new Map<string, Promise<void>>()
  private readonly readers = new Set<DiscussionReaderNavigation>()
  private readonly presentations = new Map<string, {
    open: DiscussionResourceNavigation | undefined
    returnTo: (() => void) | undefined
  }>()
  private study: DiscussionStudyAdmission | undefined
  private readonly lifetime = new AbortController()
  private disposal: Promise<void> | undefined

  private get disposed(): boolean { return this.lifetime.signal.aborted }

  constructor(private readonly ctx: Context, private readonly workspaces: ResearchWorkspaceRegistry,
    private readonly fallback: DiscussionReaderNavigation, private readonly t: TranslateNS<'aitp.research.discussion'>, readonly workflowEnabled: (sessionId?: SessionId) => boolean = () => false) {}

  private update(scope: ResearchDiscussionScope, patch: Partial<DiscussionView>): void {
    if (this.disposed) return
    const key = discussionScopeKey(scope)
    this.views.set({ ...this.views.getSnapshot(), [key]: { ...discussionView(this.views.getSnapshot(), scope),
      ...(scope.title === undefined ? {} : { title: scope.title }), ...patch } })
  }
  private readonly returnPanels = new Map<SessionId, { panel: MainPanelId | null; restore?: (() => void) | undefined }>()
  private selection(scope: ResearchDiscussionScope): OwnedDiscussion | undefined {
    const id = discussionView(this.views.getSnapshot(), scope).reference?.sessionId
    return id === undefined ? undefined : this.owned.get(id)
  }
  private async perform(scope: ResearchDiscussionScope, run: () => Promise<void>): Promise<void> {
    if (this.disposed) return
    const panel = this.ctx.get('layout')?.panelInfo.getSnapshot().activePanelId
    const roots = this.ctx.get('sidebarRightRoots')
    if (panel !== undefined && panel !== null && roots !== undefined) {
      const view = roots.views.getSnapshot()[panel]
      if (view?.expanded && view.activeAddress?.startsWith('dsh-resource://aitp-workspace-setup/') === true) roots.toggleExpanded(panel)
    }
    const key = discussionScopeKey(scope)
    const existing = this.pending.get(key)
    if (existing !== undefined) return existing
    this.update(scope, { visible: true, loading: true, error: undefined })
    const task = Promise.resolve().then(async () => { if (!this.disposed) await run() })
      .catch((error: unknown) => { this.update(scope, { error: error instanceof Error ? error.message : String(error) }) })
      .finally(() => { this.pending.delete(key); this.update(scope, { loading: false }) })
    this.pending.set(key, task)
    await task
  }
  async open(scope: ResearchDiscussionScope, origin?: ResearchOrigin, prompt?: string): Promise<void> {
    if (origin !== undefined) this.setSource(scope, origin)
    this.update(scope, { visible: true, native: false })
    await this.perform(scope, async () => {
      if (this.selection(scope) === undefined) {
        const listed = scope.workspaceId === undefined ? { ok: true as const, value: { items: [] } }
          : await this.workspaces.listDiscussions(scope.workspaceId,
            scope.topicId === undefined ? {} : { topicId: scope.topicId }, { signal: this.lifetime.signal })
        this.lifetime.signal.throwIfAborted()
        if (!listed.ok) throw new Error(listed.error.message)
        const id = listed.value.items[0]?.sessionId
        const sessionId = id ?? await this.ctx.sessions.create(scope.workspaceId === undefined ? {} : { workspaceId: scope.workspaceId })
        await this.adopt(scope, sessionId, id === undefined)
      }
      this.lifetime.signal.throwIfAborted()
      const selected = this.selection(scope)
      if (prompt !== undefined && selected !== undefined) {
        const result = this.ctx.conversation.input.requestDraftInitialization(selected.reference.binding, { prompt })
        if (result !== 'applied') this.ctx.conversation.input.for(selected.reference.binding.ctx).notify('info', this.t('draftPreserved'))
      }
    })
  }
  /**
   * Move the retained Session into the normal Conversation without replacing its composer or source transport.
   * @param scope - the discussion currently displayed beside a reading surface.
   * @param restore - optional reading-owner callback captured before expanding the conversation.
   */
  openFullDiscussion(scope: ResearchDiscussionScope, restore?: () => void): void {
    const selected = this.selection(scope)
    if (selected === undefined) return
    this.returnPanels.set(selected.reference.sessionId, { panel: this.ctx.layout.panelInfo.getSnapshot().activePanelId, restore })
    this.setSessionSource(selected, this.sourceOf(selected))
    this.update(scope, { native: true })
    this.ctx.uiWorkspace.openSession(selected.reference.sessionId)
  }
  /**
   * Return the native Session to its retained reading presentation.
   * @param scope - the same Session's reading scope, whose page state stays with its owner.
   */
  returnToReading(scope: ResearchDiscussionScope): void {
    const selected = this.selection(scope)
    if (selected === undefined) return
    const panel = this.returnPanels.get(selected.reference.sessionId)
    if (panel === undefined) return
    this.update(scope, { native: false })
    if (panel.restore !== undefined) panel.restore()
    else this.ctx.layout.selectPanel(panel.panel)
  }
  /**
   * Restore the captured reading destination for the actual native Session.
   * @param sessionId - retained discussion whose source is displayed beside the composer.
   * @returns completion of reselecting this discussion before restoring its reading surface.
   */
  async returnSessionToReading(sessionId: SessionId): Promise<void> {
    const owned = this.owned.get(sessionId)
    if (this.disposed || owned === undefined || !this.returnPanels.has(sessionId)) return
    await this.select(owned.scope, sessionId)
    if (this.selection(owned.scope) === owned) this.returnToReading(owned.scope)
  }
  async newDiscussion(scope: ResearchDiscussionScope): Promise<void> {
    await this.perform(scope, async () => {
      this.lifetime.signal.throwIfAborted()
      const sessionId = await this.ctx.sessions.create(scope.workspaceId === undefined ? {} : { workspaceId: scope.workspaceId })
      await this.adopt(scope, sessionId, true)
    })
  }
  async select(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void> {
    await this.perform(scope, async () => {
      const known = this.owned.get(sessionId)
      if (known === undefined) {
        if (scope.workspaceId === undefined) throw new Error(this.t('changed'))
        const listed = await this.workspaces.listDiscussions(scope.workspaceId,
          scope.topicId === undefined ? {} : { topicId: scope.topicId }, { signal: this.lifetime.signal })
        this.lifetime.signal.throwIfAborted()
        if (!listed.ok) throw new Error(listed.error.message)
        if (!listed.value.items.some(item => item.sessionId === sessionId)) throw new Error(this.t('changed'))
      } else if (discussionScopeKey(known.scope) !== discussionScopeKey(scope)) throw new Error(this.t('changed'))
      await this.adopt(scope, sessionId, known?.draft ?? false)
    })
  }
  async showSession(scope: ResearchDiscussionScope, sessionId: SessionId): Promise<void> { await this.select(scope, sessionId) }
  /**
   * Rename the retained native Session and refresh the authoritative discussion list.
   * @param scope - scientific scope owning the retained discussion.
   * @param sessionId - retained native Session to rename.
   * @param title - requested discussion title.
   * @returns completion of the rename and refresh request.
   */
  async renameDiscussion(scope: ResearchDiscussionScope, sessionId: SessionId, title: string): Promise<void> {
    const owned = this.owned.get(sessionId)
    if (this.disposed || owned === undefined || discussionScopeKey(owned.scope) !== discussionScopeKey(scope)) {
      throw new Error(this.t('changed'))
    }
    const result = await owned.reference.binding.session.rename(title)
    if (!result.ok) throw new Error(result.error.message)
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- unload may change this field while native rename awaits its reply.
    if (!this.disposed && scope.workspaceId !== undefined) this.workspaces.retry(scope.workspaceId)
  }
  private async adopt(scope: ResearchDiscussionScope, sessionId: SessionId, draft: boolean): Promise<void> {
    if (this.disposed) return
    const previous = discussionView(this.views.getSnapshot(), scope)
    let owned = this.owned.get(sessionId)
    if (owned === undefined) {
      // A later draft may change the new-Session default before this reader sends its first message.
      this.workflowEnabled(sessionId)
      const reference = this.ctx.sessions.retain(sessionId, { source: 'researchDiscussion', signal: this.lifetime.signal })
      const initial = draft || previous.reference === undefined ? previous.origin : undefined
      const releaseSubmission = this.ctx.conversation.submissions.register(sessionId, () => this.capture(sessionId))
      const releaseNavigation = this.ctx.uiChatNavigation.register(sessionId, (address, params) => {
        const view = discussionView(this.views.getSnapshot(), scope)
        if ((!this.presentations.has(discussionScopeKey(scope)) && view.native !== true)
          || !view.visible || view.reference?.sessionId !== sessionId) return false
        void this.navigate(scope, address, params)
        return true
      })
      owned = { scope: { ...scope }, reference, draft,
        release: () => { releaseSubmission(); releaseNavigation(); reference.release() } }
      this.owned.set(sessionId, owned)
      this.setSessionSource(owned, sourceFor(scope, initial))
    }
    await owned.reference.ready
    this.lifetime.signal.throwIfAborted()
    const latest = discussionView(this.views.getSnapshot(), scope).origin
    // Source choices made while loading win; otherwise each Session retains its own source.
    if (latest !== previous.origin) this.setSessionSource(owned, sourceFor(scope, latest))
    this.update(scope, { reference: owned.reference, origin: this.sourceOf(owned), draft: owned.draft,
      sessionIds: [...this.owned.entries()]
        .filter(([, item]) => discussionScopeKey(item.scope) === discussionScopeKey(scope)).map(([id]) => id) })
  }
  setSource(scope: ResearchDiscussionScope, origin: ResearchOrigin): void {
    if (this.disposed) return
    const source = sourceFor(scope, origin)
    const selected = this.selection(scope)
    if (selected !== undefined) this.setSessionSource(selected, source)
    this.update(scope, { origin: source })
  }
  /**
   * Clear only the displayed Session's prepared sources, without selecting another discussion.
   * @param sessionId - retained native Session whose next message should use its question scope alone.
   */
  clearSessionSource(sessionId: SessionId): void {
    const owned = this.owned.get(sessionId)
    if (this.disposed || owned === undefined) return
    const origin = sourceFor(owned.scope)
    this.setSessionSource(owned, origin)
    if (this.selection(owned.scope) === owned) this.update(owned.scope, { origin })
  }
  private sourceOf(owned: OwnedDiscussion): ResearchOrigin {
    const source = this.sessionViews.getSnapshot()[owned.reference.sessionId]
    if (source === undefined) throw new Error('The retained research discussion has no source choice')
    return source.origin
  }
  private setSessionSource(owned: OwnedDiscussion, origin: ResearchOrigin): void {
    const id = owned.reference.sessionId
    this.sessionViews.set({ ...this.sessionViews.getSnapshot(), [id]: {
      scope: owned.scope, origin, canReturn: this.returnPanels.has(id),
    } })
  }
  /**
   * Follow ordinary reading navigation while preserving an explicitly selected bundle or passage.
   * @param scope - destination reading's scientific scope.
   * @param origin - current reading source used only when no explicit selection takes precedence.
   */
  setReadingSource(scope: ResearchDiscussionScope, origin: ResearchOrigin): void {
    const current = discussionView(this.views.getSnapshot(), scope).origin
    if (current?.selections !== undefined || current?.selectedText !== undefined
      || current?.selectedRange !== undefined || current?.anchor !== undefined) return
    this.setSource(scope, origin)
  }
  collapse(scope: ResearchDiscussionScope): void { this.update(scope, { visible: false, expanded: false }) }
  suspend(scope: ResearchDiscussionScope): () => void {
    const previous = discussionView(this.views.getSnapshot(), scope)
    this.collapse(scope)
    return () => { if (previous.visible) this.update(scope, { visible: true, expanded: previous.expanded }) }
  }
  /**
   * Toggle the selected discussion's expanded presentation.
   * @param scope - scientific scope whose presentation should change.
   */
  expand(scope: ResearchDiscussionScope): void {
    this.update(scope, { expanded: !discussionView(this.views.getSnapshot(), scope).expanded })
  }
  /**
   * Bind the mounted discussion presentation's navigation and return destination.
   * @param scope - scientific scope displayed by this presentation.
   * @param open - optional presentation-owned source navigation.
   * @param returnTo - optional action returning to the surrounding reading surface.
   * @returns a callback releasing this presentation if it is still current.
   */
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
    const origin = structuredClone({ ...this.sourceOf(owned), workflow: this.workflowEnabled(sessionId) ? 'research' as const : 'ordinary' as const })
    const study = this.study
    return async (request, signal) => {
      try {
        const result = owned.scope.workspaceId === undefined || origin.selections?.length
          ? study === undefined
            ? { ok: false as const, error: { code: 'not-connected', message: this.t('studyUnavailable') } }
            : await study(origin, request, signal)
          : await this.workspaces.ask({
            workspaceId: owned.scope.workspaceId, workflow: origin.workflow === 'research',
            ...(owned.scope.topicId === undefined ? {} : { topicId: owned.scope.topicId }),
            ...(origin.resourceId === undefined ? {} : { resourceId: brandString<ResourceId>(origin.resourceId) }),
            ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
            ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }),
            ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
            ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
            question: request.content.filter(part => part.type === 'text').map(part => part.text).join('\n'),
            sessionId, requestId: request.requestId, content: request.content, mode: request.mode,
            ...(request.clientTimeZone === undefined ? {} : { clientTimeZone: request.clientTimeZone }),
          }, signal === undefined ? {} : { signal })
        if (!result.ok) return { ok: false, error: new RemoteError('gateway/bad-request', result.error.message, {}) }
        if (result.value.sessionId !== sessionId) return { ok: false, error: new RemoteError('gateway/internal', 'The question was accepted by a different discussion.', {}) }
        owned.draft = false
        if (this.selection(owned.scope) === owned) this.update(owned.scope, { draft: false })
        if (owned.scope.workspaceId !== undefined) this.workspaces.retry(owned.scope.workspaceId)
        return { ok: true, value: { accepted: true } }
      } catch (error) {
        return { ok: false, error: new RemoteError('gateway/internal', error instanceof Error ? error.message : String(error), {}) }
      }
    }
  }
  /**
   * Close admission, cancel reads and drain admitted openings before releasing retained generations.
   * Native Session creation already sent to the Host is awaited, not rolled back.
   * @returns completion of pending openings and release of their submission/navigation registrations.
   */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.disposal = Promise.allSettled(this.pending.values()).then(() => {
      for (const owned of this.owned.values()) owned.release()
      this.owned.clear(); this.readers.clear(); this.presentations.clear(); this.returnPanels.clear(); this.study = undefined
      this.sessionViews.set({})
    })
    this.lifetime.abort()
    return this.disposal
  }
}
