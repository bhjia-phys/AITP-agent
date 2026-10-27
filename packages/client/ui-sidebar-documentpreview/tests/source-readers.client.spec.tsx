// @vitest-environment jsdom
/** Authorized source factories share native renderers without borrowing Session file authority. */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { SourceMarkdownReader } from '../src/client/markdown/MarkdownBody.tsx'
import { SourceImageReader } from '../src/client/image/ImageBody.tsx'
import { en as markdownEn } from '../src/client/markdown/locales.ts'
import { en as imageEn } from '../src/client/image/locales.ts'

async function setup(dictionary: Record<string, string>) {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }, t = makeTranslate(dictionary)
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {}, bind: () => t })
  return runtime
}

it('uses authorized Markdown image mappings, native lightbox and exact source-owned local/resource links', async () => {
  const runtime = await setup(markdownEn)
  const open = vi.fn(), openResource = vi.fn()
  const image = 'blob:https://research.test/authorized-image'
  const resolveImage = vi.fn((path: string) => path === '图片/控制 图.png' || path === '%E5%9B%BE%E7%89%87/%E6%8E%A7%E5%88%B6%20%E5%9B%BE.png' ? image : undefined)
  runtime.slots.registerFactory({ name: 'document.markdown.reader', scope: 'root', locale: 'documentMarkdown' }, SourceMarkdownReader)
  await runtime.root.declare({}, owner => owner.renderFactorySlot('document.markdown.reader', {
    text: '# Actual article\n\n![Matched control](%E5%9B%BE%E7%89%87/%E6%8E%A7%E5%88%B6%20%E5%9B%BE.png)\n\n[Next](notes/next.md#boundary) [Outside](../outside.md) [Source](dsh-resource://research/source)',
    resolveImage, localLinks: { canOpen: href => href === 'notes/next.md#boundary', open },
    resourceLinks: { canOpen: href => href === 'dsh-resource://research/source', open: openResource },
  }))
  runtime.renderRoot()
  expect(screen.getByRole('heading', { name: 'Actual article' })).toBeDefined()
  expect(screen.getByAltText('Matched control').getAttribute('src')).toBe(image)
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(open).toHaveBeenCalledExactlyOnceWith('notes/next.md#boundary')
  expect(screen.queryByRole('button', { name: 'Outside' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Source' }))
  expect(openResource).toHaveBeenCalledExactlyOnceWith('dsh-resource://research/source')
  fireEvent.click(screen.getByRole('button', { name: 'Open image: Matched control' }))
  expect(screen.getByRole('dialog', { name: 'Image preview' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('owns a native image Blob, restores viewing state and revokes it without replacing it on zoom', async () => {
  const runtime = await setup(imageEn)
  const create = vi.fn(() => 'blob:https://research.test/source-image'), revoke = vi.fn()
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  onTestFinished(() => {
    if (originalCreate === undefined) Reflect.deleteProperty(URL, 'createObjectURL')
    else Object.defineProperty(URL, 'createObjectURL', originalCreate)
    if (originalRevoke === undefined) Reflect.deleteProperty(URL, 'revokeObjectURL')
    else Object.defineProperty(URL, 'revokeObjectURL', originalRevoke)
  })
  const onZoomChange = vi.fn(), onScrollTopChange = vi.fn()
  const data = new Uint8Array([1, 2, 3])
  runtime.slots.registerFactory({ name: 'document.image.reader', scope: 'root', locale: 'sidebarImage' }, SourceImageReader)
  await runtime.root.declare({}, owner => owner.renderFactorySlot('document.image.reader', {
    data, name: '控制 图.png', mediaType: 'image/png', zoom: { kind: 'fixed', scale: 1.5 },
    scrollTop: 75, onZoomChange, onScrollTopChange,
  }))
  const view = runtime.renderRoot()
  const img = await screen.findByRole('img', { hidden: true })
  expect(img.getAttribute('alt')).toBe('Image preview: 控制 图.png')
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 200 })
  fireEvent.load(img)
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Choose zoom' }).textContent).toContain('150%') })
  const scrollport = view.container.querySelector('[data-document-zoom-scrollport]')
  if (!(scrollport instanceof HTMLElement)) throw new Error('Expected the native image scrollport.')
  expect(scrollport.scrollTop).toBe(75)
  scrollport.scrollTop = 95
  fireEvent.scroll(scrollport)
  expect(onScrollTopChange).toHaveBeenLastCalledWith(95)
  fireEvent.click(screen.getByRole('button', { name: 'Choose zoom' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Fit width' }))
  expect(onZoomChange).toHaveBeenLastCalledWith({ kind: 'fit-width' })
  expect(create).toHaveBeenCalledOnce()
  expect(screen.getByRole('img')).toBe(img)
  view.unmount()
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:https://research.test/source-image')
})
