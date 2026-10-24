import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { MarkdownWorkspace, resourceIdForPath } from '../src/markdown.ts'
import type { Result } from '../src/types.ts'
import { ScratchWriter, type WriteProposal } from '../src/writer.ts'

const initial = '\ufeff# Direction\n\nThe question remains open.\n\n## Current work\n\nNo result.\n'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function fixture(): Promise<{ source: string; writer: ScratchWriter; resume: () => ScratchWriter }> {
  const temporary = await mkdtemp(join(tmpdir(), 'aitp-writer-bom-'))
  onTestFinished(() => rm(temporary, { recursive: true, force: true }))
  const root = join(temporary, 'research')
  await mkdir(root)
  const source = join(root, 'research.md')
  await writeFile(source, initial, 'utf8')
  const workspace = new MarkdownWorkspace({ root, maxFiles: 10, maxFileBytes: 10_000, maxContextCharacters: 10_000 })
  const resume = (): ScratchWriter => new ScratchWriter(workspace, {
    writableRoot: root, stateDirectory: join(temporary, 'runtime', 'operations'), maxOperationBytes: 100_000,
  })
  return { source, writer: resume(), resume }
}

function proposal(originalText: string, replacementText: string): WriteProposal {
  return {
    disposition: 'edit', rationale: 'Retain the surrounding account and integrate the selected passage.',
    edits: [{ resourceId: resourceIdForPath('research.md'), originalText, replacementText,
      rationale: 'Only this passage changes.', sourceRefs: [] }],
    remainingUses: [],
  }
}

describe('scratch UTF-8 source preservation', () => {
  it('retains the untouched BOM and all other bytes when publishing an interior passage', async () => {
    const { source, writer, resume } = await fixture()
    const prepared = unwrap(await writer.prepare(proposal('No result.', 'Result B only under condition A.')))
    const expected = initial.replace('No result.', 'Result B only under condition A.')
    expect(prepared.files[0]).toMatchObject({ beforeText: initial, afterText: expected })
    expect(await readFile(source)).toEqual(Buffer.from(initial, 'utf8'))

    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('applied')
    expect(await readFile(source)).toEqual(Buffer.from(expected, 'utf8'))
    expect(applied.files[0]).toMatchObject({ beforeText: initial, afterText: expected })
    expect(unwrap(await resume().recover(prepared.operationId))).toMatchObject({
      state: 'applied', files: [{ current: { state: 'matches-planned-output' } }],
    })
  })

  it('applies a prepared literal passage that includes the source BOM', async () => {
    const { source, writer } = await fixture()
    const original = '\ufeff# Direction'
    const replacement = '\ufeff# Revised direction'
    const prepared = unwrap(await writer.prepare(proposal(original, replacement)))
    expect(prepared.state).toBe('prepared')

    expect(unwrap(await writer.apply(prepared.operationId)).state).toBe('applied')
    expect(await readFile(source)).toEqual(Buffer.from(initial.replace(original, replacement), 'utf8'))
  })

  it('leaves the complete BOM-bearing source unchanged for a no-change decision', async () => {
    const { source, writer, resume } = await fixture()
    const prepared = unwrap(await writer.prepare({
      disposition: 'no-change', rationale: 'The question adds no durable correction.', edits: [], remainingUses: [],
    }))
    expect(unwrap(await writer.apply(prepared.operationId)).state).toBe('no-change')
    expect(unwrap(await resume().recover(prepared.operationId)).state).toBe('no-change')
    expect(await readFile(source)).toEqual(Buffer.from(initial, 'utf8'))
  })

  it('refuses invalid UTF-8 introduced after preparation without rewriting those bytes', async () => {
    const { source, writer, resume } = await fixture()
    const prepared = unwrap(await writer.prepare(proposal('No result.', 'Conditional result.')))
    const invalid = Buffer.concat([Buffer.from(initial, 'utf8'), Buffer.from([0xc3, 0x28])])
    await writeFile(source, invalid)

    expect(unwrap(await writer.apply(prepared.operationId))).toMatchObject({
      state: 'not-applied', files: [{ state: 'not-applied', diagnostic: { code: 'io-failure' } }],
    })
    expect(unwrap(await resume().recover(prepared.operationId))).toMatchObject({
      state: 'not-applied', files: [{ current: { state: 'unavailable' } }],
    })
    expect(await readFile(source)).toEqual(invalid)
  })
})
