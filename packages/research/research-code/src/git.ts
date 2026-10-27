/** Bounded local Git observations without repository mutation or external diff helpers. */
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'

/** Explicit process and output limits owned by the code plugin. */
export interface GitReadConfig {
  readonly executable: string
  readonly timeoutMs: number
  readonly maxOutputBytes: number
  readonly maxHistoryEntries: number
}

/** One current checkout observation; dirty status never attributes a change to this Session. */
export interface CheckoutObservation {
  readonly path: string
  readonly branch: string | null
  readonly head: string | null
  readonly status: readonly { readonly code: string; readonly path: string; readonly previousPath?: string }[]
}

/** A read rejected before any partial Git output is presented as complete. */
export class GitReadError extends Error {
  constructor(readonly kind: 'not-a-checkout' | 'different-root' | 'too-large' | 'unavailable', message: string) {
    super(message)
  }
}

function environment(): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^GIT_|KEY|TOKEN|PASSWORD|SECRET/i.test(key)) continue
    result[key] = value
  }
  return { ...result, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_ATTR_NOSYSTEM: '1', GIT_LITERAL_PATHSPECS: '1' }
}

function samePath(left: string, right: string): boolean {
  return process.platform === 'win32' ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right)
}

/** Fixed local read commands; the executable never receives a shell command string. */
export class GitReader {
  private readonly baseArgs = ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
    '-c', `core.hooksPath=${process.platform === 'win32' ? 'NUL' : '/dev/null'}`, '-c', 'core.pager=cat', '-c', 'log.showSignature=false']
  private filterArgs: readonly string[] = []

  constructor(readonly root: string, readonly config: GitReadConfig) {}

  private async execute(args: readonly string[], signal: AbortSignal,
    allowedFailures: readonly number[] = []): Promise<string | undefined> {
    signal.throwIfAborted()
    return new Promise((accept, reject) => {
      execFile(this.config.executable, [...this.baseArgs, ...this.filterArgs, ...args], {
        cwd: this.root, env: environment(), encoding: 'utf8', timeout: this.config.timeoutMs,
        maxBuffer: this.config.maxOutputBytes, signal, windowsHide: true,
      }, (error, stdout) => {
        if (signal.aborted) {
          reject(signal.reason instanceof Error ? signal.reason : new DOMException('The Git observation was cancelled.', 'AbortError'))
          return
        }
        if (error !== null) {
          if (typeof error.code === 'number' && allowedFailures.includes(error.code)) { accept(undefined); return }
          if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            reject(new GitReadError('too-large', 'The Git observation exceeds the configured output bound; no truncated result was returned.'))
            return
          }
          reject(new GitReadError('unavailable', error.killed ? 'The Git observation exceeded its configured time limit.' : 'The local Git observation failed.'))
          return
        }
        accept(stdout)
      })
    })
  }

  /**
   * Admit only the exact registered checkout and disable configured content filters.
   * @param signal - source-read lifetime.
   * @returns this reader after checkout identity and configuration are observed.
   */
  async initialize(signal: AbortSignal): Promise<this> {
    const top = await this.execute(['rev-parse', '--show-toplevel'], signal, [128])
    if (top === undefined) throw new GitReadError('not-a-checkout', 'The admitted source root is not a Git checkout.')
    if (!samePath(top.trim(), this.root)) throw new GitReadError('different-root', 'The admitted source root is not the actual checkout root; no parent checkout was substituted.')
    const filters = await this.execute(['config', '--null', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], signal, [1])
    this.filterArgs = (filters ?? '').split('\0').filter(Boolean).flatMap((record) => {
      const key = record.split('\n', 1)[0]
      return key === undefined ? [] : ['-c', `${key}=${key.endsWith('.required') ? 'false' : ''}`]
    })
    return this
  }

  /**
   * Read HEAD, branch and bounded porcelain status without refreshing the index on disk.
   * @param signal - source-read lifetime.
   * @returns observed checkout facts, including an unborn or detached HEAD explicitly.
   */
  async inspect(signal: AbortSignal): Promise<CheckoutObservation> {
    const head = await this.execute(['rev-parse', '--verify', 'HEAD'], signal, [1, 128])
    const branch = await this.execute(['symbolic-ref', '--quiet', '--short', 'HEAD'], signal, [1])
    const output = await this.execute(['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all', '--', '.'], signal)
    const fields = (output ?? '').split('\0')
    const status: { code: string; path: string; previousPath?: string }[] = []
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index]
      if (!field) continue
      const code = field.slice(0, 2)
      const path = field.slice(3)
      const renamed = /[RC]/.test(code)
      const previousPath = renamed ? fields[++index] : undefined
      status.push({ code, path, ...(previousPath === undefined ? {} : { previousPath }) })
    }
    return { path: this.root, head: head?.trim() ?? null, branch: branch?.trim() ?? null, status }
  }

  /**
   * Resolve a requested revision before later reads so movable names are never the retained identity.
   * @param revision - exact authored revision request, not a path or command option.
   * @param signal - source-read lifetime.
   * @returns the actual commit ID or undefined when it cannot be resolved.
   */
  async commit(revision: string, signal: AbortSignal): Promise<string | undefined> {
    const value = await this.execute(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], signal, [1, 128])
    return value?.trim()
  }

  /**
   * Read a normal file blob from a resolved commit; symlinks and submodules stay unavailable.
   * @param commit - previously resolved commit ID.
   * @param path - normalized source-relative file path.
   * @param signal - source-read lifetime.
   * @returns complete file text, or undefined for an absent or non-file tree entry.
   */
  async file(commit: string, path: string, signal: AbortSignal): Promise<string | undefined> {
    const entry = await this.execute(['ls-tree', '-z', commit, '--', path], signal)
    if (entry === undefined || !/^100(?:644|755) blob /.test(entry)) return undefined
    return this.execute(['show', '--no-ext-diff', '--no-textconv', '--no-show-signature', `${commit}:${path}`], signal, [128])
  }

  /**
   * Inspect status, diff or bounded commit history without fetching or executing research code.
   * @param view - selected read surface.
   * @param scope - explicit diff scope.
   * @param revision - optional resolved commit for a committed diff/history.
   * @param path - optional normalized source-relative path filter.
   * @param signal - source-read lifetime.
   * @returns the complete bounded text for this observation.
   */
  async view(view: 'status' | 'diff' | 'history', scope: 'working-tree' | 'staged' | 'commit', revision: string | undefined,
    path: string | undefined, signal: AbortSignal): Promise<string> {
    if (view === 'status') {
      const checkout = await this.inspect(signal)
      return JSON.stringify(path === undefined ? checkout : { ...checkout,
        status: checkout.status.filter(item => item.path === path) }, null, 2)
    }
    const paths = path === undefined ? [] : [path]
    if (view === 'history') return await this.execute(['log', '--no-show-signature', `--max-count=${this.config.maxHistoryEntries}`,
      '--format=%H%x09%aI%x09%s', revision ?? 'HEAD', '--', ...paths], signal) ?? ''
    if (scope === 'commit') {
      if (revision === undefined) throw new GitReadError('unavailable', 'A committed diff requires an explicit resolved revision.')
      return await this.execute(['show', '--format=fuller', '--no-show-signature', '--no-ext-diff', '--no-textconv', '--no-renames', revision, '--', ...paths], signal) ?? ''
    }
    return await this.execute(['diff', '--no-ext-diff', '--no-textconv', '--no-renames', ...(scope === 'staged' ? ['--cached'] : []), '--', ...paths], signal) ?? ''
  }
}
