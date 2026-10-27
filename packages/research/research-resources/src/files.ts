/** Shared bounded local reads; root authorization belongs to the source service. */
import { constants, lstatSync, watch, type FSWatcher } from 'node:fs'
import { EventEmitter } from 'node:events'
import { lstat, open, opendir, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { ResourceReadError } from './types.ts'

/** Expected source rejection carrying the workspace error code used by the adapter boundary. */
export class SourceError extends Error {
  /** @param code - expected rejection category. @param message - source-local diagnostic without an absolute path. */
  constructor(readonly code: 'invalid-request' | 'permission-denied' | 'not-found' | 'unavailable' | 'unsupported' | 'cancelled', message: string) {
    super(message)
  }
}

/**
 * Translate source and filesystem failures without exposing absolute filesystem paths.
 * @param error - a caught source or filesystem error; unknown failures become unavailable.
 * @returns an expected workspace failure, retryable only when access may recover.
 */
export function sourceFailure(error: unknown): ResourceReadError {
  if (error instanceof SourceError) return { code: error.code, message: error.message, retryable: error.code === 'unavailable' }
  if (error instanceof Error && 'code' in error) {
    if (error.code === 'ENOENT') return { code: 'not-found', message: 'The source no longer exists.', retryable: false }
    if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'ELOOP') {
      return { code: 'permission-denied', message: 'The source cannot be read within this research root.', retryable: false }
    }
  }
  return { code: 'unavailable', message: 'The research source could not be read. Refresh or check filesystem access.', retryable: true }
}

/**
 * Validate the adapter's slash-separated relative-path representation.
 * @param path - a nonempty path with no absolute prefix, dot segments, backslashes or empty segments.
 * @returns the unchanged path; this validates syntax, not filesystem containment or existence.
 * @throws {SourceError} when the path is outside the accepted representation.
 */
export function normalizedPath(path: string): string {
  if (!path || isAbsolute(path) || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part === '.' || !part)) {
    throw new SourceError('invalid-request', 'A source must have a normalized relative path within the configured root.')
  }
  return path
}

/** A skipped relative path or discovery limit; an empty path denotes the root-wide limit. */
export interface ScanIssue { readonly path: string; readonly reason: string }
/** Bounded regular-file discovery with omissions kept explicit; paths alone assert no topic relationships. */
export interface SourceScan {
  readonly paths: readonly string[]
  /** Directories actually visited; older external scan providers may omit this detail. */
  readonly directories?: readonly string[]
  readonly issues: readonly ScanIssue[]
  readonly partial: boolean
}

function internalDirectory(name: string): boolean {
  const normalized = name.toLowerCase()
  return normalized === '.git' || normalized === 'node_modules' || normalized === '.research-memory'
}

/** Read a complete file with room to detect growth beyond its original stat and configured bound. */
async function readBounded(handle: Awaited<ReturnType<typeof open>>, initialSize: number, bound: number,
  signal?: AbortSignal): Promise<Buffer> {
  let bytes = Buffer.alloc(Math.min(bound + 1, Math.max(1, initialSize + 1)))
  let length = 0
  while (true) {
    signal?.throwIfAborted()
    if (length === bytes.length) {
      if (length > bound) throw new SourceError('unavailable', 'The source grew beyond the configured byte limit; no truncated reading was returned.')
      const grown = Buffer.alloc(Math.min(bound + 1, Math.max(length + 1, length * 2)))
      bytes.copy(grown, 0, 0, length)
      bytes = grown
    }
    const read = await handle.read(bytes, length, bytes.length - length, length)
    if (read.bytesRead === 0) break
    length += read.bytesRead
    if (length > bound) throw new SourceError('unavailable', 'The source grew beyond the configured byte limit; no truncated reading was returned.')
  }
  return bytes.subarray(0, length)
}

/** One validated immediate child of a directory. */
export interface SourceDirectoryEntry { readonly path: string; readonly kind: 'file' | 'directory' }
/** A bounded immediate directory listing, preserving skipped entries as explicit issues. */
export interface SourceDirectory {
  readonly entries: readonly SourceDirectoryEntry[]
  readonly issues: readonly ScanIssue[]
  readonly partial: boolean
}

