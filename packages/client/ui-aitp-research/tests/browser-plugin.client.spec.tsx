// @vitest-environment jsdom
/**
 * Real Web roster: the Research panel, its sidebar entry and the note dock
 * tab type register beside the shipped plugins; with the labelled fixture
 * loaded, the research protocols read through the real resource service; and
 * unloading either plugin removes exactly what it added.
 */
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp, type TestClient } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { noteAddress, topicAddress, topicsAddress } from '../src/client/protocol.ts'
import { ResearchPanel, type ResearchPanelFace } from '../src/client/ResearchPanel.tsx'
import { WorkspaceSidebar } from '../src/client/WorkspaceSidebar.tsx'
import { workspaceProjectAddress } from '../src/client/workspace-resources.ts'
import { apply as nodeApply } from '../src/index.ts'

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
    ],
    immediately: false,
  },
  { name: FIXTURES, inject: ['@deepseek-ai/dsh-client-resources'], immediately: false },
]) })

/**
 * Narrow a registration's inject face to the panel's navigation face.
 * @param face - what the entry's inject returned.
 * @returns whether it carries both navigation callbacks.
 */
function isPanelFace(face: Record<string, unknown> | undefined): face is Record<string, unknown> & ResearchPanelFace {
  return typeof face?.['openSession'] === 'function' && typeof face['startDraft'] === 'function'
}

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

it('registers the panel, its sidebar entry and the note tab type, and removes them on unload', async ({ start }) => {
  const client = await start()
  const panelEntry = client.ctx.slots.entries('main').find(entry => entry.component === ResearchPanel)
  const store = panelEntry?.store
  if (store === undefined || !('create' in store)) throw new Error('the Research panel declares no store handle')
  // The renderer owns one root instance for the shared handle.
  expect(client.ctx.slots.entries('sidebar.context').find(item => item.component === WorkspaceSidebar)?.store).toBe(store)
  const entry = client.ctx.slots.entries('sidebar.panellist').find(item => item.options.id === 'aitp-research')
  expect(resolveSlotLabel(entry?.options.label)).toBe('Research')
  const address = noteAddress(WS, 'spectra/research.md')
  expect(client.ctx.sidebarRightTabs.candidates(address).map(tab => tab.kind)).toEqual(['aitp-note'])
  expect(client.ctx.sidebarRightTabs.get('aitp-note')?.title(address)).toBe('research.md')
  expect(client.ctx.sidebarRightTabs.candidates('dsh-resource://aitp-topic/workspace/w1/topic/x')).toEqual([])
  expect(client.ctx.sidebarRightTabs.get('aitp-note')?.title('elsewhere')).toBe('Note')
  const openSession = vi.spyOn(client.ctx.uiWorkspace, 'openSession').mockImplementation(() => undefined)
  const startSession = vi.spyOn(client.ctx.uiWorkspace, 'startSession').mockImplementation(() => undefined)
  const face = client.ctx.slots.entries('main').find(item => item.component === ResearchPanel)?.inject?.()
  if (!isPanelFace(face)) throw new Error('the Research panel entry carries no navigation face')
  face.openSession('s1' as never)
  face.startDraft(WS, 'Working on @research.md: ')
  expect(openSession).toHaveBeenCalledWith('s1')
  expect(startSession).toHaveBeenCalledWith(WS, { prompt: 'Working on @research.md: ' })
  expect(client.ctx.locale.bind('aitp.research')('panel')).toBe('Research')
  await client.unload(RESEARCH)
  await client.flush()
  expect(client.ctx.slots.entries('main').filter(entry => entry.component === ResearchPanel)).toHaveLength(0)
  expect(client.ctx.slots.entries('sidebar.panellist').map(entry => entry.options.id)).not.toContain('aitp-research')
  expect(client.ctx.sidebarRightTabs.get('aitp-note')).toBeUndefined()
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
