import { describe, expect, it } from 'vitest'
import type { SourceRef, SourceRootId, SourceId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { createMaterialsStore, materialSelectionKey, materialsScopeKey } from '../src/client/store.ts'

const ref = (rootId: string): SourceRef => ({ rootId: rootId as SourceRootId, sourceId: 'source:same.md' as SourceId })
const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'topic:branch/research.md' as SourceTopicId }

describe('shared library interaction state', () => {
  it('retains catalogue position independently of native source tabs and ignores retired scroll callbacks', () => {
    const store = createMaterialsStore().create()
    store.actions.setScope(topic)
    store.actions.setCatalogScroll('literature', 420, materialsScopeKey(topic))
    store.actions.open('literature', { kind: 'source', ref: ref('papers') })
    expect(store.getSnapshot().views.literature.catalogScrollTop).toBe(420)
    store.actions.setScope({})
    store.actions.setCatalogScroll('literature', 17, materialsScopeKey(topic))
    expect(store.getSnapshot().views.literature.catalogScrollTop).toBe(0)
    store.actions.setScope(topic)
    expect(store.getSnapshot().views.literature.catalogScrollTop).toBe(420)
  })

  it('stages a late document selection only in its captured research scope', () => {
    const store = createMaterialsStore().create()
    const selected = { ref: ref('papers'), title: 'A selected passage', domain: 'literature' as const }
    store.actions.selectForScope(topic, selected, true)
    expect(store.getSnapshot().scope).toEqual({})
    expect(store.getSnapshot().drafts[materialsScopeKey({})]).toBeUndefined()
    expect(store.getSnapshot().drafts[materialsScopeKey(topic)]?.selections).toEqual([selected])
    store.actions.sending(materialsScopeKey(topic), true)
    store.actions.selectForScope(topic, selected, false)
    expect(store.getSnapshot().drafts[materialsScopeKey(topic)]?.selections).toEqual([selected])
  })

  it('restores each research direction without carrying another direction into its reading history', () => {
    const store = createMaterialsStore().create()
    store.actions.setScope(topic)
    store.actions.setQuery('literature', 'boundary conditions')
    store.actions.open('literature', { kind: 'source', ref: ref('papers') })
    store.actions.setPdfPage('literature', 7)
    const first = store.getSnapshot().views.literature
    const other = { ...topic, topicId: 'topic:other/research.md' as SourceTopicId }
    store.actions.setScope(other)
    expect(store.getSnapshot().views.literature).toMatchObject({ query: '', location: { kind: 'list' }, back: [] })
    store.actions.open('literature', { kind: 'source', ref: ref('other-papers') })
    store.actions.setPdfPage('literature', 2)
    store.actions.back('literature')
    expect(store.getSnapshot().views.literature.location).toEqual({ kind: 'list' })
    store.actions.setScope({ ...topic, title: 'Updated topic title' })
    expect(store.getSnapshot().views.literature).toEqual(first)
    expect(store.getSnapshot().views.literature.location).toEqual({ kind: 'source', ref: ref('papers'), pdfPage: 7 })
    store.actions.setScope(topic)
    expect(store.getSnapshot().views.literature).toEqual(first)
  })

  it('changes source views without turning each tab into another return destination', () => {
    const store = createMaterialsStore().create()
    store.actions.setFolder('code', 'src')
    store.actions.open('code', { kind: 'source', ref: ref('checkout') })
    store.actions.replaceSource('code', { kind: 'source', ref: ref('checkout'), locator: { kind: 'git', view: 'diff' } })
    store.actions.replaceSource('code', { kind: 'source', ref: ref('checkout'), locator: { kind: 'git', view: 'history' } })
    store.actions.back('code')
    expect(store.getSnapshot().views.code).toMatchObject({ folderPath: 'src', location: { kind: 'list' }, back: [] })
  })

  it('retains separate physical pages from one PDF and removes only the requested passage', () => {
    const store = createMaterialsStore().create()
    const secondPage = { ref: ref('papers'), title: 'Paper', domain: 'literature' as const, locator: { kind: 'pdf-page' as const, page: 2 } }
    const seventhPage = { ...secondPage, locator: { kind: 'pdf-page' as const, page: 7 }, selectedText: 'Only under A' }
    store.actions.select(secondPage, true)
    store.actions.select({ ...secondPage, locator: { page: 2, kind: 'pdf-page' } }, true)
    store.actions.select(seventhPage, true)
    expect(store.getSnapshot().drafts[materialsScopeKey({})]?.selections).toEqual([secondPage, seventhPage])
    store.actions.select(secondPage, false)
    expect(store.getSnapshot().drafts[materialsScopeKey({})]?.selections).toEqual([seventhPage])
  })

  it('keeps equal filenames in separate roots selected across library navigation', () => {
    const store = createMaterialsStore().create()
    store.actions.select({ ref: ref('papers'), title: 'Paper', domain: 'literature' }, true)
    store.actions.select({ ref: ref('knowledge'), title: 'Explanation', domain: 'knowledge' }, true)
    store.actions.open('code', { kind: 'source', ref: ref('checkout') })
    const draft = store.getSnapshot().drafts[materialsScopeKey({})]
    expect(draft?.selections.map(item => item.ref.rootId)).toEqual(['papers', 'knowledge'])
    expect(store.getSnapshot().scope).toEqual({})
    store.actions.select({ ref: ref('papers'), title: 'Paper', domain: 'literature' }, false)
    expect(store.getSnapshot().drafts[materialsScopeKey({})]?.selections.map(item => item.ref.rootId)).toEqual(['knowledge'])
  })

  it('isolates topic questions and settles a late failure in its original scope', () => {
    const store = createMaterialsStore().create()
    store.actions.setScope(topic)
    store.actions.question('这个条件能否取消？')
    store.actions.select({ ref: ref('papers'), title: 'Selected evidence', domain: 'literature' }, true)
    const key = materialsScopeKey(topic)
    store.actions.sending(key, true)
    store.actions.setScope({})
    store.actions.question('A different global question')
    store.actions.sending(key, false, 'The connection ended before confirmation.')
    expect(store.getSnapshot().drafts[materialsScopeKey({})]).toMatchObject({ question: 'A different global question', failure: null, selections: [] })
    expect(store.getSnapshot().drafts[key]).toMatchObject({ question: '这个条件能否取消？', sending: false, failure: 'The connection ended before confirmation.' })
    store.actions.setScope(topic)
    expect(store.getSnapshot().drafts[key]?.selections).toHaveLength(1)
  })

  it('restores a library list and its filters after reading a source', () => {
    const store = createMaterialsStore().create()
    store.actions.setQuery('knowledge', '归一化')
    store.actions.setRoot('knowledge', 'theory')
    store.actions.setFolder('knowledge', 'concepts/normalization')
    store.actions.open('knowledge', { kind: 'source', ref: ref('theory'), locator: { kind: 'anchor', anchor: 'conditions' } })
    store.actions.back('knowledge')
    expect(store.getSnapshot().views.knowledge).toMatchObject({ query: '归一化', rootId: 'theory', folderPath: 'concepts/normalization', location: { kind: 'list' } })
    expect(store.getSnapshot().views.literature.query).toBe('')
  })

  it('restores the viewed PDF page through source history and gives an explicit locator its own position', () => {
    const store = createMaterialsStore().create()
    store.actions.open('literature', { kind: 'source', ref: ref('papers'), locator: { kind: 'pdf-page', page: 2 } })
    store.actions.setPdfPage('literature', 7)
    store.actions.open('literature', { kind: 'source', ref: ref('supplement') })
    store.actions.setPdfPage('literature', 3)
    store.actions.back('literature')
    expect(store.getSnapshot().views.literature.location).toEqual({ kind: 'source', ref: ref('papers'),
      locator: { kind: 'pdf-page', page: 2 }, pdfPage: 7 })
    store.actions.setLocator('literature', { kind: 'pdf-page', page: 4 })
    expect(store.getSnapshot().views.literature.location).toEqual({ kind: 'source', ref: ref('papers'),
      locator: { kind: 'pdf-page', page: 4 } })
  })
})

