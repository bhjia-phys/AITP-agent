// @vitest-environment jsdom
import type {} from '../src/client/index.ts'
import { fireEvent } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { MaterialBodyInput, MaterialsCatalogInput } from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type { ResourceEntryId, ResourceReading, ResourceSummary, SourceId, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import { CodeCatalog } from '../src/client/CodeCatalog.tsx'
import { CodeBody } from '../src/client/CodeReader.tsx'
import { codeChanges, codeDirectory, codeHistory } from '../src/client/code-model.ts'
import { en } from '../src/client/locales.ts'
import { SourceCodeReader } from '../../ui-sidebar-documentpreview/src/client/code/CodeBody.tsx'

const rootId = brandString<SourceRootId>('code')
const root = { id: rootId, title: 'Simulation', displayPath: '/research/simulation', domains: ['code'] as const }
function file(path: string): ResourceSummary {
  return { id: brandString<ResourceEntryId>(path), ref: { rootId, sourceId: brandString<SourceId>(`source:${encodeURIComponent(path)}`) },
    title: path, domain: 'code', kind: 'code', providerId: 'research-code', metadata: {
      entryKind: 'source-file', checkoutState: 'git', branch: 'main', dirtyCount: '1', fileStatus: ' M',
    }, links: [], topics: [] }
}
const source = file('src/observables/boundary.py')
const snapshot: ResourceReading = { resource: source, body: { kind: 'text', format: 'code', text: 'boundary = 3\n', language: 'python' },
  observedAt: '2026-10-26T00:00:00Z', issues: [] }

type MarkdownProps = FactoryComponentPropsOf<'aitp.materials.markdown'>

async function setup(observeMarkdown: (props: MarkdownProps) => void = () => {}) {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const t = makeTranslate(en), locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {}, bind: () => t })
  await runtime.declare({
    'aitp.materials.catalog.body': { kind: 'keyed', scope: 'root' },
    'aitp.materials.reader.body': { kind: 'keyed', scope: 'root' },
  })
  runtime.slots.register({ name: 'aitp.materials.catalog.body', key: 'code', locale: 'aitp.materials.code' }, CodeCatalog)
  runtime.slots.register({ name: 'aitp.materials.reader.body', key: 'code', locale: 'aitp.materials.code' }, CodeBody)
  runtime.slots.registerFactory({ name: 'document.code.reader', scope: 'root', locale: 'sidebarCodePreview' }, SourceCodeReader)
  runtime.slots.registerFactory({ name: 'aitp.materials.markdown', scope: 'root', locale: 'aitp.materials' }, (props: MarkdownProps) => {
    observeMarkdown(props)
    return <article aria-label="Native Markdown">{props.text}</article>
  })
  return runtime
}

it('derives folders only from the observed page and searches across nested paths', () => {
  const files = [source, file('src2/unrelated.py'), file('src/config.py'), file('README.md')]
  expect(codeDirectory(files, 'src', false).folders).toEqual([{ name: 'observables', path: 'src/observables' }])
  expect(codeDirectory(files, 'src', false).files.map(item => item.path)).toEqual(['src/config.py'])
  expect(codeDirectory(files, 'src', true).files.map(item => item.path)).toEqual([
    'README.md', 'src/config.py', 'src/observables/boundary.py', 'src2/unrelated.py',
  ])
})

it('retains root, folder and precise source identity without requiring a synthetic checkout row', async () => {
  const runtime = await setup()
  const input: MaterialsCatalogInput = { domain: 'code', items: [source], roots: [root], rootId: null, folderPath: '', query: '',
    selected: [], isSelected: () => false, disabled: false, onRoot: vi.fn(), onFolder: vi.fn(), onOpen: vi.fn(), onSelect: vi.fn() }
  const output = runtime.renderSlot('aitp.materials.catalog.body', input, { entryKey: 'code' })
  fireEvent.click(output.view.getByRole('button', { name: 'Simulation' }))
  expect(input.onRoot).toHaveBeenCalledWith(rootId)
  output.update({ ...input, rootId })
  expect(output.view.getByText('main')).toBeDefined()
  fireEvent.click(output.view.getByRole('button', { name: 'Open folder src' }))
  expect(input.onFolder).toHaveBeenCalledWith('src')
  output.update({ ...input, rootId, folderPath: 'src/observables' })
  fireEvent.click(output.view.getByRole('button', { name: 'src/observables/boundary.py' }))
  expect(input.onOpen).toHaveBeenCalledWith({ ref: source.ref })
  fireEvent.click(output.view.getByRole('checkbox', { name: 'Select src/observables/boundary.py' }))
  expect(input.onSelect).toHaveBeenCalledWith(source, true)
})

it('uses real source-qualified locators for working, staged and historical changes', async () => {
  const runtime = await setup(), onNavigate = vi.fn<MaterialBodyInput['onNavigate']>()
  const input: MaterialBodyInput = { reading: snapshot, text: snapshot.body.kind === 'text' ? snapshot.body.text : '', raw: false,
    onLink: () => false, onNavigate }
  const output = runtime.renderSlot('aitp.materials.reader.body', input, { entryKey: 'code' })
  expect(output.view.getByLabelText('Source code').textContent).toContain('boundary = 3')
  fireEvent.click(output.view.getByRole('button', { name: 'Changes' }))
  expect(onNavigate).toHaveBeenLastCalledWith({ ref: source.ref, locator: { kind: 'git', view: 'diff', scope: 'working-tree' } })
  const patch = 'diff --git a/src/observables/boundary.py b/src/observables/boundary.py\n@@ -1 +1 @@\n-boundary = 2\n+boundary = 3\n'
  output.update({ ...input, reading: { ...snapshot, locator: { kind: 'git', view: 'diff', scope: 'working-tree' },
    body: { kind: 'text', format: 'plain-text', text: patch } } })
  expect(output.view.getByLabelText('Git patch').textContent).toContain('-boundary = 2')
  expect(output.view.getByLabelText('Git patch').textContent).toContain('+boundary = 3')
  fireEvent.click(output.view.getByRole('button', { name: 'Staged' }))
  expect(onNavigate).toHaveBeenLastCalledWith({ ref: source.ref, locator: { kind: 'git', view: 'diff', scope: 'staged' } })
  fireEvent.click(output.view.getByRole('button', { name: 'History' }))
  expect(onNavigate).toHaveBeenLastCalledWith({ ref: source.ref, locator: { kind: 'git', view: 'history' } })
  fireEvent.click(output.view.getByRole('button', { name: 'Source' }))
  expect(onNavigate).toHaveBeenLastCalledWith({ ref: source.ref })
})

