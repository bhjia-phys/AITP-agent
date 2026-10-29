// @vitest-environment jsdom
/**
 * Real Web roster: the Research panel, its sidebar entry and the note dock
 * tab type register beside the shipped plugins; with the labelled fixture
 * loaded, the research protocols read through the real resource service; and
 * unloading either plugin removes exactly what it added.
 */
import { act, within } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp, type TestClient } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { noteAddress, topicAddress, topicsAddress } from '../src/client/protocol.ts'
import { ResearchPanel } from '../src/client/ResearchPanel.tsx'
import { ResearchHome } from '../src/client/ResearchHome.tsx'
import { workspaceProjectAddress } from '../src/client/workspace-resources.ts'
import { apply as nodeApply } from '../src/index.ts'
import type { ResearchChangeReader } from '../src/client/research-change-model.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { createWorkflowStore } from '../src/client/workflow-store.ts'

const RESEARCH = '@deepseek-ai/dsh-client-ui-aitp-research'
const FIXTURES = '@deepseek-ai/dsh-client-ui-aitp-fixtures'
const WS = 'w1' as WorkspaceId

const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows,
  {
    name: RESEARCH,
    inject: [
      '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar-right',
      '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-chat',
    ],
    immediately: false,
  },
  { name: FIXTURES, inject: ['@deepseek-ai/dsh-client-resources'], immediately: false },
]) }, { mount: true })

/**
 * Hold one address open until its first settled frame.
 * @param client - the running client.
 * @param address - resource address.
 * @returns the settled snapshot.
 */
async function read(client: TestClient, address: string): Promise<ResourceSnapshot<unknown>> {
  const source = client.ctx.resources.source(address)
  const release = source.subscribe(() => {})
  try {
    for (let round = 0; round < 20 && source.getSnapshot().status === 'loading'; round += 1) await client.flush()
    return source.getSnapshot()
  } finally {
    release()
  }
}

async function reloadChangeReader(client: TestClient): Promise<ResearchChangeReader['read']> {
  const registrations = vi.spyOn(client.ctx.slots, 'registerFactory')
  try {
    await client.reload(RESEARCH)
    await client.flush()
    const definition = registrations.mock.calls.findLast(([options]) => options.name === 'aitp.research.change-notice')?.[0]
    if (definition?.inject === undefined) throw new Error('The change notice has no registration-owned reader.')
    // This registration's factory ignores Session arguments and supplies only its reader capability.
    const inject = definition.inject as () => { readonly latestResearchChange: ResearchChangeReader['read'] }
    return inject().latestResearchChange
  } finally {
    registrations.mockRestore()
  }
}

it('captures each Session preference and admits the default workflow only while its actual provider supports it', async ({ start }) => {
  localStorage.removeItem('aitp.research.workflow.v1')
  const client = await start()
  const release = client.ctx.reflect.provide('researchWorkflowTransport', {
    submit: () => async () => ({ ok: true, value: { accepted: true } }),
    setMode: vi.fn(async () => {}),
  })
  try {
    await client.flush()
    const entry = client.ctx.slots.entries('conversation.input.dock').find(item => item.options.id === 'aitp-research-mode')
    expect(client.ctx.slots.entries('conversation.hero.options').some(item => item.options.id === 'aitp-research-mode')).toBe(false)
    if (entry?.store === undefined || !('create' in entry.store)) throw new Error('The Research preference has no registered store')
    const store = entry.store as ReturnType<typeof createWorkflowStore>
    const choices = store.create()
    const first = 'workflow-first' as SessionId
    const second = 'workflow-second' as SessionId
    expect(client.ctx.researchDiscussions.workflowEnabled(first)).toBe(true)
    choices.actions.choose(second, false)
    expect(client.ctx.researchDiscussions.workflowEnabled(first)).toBe(true)
    expect(client.ctx.researchDiscussions.workflowEnabled(second)).toBe(false)
    expect(client.ctx.researchDiscussions.workflowEnabled()).toBe(false)
    choices.actions.choose(first, false)
    choices.actions.choose(second, true)
    expect(client.ctx.researchDiscussions.workflowEnabled(first)).toBe(false)

    const resolved = client.ctx.researchWorkspaces.resolve(WS)
    if (!resolved.ok) throw new Error('The test workspace has no provider')
    const provider = resolved.value.provider
    const workspaces = client.ctx.workspaces.list.getSnapshot()
    const workspaceSnapshot = vi.spyOn(client.ctx.workspaces.list, 'getSnapshot').mockReturnValue({ ...workspaces, items: [{
      workspaceId: WS, title: 'Actual session workspace', path: '/fixture', sessionIds: [first], createdAt: '', updatedAt: '',
    }] })
    let automaticResearch = false
    const availability = vi.spyOn(client.ctx.researchWorkspaces, 'resolve').mockImplementation(() => ({
      ok: true, value: { ...resolved.value, provider: { ...provider, capabilities: { ...provider.capabilities, automaticResearch } } },
    }))
    try {
      choices.actions.choose(first, true)
      expect(client.ctx.conversation.submissions.capture(first)).toBeUndefined()
      automaticResearch = true
      expect(client.ctx.conversation.submissions.capture(first)).toBeTypeOf('function')
      availability.mockReturnValue({ ok: false, error: { code: 'not-connected', message: 'Workspace connection pending', retryable: true } })
      const pending = client.ctx.conversation.submissions.capture(first)
      expect(pending).toBeTypeOf('function')
      expect(await pending!({ sessionId: first, requestId: 'pending-provider' as SessionRequestId,
        content: [{ type: 'text', text: 'Keep this Research question' }], mode: 'steer' })).toMatchObject({
        ok: false, error: { code: 'aitp/workspace', details: { code: 'not-connected', retryable: true } },
      })
      choices.actions.choose(first, false)
      expect(client.ctx.conversation.submissions.capture(first)).toBeUndefined()
    } finally {
      availability.mockRestore()
      workspaceSnapshot.mockRestore()
    }
  } finally {
    await release()
    localStorage.removeItem('aitp.research.workflow.v1')
  }
}, 60_000)