it('restores each material position through Back and rejects retired image callbacks in another source or topic', () => {
  const store = createMaterialsStore().create()
  const document = { kind: 'source' as const, ref: ref('notes'), readerDomain: null }
  const image = { kind: 'source' as const, ref: ref('figures'), readerDomain: null }
  const documentIdentity = { scope: materialsScopeKey(topic), source: materialSelectionKey(document) }
  const imageIdentity = { scope: materialsScopeKey(topic), source: materialSelectionKey(image) }
  store.actions.setScope(topic)
  store.actions.open('knowledge', document)
  store.actions.setReadingScroll('knowledge', 480, documentIdentity)
  store.actions.open('knowledge', image)
  store.actions.setReadingScroll('knowledge', 40, imageIdentity)
  store.actions.setImageZoom('knowledge', { kind: 'fixed', scale: 1.5 }, imageIdentity)
  store.actions.setImageScroll('knowledge', 320, imageIdentity)
  const imagePosition = store.getSnapshot().views.knowledge.location
  expect(imagePosition).toEqual({ ...image, scrollTop: 40, imageZoom: { kind: 'fixed', scale: 1.5 }, imageScrollTop: 320 })
  store.actions.open('knowledge', { kind: 'source', ref: ref('implementation'), readerDomain: null })
  store.actions.setReadingScroll('knowledge', 900, imageIdentity)
  store.actions.setImageZoom('knowledge', { kind: 'fixed', scale: 2 }, imageIdentity)
  store.actions.setImageScroll('knowledge', 700, imageIdentity)
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'source', ref: ref('implementation'), readerDomain: null })
  store.actions.back('knowledge')
  expect(store.getSnapshot().views.knowledge.location).toEqual(imagePosition)
  store.actions.setScope({ ...topic, topicId: 'other' as SourceTopicId })
  store.actions.open('knowledge', image)
  store.actions.setReadingScroll('knowledge', 900, imageIdentity)
  store.actions.setImageZoom('knowledge', { kind: 'fixed', scale: 2 }, imageIdentity)
  store.actions.setImageScroll('knowledge', 700, imageIdentity)
  expect(store.getSnapshot().views.knowledge.location).toEqual(image)
  store.actions.setScope(topic)
  expect(store.getSnapshot().views.knowledge.location).toEqual(imagePosition)
  store.actions.back('knowledge')
  expect(store.getSnapshot().views.knowledge.location).toEqual({ ...document, scrollTop: 480 })
  store.actions.back('knowledge')
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'list' })
  store.actions.setReadingScroll('knowledge', 900, documentIdentity)
  store.actions.setImageZoom('knowledge', { kind: 'fixed', scale: 2 }, imageIdentity)
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'list' })
})

