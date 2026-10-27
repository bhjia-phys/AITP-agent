/** Private local checkout fixture; callers own its explicit disposal. */
import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/** @returns a real committed checkout, bounded reader options and its cleanup operation. */
export async function createCheckoutFixture() {
  const root = await mkdtemp(join(tmpdir(), 'research-code-'))
  const git = (...args: string[]) => execFile('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: root, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  })
  try {
    await git('init', '-q')
    await writeFile(join(root, 'model.py'), 'original condition\nsecond line\n')
    await git('add', 'model.py')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Initial control')
    const options = { executable: 'git', timeoutMs: 5000, maxOutputBytes: 1000000, maxHistoryEntries: 2 }
    return { root, git, options, dispose: () => rm(root, { recursive: true, force: true }) }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}
