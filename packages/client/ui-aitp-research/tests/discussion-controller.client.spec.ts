// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { SlotTestRuntime, makeTranslate, bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { SessionSeq, type SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionPromptRequest, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { ResearchOrigin } from '@deepseek-ai/dsh-research-memory/types'
import { ConversationController } from '../../ui-conversation/src/client/service.ts'
import { InputHub } from '../../ui-conversation/src/client/input/hub.ts'
import { ComposerBlockRegistry } from '../../ui-conversation/src/client/input/blocks.ts'
import { ChatNavigationRegistry } from '../../ui-chat/src/client/resource-navigation.ts'
import { ResearchDiscussionController, discussionView } from '../src/client/discussion-controller.ts'
import { NativeDiscussionContext } from '../src/client/NativeDiscussionContext.tsx'
import { createWorkflowStore } from '../src/client/workflow-store.ts'
import { ResearchWorkspaceRegistry } from '../src/client/workspace-service.ts'
import type { ResearchDiscussionScope } from '../src/client/discussion-contract.ts'

const scope = { workspaceId: brandString<WorkspaceId>('workspace'), topicId: 'topic', title: 'Topic' } satisfies ResearchDiscussionScope
const runtimes: SlotTestRuntime[] = []
let fixtureId = 0
type SourceRef = NonNullable<ResearchOrigin['selections']>[number]['ref']
afterEach(async () => { cleanup(); for (const runtime of runtimes.splice(0)) await runtime.dispose() })

/** Keep real Session generations, native draft machines and service registration in the test. */
async function setup(workflowEnabled?: (sessionId?: SessionId) => boolean) {
  let next = 0
  const prefix = `research-discussion-${++fixtureId}`
  const runtime = await SlotTestRuntime.create()
  runtimes.push(runtime)
  const input = new InputHub(runtime.ctx, makeTranslate())
  const conversation = new ConversationController(runtime.ctx, { input, blocks: new ComposerBlockRegistry(), maxConcurrentFileUploads: 1 })
  const navigation = new ChatNavigationRegistry()
  runtime.ctx.reflect.provide('uiChatNavigation', navigation)
  const rename = vi.fn<(id: SessionId, title: string) => ReturnType<SessionFace['rename']>>(async (_id, title) => ({
    ok: true, value: { title, seq: SessionSeq(0) },
  }))
  const create = vi.fn(async () => {
    const id = brandString<SessionId>(`${prefix}-${++next}`)
    return runtime.sessions.add({ id, snapshot: { blank: true }, session: { rename: title => rename(id, title) } })
  })
  runtime.sessions.stubCreate(create)
  class Workspaces extends ResearchWorkspaceRegistry {
    override listDiscussions = vi.fn<ResearchWorkspaceRegistry['listDiscussions']>(async () => ({
      ok: true, value: { items: [], completeness: 'complete', issues: [] },
    }))
    override ask = vi.fn<ResearchWorkspaceRegistry['ask']>(async (question) => {
      if (question.sessionId === undefined) throw new Error('Expected native Session admission')
      return { ok: true, value: { sessionId: question.sessionId } }
    })
    override retry = vi.fn<ResearchWorkspaceRegistry['retry']>()
  }
  const registry = new Workspaces(runtime.ctx)
  const fallback = vi.fn(() => false)
  const openSession = vi.fn()
  const selectPanel = vi.fn()
  runtime.ctx.provide('uiWorkspace', { openSession })
  runtime.ctx.provide('layout', {
    panelInfo: createSnapshotStore({ activePanelId: 'aitp-research' as MainPanelId }), selectPanel,
  })
  const controller = new ResearchDiscussionController(runtime.ctx, registry, fallback, makeTranslate(), workflowEnabled)
  const capture = (id: SessionId) => {
    const send = conversation.submissions.capture(id)
    if (send === undefined) throw new Error('Expected a registered research admission route')
    return send
  }
  const draft = (id: SessionId) => {
    const binding = runtime.ctx.sessions.binding(id)
    if (binding === undefined) throw new Error('Expected a retained native Session')
    return input.shellFor(binding)
  }
  return { controller, create, list: registry.listDiscussions, ask: registry.ask, retry: registry.retry,
    fallback, capture, navigation, draft, runtime, conversation, rename, openSession, selectPanel }
}
function request(id: SessionId): SessionPromptRequest {
  return { sessionId: id, requestId: brandString<SessionRequestId>('request'), content: [{ type: 'text', text: 'Question' }], mode: 'steer' }
}

