import { Context } from '@deepseek-ai/cordis'
import ResearchResources, { sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import type { ResourceResult } from '@deepseek-ai/dsh-research-resources'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Config, createKnowledgeProvider } from '../src/index.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'knowledge-provider-'))
  cleanup.push(() => rm(base, { recursive: true, force: true }))
  const knowledge = join(base, 'knowledge')
  const research = join(base, 'research')
  await mkdir(knowledge)
  await mkdir(research)
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, {})
  const root = await service.registerRoot({ id: 'knowledge', path: knowledge, domains: ['knowledge'] })
  const owner = await service.registerRoot({ id: 'research', path: research, domains: [] })
  service.registerProvider(createKnowledgeProvider(Config({ indexPaths: ['index.md'] })))
  return { service, knowledge, research, root, owner }
}

describe('knowledge projections preserve the existing AITP collection', () => {
  it('opens research pointers at their actual owner and keeps the claim out of the index projection', async () => {
    const { service, knowledge, research, root, owner } = await fixture()
    const index = '# Index\n\n| Entry | Kind | What it answers | Note | Where to read | Support |\n|---|---|---|---|---|---|\n| Which limit is supported? | result | Finite size only | [Owner](../research/research.md#answer) | [Source](source.md) | provisional; awaiting researcher review |\n'
    const original = '# Research\n\n## Answer\n\nAt N=6 only under A.\n'
    await writeFile(join(knowledge, 'index.md'), index)
    await writeFile(join(knowledge, 'source.md'), '# A source\n')
    await writeFile(join(research, 'research.md'), original)
    const before = await readdir(knowledge)
    const rows = value(await service.listResources({ domain: 'knowledge', rootId: root.rootId }, signal())).items
    const pointer = rows.find(row => row.metadata.entryKind === 'provisional-pointer')
    expect(pointer?.title).toBe('Which limit is supported?')
    expect(pointer?.ref).toEqual({ rootId: owner.rootId, sourceId: sourceIdForPath('research.md') })
    expect(pointer?.metadata.support).toBe('provisional; awaiting researcher review')
    expect(JSON.stringify(pointer)).not.toContain('At N=6 only under A.')
    expect(pointer?.links.some(link => link.label === 'Original index row' && link.locator?.kind === 'text')).toBe(true)
    if (pointer === undefined) throw new Error('The provisional pointer was not projected.')
    const reading = value(await service.readResource({ ref: pointer.ref,
      ...(pointer.locator === undefined ? {} : { locator: pointer.locator }) }, signal()))
    expect(reading.body.kind).toBe('text')
    if (reading.body.kind === 'text') expect(reading.body.text).toContain('At N=6 only under A.')
    expect(await readFile(join(knowledge, 'index.md'), 'utf8')).toBe(index)
    expect(await readFile(join(research, 'research.md'), 'utf8')).toBe(original)
    expect(await readdir(knowledge)).toEqual(before)
  })

  it('retains the four authored kinds and keeps support, review and reading depth separate', async () => {
    const { service, knowledge } = await fixture()
    await writeFile(join(knowledge, 'index.md'), '# Index\n\n[Atom](atom.md)\n\n[Paper](paper.md)\n\n[Story](story.md)\n\n[Author](author.md)\n')
    await writeFile(join(knowledge, 'atom.md'), '---\nkind: theorem\nsupport: source\nreview: awaiting\n---\n# Theorem\n\nAssuming A.\n')
    await writeFile(join(knowledge, 'paper.md'), '---\nkind: paper\nreading_depth: AI-read\nclose_reading: partial\n---\n# Paper\n')
    await writeFile(join(knowledge, 'story.md'), '---\nkind: story\nstatus: reading\n---\n# Questions\n')
    await writeFile(join(knowledge, 'author.md'), '---\nkind: author-collection\n---\n# Author moves\n')
    await writeFile(join(knowledge, 'unindexed.md'), '# Unindexed explanation\n')
    const rows = value(await service.listResources({ domain: 'knowledge' }, signal())).items
    expect(rows.map(row => row.metadata.entryKind)).toEqual(expect.arrayContaining(['atom', 'source-reading', 'story', 'author-collection']))
    expect(rows.find(row => row.title === 'Atom')?.metadata).toMatchObject({ kind: 'theorem', support: 'source', review: 'awaiting', entryKind: 'atom' })
    expect(rows.find(row => row.title === 'Paper')?.metadata).toMatchObject({ reading_depth: 'AI-read', close_reading: 'partial' })
    expect(rows.some(row => row.ref.sourceId === sourceIdForPath('unindexed.md'))).toBe(false)
    expect(rows.some(row => row.metadata.review === 'confirmed' || row.metadata.reading_depth === 'researcher-read')).toBe(false)
  })

  it('leaves multiple owners and broken targets explicit instead of picking the first matching title', async () => {
    const { service, knowledge } = await fixture()
    await writeFile(join(knowledge, 'index.md'), '# Index\n\n| Entry | Note | Support |\n|---|---|---|\n| Which convention? | [A](a.md#one), [B](a.md#two) | unchecked |\n| Missing | [Gone](gone.md) | unchecked |\n')
    await writeFile(join(knowledge, 'a.md'), '# A\n\n## One\n\nFirst.\n\n## Two\n\nSecond.\n')
    await writeFile(join(knowledge, 'b.md'), '# B\n')
    const rows = value(await service.listResources({ domain: 'knowledge' }, signal())).items
    const ambiguous = rows.find(row => row.title === 'Which convention?')
    expect(ambiguous?.metadata.targetState).toBe('multiple-source-links')
    expect(ambiguous?.ref.sourceId).toBe(sourceIdForPath('index.md'))
    expect(ambiguous?.links.filter(link => link.label === 'A' || link.label === 'B')).toHaveLength(2)
    const missing = rows.find(row => row.title === 'Missing')
    if (missing === undefined) throw new Error('The missing source record was hidden.')
    expect(await service.readResource({ ref: missing.ref }, signal())).toMatchObject({ ok: false, error: { code: 'not-found' } })
  })

  it('keeps a useful index-only concept distinct from an existing atom and respects an authored status column', async () => {
    const { service, knowledge, research } = await fixture()
    await writeFile(join(knowledge, 'index.md'), '# Index\n\n| Entry | Kind | Note | Status |\n|---|---|---|---|\n| Which hypothesis? | theorem | — | source located |\n| Which finite bound? | result | [Owner](../research/research.md) | provisional; awaiting review |\n')
    await writeFile(join(research, 'research.md'), '# Research\n\nFinite control only.\n')
    const rows = value(await service.listResources({ domain: 'knowledge' }, signal())).items
    expect(rows.find(row => row.title === 'Which hypothesis?')?.metadata).toMatchObject({ entryKind: 'entry', kind: 'theorem', status: 'source located' })
    expect(rows.find(row => row.title === 'Which finite bound?')?.metadata).toMatchObject({ entryKind: 'provisional-pointer', kind: 'result' })
    expect(await readdir(knowledge)).toEqual(['index.md'])
  })
})

it('keeps collection-directory links navigable without projecting them as selectable knowledge documents', async () => {
  const f = await fixture()
  await writeFile(join(f.knowledge, 'index.md'), '# Collection\n\n[Collection location](.)\n\n[Evidence](note.md)\n')
  await writeFile(join(f.knowledge, 'note.md'), '# Evidence\n\nProvisional reading only.\n')
  const page = value(await f.service.listResources({ domain: 'knowledge' }, signal()))
  expect(page.items.some(item => item.ref.sourceId === 'collection:root')).toBe(false)
  expect(page.items.find(item => item.ref.sourceId === sourceIdForPath('index.md'))?.links)
    .toContainEqual(expect.objectContaining({ target: { rootId: f.root.rootId, sourceId: 'collection:root' } }))
})
