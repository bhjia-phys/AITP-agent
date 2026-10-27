/** Reading remains complete and bounded when a source grows after the initial stat. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, vi } from 'vitest'
import { GuardedFiles } from '../src/files.ts'

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, open: async (...args: Parameters<typeof actual.open>) => {
    const handle = await actual.open(...args)
    const stat = handle.stat.bind(handle)
    handle.stat = (async () => {
      const info = await stat()
      Object.defineProperty(info, 'size', { value: 0 })
      return info
    }) as typeof handle.stat
    return handle
  } }
})

it('reads all newly grown bytes within the bound and rejects growth beyond it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-growing-source-'))
  try {
    await writeFile(join(root, 'small.md'), 'abcd')
    await writeFile(join(root, 'large.md'), 'abcde')
    const files = new GuardedFiles(root, 10, 4)
    expect(await files.read('small.md')).toBe('abcd')
    await expect(files.read('large.md')).rejects.toMatchObject({ code: 'unavailable' })
    expect(Buffer.from(await files.readBytes('small.md')).toString()).toBe('abcd')
    await expect(files.readBytes('large.md')).rejects.toMatchObject({ code: 'unavailable' })
  } finally { await rm(root, { recursive: true, force: true }) }
})
