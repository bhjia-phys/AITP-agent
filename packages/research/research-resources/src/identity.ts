/** Root-qualified identity helpers, independent of discovery or scientific ownership. */
import { normalizedPath, SourceError } from './files.ts'
import type { ResourceEntryId, SourceId, SourceRef, SourceRootId } from './types.ts'

/**
 * Retain a Host-chosen source-root identity.
 * @param value - stable nonempty configured root name.
 * @returns the same identity, branded for source addressing.
 * @throws when the identity is empty or contains a null byte.
 */
export function sourceRootId(value: string): SourceRootId {
  if (!value || value.includes('\0')) throw new SourceError('invalid-request', 'A source root needs a nonempty identity.')
  return value as SourceRootId
}

/**
 * Encode a normalized relative path as a root-local source identity.
 * @param path - slash-separated file path within an independently authorized root.
 * @returns a restart-stable path identity; external renames remain unresolved.
 */
export function sourceIdForPath(path: string): SourceId {
  return `source:${encodeURIComponent(normalizedPath(path))}` as SourceId
}

/**
 * Recover a normalized source path before a fresh guarded read.
 * @param id - path identity from sourceIdForPath; virtual provider identities are not file paths.
 * @returns the normalized root-relative path.
 * @throws for foreign identities, malformed encoding or invalid paths.
 */
export function pathForSourceId(id: SourceId): string {
  if (!id.startsWith('source:')) throw new SourceError('invalid-request', 'This source identity is not a local file.')
  let path: string
  try { path = decodeURIComponent(id.slice(7)) }
  catch (error) {
    throw new SourceError('invalid-request', `The source identity has invalid encoding: ${error instanceof URIError ? 'URI encoding' : 'encoding'}.`)
  }
  return normalizedPath(path)
}

/**
 * Distinguish catalog passages and roots without copying their source content.
 * @param reference - root-qualified source identity.
 * @param suffix - optional provider-owned passage or index-row identity.
 * @returns an opaque entry identity unique to this reference and suffix.
 */
export function resourceEntryId(reference: SourceRef, suffix: string = ''): ResourceEntryId {
  return JSON.stringify([reference.rootId, reference.sourceId, suffix]) as ResourceEntryId
}
