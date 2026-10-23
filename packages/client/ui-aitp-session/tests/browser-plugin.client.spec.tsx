// @vitest-environment jsdom
/**
 * Real Web roster: the header action, the task card in the composer context
 * stack and the Sources & memory page register beside the shipped plugins; the
 * registration face opens the page and notes through the real dock; the
 * labelled fixture serves Session memory through the real resource service;
 * and unloading removes exactly what the plugin added.
 */
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { MemoryPage, MemoryPageTitle } from '../src/client/MemoryPage.tsx'
import { apply as nodeApply } from '../src/index.ts'
import { OriginAction } from '../src/client/OriginAction.tsx'
import { memoryAddress } from '../src/client/protocol.ts'
import { TaskCard, type MemoryActionsFace } from '../src/client/TaskCard.tsx'

const SESSION = '@deepseek-ai/dsh-client-ui-aitp-session'
const FIXTURES = '@deepseek-ai/dsh-client-ui-aitp-fixtures'
const PAGE_KEY = '@deepseek-ai/dsh-client-ui-aitp-session/memory'

const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows,
  {
    name: '@deepseek-ai/dsh-client-ui-aitp-research',
    inject: [
      '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar-right',
      '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    ],
    immediately: false,
  },
  {
    name: SESSION,
    inject: [
      '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-sidebar-right',
      '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    ],
    immediately: false,
  },
  { name: FIXTURES, inject: ['@deepseek-ai/dsh-client-resources'], immediately: false },
]) })

/**
 * Narrow a registration's inject face to the note opener.
 * @param face - what the entry's inject returned.
 * @returns whether it opens notes.
 */
function opensNotes(face: Record<string, unknown> | undefined): face is Record<string, unknown> & Pick<MemoryActionsFace, 'openNote'> {
  return typeof face?.['openNote'] === 'function'
}

/**
 * Narrow a registration's inject face to the memory actions.
 * @param face - what the entry's inject returned.
 * @returns whether it opens the page and notes.
 */
function isMemoryFace(face: Record<string, unknown> | undefined): face is Record<string, unknown> & MemoryActionsFace {
  return opensNotes(face) && typeof face['openMemory'] === 'function'
}

it('registers the header action, task card and page, opens through the dock, and removes them on unload', async ({ start }) => {
  const client = await start()
  const header = client.ctx.slots.entries('conversation.session.header.actions').find(entry => entry.component === OriginAction)
  const dock = client.ctx.slots.entries('conversation.input.dock').find(entry => entry.component === TaskCard)
  expect(header?.options).toMatchObject({ id: 'aitp-memory', order: 40 })
  expect(dock?.options).toMatchObject({ id: 'aitp-task', order: -10 })
  expect(client.ctx.slots.entries('sidebar.right.pane.tab').find(entry => entry.options.key === PAGE_KEY)?.component).toBe(MemoryPage)
  expect(client.ctx.slots.entries('sidebar.right.pane.tab.title').find(entry => entry.options.key === PAGE_KEY)?.component).toBe(MemoryPageTitle)
  expect(client.ctx.sidebarRightTabs.get('aitp-memory')?.title('')).toBe('Sources & memory')

  const openTab = vi.spyOn(client.ctx.sidebarRight, 'openTab').mockImplementation(() => undefined)
  const openResource = vi.spyOn(client.ctx.sidebarRight, 'openResource').mockImplementation(() => undefined)
  const face = header?.inject?.()
  if (!isMemoryFace(face)) throw new Error('the header action carries no memory actions')
  expect(isMemoryFace(dock?.inject?.())).toBe(true)
  face.openMemory()
  face.openNote('dsh-resource://aitp-note/workspace/w/note/research.md')
  expect(openTab).toHaveBeenCalledWith('aitp-memory')
  expect(openResource).toHaveBeenCalledWith('dsh-resource://aitp-note/workspace/w/note/research.md')
  const pageFace = client.ctx.slots.entries('sidebar.right.pane.tab').find(entry => entry.options.key === PAGE_KEY)?.inject?.()
  if (!opensNotes(pageFace)) throw new Error('the page entry carries no note opener')
  pageFace.openNote('dsh-resource://aitp-note/workspace/w/note/a.md')
  expect(openResource).toHaveBeenLastCalledWith('dsh-resource://aitp-note/workspace/w/note/a.md')

  await client.unload(SESSION)
  await client.flush()
  expect(client.ctx.slots.entries('conversation.session.header.actions').some(entry => entry.component === OriginAction)).toBe(false)
  expect(client.ctx.slots.entries('conversation.input.dock').some(entry => entry.component === TaskCard)).toBe(false)
  expect(client.ctx.slots.entries('sidebar.right.pane.tab').some(entry => entry.options.key === PAGE_KEY)).toBe(false)
  expect(client.ctx.sidebarRightTabs.get('aitp-memory')).toBeUndefined()
  expect(() => { nodeApply() }).not.toThrow()
}, 60_000)

it('serves labelled demonstration memory for a Session while the fixture is loaded', async ({ start }) => {
  const client = await start()
  const source = client.ctx.resources.source(memoryAddress('s-demo' as SessionId))
  const release = source.subscribe(() => {})
  for (let round = 0; round < 20 && source.getSnapshot().status === 'loading'; round += 1) await client.flush()
  expect(source.getSnapshot().value).toMatchObject({ origin: 'fixture', sessionId: 's-demo' })
  release()
  const malformed = client.ctx.resources.source('dsh-resource://aitp-session/session')
  const stop = malformed.subscribe(() => {})
  for (let round = 0; round < 20 && malformed.getSnapshot().status === 'loading'; round += 1) await client.flush()
  expect(malformed.getSnapshot().value).toMatchObject({ sessionId: '' })
  stop()
}, 60_000)
