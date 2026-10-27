// @vitest-environment jsdom
/** Source actions and exact text remain available inside the native dock presentation. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceEntryId, ResourceReading, ResourceSummary, SourceId, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { MaterialReader } from '../src/client/MaterialReader.tsx'
import { MaterialMarkdown } from '../src/client/MaterialMarkdown.tsx'
import type { MaterialReaderInput } from '../src/client/contracts.ts'
import { createMaterialsStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'
import { SourceMarkdownReader } from '../../ui-sidebar-documentpreview/src/client/markdown/MarkdownBody.tsx'
import { SourceCodeReader } from '../../ui-sidebar-documentpreview/src/client/code/CodeBody.tsx'
import { en as markdownEn } from '../../ui-sidebar-documentpreview/src/client/markdown/locales.ts'
import { en as codeEn } from '../../ui-sidebar-documentpreview/src/client/code/locales.ts'

afterEach(() => { cleanup(); document.getSelection()?.removeAllRanges() })

const t = makeTranslate(en)
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const resource: ResourceSummary = { id: 'notes' as ResourceEntryId,
  ref: { rootId: 'project' as SourceRootId, sourceId: 'source:研究/notes.md' as SourceId },
  title: 'Research note', kind: 'code', domain: 'code', providerId: 'code',
  metadata: { checkoutState: 'git', branch: 'main' }, links: [], topics: [],
}

function unused(): never { throw new Error('Unexpected framework seat in the source reader.') }

function props(input: MaterialReaderInput): FactoryComponentPropsOf<'aitp.materials.reader'> {
  const store = createMaterialsStore().create()
  return { ...input, presentation: 'dock', t, useStore: bindSnapshotSelector(store), actions: store.actions,
    renderSlot: (_name, _owner, options) => options?.fallback ?? null,
    renderFactorySlot: unused, useFactorySlot: unused, useResource: () => none,
    useSessions: unused, useSessionStatus: unused, useSessionRetainInfo: unused, useSessionAccess: unused,
    useWorkspaces: unused, useWorkspaceAccess: unused, usePanelInfo: unused, useRemoteAccess: unused,
  }
}

async function markdownReader(input: MaterialReaderInput) {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {},
    bind: namespace => namespace === 'documentMarkdown' ? makeTranslate(markdownEn)
      : namespace === 'sidebarCodePreview' ? makeTranslate(codeEn) : t })
  runtime.slots.registerFactory({ name: 'aitp.materials.markdown', scope: 'root', locale: 'aitp.materials' }, MaterialMarkdown)
  runtime.slots.registerFactory({ name: 'document.markdown.reader', scope: 'root', locale: 'documentMarkdown' }, SourceMarkdownReader)
  runtime.slots.registerFactory({ name: 'document.code.reader', scope: 'root', locale: 'sidebarCodePreview' }, SourceCodeReader)
  await runtime.root.declare({}, ({ renderFactorySlot }) => <MaterialReader {...props(input)} renderFactorySlot={renderFactorySlot} />)
  return runtime.renderRoot()
}

it('keeps the authored Markdown title and native metadata in the dock and exact original text in source mode', async () => {
  const text = '---\ncustom: source-owned\n---\n# Research note\n\nOnly a bounded result.'
  const reading: ResourceReading = { resource, body: { kind: 'text', format: 'markdown', text }, observedAt: 'now', issues: [] }
  const onSelect = vi.fn()
  const view = await markdownReader({ reading, fields: [], onLink: vi.fn(() => true), onSelect, libraryDomain: 'code' })
  expect(view.container.querySelector('[data-document-markdown]')).not.toBeNull()
  expect(view.container.querySelector('[data-document-frontmatter]')?.textContent).toContain('source-owned')
  expect(view.container.querySelectorAll('section h1')).toHaveLength(1)
  expect(view.container.querySelector('section h1')?.textContent).toBe(resource.title)
  expect(view.container.querySelector('article > header')).toBeNull()
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull()
  expect(view.container.querySelector('article > details')?.hasAttribute('open')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Source text' }))
  const source = view.container.querySelector('[data-code-preview] pre')
  expect(source?.textContent).toBe(text)
  if (source === null) throw new Error('Native source text must remain available.')
  const range = document.createRange()
  range.selectNodeContents(source)
  document.getSelection()?.addRange(range)
  fireEvent.click(screen.getByRole('button', { name: 'Use selected passage' }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ref: resource.ref,
    locator: { kind: 'text', start: 0, end: text.length, quote: text }, selectedText: text,
  })
})

it('keeps physical-page discussion and quotation actions without a second PDF paging toolbar', () => {
  const reading: ResourceReading = { resource, body: { kind: 'pdf', pageCount: 2,
    pages: [{ page: 1, text: 'First page.' }, { page: 2, text: 'Second page.' }],
  }, observedAt: 'now', issues: [] }
  const onDiscuss = vi.fn(), onSelect = vi.fn()
  render(<MaterialReader {...props({ reading, fields: [], onLink: vi.fn(() => true), onDiscuss, onSelect })} />)
  expect(screen.queryByRole('button', { name: 'Next PDF page' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Previous PDF page' })).toBeNull()
  fireEvent.keyDown(screen.getByRole('article', { name: resource.title }), { key: 'PageDown' })
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this page' }))
  expect(onDiscuss).toHaveBeenCalledExactlyOnceWith({ ref: resource.ref, locator: { kind: 'pdf-page', page: 2 } })
  fireEvent.click(screen.getByRole('button', { name: 'Use this source' }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ref: resource.ref })
  expect(screen.getByRole('button', { name: 'Use selected passage' })).toBeDefined()
})

it('retains a dock document page when another research scope becomes the foreground', () => {
  const reading: ResourceReading = { resource, body: { kind: 'pdf', pageCount: 2,
    pages: [{ page: 1, text: 'First page.' }, { page: 2, text: 'Second page.' }],
  }, observedAt: 'now', issues: [] }
  const onDiscuss = vi.fn()
  const input = props({ reading, fields: [], onLink: vi.fn(() => true), onDiscuss })
  render(<MaterialReader {...input} />)
  fireEvent.keyDown(screen.getByRole('article', { name: resource.title }), { key: 'PageDown' })
  act(() => { input.actions.setScope({ workspaceId: 'another-project' as WorkspaceId }) })
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this page' }))
  expect(onDiscuss).toHaveBeenCalledExactlyOnceWith({ ref: resource.ref, locator: { kind: 'pdf-page', page: 2 } })
})
