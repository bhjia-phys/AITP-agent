import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, lstat, open, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/** Tracks whether a failed publication may already have changed its destination. */
export class PublicationFailure extends Error {
  /**
   * @param attempted Whether rename was reached, so the destination may have changed.
   * @param cause Original storage failure retained for diagnostics.
   */
  constructor(readonly attempted: boolean, cause: unknown) {
    super('The file publication did not complete with a confirmed outcome.', { cause })
  }
}

/**
 * Publish UTF-8 text by an exclusive sibling file and rename, retaining POSIX mode.
 * This provides one-file publication, not a transaction with external editors.
 * @param path Existing destination or a new runtime receipt path.
 * @param text Complete text to publish.
 * @param mode Permissions to retain; runtime receipts use owner-only permissions.
 * @returns Resolves after file and directory sync on platforms supporting directory sync.
 * @throws PublicationFailure with attempted=true when the destination outcome is uncertain.
 */
export async function publishText(path: string, text: string, mode: number): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  let attempted = false
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(text, 'utf8')
      await file.sync()
    } finally {
      await file.close()
    }
    await chmod(temporary, mode)
    attempted = true
    await rename(temporary, path)
    if (process.platform !== 'win32') {
      const directory = await open(dirname(path), 'r')
      try {
        await directory.sync()
      } finally {
        await directory.close()
      }
    }
  } catch (error) {
    throw new PublicationFailure(attempted, error)
  } finally {
    try {
      await rm(temporary, { force: true })
    } catch (error) {
      // Cleanup cannot erase or reclassify an already observed publication outcome.
      if (!(error instanceof Error)) throw error
    }
  }
}

/**
 * Read a bounded regular file without following a final symlink.
 * @param path File in a previously checked directory.
 * @param maxBytes Complete UTF-8 byte bound.
 * @returns Raw text for the caller's durable-format validation.
 * @throws If the file is unsafe, exceeds the bound, contains invalid UTF-8 or cannot be read.
 */
export async function readBoundedText(path: string, maxBytes: number): Promise<string> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) {
    throw new Error('The source is not a bounded regular file.')
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const chunks: Buffer[] = []
    let total = 0
    while (total <= maxBytes) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - total))
      const { bytesRead } = await file.read(chunk)
      if (bytesRead === 0) break
      total += bytesRead
      if (total > maxBytes) throw new Error('The source exceeds its configured byte bound.')
      chunks.push(chunk.subarray(0, bytesRead))
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total))
  } finally {
    await file.close()
  }
}
