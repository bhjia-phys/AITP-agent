// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate, stubConfigForm } from '@deepseek-ai/dsh-client-test-runtime'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { ResearchPreferences } from '../src/preferences.ts'
import type {} from '../src/client/index.ts'
import { ResearchSettingsSection, type ResearchSettingsProps } from '../src/client/ResearchSettingsSection.tsx'
import { ResearchSettingsController, runningResearch } from '../src/client/research-settings-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const defaults: ResearchPreferences = { suite: 'full', literature: true, knowledge: true, code: true }
const modules = ['@deepseek-ai/dsh-research-memory', '@deepseek-ai/dsh-research-resources', '@deepseek-ai/dsh-client-ui-aitp-backend',
  '@deepseek-ai/dsh-client-ui-aitp-research', '@deepseek-ai/dsh-client-ui-aitp-materials',
  ...['literature', 'knowledge', 'code'].flatMap(name => [`@deepseek-ai/dsh-research-${name}`, `@deepseek-ai/dsh-client-ui-aitp-${name}`])]
const inventory: PluginInventorySnapshot = { entries: modules.map(moduleName => ({
  entryId: moduleName as PluginInventorySnapshot['entries'][number]['entryId'], moduleName, enabled: true, fiberPhase: 'active',
})) }

function setup(value = defaults, writable = true, list = vi.fn(async () => inventory)) {
  const host = stubConfigForm<ResearchPreferences>()
  host.publish({ status: 'ready', value, user: value, writable, revision: 4 })
  host.mutate.mockImplementation(async (ops) => {
    const saved = { ...host.scope.getSnapshot().value }
    for (const op of ops) if (op.op === 'set') Object.assign(saved, { [op.path[0]!]: op.value })
    host.publish({ value: saved as ResearchPreferences, user: saved, revision: 5 })
    return true
  })
  const controller = new ResearchSettingsController(host.scope, list, { automaticResearch: true })
  const face = controller.inject()
  // Only the shares consumed by this component; native slot wiring is covered by apply.client.spec.ts.
  const props = { ...face, close: vi.fn(), t: makeTranslate(en),
    useResearchSettings: bindSnapshotSelector(face.hooks.researchSettings) } as unknown as ResearchSettingsProps
  const view = render(<ResearchSettingsSection {...props} />)
  return { host, controller, face, view, list }
}

it('stages one complete startup choice and keeps running capabilities unchanged after saving', async () => {
  const { host, face } = setup()
  await waitFor(() => { expect(face.hooks.researchSettings.getSnapshot().running?.workbench).toBe('on') })
  fireEvent.click(screen.getByRole('radio', { name: /^Browse research/ }))
  fireEvent.click(screen.getByText(en.libraries))
  fireEvent.click(screen.getByRole('checkbox', { name: /^Literature/ }))
  expect(host.mutate).not.toHaveBeenCalled()
  expect(screen.getByText(en.unsaved)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: en.save }))
  await waitFor(() => { expect(screen.getByText(en.saved)).toBeDefined() })
  expect(host.mutate).toHaveBeenCalledExactlyOnceWith([
    { op: 'set', path: ['suite'], value: 'browse' },
    { op: 'set', path: ['literature'], value: false },
    { op: 'set', path: ['knowledge'], value: true },
    { op: 'set', path: ['code'], value: true },
  ], 4)
  expect(face.hooks.researchSettings.getSnapshot().running?.automaticResearch).toBe('on')
  expect(screen.getByText(en.restart)).toBeDefined()
  expect(screen.getByText(en.priority)).toBeDefined()
})

it('keeps library choices while Skills is selected and allows returning to the workbench', () => {
  const { host } = setup({ ...defaults, suite: 'skills', literature: false })
  expect(screen.getByText(en.returnSkills)).toBeDefined()
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /^Full research workbench/ }))
  fireEvent.click(screen.getByText(en.libraries))
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Literature/ }).checked).toBe(false)
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /^Knowledge/ }).checked).toBe(true)
  expect(host.mutate).not.toHaveBeenCalled()
})

it('allows saving the displayed defaults before any user preference has been persisted', async () => {
  const { host } = setup()
  act(() => { host.publish({ user: {} }) })
  expect(screen.getByText(en.notSaved)).toBeDefined()
  expect(screen.queryByRole('button', { name: en.discard })).toBeNull()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: en.save }))
  await waitFor(() => { expect(screen.getByText(en.saved)).toBeDefined() })
  expect(host.mutate.mock.calls[0]?.[0]).toHaveLength(4)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
})

it('preserves a failed draft and its revision until the user discards it', async () => {
  const { host, face } = setup()
  host.mutate.mockImplementation(async () => {
    host.publish({ revision: 6, value: { ...defaults, suite: 'skills' } })
    return false
  })
  fireEvent.click(screen.getByRole('radio', { name: /^Browse research/ }))
  fireEvent.click(screen.getByRole('button', { name: en.save }))
  await waitFor(() => { expect(screen.getByText(en.saveFailed)).toBeDefined() })
  expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Browse research/ }).checked).toBe(true)
  expect(screen.getByText(en.changedElsewhere)).toBeDefined()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
  expect(face.hooks.researchSettings.getSnapshot().saved).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: en.discard }))
  expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Skills/ }).checked).toBe(true)
  expect(host.mutate).toHaveBeenCalledTimes(1)
})

it('reports read-only preferences without making save or controls available', () => {
  const { host, face } = setup(defaults, false)
  expect(screen.getByText(en.readOnly)).toBeDefined()
  expect(screen.getByRole('group', { name: en.nextStart }).hasAttribute('disabled')).toBe(true)
  act(() => { face.editSuite('skills'); face.save() })
  expect(host.mutate).not.toHaveBeenCalled()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
})

it('does not mistake enabled or failed plugins for running capabilities', () => {
  const failed: PluginInventorySnapshot = { entries: inventory.entries.map(entry => entry.moduleName === '@deepseek-ai/dsh-research-literature'
    ? { ...entry, fiberPhase: 'failed' } : entry.moduleName === '@deepseek-ai/dsh-client-ui-aitp-code' ? { ...entry, enabled: false } : entry) }
  expect(runningResearch(failed, { automaticResearch: null })).toMatchObject({
    sourceAccess: 'on', workbench: 'on', literature: 'unavailable', knowledge: 'on', code: 'off', automaticResearch: 'unavailable',
  })
  expect(runningResearch({ entries: [] }, { automaticResearch: true })).toMatchObject({ workbench: 'off', automaticResearch: 'off' })
})

it('keeps settings usable when inventory fails and marks retained observations as stale', async () => {
  const list = vi.fn(async () => inventory)
  const { face } = setup(defaults, true, list)
  await waitFor(() => { expect(face.hooks.researchSettings.getSnapshot().running).toBeDefined() })
  list.mockRejectedValue(new Error('Unavailable'))
  fireEvent.click(screen.getByText(en.current))
  fireEvent.click(screen.getByRole('button', { name: en.refresh }))
  await waitFor(() => { expect(screen.getByText(en.staleInventory)).toBeDefined() })
  expect(within(screen.getByText(en.current).closest('details')!).getAllByText(en.on).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('radio', { name: /^Skills/ }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(false)
})

it('discards unsaved choices on leaving the page without writing them', () => {
  const { host, face, view } = setup()
  fireEvent.click(screen.getByRole('radio', { name: /^Skills/ }))
  view.unmount()
  expect(face.hooks.researchSettings.getSnapshot().dirty).toBe(false)
  expect(host.mutate).not.toHaveBeenCalled()
})
