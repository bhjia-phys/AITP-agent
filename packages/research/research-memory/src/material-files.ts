/** Bounded file operations for explicitly selected research material locations. */
import { constants } from 'node:fs'
import { lstat, mkdir, open } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { OnboardingFailure, missing, safeSource, syncDirectory } from './onboarding-files.ts'
import { readBoundedText } from './writer-storage.ts'

async function checkOpened(root: string, path: string, file: Awaited<ReturnType<typeof open>>): Promise<void> {
  await safeSource(root, path, 'file')
  const opened = await file.stat()
  const current = await lstat(path)
  if (!opened.isFile() || opened.nlink !== 1 || current.ino !== opened.ino || current.dev !== opened.dev) {
    throw new OnboardingFailure('permission-denied', 'The selected file changed while it was opened.')
  }
}

/**
 * Read binary bytes with the same confinement and unaliased-file requirements as source writing.
 * @param root - canonical authorized root, including private runtime storage when reading a staged payload.
 * @param path - absolute regular file inside that root.
 * @param maxBytes - maximum complete content size.
 * @returns fresh bounded bytes after checking the opened file identity.
 */
export async function readMaterialBytes(root: string, path: string, maxBytes: number): Promise<Buffer> {
  await safeSource(root, path, 'file')
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    await checkOpened(root, path, file)
    if ((await file.stat()).size > maxBytes) throw new OnboardingFailure('invalid-request', 'The selected material exceeds the content byte bound.')
    const bytes = Buffer.alloc(maxBytes + 1)
    let length = 0
    while (length < bytes.length) {
      const read = await file.read(bytes, length, bytes.length - length)
      if (read.bytesRead === 0) break
      length += read.bytesRead
    }
    if (length > maxBytes) throw new OnboardingFailure('invalid-request', 'The selected material exceeds the content byte bound.')
    await checkOpened(root, path, file)
    return bytes.subarray(0, length)
  } finally { await file.close() }
}

/**
 * Create only the selected material's missing directories, checking every existing component.
 * @param root - canonical writable research root.
 * @param path - absolute parent directory within that root; syntax is validated by the caller.
 * @returns after directory creation and supported directory synchronization.
 */
export async function materialDirectory(root: string, path: string): Promise<void> {
  await safeSource(root, root, 'directory')
  let current = root
  const suffix = relative(root, path)
  for (const part of suffix === '' ? [] : suffix.split(sep)) {
    const parent = current
    current = join(current, part)
    try { await safeSource(root, current, 'directory') }
    catch (error) {
      if (!missing(error)) throw error
      await safeSource(root, parent, 'directory')
      try { await mkdir(current, { mode: 0o700 }) }
      catch (creationError) {
        if (!(creationError instanceof Error && 'code' in creationError && creationError.code === 'EEXIST')) throw creationError
      }
      await safeSource(root, current, 'directory')
      await syncDirectory(parent)
    }
  }
}

/**
 * Publish a new material exclusively without replacing an existing name.
 * @param root - canonical writable root.
 * @param path - selected destination in an existing checked directory.
 * @param bytes - complete bounded payload already retained in private operation storage.
 * @returns after file and supported directory synchronization; failure can leave a partial new file.
 */
export async function createMaterialFile(root: string, path: string, bytes: Uint8Array): Promise<void> {
  await safeSource(root, dirname(path), 'directory')
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    await checkOpened(root, path, file)
    await file.writeFile(bytes)
    await file.sync()
  } finally { await file.close() }
  await syncDirectory(dirname(path))
}

/**
 * Append an authored material link, preserving existing text and unrelated concurrent appends.
 * @param root - canonical writable root.
 * @param path - existing ordinary account or index inside that root.
 * @param line - one complete Markdown link with its optional using passage.
 * @param maxBytes - maximum complete account size after addition.
 * @returns after observing an identical existing line or synchronizing the append.
 */
export async function appendMaterialLink(root: string, path: string, line: string, maxBytes: number): Promise<void> {
  await safeSource(root, path, 'file')
  if ((await lstat(path)).size > maxBytes) {
    throw new OnboardingFailure('invalid-request', 'The selected account exceeds its byte bound; the material link was not appended.')
  }
  const text = await readBoundedText(path, maxBytes)
  if (text.split(/\r?\n/).includes(line)) return
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const headings = [...text.matchAll(/^#{1,2}\s+(.+)$/gm)]
  const lastTitle = headings.at(-1)?.[1]?.trim()
  const heading = lastTitle !== undefined && /^(materials|related materials|references|资料|相关资料|材料)$/i.test(lastTitle)
    ? '' : `## Materials${newline}${newline}`
  const addition = `${text.endsWith('\n') ? newline : newline + newline}${heading}${line}${newline}`
  if (Buffer.byteLength(text + addition, 'utf8') > maxBytes) {
    throw new OnboardingFailure('invalid-request', 'The selected account has no room for the material link within its byte bound.')
  }
  const file = await open(path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW)
  try {
    await checkOpened(root, path, file)
    // A changed source must be reread before deriving another append, even when its size is unchanged.
    if (await readBoundedText(path, maxBytes) !== text) {
      throw new OnboardingFailure('unavailable', 'The selected account changed before linking. Retry to preserve its new contents.')
    }
    await file.writeFile(addition, 'utf8')
    await file.sync()
  } finally { await file.close() }
}