it('ignores retired native PDF callbacks after switching source or research direction', () => {
  const store = createMaterialsStore().create()
  const source = { kind: 'source' as const, ref: ref('papers') }
  store.actions.setScope(topic)
  store.actions.open('literature', source)
  const expected = { scope: materialsScopeKey(topic), source: materialSelectionKey(source) }
  store.actions.setPdfZoom('literature', { kind: 'fixed', scale: 1.5 }, expected)
  store.actions.setPdfScroll('literature', 280, expected)
  store.actions.setScope({ ...topic, topicId: 'other' as SourceTopicId })
  store.actions.open('literature', source)
  store.actions.setPdfPage('literature', 5, expected)
  store.actions.setPdfZoom('literature', { kind: 'fixed', scale: 2 }, expected)
  store.actions.setPdfScroll('literature', 700, expected)
  expect(store.getSnapshot().views.literature.location).toEqual(source)
  store.actions.setScope(topic)
  expect(store.getSnapshot().views.literature.location).toMatchObject({ pdfZoom: { kind: 'fixed', scale: 1.5 }, pdfScrollTop: 280 })
  store.actions.open('literature', { kind: 'source', ref: ref('other-papers') })
  store.actions.setPdfPage('literature', 5, expected)
  expect(store.getSnapshot().views.literature.location).toEqual({ kind: 'source', ref: ref('other-papers') })
})

it('returns to the long library list at its previous position without accepting a retired source scroll', () => {
  const store = createMaterialsStore().create()
  store.actions.setScope(topic)
  const scope = materialsScopeKey(topic)
  store.actions.setReadingScroll('knowledge', 920, { scope, source: 'list' })
  store.actions.open('knowledge', { kind: 'source', ref: ref('knowledge') })
  store.actions.setReadingScroll('knowledge', 200, { scope, source: materialSelectionKey({ ref: ref('knowledge') }) })
  store.actions.back('knowledge')
  store.actions.setReadingScroll('knowledge', 0, { scope, source: materialSelectionKey({ ref: ref('knowledge') }) })
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'list', scrollTop: 920 })
  store.actions.setScope({})
  store.actions.setReadingScroll('knowledge', 0, { scope, source: 'list' })
  store.actions.setScope(topic)
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'list', scrollTop: 920 })
})
