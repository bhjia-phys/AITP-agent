import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmod, link, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MarkdownWorkspace, resourceIdForPath } from '../src/markdown.ts'
import { ScratchWriter } from '../src/writer.ts'
import type { SourceEdit, WriteOperation, WriteProposal } from '../src/writer.ts'
import type { ResourceId, Result } from '../src/types.ts'

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return { ...original, rename: vi.fn(original.rename) }
})

const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
let temporary: string
let root: string
let stateDirectory: string
let workspace: MarkdownWorkspace
let writer: ScratchWriter
const initial = '# 子方向\n\n答案尚未确认。\n\n## Current work\n\n保留失败路线：假设 X 尚未成立。\n'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function edit(path = 'child/research.md', originalText = '答案尚未确认。', replacementText = '在条件 A 下得到结果 B。'): SourceEdit {
  return { resourceId: resourceIdForPath(path), originalText, replacementText,
    rationale: 'Integrate the supported result while preserving its condition.', sourceRefs: ['report.md#control'] }
}

function proposal(edits: readonly SourceEdit[] = [edit()]): WriteProposal {
  return { disposition: 'edit', rationale: 'The child answer changed.', edits, remainingUses: ['Parent implication needs assessment.'] }
}

function newWriter(writableRoot: string | null = root, maxOperationBytes = 100_000): ScratchWriter {
  return new ScratchWriter(workspace, { writableRoot, stateDirectory, maxOperationBytes })
}

function publishedSources(): number {
  return vi.mocked(rename).mock.calls.filter(([, destination]) => String(destination).startsWith(root)).length
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((settled) => { resolve = settled })
  return { promise, resolve }
}

beforeEach(async () => {
  vi.mocked(rename).mockReset().mockImplementation(actualFs.rename)
  temporary = await mkdtemp(join(tmpdir(), 'aitp-writer-'))
  root = join(temporary, 'research')
  stateDirectory = join(temporary, 'runtime', 'operations')
  await mkdir(join(root, 'child'), { recursive: true })
  await writeFile(join(root, 'research.md'), '# Parent\n\n[Child](child/research.md) has no accepted answer yet.\n')
  await writeFile(join(root, 'child/research.md'), initial)
  workspace = new MarkdownWorkspace({ root, maxFiles: 30, maxFileBytes: 50_000, maxContextCharacters: 20_000 })
  writer = newWriter()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(temporary, { recursive: true, force: true })
})

