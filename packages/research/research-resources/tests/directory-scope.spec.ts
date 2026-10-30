/** Internal account probing filters ordinary files before its directory budget. */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { GuardedFiles } from '../src/files.ts'

it('keeps directory-only account probes bounded without changing ordinary directory browsing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-directory-scope-'))
  try {
    await mkdir(join(root, 'question'))
    await mkdir(join(root, 'history'))
    for (let i = 0; i < 20; i++) await writeFile(join(root, `raw-${i}.txt`), 'data')
    const files = new GuardedFiles(root, 1, 1024)
    expect(await files.listDirectory('', undefined, { directoriesOnly: true, excludedDirectories: ['history'] }))
      .toEqual({ entries: [{ path: 'question', kind: 'directory' }], issues: [], partial: false })
    expect((await files.listDirectory('')).partial).toBe(true)
    await mkdir(join(root, 'second'))
    const limited = await files.listDirectory('', undefined, { directoriesOnly: true, excludedDirectories: ['history'] })
    expect(limited.partial).toBe(true)
    expect(limited.entries).toHaveLength(1)
    const controller = new AbortController()
    controller.abort()
    await expect(files.listDirectory('', controller.signal, { directoriesOnly: true })).rejects.toBeDefined()
  } finally { await rm(root, { recursive: true, force: true }) }
})
