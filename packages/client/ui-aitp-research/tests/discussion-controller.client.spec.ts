// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { SlotTestRuntime, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
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
import { ResearchWorkspaceRegistry } from '../src/client/workspace-service.ts'
import type { ResearchDiscussionScope } from '../src/client/discussion-contract.ts'

const scope: ResearchDiscussionScope = { workspaceId: brandString<WorkspaceId>('workspace'), topicId: 'topic', title: 'Topic' }
const runtimes: SlotTestRuntime[] = []
let fixtureId = 0
type SourceRef = NonNullable<ResearchOrigin['selections']>[number]['ref']
afterEach(async () => { for (const runtime of runtimes.splice(0)) await runtime.dispose() })

/** Keep real Session generations, native draft machines and service registration in the test. */
async function setup() {
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
  const controller = new ResearchDiscussionController(runtime.ctx, registry, fallback, makeTranslate())
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
    fallback, capture, navigation, draft, runtime, conversation, rename }
}
function request(id: SessionId): SessionPromptRequest {
  return { sessionId: id, requestId: brandString<SessionRequestId>('request'), content: [{ type: 'text', text: 'Question' }], mode: 'steer' }
}

describe('reading-side discussions', () => {
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
    fixture.controller.dispose()
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
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith(scope.workspaceId, { topicId: scope.topicId })
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
    expect(study).toHaveBeenCalledWith({ workspaceId: scope.workspaceId, topicId: scope.topicId,
      selections: [{ ref: { rootId: 'root', sourceId: 'paper' }, locator: { kind: 'pdf-page', page: 8 }, selectedText: 'An explicit assumption' }] }, submitted, signal)
    expect(fixture.ask).not.toHaveBeenCalled()
  })

  it('does not reopen a pane that the researcher collapsed while the native Session was being created', async () => {
    const fixture = await setup()
    let finish: ((id: SessionId) => void) | undefined
    fixture.create.mockImplementationOnce(async () => {
      const id = await new Promise<SessionId>((resolve) => { finish = resolve })
      return fixture.runtime.sessions.add({ id, snapshot: { blank: true } })
    })
    const opening = fixture.controller.newDiscussion(scope)
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