describe('scratch source writing', () => {
  it('persists a reviewable edit before application, then preserves the failed route and unrelated parent', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    expect(prepared.state).toBe('prepared')
    expect(prepared.files[0]).toMatchObject({ beforeText: initial, afterText: initial.replace('答案尚未确认。', '在条件 A 下得到结果 B。') })
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(initial)
    expect(JSON.parse(await readFile(join(stateDirectory, `${prepared.operationId}.json`), 'utf8'))).toEqual(prepared)
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('applied')
    expect(applied.files[0]?.appliedAt).toBeTypeOf('string')
    expect(applied.proposal.remainingUses).toEqual(['Parent implication needs assessment.'])
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toContain('保留失败路线：假设 X 尚未成立。')
    expect(await readFile(join(root, 'research.md'), 'utf8')).toContain('has no accepted answer yet')
    const resumed = unwrap(await newWriter().recover(prepared.operationId))
    expect(resumed).toMatchObject({ state: 'applied', files: [{ state: 'applied', current: { state: 'matches-planned-output' } }] })
  })

  it('patches current text and preserves unrelated edits made after preparation', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    await writeFile(join(root, 'child/research.md'), `${initial}\nExternal addition: retain α > 0.\n`)
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('applied')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(
      `${initial.replace('答案尚未确认。', '在条件 A 下得到结果 B。')}\nExternal addition: retain α > 0.\n`,
    )
    expect(applied.files[0]?.beforeText).toContain('External addition')
  })

  it.each([
    { original: '', expected: 'nonempty' },
    { original: 'absent passage', expected: 'absent' },
    { original: '\n', expected: 'more than once' },
  ])('rejects an invalid passage without publishing: $expected', async ({ original, expected }) => {
    const result = await writer.prepare(proposal([edit('child/research.md', original, 'replacement')]))
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    if (result.ok) throw new Error('Expected a rejected source edit.')
    expect(result.error.message).toContain(expected)
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(initial)
    expect(publishedSources()).toBe(0)
  })

  it('retains no-change and pending decisions without applying their proposed text', async () => {
    const unchanged = unwrap(await writer.prepare({ disposition: 'no-change', rationale: 'Status question only.', edits: [], remainingUses: [] }))
    const pending = unwrap(await writer.prepare({ ...proposal(), disposition: 'pending' }))
    expect(unwrap(await writer.apply(unchanged.operationId)).state).toBe('no-change')
    expect(unwrap(await writer.apply(pending.operationId)).state).toBe('pending')
    expect(unwrap(await newWriter().recover(pending.operationId)).proposal.edits).toEqual([edit()])
    expect(publishedSources()).toBe(0)
  })

  it('allows preview with source writing disabled and rejects application through the executor', async () => {
    writer = newWriter(null)
    const prepared = unwrap(await writer.prepare(proposal()))
    expect(await writer.apply(prepared.operationId)).toMatchObject({ ok: false, error: { code: 'read-only' } })
    expect(unwrap(await writer.recover(prepared.operationId)).state).toBe('prepared')
    expect(publishedSources()).toBe(0)
  })

  it('serializes duplicate retries and does not overwrite later source changes', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    const results = await Promise.all([writer.apply(prepared.operationId), writer.apply(prepared.operationId)])
    expect(results.map(result => unwrap(result).state)).toEqual(['applied', 'applied'])
    expect(publishedSources()).toBe(1)
    await writeFile(join(root, 'child/research.md'), '# A later independently revised account\n')
    const retry = unwrap(await newWriter().apply(prepared.operationId))
    expect(retry).toMatchObject({ state: 'applied', files: [{ state: 'applied', current: { state: 'different' } }] })
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe('# A later independently revised account\n')
    expect(publishedSources()).toBe(1)
  })

  it('serializes competing operations on the same owner and refuses the now-absent passage', async () => {
    const first = unwrap(await writer.prepare(proposal()))
    const second = unwrap(await writer.prepare(proposal([edit('child/research.md', '答案尚未确认。', 'Another answer.')])))
    const outcomes = await Promise.all([writer.apply(first.operationId), writer.apply(second.operationId)])
    expect(outcomes.map(result => unwrap(result).state).sort()).toEqual(['applied', 'not-applied'])
    expect(publishedSources()).toBe(1)
  })

  it.each(['resource:%63hild%2Fresearch.md', 'resource:child%2fresearch.md'])(
    'serializes disjoint edits when the same target has the alias %s', async (alias) => {
      const first = unwrap(await writer.prepare(proposal()))
      const otherEdit = { ...edit('child/research.md', '假设 X 尚未成立。', '假设 X 仍未成立；不能重复该路线。'), resourceId: alias as ResourceId }
      const second = unwrap(await writer.prepare(proposal([otherEdit])))
      expect(second.files[0]?.relativePath).toBe(first.files[0]?.relativePath)
      const publishing = deferred()
      const release = deferred()
      const bothQueued = deferred()
      let held = false
      let requested = 0
      let active = 0
      let overlapping = false
      vi.mocked(rename).mockImplementation(async (from, to) => {
        if (String(to) === join(root, 'child/research.md') && !held) {
          held = true
          publishing.resolve()
          await release.promise
        }
        await actualFs.rename(from, to)
      })
      // Observe the actual lock boundary without changing its queue or the real file operations.
      writer = new Proxy(writer, {
        get(target, key, receiver) {
          if (key !== 'locked') {
            const member: unknown = Reflect.get(target, key, receiver)
            return member
          }
          return <T>(keys: readonly string[], action: () => Promise<T>): Promise<T> => {
            if (!keys.some(key => key.startsWith('source:'))) return target['locked'](keys, action)
            const result = target['locked'](keys, async () => {
              overlapping ||= active > 0
              active++
              try { return await action() }
              finally { active-- }
            })
            if (++requested === 2) bothQueued.resolve()
            return result
          }
        },
      })
      const firstApplying = writer.apply(first.operationId)
      let secondApplying: ReturnType<ScratchWriter['apply']> | undefined
      try {
        await Promise.race([publishing.promise, firstApplying.then(() => {
          throw new Error('The first edit ended before its publication barrier.')
        })])
        secondApplying = writer.apply(second.operationId)
        await Promise.race([bothQueued.promise, secondApplying.then(() => {
          throw new Error('The second edit ended before requesting its source lock.')
        })])
        expect(overlapping).toBe(false)
      } finally {
        release.resolve()
        await Promise.allSettled(secondApplying === undefined ? [firstApplying] : [firstApplying, secondApplying])
      }
      if (secondApplying === undefined) throw new Error('The second edit was not submitted.')
      const outcomes = await Promise.all([firstApplying, secondApplying])
      expect(outcomes.map(result => unwrap(result).state)).toEqual(['applied', 'applied'])
      expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(
        initial.replace('答案尚未确认。', '在条件 A 下得到结果 B。').replace(otherEdit.originalText, otherEdit.replacementText),
      )
      expect(publishedSources()).toBe(2)
    },
  )

  it('deduplicates source locks when one proposal uses aliases for a single target', async () => {
    const otherEdit = { ...edit('child/research.md', '假设 X 尚未成立。', '假设 X 仍未成立；不能重复该路线。'),
      resourceId: 'resource:%63hild%2Fresearch.md' as ResourceId }
    const prepared = unwrap(await writer.prepare(proposal([edit(), otherEdit])))
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('applied')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(
      initial.replace('答案尚未确认。', '在条件 A 下得到结果 B。').replace(otherEdit.originalText, otherEdit.replacementText),
    )
    expect(unwrap(await writer.apply(prepared.operationId)).state).toBe('applied')
    expect(publishedSources()).toBe(2)
  })

  it('durably binds a UI retry identity to one preview and rejects reuse for another', async () => {
    const first = unwrap(await writer.prepare(proposal()))
    const second = unwrap(await writer.prepare(proposal([edit('child/research.md', '答案尚未确认。', 'Other answer.')])))
    const applied = unwrap(await writer.apply(first.operationId, 'UI operation α'))
    expect(applied.state).toBe('applied')
    expect(unwrap(await newWriter().apply(first.operationId, 'UI operation α')).state).toBe('applied')
    expect(await newWriter().apply(second.operationId, 'UI operation α')).toMatchObject({ ok: false, error: { code: 'operation-reused' } })
    expect(publishedSources()).toBe(1)
  })

  it('reports partial multi-owner application and leaves later owners untouched on retry', async () => {
    await writeFile(join(root, 'report.md'), '# Report\n\nOld result.\n')
    const prepared = unwrap(await writer.prepare(proposal([edit(), edit('report.md', 'Old result.', 'Updated result.')])))
    await writeFile(join(root, 'report.md'), '# Report\n\nExternal correction.\n')
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('partial')
    expect(applied.files.map(file => file.state)).toEqual(['applied', 'not-applied'])
    expect(applied.files[1]?.diagnostic?.code).toBe('missing-passage')
    expect(unwrap(await newWriter().apply(prepared.operationId)).state).toBe('partial')
    expect(await readFile(join(root, 'report.md'), 'utf8')).toContain('External correction.')
    expect(publishedSources()).toBe(1)
  })

  it('does not use an older inverse edit to overwrite a later correction', async () => {
    const initialEdit = unwrap(await writer.prepare(proposal()))
    unwrap(await writer.apply(initialEdit.operationId))
    const olderRevert = unwrap(await writer.prepare(proposal([edit('child/research.md', '在条件 A 下得到结果 B。', '答案尚未确认。')])))
    const correction = unwrap(await writer.prepare(proposal([edit('child/research.md', '在条件 A 下得到结果 B。', '条件 A 失效；结果仍未解决。')])))
    unwrap(await writer.apply(correction.operationId))
    expect(unwrap(await writer.apply(olderRevert.operationId)).state).toBe('not-applied')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toContain('条件 A 失效；结果仍未解决。')
  })

  it('separates applied source facts from a failed index refresh', async () => {
    const refresh = vi.spyOn(workspace, 'refresh').mockRejectedValue(new Error('Index unavailable'))
    const prepared = unwrap(await writer.prepare(proposal()))
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('applied')
    expect(applied.refreshWarnings).toEqual(['child/research.md: Index unavailable'])
    expect(refresh).toHaveBeenCalledWith(resourceIdForPath('child/research.md'))
    expect(unwrap(await newWriter().recover(prepared.operationId)).refreshWarnings).toEqual(applied.refreshWarnings)
  })
})

