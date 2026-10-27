// @vitest-environment jsdom
import type {} from '../src/client/index.ts'
import { fireEvent, screen, within } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { MaterialBodyInput, MaterialHeaderInput, MaterialsCatalogInput } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { KnowledgeCatalog } from '../src/client/KnowledgeCatalog.tsx'
import { KnowledgeHeader } from '../src/client/KnowledgeHeader.tsx'
import { KnowledgeBody } from '../src/client/KnowledgeBody.tsx'
import { knowledgeKind } from '../src/client/presentation.ts'
import { en } from '../src/client/locales.ts'

const t = makeTranslate(en)
type Source = MaterialsCatalogInput['items'][number]
const atom: Source = {
  id: brandString<Source['id']>('atom'), ref: {
    rootId: brandString<Source['ref']['rootId']>('knowledge'), sourceId: brandString<Source['ref']['sourceId']>('source:boundary.md'),
  },
  domain: 'knowledge', kind: 'knowledge', providerId: 'knowledge', title: 'Why does this boundary need a matched control?',
  description: 'Conditions under which the calculation applies', metadata: { entryKind: 'atom', support: 'derived under the stated assumptions', review: 'awaiting researcher review', area: 'Boundaries' }, links: [], topics: [],
}
const input = (items: readonly Source[] = [atom]): MaterialsCatalogInput => ({ domain: 'knowledge', items, roots: [], rootId: null, folderPath: '', query: '',
  selected: [], isSelected: () => false, disabled: false, onOpen: vi.fn(), onSelect: vi.fn(), onRoot: vi.fn(), onFolder: vi.fn() })
const reading = (text: string): MaterialHeaderInput['reading'] => ({ resource: atom, body: { kind: 'text', format: 'markdown', text }, observedAt: 'now', issues: [] })
const bodyProps = (text: string): MaterialBodyInput => ({ reading: reading(text), text, raw: false,
  onLink: vi.fn(() => true), onNavigate: vi.fn() })

type MarkdownProps = FactoryComponentPropsOf<'aitp.materials.markdown'>

async function setup(observeMarkdown: (props: MarkdownProps) => void = () => {}) {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {}, bind: () => t })
  await runtime.declare({
    'aitp.materials.catalog.body': { kind: 'keyed', scope: 'root' },
    'aitp.materials.reader.header': { kind: 'keyed', scope: 'root' },
    'aitp.materials.reader.body': { kind: 'keyed', scope: 'root' },
  })
  runtime.slots.register({ name: 'aitp.materials.catalog.body', key: 'knowledge', locale: 'aitp.materials.knowledge' }, KnowledgeCatalog)
  runtime.slots.register({ name: 'aitp.materials.reader.header', key: 'knowledge', locale: 'aitp.materials.knowledge' }, KnowledgeHeader)
  runtime.slots.register({ name: 'aitp.materials.reader.body', key: 'knowledge', locale: 'aitp.materials.knowledge' }, KnowledgeBody)
  runtime.slots.registerFactory({ name: 'aitp.materials.markdown', scope: 'root', locale: 'aitp.materials' }, (props: MarkdownProps) => {
    observeMarkdown(props)
    return <MarkdownText text={props.text} labels={{ code: { copyLabel: t('copy'), copiedLabel: t('copied') }, footnotes: t('footnotes') }} />
  })
  return runtime
}

