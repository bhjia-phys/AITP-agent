/** Filesystem publication shared by explicit project and topic onboarding. */
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, rm } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { WorkspaceError } from './types.ts'
import { publishText, readBoundedText } from './writer-storage.ts'
import { parseMarkdown } from './markdown-model.ts'

/** Expected onboarding failure, safe to expose without an absolute source path. */
export class OnboardingFailure extends Error {
  constructor(readonly code: 'invalid-request' | 'read-only' | 'unavailable' | 'operation-reused' | 'permission-denied', message: string) {
    super(message)
  }
}

/**
 * Translate rejected onboarding and IO into a source-safe domain failure.
 * @param error - caught onboarding or filesystem error.
 * @returns the explicit domain rejection, or a generic retryable storage failure without absolute source paths.
 */
export function onboardingFailure(error: unknown): WorkspaceError {
  return { code: error instanceof OnboardingFailure ? error.code : 'unavailable',
    message: error instanceof OnboardingFailure ? error.message : 'Research setup could not complete. Check source and application storage access.',
    retryable: !(error instanceof OnboardingFailure) || error.code === 'unavailable' }
}

function inside(root: string, path: string): boolean {
  const suffix = relative(root, path)
  return suffix === '' || (!suffix.startsWith(`..${sep}`) && suffix !== '..' && !isAbsolute(suffix))
}

async function prospectivePath(path: string): Promise<string> {
  try { return await realpath(path) }
  catch (error) {
    if (!missing(error)) throw error
    const parent = dirname(path)
    if (parent === path) throw error
    return join(await prospectivePath(parent), basename(path))
  }
}

/**
 * Identify ordinary filesystem absence without treating other IO failures as missing data.
 * @param error - caught filesystem operation failure.
 * @returns whether the error is an Error carrying the ENOENT code.
 */
export function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/**
 * Check runtime-state confinement before and after optional directory creation.
 * @param root - canonical scientific root that must not contain runtime state.
 * @param directory - absolute application-state location, whose missing suffix may be created.
 * @param create - whether to create missing directories with owner-only permissions.
 * @returns the canonical location, retaining any missing suffix when creation is disabled.
 * @throws OnboardingFailure for a relative or contained location; propagates other filesystem failures.
 */
export async function outsideState(root: string, directory: string, create: boolean): Promise<string> {
  if (!isAbsolute(directory) || inside(root, await prospectivePath(resolve(directory)))) {
    throw new OnboardingFailure('invalid-request', 'Application receipts must be stored outside the research root.')
  }
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 })
  const canonical = await prospectivePath(resolve(directory))
  if (inside(root, canonical)) throw new OnboardingFailure('invalid-request', 'Application storage resolves inside the research root.')
  return canonical
}

/**
 * Check source confinement and reject aliased directories or final files without reserving them.
 * @param root - canonical scientific directory, rechecked against its current real path.
 * @param path - absolute source target inside that root.
 * @param kind - required final target type; file targets must have a single hard link.
 * @returns after every existing path component and final real path pass the checks.
 * @throws OnboardingFailure for unsafe targets; propagates absence and other filesystem failures.
 */
export async function safeSource(root: string, path: string, kind: 'file' | 'directory'): Promise<void> {
  if (!inside(root, path) || await realpath(root) !== root) {
    throw new OnboardingFailure('permission-denied', 'The source root changed or the requested path escapes it.')
  }
  if (!(await lstat(root)).isDirectory()) throw new OnboardingFailure('permission-denied', 'The research root is no longer a directory.')
  let current = root
  const suffix = relative(root, path)
  const parts = suffix === '' ? [] : suffix.split(sep)
  for (const [index, part] of parts.entries()) {
    current = join(current, part)
    const info = await lstat(current)
    const finalFile = index + 1 === parts.length && kind === 'file'
    if (info.isSymbolicLink() || (finalFile ? !info.isFile() || info.nlink !== 1 : !info.isDirectory())) {
      throw new OnboardingFailure('permission-denied', 'Research onboarding requires ordinary directories and unaliased regular files.')
    }
  }
  if (!inside(root, await realpath(path))) throw new OnboardingFailure('permission-denied', 'The source path resolves outside the research root.')
}

async function checkedHandle(root: string, path: string, flags: number): Promise<FileHandle> {
  await safeSource(root, path, 'file')
  const file = await open(path, flags | constants.O_NOFOLLOW)
  try {
    await checkHandle(root, path, file)
    return file
  } catch (error) {
    await file.close()
    throw error
  }
}