describe('interruption and unknown outcomes', () => {
  it('recovers an interrupted post-publication receipt as unknown and never reapplies matching text', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    const sourcePath = join(root, 'child/research.md')
    let sourcePublished = false
    vi.mocked(rename).mockImplementation(async (from, to) => {
      if (sourcePublished && String(to).startsWith(stateDirectory)) throw new Error('Receipt storage interrupted')
      await actualFs.rename(from, to)
      if (String(to) === sourcePath) sourcePublished = true
    })
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('unknown')
    expect(applied.files[0]?.state).toBe('unknown')
    expect(JSON.parse(await readFile(join(stateDirectory, `${prepared.operationId}.json`), 'utf8'))).toMatchObject({ state: 'applying' })
    vi.mocked(rename).mockImplementation(actualFs.rename)
    const recovered = unwrap(await newWriter().recover(prepared.operationId))
    expect(recovered).toMatchObject({ state: 'unknown', files: [{ state: 'unknown', current: { state: 'matches-planned-output' } }] })
    const count = publishedSources()
    expect(unwrap(await newWriter().apply(prepared.operationId)).state).toBe('unknown')
    expect(publishedSources()).toBe(count)
  })

  it('does not promote coincidentally matching current text into an applied operation', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    const interrupted: WriteOperation = { ...prepared, state: 'applying', files: prepared.files.map(file => ({ ...file, state: 'applying' })) }
    await writeFile(join(stateDirectory, `${prepared.operationId}.json`), JSON.stringify(interrupted))
    await writeFile(join(root, 'child/research.md'), prepared.files[0]!.afterText)
    const recovered = unwrap(await newWriter().recover(prepared.operationId))
    expect(recovered.state).toBe('unknown')
    expect(recovered.files[0]?.appliedAt).toBeUndefined()
    expect(recovered.files[0]?.current?.state).toBe('matches-planned-output')
    expect(publishedSources()).toBe(0)
  })

  it('reports an unknown outcome when external text differs at source readback', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    vi.mocked(rename).mockImplementation(async (from, to) => {
      await actualFs.rename(from, to)
      if (String(to) === join(root, 'child/research.md')) await writeFile(to, '# Concurrent external account\n')
    })
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied).toMatchObject({ state: 'unknown', files: [{ state: 'unknown', diagnostic: { code: 'readback-differs' } }] })
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe('# Concurrent external account\n')
  })
})