/** Non-recursive watches for bounded discovery and explicitly opened sources. */
export class BoundedSourceWatcher extends EventEmitter {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly identities = new Map<string, string>()
  private readonly selected = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = false

  /** @param root - admitted root. @param limit - maximum watched directories. @param changed - coalesced invalidation. */
  constructor(private readonly root: string, private readonly limit: number, private readonly changed: () => void) {
    super()
    this.add('')
  }
  /** Number of active directory watches, never greater than the configured bound. */
  get count(): number { return this.watchers.size }
  /**
   * Watch discovered directories, retaining parents of explicitly opened files.
   * @param directories - root-relative discovered directories.
   */
  sync(directories: readonly string[]): void {
    const desired = new Set(['', ...directories, ...this.selected])
    if (desired.size > this.limit) throw new SourceError('unavailable', 'The bounded source watch limit was reached.')
    for (const path of desired) this.add(path)
    for (const [path, watcher] of this.watchers) if (!desired.has(path)) {
      watcher.close(); this.watchers.delete(path); this.identities.delete(path)
    }
  }
  /**
   * Retain one separately validated opened file's parent even when discovery was partial.
   * @param path - root-relative path of the opened source.
   */
  includeFile(path: string): void {
    const parent = dirname(normalizedPath(path)).replaceAll('\\', '/')
    const parts = parent === '.' ? [] : parent.split('/')
    const directories = parts.map((_part, index) => parts.slice(0, index + 1).join('/'))
    const additions = directories.filter(directory => !this.watchers.has(directory))
    if (this.watchers.size + additions.length > this.limit) throw new SourceError('unavailable', 'The bounded source watch limit was reached.')
    for (const directory of directories) { this.add(directory); this.selected.add(directory) }
  }
  /** Release all OS watches and pending notifications. */
  close(): void {
    this.stopped = true
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    for (const watcher of this.watchers.values()) watcher.close()
    this.watchers.clear()
    this.identities.clear()
  }
  private add(directory: string): void {
    if (this.stopped) return
    if (directory !== '') normalizedPath(directory)
    const fullPath = directory === '' ? this.root : resolve(this.root, directory)
    const info = lstatSync(fullPath)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new SourceError('permission-denied', 'The watched source directory is unavailable.')
    const identity = `${info.dev}:${info.ino}`
    const existing = this.watchers.get(directory)
    if (existing !== undefined && this.identities.get(directory) === identity) return
    if (existing !== undefined) { existing.close(); this.watchers.delete(directory); this.identities.delete(directory) }
    if (this.watchers.size >= this.limit) throw new SourceError('unavailable', 'The bounded source watch limit was reached.')
    const watcher = watch(fullPath, { recursive: false, persistent: false }, () => {
      if (this.timer !== undefined) clearTimeout(this.timer)
      this.timer = setTimeout(() => { this.timer = undefined; if (!this.stopped) this.changed() }, 150)
      this.timer.unref()
    })
    watcher.on('error', (error) => { if (!this.stopped) this.emit('error', error) })
    this.watchers.set(directory, watcher)
    this.identities.set(directory, identity)
  }
}

/** One configured root; realpath checks apply again to each fresh source read. */
export class GuardedFiles {
  constructor(readonly root: string, readonly maxFiles: number, readonly maxFileBytes: number,
    readonly maxBinaryBytes: number = maxFileBytes) {}

  /**
   * Check an explicitly named file using the same directory and symlink exclusions as discovery.
   * @param path - normalized relative path inside the configured root.
   * @param signal - optional cancellation checked before each path-component observation.
   * @returns whether the final source is a regular file, without reading its contents.
   * @throws {Error} for missing paths, excluded directories, symlinks or cancellation.
   */
  async discoverable(path: string, signal?: AbortSignal): Promise<boolean> {
    return this.inspectPath(path, signal, false)
  }