async function checkHandle(root: string, path: string, file: FileHandle): Promise<void> {
  await safeSource(root, path, 'file')
  const actual = await file.stat()
  const current = await lstat(path)
  if (!actual.isFile() || actual.nlink !== 1 || actual.ino !== current.ino || actual.dev !== current.dev) {
    throw new OnboardingFailure('permission-denied', 'The source changed while it was opened; no write was attempted.')
  }
}

/**
 * Synchronize an existing directory on supported hosts; Windows performs no directory sync.
 * @param path - directory whose entries should be persisted.
 * @returns after synchronization and handle closure, or immediately on Windows.
 * @throws when opening, synchronizing or closing the directory fails.
 */
export async function syncDirectory(path: string): Promise<void> {
  if (process.platform === 'win32') return
  const directory = await open(path, 'r')
  try { await directory.sync() }
  finally { await directory.close() }
}

/**
 * Create an account exclusively, synchronize its bytes and synchronize its directory where supported.
 * @param root - canonical authorized scientific root.
 * @param path - new account path in an existing checked directory; existing targets are never replaced.
 * @param text - complete UTF-8 account content, bounded by the caller before publication.
 * @returns after file synchronization, closure and supported directory synchronization.
 * @throws on unsafe paths, existing targets or IO failure; a failure after creation can leave a partial account.
 */
export async function createAccount(root: string, path: string, text: string): Promise<void> {
  await safeSource(root, dirname(path), 'directory')
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    await checkHandle(root, path, file)
    await file.writeFile(text, 'utf8')
    await file.sync()
  } finally { await file.close() }
  await syncDirectory(dirname(path))
}

/**
 * Insert a link in the last recognized child-directory section, or append a new section when absent.
 * The caller owns source-publication serialization; unrelated text from the fresh read is preserved.
 * @param root - canonical authorized scientific root.
 * @param path - existing unaliased parent account.
 * @param link - complete Markdown child-link line prepared by the onboarding owner.
 * @param maxBytes - maximum complete parent-account UTF-8 size after insertion.
 * @returns after appending and syncing, or publishing the updated account with its existing permissions.
 * @throws on unsafe paths, excessive size or IO failure; a publication failure can leave the outcome uncertain.
 */
export async function appendChild(root: string, path: string, link: string, maxBytes: number): Promise<void> {
  await safeSource(root, path, 'file')
  const text = await readBoundedText(path, maxBytes)
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const sections = parseMarkdown(relative(root, path).split(sep).join('/'), text).sections
  const childSection = /^(topics?|subtopics?|branches|child topics?|课题|子课题|子方向|研究分支|分支)$/i
  const directory = sections.filter(section => childSection.test(section.title)).at(-1)
  const offset = directory?.end ?? text.length
  const prefix = text.slice(0, offset)
  const addition = `${prefix.endsWith('\n') ? newline : newline + newline}${directory === undefined ? `## Child topics${newline}${newline}` : ''}${link}${newline}${offset < text.length ? newline : ''}`
  const after = prefix + addition + text.slice(offset)
  if (Buffer.byteLength(after, 'utf8') > maxBytes) {
    throw new OnboardingFailure('invalid-request', 'The parent account has no room for a child link within the source byte bound.')
  }
  const file = await checkedHandle(root, path, constants.O_WRONLY | constants.O_APPEND)
  try {
    await checkHandle(root, path, file)
    if (offset === text.length) {
      await file.writeFile(addition, 'utf8')
      await file.sync()
    }
  } finally { await file.close() }
  if (offset < text.length) {
    await safeSource(root, path, 'file')
    await publishText(path, after, (await lstat(path)).mode & 0o777)
  }
}

/**
 * Hold an exclusive cross-process claim while an action settles, without stealing interrupted claims.
 * @param directory - existing application-state directory owned and checked by the caller.
 * @param name - trusted claim filename scoped to that directory.
 * @param action - operation to run after exclusive claim creation succeeds.
 * @returns the action result after closing and removing the claim.
 * @throws on contention, action failure or release failure; interrupted claims require inspection before removal.
 */
export async function claim<T>(directory: string, name: string, action: () => Promise<T>): Promise<T> {
  const path = join(directory, name)
  let file: FileHandle
  try { file = await open(path, 'wx', 0o600) }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new OnboardingFailure('unavailable', 'Another setup operation holds application storage. If a host stopped during setup, inspect its receipts before removing the stale claim.')
    }
    throw error
  }
  try { return await action() }
  finally {
    await file.close()
    await rm(path)
  }
}