it('replaces change observations on real plugin reload and releases them on unload', async ({ start }) => {
  const first = await start()
  const nodes = [{ kind: 'tool-call', data: { root: {
    kind: 'tool-result', name: 'research_apply_change', seq: 1, isError: false,
    meta: { researchWrite: { operationId: 'owned-change', state: 'applied' } }, subCalls: [],
  } } }]
  const readFirst = await reloadChangeReader(first)
  const pointer = readFirst(nodes)
  expect(pointer).not.toBeNull()
  expect(readFirst(nodes)).toBe(pointer)
  const readReloaded = await reloadChangeReader(first)
  expect(readFirst(nodes)).toBeNull()
  const reloaded = readReloaded(nodes)
  expect(reloaded).toEqual(pointer)
  expect(reloaded).not.toBe(pointer)
  expect(readReloaded(nodes)).toBe(reloaded)
  await first.unload(RESEARCH)
  await first.flush()
  expect(readReloaded(nodes)).toBeNull()
}, 60_000)

it('waits for admitted discussion creation before real plugin unload completes', async ({ start }) => {
  const client = await start()
  const discussions = client.ctx.researchDiscussions
  const scope = { workspaceId: WS, topicId: 'topic' }
  const listing = Promise.withResolvers<undefined>()
  const aborted = Promise.withResolvers<undefined>()
  const creating = Promise.withResolvers<undefined>()
  const created = Promise.withResolvers<SessionId>()
  const list = vi.spyOn(client.ctx.researchWorkspaces, 'listDiscussions').mockImplementation((_workspace, _query, options) => {
    const reply = Promise.withResolvers<Awaited<ReturnType<typeof client.ctx.researchWorkspaces.listDiscussions>>>()
    options?.signal?.addEventListener('abort', () => {
      aborted.resolve(undefined)
      reply.reject(options.signal?.reason)
    }, { once: true })
    listing.resolve(undefined)
    return reply.promise
  })
  const create = vi.spyOn(client.ctx.sessions, 'create').mockImplementation(() => {
    creating.resolve(undefined)
    return created.promise
  })
  const retain = vi.spyOn(client.ctx.sessions, 'retain')
  const reading = discussions.open(scope)
  const opening = discussions.newDiscussion({ ...scope, topicId: 'other' })
  await Promise.all([listing.promise, creating.promise])
  let unloaded = false
  const removing = client.unload(RESEARCH).then(() => { unloaded = true })
  try {
    await aborted.promise
    await discussions.newDiscussion(scope)
    await client.flush()
    expect(create).toHaveBeenCalledOnce()
    expect(unloaded).toBe(false)
  } finally {
    created.resolve('admitted-before-unload' as SessionId)
    await Promise.all([reading, opening, removing])
    try {
      expect(retain.mock.calls.some(([id]) => id === 'admitted-before-unload')).toBe(false)
      expect(client.ctx.get('researchDiscussions')).toBeUndefined()
    } finally {
      list.mockRestore(); create.mockRestore(); retain.mockRestore()
    }
  }
}, 60_000)