  /**
   * Validate an archived source path while permitting a missing working-tree tail.
   * @param path - normalized root-relative path whose historical blob a specialized provider will verify.
   * @param signal - cancellation checked before current ancestor observations.
   * @returns nothing after checking exclusions and existing ordinary ancestors; this establishes no blob existence.
   * @throws for traversal, internal state, existing symlinks or non-file paths.
   */
  async validateHistoricalPath(path: string, signal?: AbortSignal): Promise<void> {
    if (!await this.inspectPath(path, signal, true)) throw new SourceError('invalid-request', 'The archived source path is not a normal file path.')
  }

  private async inspectPath(path: string, signal: AbortSignal | undefined, allowMissing: boolean): Promise<boolean> {
    const parts = normalizedPath(path).split('/')
    if (parts.some(internalDirectory)) {
      throw new SourceError('permission-denied', 'Internal dependency and state directories are excluded from discovery.')
    }
    const canonicalRoot = await realpath(this.root)
    let current = canonicalRoot
    for (const [index, part] of parts.entries()) {
      signal?.throwIfAborted()
      current = resolve(current, part)
      let info: Awaited<ReturnType<typeof lstat>>
      try { info = await lstat(current) }
      catch (error) {
        if (allowMissing && error instanceof Error && 'code' in error && error.code === 'ENOENT') return true
        throw error
      }
      if (info.isSymbolicLink()) throw new SourceError('permission-denied', 'Symbolic links are not admitted by source discovery.')
      if (index === parts.length - 1) return info.isFile()
      if (!info.isDirectory()) return false
    }
    return false
  }

  /**
   * Read one directory without traversing descendants or admitting symbolic links.
   * @param path - root-relative directory; empty for the source root.
   * @param signal - cancels the observation.
   * @returns Immediate entries and any discovery issues.
   */
  async listDirectory(path: string, signal?: AbortSignal): Promise<SourceDirectory> {
    const root = await realpath(this.root)
    let directory = root
    if (path !== '') {
      for (const part of normalizedPath(path).split('/')) {
        signal?.throwIfAborted()
        if (internalDirectory(part)) throw new SourceError('permission-denied', 'This internal directory is not a source location.')
        directory = resolve(directory, part)
        const info = await lstat(directory)
        if (info.isSymbolicLink()) throw new SourceError('permission-denied', 'Symbolic links are not admitted by source discovery.')
        if (!info.isDirectory()) throw new SourceError('not-found', 'The selected location is not a directory.')
      }
    }
    signal?.throwIfAborted()
    const entries: SourceDirectoryEntry[] = []
    const issues: ScanIssue[] = []
    let visited = 0
    let partial = false
    const stream = await opendir(directory)
    for await (const item of stream) {
      signal?.throwIfAborted()
      if (internalDirectory(item.name)) continue
      if (visited++ >= this.maxFiles) { partial = true; issues.push({ path, reason: 'The directory entry limit was reached.' }); break }
      const child = path ? `${path}/${item.name}` : item.name
      if (item.isSymbolicLink()) { partial = true; issues.push({ path: child, reason: 'Symbolic links are not traversed by discovery.' }) }
      else if (item.isDirectory()) entries.push({ path: child, kind: 'directory' })
      else if (item.isFile()) entries.push({ path: child, kind: 'file' })
    }
    entries.sort((left, right) => Number(right.kind === 'directory') - Number(left.kind === 'directory') || left.path.localeCompare(right.path))
    return { entries, issues, partial }
  }

