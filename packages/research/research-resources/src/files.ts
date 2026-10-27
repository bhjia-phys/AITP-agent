/** Shared bounded local reads; root authorization belongs to the source service. */
import { constants } from 'node:fs'
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
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
export interface SourceScan { readonly paths: readonly string[]; readonly issues: readonly ScanIssue[]; readonly partial: boolean }

function internalDirectory(name: string): boolean {
  const normalized = name.toLowerCase()
  return normalized === '.git' || normalized === 'node_modules' || normalized === '.research-memory'
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
      const bytes = Buffer.alloc(this.maxFileBytes + 1)
      let length = 0
      while (length < bytes.length) {
        signal?.throwIfAborted()
        const result = await handle.read(bytes, length, bytes.length - length, length)
        if (result.bytesRead === 0) break
        length += result.bytesRead
      }
      if (length > this.maxFileBytes) throw new SourceError('unavailable', 'The source grew beyond the configured byte limit; no truncated reading was returned.')
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length))
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
      const bytes = Buffer.alloc(bound + 1)
      let length = 0
      while (length < bytes.length) {
        signal?.throwIfAborted()
        const result = await handle.read(bytes, length, bytes.length - length, length)
        if (result.bytesRead === 0) break
        length += result.bytesRead
      }
      if (length > bound) throw new SourceError('unavailable', 'The source grew beyond the configured byte limit; no truncated reading was returned.')
      return bytes.subarray(0, length)
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
    return { paths, issues, partial }
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
