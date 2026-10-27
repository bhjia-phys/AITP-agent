import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitReader } from '../src/git.ts'
import { createCheckoutFixture } from './fixture.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { vi.unstubAllEnvs(); for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal

async function fixture() {
  const checkout = await createCheckoutFixture()
  cleanup.push(checkout.dispose)
  return checkout
}

describe('readonly local checkout observations', () => {
  it('distinguishes committed source from dirty working text and preserves the index bytes', async () => {
    const { root, options } = await fixture()
    await writeFile(join(root, 'model.py'), 'changed condition\nsecond line\n')
    const indexBefore = await readFile(join(root, '.git/index'))
    const reader = await new GitReader(root, options).initialize(signal())
    const state = await reader.inspect(signal())
    expect(state.path).toBe(root)
    expect(state.head).toMatch(/^[a-f0-9]{40,64}$/)
    expect(state.status).toContainEqual({ code: ' M', path: 'model.py' })
    if (state.head === null) throw new Error('The committed fixture has no HEAD.')
    expect(await reader.file(state.head, 'model.py', signal())).toBe('original condition\nsecond line\n')
    expect(await reader.view('diff', 'working-tree', undefined, 'model.py', signal())).toContain('+changed condition')
    expect(await reader.view('history', 'working-tree', undefined, undefined, signal())).toContain('Initial control')
    expect(await readFile(join(root, '.git/index'))).toEqual(indexBefore)
    expect(await readFile(join(root, 'model.py'), 'utf8')).toBe('changed condition\nsecond line\n')
  })

  it('does not execute configured fsmonitor, clean/process filters, textconv or external diff helpers', async () => {
    const { root, git, options } = await fixture()
    const helper = join(root, 'helper.sh')
    const marker = join(root, 'helper-ran')
    await writeFile(helper, `#!/bin/sh\nprintf hit > '${marker}'\ncat\n`)
    await chmod(helper, 0o700)
    await writeFile(join(root, '.gitattributes'), 'model.py filter=tripwire diff=tripwire\n')
    await git('config', 'core.fsmonitor', helper)
    await git('config', 'filter.tripwire.clean', helper)
    await git('config', 'filter.tripwire.process', helper)
    await git('config', 'filter.tripwire.required', 'true')
    await git('config', 'diff.tripwire.command', helper)
    await git('config', 'diff.tripwire.textconv', helper)
    await writeFile(join(root, 'model.py'), 'changed condition\nsecond line\n')
    const reader = await new GitReader(root, options).initialize(signal())
    await reader.inspect(signal())
    expect(await reader.view('diff', 'working-tree', undefined, 'model.py', signal())).toContain('changed condition')
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps exact checkout roots and literal revision/path requests, rejecting excess output', async () => {
    const { root, options } = await fixture()
    const nested = join(root, 'nested')
    await mkdir(nested)
    await expect(new GitReader(nested, options).initialize(signal())).rejects.toMatchObject({ kind: 'different-root' })
    vi.stubEnv('GIT_DIR', join(root, 'nonexistent'))
    const reader = await new GitReader(root, options).initialize(signal())
    expect(await reader.commit('--help', signal())).toBeUndefined()
    expect(await reader.commit('HEAD', signal())).toMatch(/^[a-f0-9]{40,64}$/)
    await writeFile(join(root, 'model.py'), 'a'.repeat(5000))
    const bounded = await new GitReader(root, { ...options, maxOutputBytes: 300 }).initialize(signal())
    await expect(bounded.view('diff', 'working-tree', undefined, 'model.py', signal())).rejects.toMatchObject({ kind: 'too-large' })
  })
})