describe('scratch confinement and complete receipt bounds', () => {
  it('rejects escaping source identities and symlinks without editing their targets', async () => {
    const outside = join(temporary, 'outside.md')
    await writeFile(outside, initial)
    const escape = 'resource:..%2Foutside.md' as ResourceId
    expect(await writer.prepare(proposal([{ ...edit(), resourceId: escape }]))).toMatchObject({ ok: false })
    await symlink(outside, join(root, 'link.md'))
    expect(await writer.prepare(proposal([edit('link.md')]))).toMatchObject({ ok: false })
    await symlink(temporary, join(root, 'linked-directory'), 'dir')
    expect(await writer.prepare(proposal([edit('linked-directory/outside.md')]))).toMatchObject({ ok: false })
    expect(await readFile(outside, 'utf8')).toBe(initial)
    expect(publishedSources()).toBe(0)
  })

  it('checks confinement again when a prepared file becomes a symlink', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    const outside = join(temporary, 'outside.md')
    await writeFile(outside, initial)
    await rm(join(root, 'child/research.md'))
    await symlink(outside, join(root, 'child/research.md'))
    const applied = unwrap(await writer.apply(prepared.operationId))
    expect(applied.state).toBe('not-applied')
    expect(applied.files[0]?.diagnostic?.code).toBe('unsafe-path')
    expect(await readFile(outside, 'utf8')).toBe(initial)
  })

  it('rejects hard-linked source targets and retains ordinary file permissions', async () => {
    await link(join(root, 'child/research.md'), join(temporary, 'alias.md'))
    expect(await writer.prepare(proposal())).toMatchObject({ ok: false })
    await rm(join(temporary, 'alias.md'))
    await chmod(join(root, 'child/research.md'), 0o640)
    const prepared = unwrap(await writer.prepare(proposal()))
    unwrap(await writer.apply(prepared.operationId))
    if (process.platform !== 'win32') expect((await stat(join(root, 'child/research.md'))).mode & 0o777).toBe(0o640)
  })

  it('binds the writer to the source root and keeps receipts outside it, including through aliases', async () => {
    const other = join(temporary, 'other')
    await mkdir(other)
    expect(await newWriter(other).prepare(proposal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const inside = new ScratchWriter(workspace, { writableRoot: root, stateDirectory: join(root, 'runtime'), maxOperationBytes: 100_000 })
    expect(await inside.prepare(proposal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    await symlink(root, join(temporary, 'alias'), 'dir')
    const aliased = new ScratchWriter(workspace, { writableRoot: root, stateDirectory: join(temporary, 'alias', 'new-state'), maxOperationBytes: 100_000 })
    expect(await aliased.prepare(proposal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect(await readdir(root)).not.toContain('new-state')
  })

  it('rejects path-like operation identities, corrupt receipts and cross-root receipt reuse', async () => {
    expect(await writer.recover('../outside')).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const prepared = unwrap(await writer.prepare(proposal()))
    const path = join(stateDirectory, `${prepared.operationId}.json`)
    await writeFile(path, '{broken')
    expect(await writer.recover(prepared.operationId)).toMatchObject({ ok: false })
    await writeFile(path, JSON.stringify({ ...prepared, sourceRoot: temporary }))
    expect(await writer.apply(prepared.operationId)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    await writeFile(path, JSON.stringify({ ...prepared, state: 'applied' }))
    expect(await writer.recover(prepared.operationId)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    await writeFile(path, JSON.stringify({ ...prepared, files: [] }))
    expect(await writer.apply(prepared.operationId)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    await rm(path)
    await writeFile(join(temporary, 'outside.json'), JSON.stringify(prepared))
    await symlink(join(temporary, 'outside.json'), path)
    expect(await writer.recover(prepared.operationId)).toMatchObject({ ok: false })
    expect(publishedSources()).toBe(0)
  })

  it('bounds the complete Unicode receipt at an exact byte boundary', async () => {
    const prepared = unwrap(await writer.prepare(proposal()))
    const receiptBytes = Buffer.byteLength(`${JSON.stringify(prepared)}\n`, 'utf8')
    expect(unwrap(await newWriter(root, receiptBytes).prepare(proposal())).state).toBe('prepared')
    expect(await newWriter(root, receiptBytes - 1).prepare(proposal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(initial)
    expect(publishedSources()).toBe(0)
  })
})
