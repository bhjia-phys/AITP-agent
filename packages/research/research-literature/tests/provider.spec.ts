import { Context } from '@deepseek-ai/cordis'
import ResearchResources, { sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import type { ResourceResult } from '@deepseek-ai/dsh-research-resources'
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { Config, createLiteratureProvider } from '../src/index.ts'
import { paddedPdf } from './fixture.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function fixture(options: ConstructorParameters<typeof ResearchResources>[1] = {}) {
  const root = await mkdtemp(join(tmpdir(), 'literature-provider-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, options)
  const source = await service.registerRoot({ id: 'papers', path: root, domains: ['literature'] })
  return { root, service, sourceRoot: source.rootId }
}

describe('local literature records', () => {
  it('keeps same-title artifacts distinct and does not infer PDF editions from a reading note or filename', async () => {
    const { root, service, sourceRoot } = await fixture()
    await mkdir(join(root, 'other'))
    await copyFile(new URL('./fixtures/two-pages.pdf', import.meta.url), join(root, 'paper-v1.pdf'))
    await copyFile(new URL('./fixtures/two-pages.pdf', import.meta.url), join(root, 'other/paper-v1.pdf'))
    const index = '# Reading\n\n[Map](map.md)\n'
    await writeFile(join(root, 'index.md'), index)
    await writeFile(join(root, 'map.md'), '---\nkind: paper\narxiv: 1234.56789v2\nreading_depth: AI-read\n---\n# A reading\n\n[PDF](paper-v1.pdf)\n')
    service.registerProvider(createLiteratureProvider(Config({ initialPdfPages: 1 })))
    const page = value(await service.listResources({ domain: 'literature' }, signal()))
    const artifacts = page.items.filter(item => item.metadata.format === 'pdf')
    expect(artifacts).toHaveLength(2)
    expect(new Set(artifacts.map(item => item.id)).size).toBe(2)
    expect(artifacts.every(item => item.metadata.edition === 'unknown')).toBe(true)
    expect(page.items.find(item => item.metadata.recordKind === 'source-reading')?.metadata)
      .toMatchObject({ arxiv: '1234.56789v2', reading_depth: 'AI-read' })
    const reading = value(await service.readResource({ ref: { rootId: sourceRoot, sourceId: sourceIdForPath('paper-v1.pdf') } }, signal()))
    expect(reading.body).toMatchObject({ kind: 'pdf', pageCount: 2, pages: [{ page: 1 }] })
    expect(reading.issues.some(issue => issue.includes('Only the first 1 physical PDF pages'))).toBe(true)
    expect(await readFile(join(root, 'index.md'), 'utf8')).toBe(index)
  })

  it('reports uninspected reading routes instead of silently treating the catalog as complete', async () => {
    const { root, service } = await fixture()
    await writeFile(join(root, 'index.md'), '# Reading\n\n[Map](map.md)\n')
    await writeFile(join(root, 'map.md'), '---\nkind: paper\n---\n# Map\n')
    service.registerProvider(createLiteratureProvider(Config({ maxReadingNotes: 1 })))
    const page = value(await service.listResources({ domain: 'literature' }, signal()))
    expect(page.completeness).toBe('partial')
    expect(page.issues.some(issue => issue.reason.includes('traversal reached its configured bound'))).toBe(true)
  })

  it('opens an authored encoded PDF page link through the real resolver and page reader', async () => {
    const { root, service, sourceRoot } = await fixture()
    const path = '论文 甲.PDF'
    const href = `${encodeURIComponent(path)}#page=2`
    const note = `# Reading\n\n[Page two](${href})\n`
    await copyFile(new URL('./fixtures/two-pages.pdf', import.meta.url), join(root, path))
    await writeFile(join(root, 'index.md'), note)
    service.registerProvider(createLiteratureProvider(Config({ initialPdfPages: 1 })))
    const from = { rootId: sourceRoot, sourceId: sourceIdForPath('index.md') }
    const source = value(await service.readResource({ ref: from }, signal()))
    const link = source.resource.links.find(link => link.label === 'Page two')
    if (link?.target === undefined) throw new Error('The authored PDF link was not resolved.')
    const reading = value(await service.readResource({ ref: link.target,
      ...(link.locator === undefined ? {} : { locator: link.locator }) }, signal()))
    expect(reading.body).toMatchObject({ kind: 'pdf', pageCount: 2, pages: [{ page: 2, text: 'Page two exact text' }] })
    expect(reading.locator).toEqual({ kind: 'pdf-page', page: 2 })
    expect(link.href).toBe(href)
    for (const page of ['0', '3']) {
      const located = await service.resolveLocalLink({ from, href: `${encodeURIComponent(path)}#page=${page}` }, signal())
      if (located === undefined) throw new Error('The local source reference was not retained.')
      expect(value(await service.readResource(located, signal())).body)
        .toMatchObject({ kind: 'unavailable', reason: page === '0' ? 'unsupported' : 'missing' })
    }
    expect(await readFile(join(root, 'index.md'), 'utf8')).toBe(note)
    expect(await readFile(join(root, path))).toEqual(await readFile(new URL('./fixtures/two-pages.pdf', import.meta.url)))
  })

  it.each([1024 * 1024, 4 * 1024 * 1024])('omits embedding at limit %i without losing native bytes or reporting a false warning', async (maxInlinePdfBytes) => {
    const { root, service, sourceRoot } = await fixture({ maxResultCharacters: 4096 })
    const bytes = paddedPdf(await readFile(new URL('./fixtures/two-pages.pdf', import.meta.url)), 2 * 1024 * 1024)
    await writeFile(join(root, 'large.pdf'), bytes)
    service.registerProvider(createLiteratureProvider(Config({ initialPdfPages: 1, maxInlinePdfBytes })))
    const ref = { rootId: sourceRoot, sourceId: sourceIdForPath('large.pdf') }
    const reading = value(await service.readResource({ ref }, signal()))
    expect(reading.body).toMatchObject({ kind: 'pdf', pageCount: 2, pages: [{ page: 1, text: 'Selectable PDF text' }] })
    expect(reading.body).not.toHaveProperty('dataBase64')
    expect(reading.issues).toEqual(['large.pdf: Only the first 1 physical PDF pages were extracted. Other pages remain available through explicit page reads.'])
    const native = value(await service.readSourceBytes({ ref }, signal()))
    expect(Buffer.from(native.data).equals(Buffer.from(bytes))).toBe(true)
    expect(JSON.stringify(reading).length).toBeLessThan(4096)
    // Compare every byte without the assertion library enumerating a multi-megabyte Buffer.
    expect((await readFile(join(root, 'large.pdf'))).equals(Buffer.from(bytes))).toBe(true)
  })
})

it('can catalog the existing shared paper collection without treating extracted figure PDFs as papers', async () => {
  const { root, service } = await fixture()
  await mkdir(join(root, 'arxiv/2112.11614v5/source'), { recursive: true })
  await mkdir(join(root, 'ren-xinguo'), { recursive: true })
  await writeFile(join(root, 'arxiv/2112.11614v5/paper.pdf'), 'paper')
  await writeFile(join(root, 'arxiv/2112.11614v5/source/figure.pdf'), 'figure')
  await writeFile(join(root, 'arxiv/2112.11614v5/source/paper.tex'), 'source')
  await writeFile(join(root, 'ren-xinguo/review.pdf'), 'review')
  service.registerProvider(createLiteratureProvider(Config({ primaryPdfOnly: true })))
  const page = value(await service.listResources({ domain: 'literature' }, signal()))
  expect(page.items.map(item => item.title).sort()).toEqual(['arXiv 2112.11614v5', 'review.pdf'].sort())
  expect(page.items.find(item => item.title.startsWith('arXiv'))?.metadata.arxiv).toBe('2112.11614v5')
})