it('groups real entry kinds while keeping provisional pointers and exact source ownership distinct', async () => {
  const runtime = await setup()
  const pointer: Source = { ...atom, id: brandString<Source['id']>('pointer'), title: 'Unsettled route', metadata: { entryKind: 'provisional-pointer' },
    locator: { kind: 'anchor', anchor: 'remaining-question' } }
  const owner = input([atom, pointer])
  runtime.renderSlot('aitp.materials.catalog.body', { ...owner, selected: [{ ref: atom.ref }],
    isSelected: resource => resource === atom }, { entryKey: 'knowledge' })
  expect(screen.getByRole('heading', { name: 'Concepts and explanations 1' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Provisional research pointers 1' })).toBeDefined()
  expect(screen.getByText('awaiting researcher review')).toBeDefined()
  const selected = screen.getByRole('checkbox', { name: `Use “${atom.title}” for this question` })
  expect(selected).toHaveProperty('checked', true)
  expect(screen.getByRole('checkbox', { name: 'Use “Unsettled route” for this question' })).toHaveProperty('checked', false)
  fireEvent.click(selected)
  expect(owner.onSelect).toHaveBeenCalledWith(atom, false)
  fireEvent.click(screen.getByRole('button', { name: pointer.title }))
  expect(owner.onOpen).toHaveBeenCalledWith({ ref: pointer.ref, locator: pointer.locator })
})

it('keeps support, human review and recorded reading coverage separate in the header', async () => {
  const runtime = await setup()
  const value = reading('Argument')
  runtime.renderSlot('aitp.materials.reader.header', { reading: { ...value, resource: { ...atom,
    metadata: { ...atom.metadata, reading_depth: 'Opening only', origin: 'A live subdirection' } } }, fields: [] }, { entryKey: 'knowledge' })
  expect(screen.getByText('derived under the stated assumptions')).toBeDefined()
  expect(screen.getByText('awaiting researcher review')).toBeDefined()
  expect(screen.getByText('Opening only')).toBeDefined()
  expect(screen.getByText('A live subdirection')).toBeDefined()
  expect(screen.queryByText('Verified')).toBeNull()
})

it('builds contents from rendered headings and navigates duplicate headings without guessed anchors', async () => {
  const runtime = await setup()
  const text = '# Boundary\n\n## Convention\n\nFirst passage.\n\n## Convention\n\nSecond passage.\n\n```md\n## Not a heading\n```'
  const view = runtime.renderSlot('aitp.materials.reader.body', bodyProps(text), { entryKey: 'knowledge' })
  expect(screen.queryByRole('navigation', { name: 'Contents' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Contents' }))
  const navigation = screen.getByRole('navigation', { name: 'Contents' })
  expect(within(navigation).getAllByRole('button', { name: 'Convention' })).toHaveLength(2)
  expect(within(navigation).queryByText('Not a heading')).toBeNull()
  const headings = screen.getAllByRole('heading', { name: 'Convention' })
  const scrollFirst = vi.fn(), scrollSecond = vi.fn()
  const first = headings[0], second = headings[1]
  const secondLink = within(navigation).getAllByRole('button', { name: 'Convention' })[1]
  if (first === undefined || second === undefined || secondLink === undefined) throw new Error('Expected two actual Convention headings.')
  first.scrollIntoView = scrollFirst
  second.scrollIntoView = scrollSecond
  fireEvent.click(secondLink)
  expect(scrollSecond).toHaveBeenCalledWith({ block: 'start' })
  expect(scrollFirst).not.toHaveBeenCalled()
  view.update(bodyProps('# Different article'))
  expect(screen.queryByRole('navigation', { name: 'Contents' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Contents' }))
  expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Different article' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Contents' }))
  expect(screen.queryByRole('navigation')).toBeNull()
})

it('handles empty articles, prose without headings and raw text honestly', async () => {
  const runtime = await setup()
  const view = runtime.renderSlot('aitp.materials.reader.body', bodyProps(''), { entryKey: 'knowledge' })
  expect(screen.getByText('This article has no content yet')).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Contents' })).toBeNull()
  view.update(bodyProps('An uninterrupted paragraph.'))
  fireEvent.click(screen.getByRole('button', { name: 'Contents' }))
  expect(screen.getByText('This article has no section headings')).toBeDefined()
  view.update({ ...bodyProps('# Raw source'), raw: true })
  expect(screen.getByText('# Raw source')).toBeDefined()
  expect(screen.queryByRole('heading')).toBeNull()
})

it('passes the observed article and its source-link callback to the shared native Markdown reader', async () => {
  const observe = vi.fn<(props: MarkdownProps) => void>()
  const runtime = await setup(observe)
  const input = bodyProps('# Local reference\n\n![Diagram](../figures/diagram.svg)')
  runtime.renderSlot('aitp.materials.reader.body', input, { entryKey: 'knowledge' })
  expect(observe).toHaveBeenCalled()
  const props = observe.mock.lastCall?.[0]
  expect(props?.reading).toBe(input.reading)
  expect(props?.text).toBe(input.text)
  expect(props?.onLink).toBe(input.onLink)
})

it('retains unknown authored entry kinds instead of reclassifying them', () => {
  expect(knowledgeKind('source-reading', t)).toBe('Source readings')
  expect(knowledgeKind('story', t)).toBe('Learning paths')
  expect(knowledgeKind('author-collection', t)).toBe('Author collections')
  expect(knowledgeKind('index', t)).toBe('Collection indexes')
  expect(knowledgeKind('entry', t)).toBe('Knowledge entries')
  expect(knowledgeKind(undefined, t)).toBe('Knowledge entries')
  expect(knowledgeKind('authored unusual type', t)).toBe('authored unusual type')
})
