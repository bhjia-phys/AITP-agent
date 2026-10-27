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
    expect(await readFile(join(root, 'large.pdf'))).toEqual(Buffer.from(bytes))
  })
})