  /**
   * Read a complete current UTF-8 file after resolving its containment in this root.
   * @param path - normalized relative source path; directories and escaped symlink targets are rejected.
   * @param signal - optional cancellation checked before access and between bounded reads.
   * @returns complete decoded text, preserving a source BOM; oversized files are never truncated.
   * @throws {Error} on cancellation, access failure, invalid UTF-8 or a file exceeding the byte bound.
   */
  async read(path: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const canonical = await this.contained(path)
    const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const info = await handle.stat()
      if (!info.isFile()) throw new SourceError('invalid-request', 'The selected source is not a regular file.')
      if (info.size > this.maxFileBytes) throw new SourceError('unavailable', 'The source exceeds the configured byte limit; no truncated reading was returned.')
      const bytes = await readBounded(handle, info.size, this.maxFileBytes, signal)
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    } finally { await handle.close() }
  }

  /**
   * Read complete bounded binary source bytes without granting write access.
   * @param path - normalized root-relative file identity.
   * @param signal - cancellation checked before and between reads.
   * @param maxBytes - optional narrower bound, never wider than this root's binary limit.
   * @returns complete bytes; oversized data is rejected rather than truncated.
   */
  async readBytes(path: string, signal?: AbortSignal, maxBytes: number = this.maxBinaryBytes): Promise<Uint8Array> {
    signal?.throwIfAborted()
    const bound = Math.min(maxBytes, this.maxBinaryBytes)
    if (!Number.isSafeInteger(bound) || bound < 1) throw new SourceError('invalid-request', 'The binary source limit must be a positive integer.')
    const canonical = await this.contained(path)
    const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const info = await handle.stat()
      if (!info.isFile()) throw new SourceError('invalid-request', 'The selected source is not a regular file.')
      if (info.size > bound) throw new SourceError('unavailable', 'The source exceeds the configured byte limit; no truncated reading was returned.')
      return await readBounded(handle, info.size, bound, signal)
    } finally { await handle.close() }
  }

  /**
   * Resolve a source location for a trusted domain provider after the usual containment check.
   * @param path - normalized relative path; this operation grants no access outside this root.
   * @returns canonical source path in the Host filesystem.
   */
  async resolvePath(path: string): Promise<string> { return this.contained(path) }

  /**
   * Discover regular files without traversing symlinks or internal dependency/state directories.
   * @param signal - optional cancellation checked between discovered directories.
   * @returns relative paths plus issues; the entry bound or skipped paths mark discovery partial.
   * @throws {Error} when the root cannot be opened as a directory or cancellation is requested.
   */
  async scan(signal?: AbortSignal): Promise<SourceScan> {
    const canonicalRoot = await realpath(this.root)
    if (!(await stat(canonicalRoot)).isDirectory()) throw new SourceError('invalid-request', 'The configured research root is not a directory.')
    const paths: string[] = []
    const directories: string[] = []
    const issues: ScanIssue[] = []
    const queue = ['']
    let visited = 0
    let partial = false
    while (queue.length) {
      signal?.throwIfAborted()
      const directory = queue.shift()
      if (directory === undefined) break
      let entries
      try { entries = await readdir(directory ? await this.contained(directory) : canonicalRoot, { withFileTypes: true }) }
      catch (error) { issues.push({ path: directory, reason: sourceFailure(error).message }); partial = true; continue }
      directories.push(directory)
      entries.sort((a, b) => a.name.localeCompare(b.name))
      let stopped = false
      for (const entry of entries) {
        if (internalDirectory(entry.name)) continue
        if (visited >= this.maxFiles) { stopped = true; break }
        visited++
        const path = directory ? `${directory}/${entry.name}` : entry.name
        if (entry.isSymbolicLink()) { issues.push({ path, reason: 'Symbolic links are not traversed by discovery.' }); partial = true }
        else if (entry.isDirectory()) queue.push(path)
        else if (entry.isFile()) paths.push(path)
      }
      if (stopped || (visited >= this.maxFiles && queue.length > 0)) {
        partial = true
        issues.push({ path: '', reason: 'Discovery reached the configured entry limit; undiscovered sources may remain.' })
        break
      }
    }
    return { paths, directories, issues, partial }
  }

  private async contained(path: string): Promise<string> {
    normalizedPath(path)
    const canonicalRoot = await realpath(this.root)
    const canonical = await realpath(resolve(canonicalRoot, path))
    const within = relative(canonicalRoot, canonical)
    if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
      throw new SourceError('permission-denied', 'The source resolves outside the configured research root.')
    }
    return canonical
  }
}