describe('reading-side discussions', () => {
  it('keeps an opened reading draft’s initial Research choice before its first message', async () => {
    localStorage.removeItem('aitp.research.workflow.v1')
    const choices = createWorkflowStore().create()
    const fixture = await setup((sessionId) => {
      if (sessionId === undefined) return choices.getSnapshot().enabledByDefault
      choices.actions.capture(sessionId)
      return choices.getSnapshot().drafts[sessionId]!
    })
    try {
      await fixture.controller.open(scope)
      const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
      choices.actions.choose(brandString<SessionId>('another-new-draft'), false)
      await fixture.capture(first)(request(first))
      expect(fixture.ask).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: first, workflow: true }), {})
      await fixture.controller.newDiscussion(scope)
      const second = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
      await fixture.capture(second)(request(second))
      expect(fixture.ask.mock.calls.at(-1)?.[0].workflow).toBe(false)
    } finally {
      await fixture.controller.dispose()
      localStorage.removeItem('aitp.research.workflow.v1')
    }
  })

  it('keeps global reading independent across native presentations and immutable per-message source selection', async () => {
    const fixture = await setup()
    const global = {}
    const first = { ref: { rootId: brandString<SourceRef['rootId']>('papers'), sourceId: brandString<SourceRef['sourceId']>('paper-a') },
      locator: { kind: 'pdf-page' as const, page: 4 } }
    const second = { ref: { rootId: brandString<SourceRef['rootId']>('knowledge'), sourceId: brandString<SourceRef['sourceId']>('note-b') } }
    await fixture.controller.open(global, { workspaceId: 'unrelated', topicId: 'unrelated', selections: [first] }, 'A global physics question')
    const view = discussionView(fixture.controller.views.getSnapshot(), global)
    const id = view.reference!.sessionId
    const study = vi.fn(async () => ({ ok: true as const, value: { sessionId: id } }))
    fixture.controller.registerStudySubmission(study)
    const admitted = fixture.capture(id)
    fixture.controller.setSource(global, { selections: [second] })
    fixture.controller.openFullDiscussion(global)
    expect(fixture.openSession).toHaveBeenCalledWith(id)
    expect(fixture.draft(id).snapshot.draft).toBe('A global physics question')
    expect(await admitted(request(id))).toEqual({ ok: true, value: { accepted: true } })
    expect(study).toHaveBeenLastCalledWith({ scope: 'global', workflow: 'ordinary', selections: [first] }, request(id), undefined)
    await fixture.capture(id)(request(id))
    expect(study).toHaveBeenLastCalledWith({ scope: 'global', workflow: 'ordinary', selections: [second] }, request(id), undefined)
    fixture.controller.setSource(global, {})
    await fixture.capture(id)(request(id))
    expect(study).toHaveBeenLastCalledWith({ scope: 'global', workflow: 'ordinary' }, request(id), undefined)
    fixture.controller.returnToReading(global)
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith({})
    expect(fixture.list).not.toHaveBeenCalled()
    expect(fixture.ask).not.toHaveBeenCalled()
    expect(fixture.retry).not.toHaveBeenCalled()
    await fixture.controller.dispose()
  })

  it('moves the same scoped Session and draft into native conversation and returns without creating another Session', async () => {
    const fixture = await setup()
    fixture.controller.openFullDiscussion(scope)
    expect(fixture.openSession).not.toHaveBeenCalled()
    await fixture.controller.open(scope, { resourceId: 'paper.md' }, 'Unsent research question')
    const id = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const before = fixture.capture(id)
    fixture.controller.openFullDiscussion(scope)
    expect(fixture.openSession).toHaveBeenCalledWith(id)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).native).toBe(true)
    expect(fixture.draft(id).snapshot.draft).toBe('Unsent research question')
    fixture.controller.setSource(scope, { resourceId: 'other.md' })
    await before(request(id))
    expect(fixture.ask).toHaveBeenCalledWith(expect.objectContaining({ sessionId: id, topicId: 'topic', resourceId: 'paper.md' }), {})
    fixture.controller.returnToReading(scope)
    expect(fixture.selectPanel).toHaveBeenCalledWith('aitp-research')
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).native).toBe(false)
    expect(fixture.create).toHaveBeenCalledOnce()
    expect(fixture.draft(id).snapshot.draft).toBe('Unsent research question')
    await fixture.controller.dispose()
  })

  it('uses the captured source owner to restore the reading location after other navigation', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope)
    const restore = vi.fn()
    fixture.controller.openFullDiscussion(scope, restore)
    fixture.controller.returnToReading(scope)
    expect(restore).toHaveBeenCalledOnce()
    expect(fixture.selectPanel).not.toHaveBeenCalled()
    await fixture.controller.dispose()
  })

  it('temporarily shows a catalogue and restores the prior discussion without creating or sending a Session', async () => {
    const fixture = await setup()
    const restoreEmpty = fixture.controller.suspend(scope)
    restoreEmpty()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).visible).toBe(false)
    expect(fixture.create).not.toHaveBeenCalled()
    await fixture.controller.open(scope, undefined, 'Unsent while browsing')
    const reference = discussionView(fixture.controller.views.getSnapshot(), scope).reference!
    const restore = fixture.controller.suspend(scope)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).visible).toBe(false)
    expect(fixture.draft(reference.sessionId).snapshot.draft).toBe('Unsent while browsing')
    restore()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope)).toMatchObject({ visible: true, reference })
    expect(fixture.create).toHaveBeenCalledOnce()
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('renames the same native Session without sending its draft or changing the topic binding', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope, undefined, 'An unsent question')
    const current = discussionView(fixture.controller.views.getSnapshot(), scope)
    const id = current.reference!.sessionId
    await fixture.controller.renameDiscussion(scope, id, 'Boundary conditions')
    expect(fixture.rename).toHaveBeenCalledExactlyOnceWith(id, 'Boundary conditions')
    expect(fixture.retry).toHaveBeenCalledExactlyOnceWith(scope.workspaceId)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBe(current.reference)
    expect(fixture.draft(id).snapshot.draft).toBe('An unsent question')
    expect(fixture.ask).not.toHaveBeenCalled()
    expect(fixture.create).toHaveBeenCalledOnce()
    await expect(fixture.controller.renameDiscussion({ ...scope, topicId: 'other' }, id, 'Wrong scope')).rejects.toThrow('changed')
    fixture.rename.mockResolvedValueOnce({ ok: false, error: new RemoteError('gateway/bad-request', 'Rename was refused', {}) })
    await expect(fixture.controller.renameDiscussion(scope, id, 'Retry title')).rejects.toThrow('Rename was refused')
    expect(fixture.retry).toHaveBeenCalledOnce()
    expect(fixture.draft(id).snapshot.draft).toBe('An unsent question')
  })

  it('creates nothing while browsing, resumes the retained selection, and preserves a draft across surfaces', async () => {
    const fixture = await setup()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).visible).toBe(false)
    expect(fixture.create).not.toHaveBeenCalled()
    await fixture.controller.open(scope, undefined, 'First draft')
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference
    expect(first).toBeDefined()
    fixture.controller.collapse(scope)
    await fixture.controller.open(scope, undefined, 'Suggested replacement')
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBe(first)
    expect(fixture.create).toHaveBeenCalledTimes(1)
    expect(fixture.draft(first!.sessionId).snapshot.draft).toBe('First draft')
    expect(fixture.draft(first!.sessionId).notices.getSnapshot()).toMatchObject({ level: 'info', text: 'draftPreserved' })
    await fixture.controller.dispose()
    expect(fixture.runtime.ctx.sessions.retainInfo(first!.sessionId).getSnapshot().referenceCount).toBe(0)
    expect(fixture.conversation.submissions.capture(first!.sessionId)).toBeUndefined()
    expect(fixture.navigation.open(first!.sessionId, 'dsh-resource://source/paper')).toBe(false)
  })

  it('captures each message source before asynchronous native preparation and keeps the Session scope fixed', async () => {
    const fixture = await setup()
    await fixture.controller.newDiscussion(scope)
    const id = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const origin = { topicId: 'wrong', workspaceId: 'wrong', resourceId: 'first.md', selectedRange: { start: 0, end: 5, text: 'first' } }
    fixture.controller.setSource(scope, origin)
    const send = fixture.capture(id)
    origin.selectedRange.text = 'mutated'
    fixture.controller.setSource(scope, { resourceId: 'second.md' })
    const signal = new AbortController().signal
    expect(await send(request(id), signal)).toEqual({ ok: true, value: { accepted: true } })
    expect(fixture.ask).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace', topicId: 'topic', resourceId: 'first.md',
      selectedRange: { start: 0, end: 5, text: 'first' }, sessionId: id, mode: 'steer', requestId: 'request',
    }), { signal })
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).origin?.resourceId).toBe('second.md')
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).draft).toBe(false)
  })

  it('does not create a Session when a pending discussion list arrives after disposal', async () => {
    const fixture = await setup()
    const entered = Promise.withResolvers<undefined>()
    const reply = Promise.withResolvers<Awaited<ReturnType<ResearchWorkspaceRegistry['listDiscussions']>>>()
    fixture.list.mockImplementationOnce(() => {
      entered.resolve(undefined)
      return reply.promise
    })
    const opening = fixture.controller.open(scope, { resourceId: 'paper.md' }, 'Unsent draft')
    await entered.promise
    const closing = fixture.controller.dispose()
    reply.resolve({ ok: true, value: { items: [], completeness: 'complete', issues: [] } })
    await Promise.all([opening, closing])
    expect(fixture.create).not.toHaveBeenCalled()
    expect(fixture.ask).not.toHaveBeenCalled()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBeUndefined()
  })

  it('rejects new discussion work after disposal without creating or listing Sessions', async () => {
    const fixture = await setup()
    await fixture.controller.dispose()
    await fixture.controller.open(scope)
    await fixture.controller.newDiscussion(scope)
    await fixture.controller.select(scope, brandString<SessionId>('unopened'))
    expect(fixture.create).not.toHaveBeenCalled()
    expect(fixture.list).not.toHaveBeenCalled()
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('closes queued admission before any lookup or creation begins', async () => {
    const fixture = await setup()
    const opening = fixture.controller.open(scope)
    await Promise.all([opening, fixture.controller.dispose()])
    expect(fixture.list).not.toHaveBeenCalled()
    expect(fixture.create).not.toHaveBeenCalled()
  })

  it('aborts reads and drains an admitted create before releasing the retained Session', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope, { resourceId: 'paper.md' }, 'Keep this draft')
    const reference = discussionView(fixture.controller.views.getSnapshot(), scope).reference!
    const draft = fixture.draft(reference.sessionId)
    const creating = Promise.withResolvers<undefined>()
    const created = Promise.withResolvers<SessionId>()
    fixture.create.mockImplementationOnce(() => {
      creating.resolve(undefined)
      return created.promise
    })
    const listing = Promise.withResolvers<undefined>()
    const listed = Promise.withResolvers<Awaited<ReturnType<ResearchWorkspaceRegistry['listDiscussions']>>>()
    let signal: AbortSignal | undefined
    fixture.list.mockImplementationOnce((_workspace, _query, options) => {
      signal = options?.signal
      listing.resolve(undefined)
      return listed.promise
    })
    const opening = fixture.controller.newDiscussion(scope)
    const reading = fixture.controller.open({ ...scope, topicId: 'other' })
    await Promise.all([creating.promise, listing.promise])
    let settled = false
    let reentered: Promise<void> | undefined
    signal?.addEventListener('abort', () => { reentered = fixture.controller.dispose() }, { once: true })
    const disposal = fixture.controller.dispose()
    const closing = disposal.then(() => { settled = true })
    try {
      expect(signal?.aborted).toBe(true)
      expect(reentered).toBe(disposal)
      await fixture.controller.newDiscussion(scope)
      expect(settled).toBe(false)
      expect(fixture.runtime.ctx.sessions.retainInfo(reference.sessionId).getSnapshot().referenceCount).toBe(1)
      expect(draft.snapshot.draft).toBe('Keep this draft')
      expect(discussionView(fixture.controller.views.getSnapshot(), scope).origin?.resourceId).toBe('paper.md')
    } finally {
      listed.resolve({ ok: true, value: { items: [], completeness: 'complete', issues: [] } })
      created.resolve(brandString<SessionId>('already-admitted'))
      await Promise.all([opening, reading, closing])
    }
    expect(fixture.create).toHaveBeenCalledTimes(2)
    expect(fixture.runtime.ctx.sessions.retainInfo(reference.sessionId).getSnapshot().referenceCount).toBe(0)
    expect(fixture.runtime.ctx.sessions.retainInfo(brandString<SessionId>('already-admitted')).getSnapshot().referenceCount).toBe(0)
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('cancels its pending readiness without releasing another owner of the same Session', async () => {
    const fixture = await setup()
    const entered = Promise.withResolvers<undefined>()
    const loaded = Promise.withResolvers<undefined>()
    const id = brandString<SessionId>('pending-native-opening')
    let openingSignal: AbortSignal | undefined
    fixture.create.mockImplementationOnce(() => fixture.runtime.sessions.add({ id, snapshot: { blank: true },
      initialOpen: (signal) => {
        openingSignal = signal
        entered.resolve(undefined)
        return loaded.promise
      },
    }))
    const opening = fixture.controller.open(scope, { resourceId: 'paper.md' }, 'Do not initialize after unload')
    await entered.promise
    const survivor = fixture.runtime.ctx.sessions.retain(id, { source: 'researchDiscussion' })
    try {
      await Promise.all([opening, fixture.controller.dispose()])
      expect(fixture.runtime.ctx.sessions.retainInfo(id).getSnapshot().referenceCount).toBe(1)
      expect(openingSignal?.aborted).toBe(false)
      expect(fixture.draft(id).snapshot.draft).toBe('')
      expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBeUndefined()
      expect(fixture.ask).not.toHaveBeenCalled()
    } finally {
      loaded.resolve(undefined)
      await survivor.ready
      survivor.release()
    }
  })

  it.each([
    ['list', 'setSource'], ['list', 'open'], ['list', 'clear'],
    ['ready', 'setSource'], ['ready', 'open'], ['ready', 'clear'],
  ] as const)('keeps the latest source from %s pending through %s', async (phase, change) => {
    const fixture = await setup()
    const waiting = Promise.withResolvers<undefined>()
    const release = Promise.withResolvers<undefined>()
    if (phase === 'list') {
      fixture.list.mockImplementationOnce(async () => {
        waiting.resolve(undefined)
        await release.promise
        return { ok: true, value: { items: [], completeness: 'complete', issues: [] } }
      })
    } else {
      const retain = fixture.runtime.ctx.sessions.retain.bind(fixture.runtime.ctx.sessions)
      vi.spyOn(fixture.runtime.ctx.sessions, 'retain').mockImplementationOnce((id, options) => {
        const reference = retain(id, options)
        return {
          sessionId: reference.sessionId,
          get binding() { return reference.binding },
          ready: reference.ready.then(async (binding) => {
            waiting.resolve(undefined)
            await release.promise
            return binding
          }),
          release: () => { reference.release() },
          [Symbol.dispose]: () => { reference.release() },
        }
      })
    }
    const opening = fixture.controller.open(scope, { resourceId: 'first.md', selectedText: 'first' }, 'Retained draft')
    await waiting.promise
    expect(discussionView(fixture.controller.views.getSnapshot(), scope)).toMatchObject({ loading: true })
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBeUndefined()
    const latest: ResearchOrigin = change === 'clear' ? {} : { resourceId: 'second.md', selectedText: 'second' }
    let reopened: Promise<void> | undefined
    try {
      if (change === 'open') reopened = fixture.controller.open(scope, latest, 'Do not replace the draft')
      else fixture.controller.setSource(scope, latest)
    } finally { release.resolve(undefined) }
    await Promise.all([opening, reopened])
    const view = discussionView(fixture.controller.views.getSnapshot(), scope)
    expect(view.origin).toEqual({ ...latest, workspaceId: scope.workspaceId, topicId: scope.topicId })
    expect(view).toMatchObject({ loading: false, visible: true, draft: true })
    const id = view.reference!.sessionId
    expect(fixture.create).toHaveBeenCalledOnce()
    expect(fixture.list).toHaveBeenCalledOnce()
    const [workspace, query, options] = fixture.list.mock.calls[0]!
    expect(workspace).toBe(scope.workspaceId)
    expect(query).toEqual({ topicId: scope.topicId })
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(fixture.draft(id).snapshot.draft).toBe('Retained draft')
    expect(fixture.ask).not.toHaveBeenCalled()
    expect(await fixture.capture(id)(request(id), undefined)).toEqual({ ok: true, value: { accepted: true } })
    const submitted = fixture.ask.mock.calls[0]![0]
    expect(submitted).toMatchObject({ workspaceId: scope.workspaceId, topicId: scope.topicId, sessionId: id })
    expect(submitted.resourceId).toBe(latest.resourceId)
    expect(submitted.selectedText).toBe(latest.selectedText)
  })

  it('restores each Session source and native draft when switching without a new source selection', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope, { resourceId: 'first.md' }, 'First draft')
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    await fixture.controller.newDiscussion(scope)
    await fixture.controller.open(scope, { resourceId: 'second.md' }, 'Second draft')
    const second = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    await fixture.controller.select(scope, first)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).origin?.resourceId).toBe('first.md')
    expect(fixture.draft(first).snapshot.draft).toBe('First draft')
    await fixture.controller.select(scope, second)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).origin?.resourceId).toBe('second.md')
    expect(fixture.draft(second).snapshot.draft).toBe('Second draft')
    expect(fixture.create).toHaveBeenCalledTimes(2)
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('keeps separate Sessions for different directions and refuses a mismatched selection', async () => {
    const fixture = await setup()
    await fixture.controller.newDiscussion(scope)
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!
    const other = { ...scope, topicId: 'other' }
    await fixture.controller.newDiscussion(other)
    const second = discussionView(fixture.controller.views.getSnapshot(), other).reference!
    await fixture.controller.select(other, first.sessionId)
    expect(discussionView(fixture.controller.views.getSnapshot(), other)).toMatchObject({ reference: second, error: 'changed' })
    await fixture.controller.select(scope, first.sessionId)
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).reference).toBe(first)
  })

  it('shows and clears the actual native Session source while another discussion is selected in the same scope', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope, { resourceId: 'first.md' }, 'First draft')
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    await fixture.controller.newDiscussion(scope)
    await fixture.controller.open(scope, { resourceId: 'second.md' }, 'Second draft')
    const second = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const beforeClear = fixture.capture(first)
    render(createElement(NativeDiscussionContext, {
      sessionId: first, t: makeTranslate(),
      useDiscussionViews: bindSnapshotSelector(fixture.controller.views),
      useDiscussionSessions: bindSnapshotSelector(fixture.controller.sessionViews),
      clearSessionSource: (id) => { fixture.controller.clearSessionSource(id) },
      returnSessionToReading: id => fixture.controller.returnSessionToReading(id),
    } as ComponentProps<typeof NativeDiscussionContext>))
    expect(screen.getByText('first.md')).toBeTruthy()
    expect(screen.queryByText('second.md')).toBeNull()
    expect(screen.queryByRole('button', { name: 'backToReading' })).toBeNull()
    fireEvent.click(screen.getByText('sources'))
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    expect(screen.queryByText('first.md')).toBeNull()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope)).toMatchObject({
      reference: { sessionId: second }, origin: { resourceId: 'second.md' },
    })
    expect(fixture.controller.sessionViews.getSnapshot()[second]?.origin.resourceId).toBe('second.md')
    await beforeClear(request(first))
    expect(fixture.ask).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: first, resourceId: 'first.md' }), {})
    await fixture.capture(first)(request(first))
    expect(fixture.ask.mock.lastCall?.[0].resourceId).toBeUndefined()
    expect(fixture.draft(first).snapshot.draft).toBe('First draft')
    expect(fixture.draft(second).snapshot.draft).toBe('Second draft')
    await act(async () => { await fixture.controller.dispose() })
    expect(fixture.controller.sessionViews.getSnapshot()).toEqual({})
    expect(screen.queryByText('sources')).toBeNull()
  })

  it('returns the addressed native Session to its own captured reader after another discussion becomes selected', async () => {
    const fixture = await setup()
    await fixture.controller.open(scope, { resourceId: 'first.md' })
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const restoreFirst = vi.fn()
    fixture.controller.openFullDiscussion(scope, restoreFirst)
    await fixture.controller.newDiscussion(scope)
    fixture.controller.setSource(scope, { resourceId: 'second.md' })
    const second = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const restoreSecond = vi.fn()
    fixture.controller.openFullDiscussion(scope, restoreSecond)
    await fixture.controller.returnSessionToReading(first)
    expect(restoreFirst).toHaveBeenCalledOnce()
    expect(restoreSecond).not.toHaveBeenCalled()
    expect(discussionView(fixture.controller.views.getSnapshot(), scope)).toMatchObject({
      reference: { sessionId: first }, origin: { resourceId: 'first.md' }, native: false,
    })
    expect(fixture.controller.sessionViews.getSnapshot()[second]?.origin.resourceId).toBe('second.md')
    expect(fixture.create).toHaveBeenCalledTimes(2)
  })

  it('keeps the selected-source transport and full native content fixed for the submitted question', async () => {
    const fixture = await setup()
    await fixture.controller.newDiscussion(scope)
    const id = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const study = vi.fn(async () => ({ ok: true as const, value: { sessionId: id } }))
    fixture.controller.registerStudySubmission(study)
    fixture.controller.setSource(scope, { selections: [{ ref: { rootId: brandString<SourceRef['rootId']>('root'), sourceId: brandString<SourceRef['sourceId']>('paper') },
      locator: { kind: 'pdf-page', page: 8 }, selectedText: 'An explicit assumption' }] })
    const send = fixture.capture(id)
    fixture.controller.setSource(scope, {})
    const signal = new AbortController().signal
    const submitted = request(id)
    expect(await send(submitted, signal)).toEqual({ ok: true, value: { accepted: true } })
    expect(study).toHaveBeenCalledWith({ workspaceId: scope.workspaceId, topicId: scope.topicId, workflow: 'ordinary',
      selections: [{ ref: { rootId: 'root', sourceId: 'paper' }, locator: { kind: 'pdf-page', page: 8 }, selectedText: 'An explicit assumption' }] }, submitted, signal)
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('uses a loaded replacement source set for the next native message without opening another discussion', async () => {
    const fixture = await setup()
    const first = { ref: { rootId: brandString<SourceRef['rootId']>('root-a'), sourceId: brandString<SourceRef['sourceId']>('paper-a') } }
    const second = { ref: { rootId: brandString<SourceRef['rootId']>('root-b'), sourceId: brandString<SourceRef['sourceId']>('paper-b') },
      locator: { kind: 'pdf-page' as const, page: 7 }, selectedText: 'Loaded collection B' }
    await fixture.controller.open(scope, { selections: [first] })
    const id = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const study = vi.fn(async () => ({ ok: true as const, value: { sessionId: id } }))
    fixture.controller.registerStudySubmission(study)
    fixture.controller.setSource(scope, { ...scope, selections: [second] })
    expect(study).not.toHaveBeenCalled()
    const submitted = request(id)
    const signal = new AbortController().signal
    expect(await fixture.capture(id)(submitted, signal)).toEqual({ ok: true, value: { accepted: true } })
    expect(study).toHaveBeenCalledExactlyOnceWith({ ...scope, workflow: 'ordinary', selections: [second] }, submitted, signal)
    expect(fixture.create).toHaveBeenCalledOnce()
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('does not reopen a pane that the researcher collapsed while the native Session was being created', async () => {
    const fixture = await setup()
    const creating = Promise.withResolvers<undefined>()
    let finish: ((id: SessionId) => void) | undefined
    fixture.create.mockImplementationOnce(async () => {
      creating.resolve(undefined)
      const id = await new Promise<SessionId>((resolve) => { finish = resolve })
      return fixture.runtime.sessions.add({ id, snapshot: { blank: true } })
    })
    const opening = fixture.controller.newDiscussion(scope)
    await creating.promise
    expect(discussionView(fixture.controller.views.getSnapshot(), scope).loading).toBe(true)
    fixture.controller.collapse(scope)
    finish?.(brandString<SessionId>('late-session'))
    await opening
    expect(discussionView(fixture.controller.views.getSnapshot(), scope)).toMatchObject({ visible: false, loading: false })
  })

  it('passes the reading return action to source readers and reports asynchronous failures in the pane', async () => {
    const fixture = await setup()
    await fixture.controller.newDiscussion(scope)
    const id = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const returnTo = vi.fn()
    const occurrence = vi.fn(() => false)
    const reader = vi.fn(async () => { throw new Error('Source is no longer available') })
    const canonicalScope = { ...scope, title: 'The current authoritative topic title' }
    fixture.controller.mount(canonicalScope, occurrence, returnTo)
    fixture.controller.registerResourceNavigation(reader)
    expect(fixture.navigation.open(id, 'dsh-resource://source/paper', { page: 3 })).toBe(true)
    await vi.waitFor(() => {
      expect(discussionView(fixture.controller.views.getSnapshot(), scope).error).toBe('Source is no longer available')
    })
    expect(occurrence).toHaveBeenCalledWith('dsh-resource://source/paper', { page: 3 })
    expect(reader).toHaveBeenCalledWith(canonicalScope, 'dsh-resource://source/paper', { page: 3 }, returnTo)
    expect(fixture.fallback).not.toHaveBeenCalled()
  })

  it('leaves native full-page navigation in control unless the exact discussion is visible in a mounted workbench', async () => {
    const fixture = await setup()
    await fixture.controller.newDiscussion(scope)
    const first = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    const address = 'dsh-resource://source/paper'
    expect(fixture.navigation.open(first, address)).toBe(false)
    const open = vi.fn(() => true)
    const unmount = fixture.controller.mount(scope, open)
    expect(fixture.navigation.open(first, address)).toBe(true)
    expect(open).toHaveBeenCalledExactlyOnceWith(address, undefined)

    fixture.controller.collapse(scope)
    expect(fixture.navigation.open(first, address)).toBe(false)
    expect(open).toHaveBeenCalledOnce()
    await fixture.controller.open(scope)
    expect(fixture.navigation.open(first, address)).toBe(true)

    await fixture.controller.newDiscussion(scope)
    const second = discussionView(fixture.controller.views.getSnapshot(), scope).reference!.sessionId
    expect(fixture.navigation.open(first, address)).toBe(false)
    expect(fixture.navigation.open(second, address)).toBe(true)
    unmount()
    expect(fixture.navigation.open(second, address)).toBe(false)
    expect(fixture.navigation.open(first, address)).toBe(false)
    expect(fixture.fallback).not.toHaveBeenCalled()
  })
})