it('shows actual commit subjects and navigates to their immutable revision', async () => {
  const runtime = await setup(), onNavigate = vi.fn<MaterialBodyInput['onNavigate']>()
  const revision = 'a'.repeat(40)
  const text = `${revision}\t2026-10-26T09:00:00+00:00\tPreserve boundary convention\n`
  const output = runtime.renderSlot('aitp.materials.reader.body', { reading: { ...snapshot,
    locator: { kind: 'git', view: 'history' }, body: { kind: 'text', format: 'plain-text', text } }, text, raw: false,
  onLink: () => false, onNavigate }, { entryKey: 'code' })
  expect(output.view.getByText('Preserve boundary convention')).toBeDefined()
  fireEvent.click(output.view.getByRole('button', { name: 'View commit aaaaaaaaaaaa' }))
  expect(onNavigate).toHaveBeenCalledWith({ ref: source.ref, locator: { kind: 'git', view: 'diff', scope: 'commit', revision } })
})

it.each(['README.md', 'docs/读我.MARKDOWN'])('reads %s as native Markdown while keeping Git patches and raw source as code', async (path) => {
  const observe = vi.fn<(props: MarkdownProps) => void>()
  const runtime = await setup(observe)
  const text = '# Research guide\n\n![Diagram](../figures/diagram.svg)'
  const reading: ResourceReading = { ...snapshot, resource: file(path), body: { kind: 'text', format: 'code', text } }
  const input: MaterialBodyInput = { reading, text, raw: false, onLink: vi.fn(() => true), onNavigate: vi.fn() }
  const output = runtime.renderSlot('aitp.materials.reader.body', input, { entryKey: 'code' })
  expect(output.view.getByRole('article', { name: 'Native Markdown' }).textContent).toBe(text)
  const props = observe.mock.lastCall?.[0]
  expect(props?.reading).toBe(reading)
  expect(props?.onLink).toBe(input.onLink)
  fireEvent.click(output.view.getByRole('button', { name: 'Changes' }))
  expect(input.onNavigate).toHaveBeenLastCalledWith({ ref: reading.resource.ref,
    locator: { kind: 'git', view: 'diff', scope: 'working-tree' } })
  output.update({ ...input, raw: true })
  expect(output.view.queryByRole('article')).toBeNull()
  expect(output.view.getByLabelText('Source code').textContent).toContain('# Research guide')
  const patch = '@@ -1 +1 @@\n-# Old guide\n+# Research guide\n'
  output.update({ ...input, reading: { ...reading, locator: { kind: 'git', view: 'diff', scope: 'working-tree' },
    body: { kind: 'text', format: 'plain-text', text: patch } } })
  expect(output.view.queryByRole('article')).toBeNull()
  expect(output.view.getByLabelText('Git patch').textContent).toContain('-# Old guide')
})

it('keeps malformed provider observations verbatim instead of inventing empty status or history', () => {
  expect(codeChanges('{"status":[{"path":"file.py","code":" M"}]}')).toEqual([{ path: 'file.py', code: ' M' }])
  expect(codeChanges('{"status":[{"path":42,"code":" M"}]}')).toBeUndefined()
  expect(codeChanges('unavailable')).toBeUndefined()
  expect(codeHistory('not a commit')).toBeUndefined()
  expect(codeHistory('')).toEqual([])
})

it('shows only checkouts with explicit topic associations in the topic-filtered overview', async () => {
  const runtime = await setup()
  const otherRoot = { id: brandString<SourceRootId>('unrelated'), title: 'Unrelated', displayPath: '/other', domains: ['code'] as const }
  const checkout: ResourceSummary = { ...source, ref: { rootId, sourceId: brandString<SourceId>('git:checkout') },
    metadata: { entryKind: 'checkout', checkoutState: 'git' } }
  const input: MaterialsCatalogInput = { domain: 'code', items: [checkout], roots: [root, otherRoot], rootId: null,
    folderPath: '', query: '', topicFiltered: true, selected: [], isSelected: () => false, disabled: false,
    onRoot: vi.fn(), onFolder: vi.fn(), onOpen: vi.fn(), onSelect: vi.fn() }
  const output = runtime.renderSlot('aitp.materials.catalog.body', input, { entryKey: 'code' })
  expect(output.view.getByRole('button', { name: 'Simulation' })).toBeTruthy()
  expect(output.view.queryByRole('button', { name: 'Unrelated' })).toBeNull()
})

it('renders an immediate directory entry as a folder instead of a source file', () => {
  const directory = { ...file('src'), metadata: { entryKind: 'source-folder' } }
  const listing = codeDirectory([directory, file('README.md')], '', false)
  expect(listing.folders).toEqual([{ name: 'src', path: 'src' }])
  expect(listing.files.map(item => item.path)).toEqual(['README.md'])
})
