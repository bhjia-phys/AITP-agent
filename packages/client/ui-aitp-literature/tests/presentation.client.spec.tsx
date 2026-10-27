// @vitest-environment jsdom
import type {} from '../src/client/index.ts'
import { fireEvent, screen, within } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { MaterialHeaderInput, MaterialsCatalogInput } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { LiteratureCatalog } from '../src/client/LiteratureCatalog.tsx'
import { LiteratureHeader } from '../src/client/LiteratureHeader.tsx'
import { en } from '../src/client/locales.ts'

const t = makeTranslate(en)
type Source = MaterialsCatalogInput['items'][number]
const paper: Source = {
  id: brandString<Source['id']>('paper'), ref: {
    rootId: brandString<Source['ref']['rootId']>('papers'), sourceId: brandString<Source['ref']['sourceId']>('source:paper.md'),
  },
  domain: 'literature', kind: 'literature', providerId: 'literature', title: 'A long paper title with a precise normalization convention',
  metadata: { authors: 'A. Researcher; B. Researcher', year: '2024', recordKind: 'source-reading', reading_depth: 'Sections 1–2 only' }, links: [], topics: [],
}
const input = (items: readonly Source[] = [paper]): MaterialsCatalogInput => ({ domain: 'literature', items, roots: [], rootId: null, folderPath: '', query: '',
  selected: [], isSelected: () => false, disabled: false, onOpen: vi.fn(), onSelect: vi.fn(), onRoot: vi.fn(), onFolder: vi.fn() })

async function setup() {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {}, bind: () => t })
  await runtime.declare({
    'aitp.materials.catalog.body': { kind: 'keyed', scope: 'root' },
    'aitp.materials.reader.header': { kind: 'keyed', scope: 'root' },
  })
  runtime.slots.register({ name: 'aitp.materials.catalog.body', key: 'literature', locale: 'aitp.materials.literature' }, LiteratureCatalog)
  runtime.slots.register({ name: 'aitp.materials.reader.header', key: 'literature', locale: 'aitp.materials.literature' }, LiteratureHeader)
  return runtime
}

it('shows recorded bibliography and coverage, with whole-source and exact-passage selection kept distinct', async () => {
  const runtime = await setup()
  const owner = input()
  const located: Source = { ...paper, id: brandString<Source['id']>('located'), title: 'The exact equation',
    locator: { kind: 'anchor', anchor: 'normalization' } }
  runtime.renderSlot('aitp.materials.catalog.body', { ...owner, items: [paper, located],
    selected: [{ ref: paper.ref, ...located.locator === undefined ? {} : { locator: located.locator } }],
    isSelected: resource => resource === located }, { entryKey: 'literature' })
  const table = screen.getByRole('table')
  expect(within(table).getAllByText('A. Researcher; B. Researcher')).toHaveLength(2)
  expect(within(table).getAllByText('Sections 1–2 only')).toHaveLength(2)
  const whole = screen.getByRole('checkbox', { name: `Use “${paper.title}” for this question` })
  expect(whole).toHaveProperty('checked', false)
  expect(screen.getByRole('checkbox', { name: 'Use “The exact equation” for this question' })).toHaveProperty('checked', true)
  fireEvent.click(whole)
  expect(owner.onSelect).toHaveBeenCalledWith(paper, true)
  fireEvent.click(screen.getByRole('button', { name: located.title }))
  expect(owner.onOpen).toHaveBeenCalledExactlyOnceWith({ ref: paper.ref, locator: located.locator })
})

it('does not invent missing authors, publication year or reading state, and disables only selection when locked', async () => {
  const runtime = await setup()
  const unknown = { ...paper, metadata: { format: 'pdf' } }
  const owner = input([unknown])
  runtime.renderSlot('aitp.materials.catalog.body', { ...owner, disabled: true }, { entryKey: 'literature' })
  expect(screen.getAllByText('Not recorded')).toHaveLength(3)
  expect(screen.getByText('PDF')).toBeDefined()
  expect(screen.queryByText('Unread')).toBeNull()
  expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: paper.title }))
  expect(owner.onOpen).toHaveBeenCalledWith({ ref: paper.ref })
})

it('keeps bibliography and identifiers in the article header without certifying an unknown edition', async () => {
  const runtime = await setup()
  const reading: MaterialHeaderInput['reading'] = { resource: { ...paper, metadata: { ...paper.metadata, edition: 'unknown', doi: '10.0000/example', arxiv: '2401.00001' } },
    body: { kind: 'text', format: 'markdown', text: '# Paper' }, observedAt: 'now', issues: [] }
  const view = runtime.renderSlot('aitp.materials.reader.header', { reading, fields: [] }, { entryKey: 'literature' })
  expect(screen.getByRole('heading', { name: paper.title })).toBeDefined()
  expect(screen.getByText('A. Researcher; B. Researcher · 2024')).toBeDefined()
  expect(screen.getByText('Not recorded')).toBeDefined()
  expect(screen.getByText('10.0000/example')).toBeDefined()
  view.update({ reading: { ...reading, resource: { ...paper, metadata: {} } }, fields: [] })
  expect(screen.getByText('Author and publication year are not recorded')).toBeDefined()
  expect(screen.queryByText('Reading coverage')).toBeNull()
})