it('adds the research home and native projects tab without a left mode switch, and releases them on unload', async ({ start }) => {
  const client = await start()
  const panelEntry = client.ctx.slots.entries('main').find(entry => entry.component === ResearchPanel)
  const store = panelEntry?.store
  if (store === undefined || !('create' in store)) throw new Error('the Research panel declares no store handle')
  // The renderer owns one root instance for the shared handle.
  expect(client.ctx.slots.entries('conversation.hero.introduction').find(item => item.component === ResearchHome)?.store).toBe(store)
  expect(client.ctx.slots.entries('sidebar.context').some(item => item.options.key === 'aitp-research')).toBe(false)
  expect(client.ctx.slots.entries('sidebar.panellist').some(item => item.options.id === 'aitp-research')).toBe(false)
  expect(client.ctx.sidebarRightTabs.get('aitp-projects')?.guide?.[0]?.title()).toBe('Research projects')
  expect(client.ctx.sidebarRightTabs.candidates('dsh-resource://aitp-workspace-setup/workspace/w1').map(tab => tab.kind)).toEqual(['aitp-projects'])
  const address = noteAddress(WS, 'spectra/research.md')
  expect(client.ctx.sidebarRightTabs.candidates(address).map(tab => tab.kind)).toEqual(['aitp-note'])
  expect(client.ctx.sidebarRightTabs.get('aitp-note')?.title(address)).toBe('research.md')
  expect(client.ctx.sidebarRightTabs.candidates('dsh-resource://aitp-topic/workspace/w1/topic/x')).toEqual([])
  expect(client.ctx.sidebarRightTabs.get('aitp-note')?.title('elsewhere')).toBe('Note')
  // Render the real main slot so its inject callback receives the framework-owned actions.
  act(() => { client.ctx.layout.selectPanel('aitp-research' as MainPanelId) })
  await client.flush()
  expect(within(client.container!).getByRole('region', { name: 'Research' })).toBeDefined()
  expect(client.ctx.researchDiscussions).toBeDefined()
  expect(client.ctx.locale.bind('aitp.research')('panel')).toBe('Research')
  await client.unload(RESEARCH)
  await client.flush()
  expect(client.ctx.slots.entries('main').filter(entry => entry.component === ResearchPanel)).toHaveLength(0)
  expect(client.ctx.slots.entries('sidebar.panellist').map(entry => entry.options.id)).not.toContain('aitp-research')
  expect(client.ctx.sidebarRightTabs.get('aitp-note')).toBeUndefined()
  expect(client.ctx.sidebarRightTabs.get('aitp-projects')).toBeUndefined()
  expect(client.ctx.slots.entries('conversation.hero.introduction').some(item => item.component === ResearchHome)).toBe(false)
  expect(client.ctx.get('researchDiscussions')).toBeUndefined()
  expect(() => { nodeApply() }).not.toThrow()
}, 60_000)

it('serves labelled fixture data and typed failures, and serves nothing once the fixture unloads', async ({ start }) => {
  const client = await start()
  expect((await read(client, workspaceProjectAddress(WS))).value).toMatchObject({
    origin: 'fixture', provider: { origin: 'fixture' }, value: { title: 'Interaction, chaos and correlation in finite systems' },
  })
  const index = await read(client, topicsAddress(WS))
  expect(index.status).toBe('live')
  expect(index.value).toMatchObject({ origin: 'fixture', root: { kind: 'note', path: 'research.md' } })
  expect((await read(client, topicAddress(WS, 'spectra'))).value).toMatchObject({ origin: 'fixture', id: 'spectra' })
  expect((await read(client, topicAddress(WS, 'absent'))).failure?.code).toBe('aitp/topic-missing')
  expect((await read(client, noteAddress(WS, 'spectra/research.md'))).value).toMatchObject({ origin: 'fixture', path: 'spectra/research.md' })
  expect((await read(client, noteAddress(WS, 'absent.md'))).failure?.code).toBe('aitp/note-missing')
  expect((await read(client, 'dsh-resource://aitp-topic/workspace/w1')).failure?.code).toBe('aitp/topic-missing')
  expect((await read(client, 'dsh-resource://aitp-note/workspace/w1')).failure?.code).toBe('aitp/note-missing')
  await client.unload(FIXTURES)
  await client.flush()
  expect((await read(client, topicsAddress('w2' as WorkspaceId))).status).toBe('none')
  expect((await read(client, workspaceProjectAddress(WS))).failure?.code).toBe('aitp/workspace')
}, 60_000)
