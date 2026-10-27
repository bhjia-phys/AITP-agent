import { normalizedPath, SourceError } from '@deepseek-ai/dsh-research-resources/files'
import type { ResourceId, TopicId } from './types.ts'

export { GuardedFiles as MarkdownFiles, normalizedPath, SourceError, sourceFailure } from '@deepseek-ai/dsh-research-resources/files'
export type { ScanIssue, SourceScan } from '@deepseek-ai/dsh-research-resources/files'

/**
 * Encode a source path as an identity; unknown external renames are unresolved.
 * @param path - a normalized path relative to the configured research root.
 * @returns a resource identity stable across reads and restarts at the same path.
 * @throws {SourceError} when the path is not normalized.
 */
export function resourceIdForPath(path: string): ResourceId {
  return `resource:${encodeURIComponent(normalizedPath(path))}` as ResourceId
}

/**
 * Encode an account path without asserting that discovery recognizes it as a topic.
 * @param path - a normalized path relative to the configured research root.
 * @returns a path-derived topic identity; moving the account changes its identity.
 * @throws {SourceError} when the path is not normalized.
 */
export function topicIdForPath(path: string): TopicId {
  return `topic:${encodeURIComponent(normalizedPath(path))}` as TopicId
}

/**
 * Decode a Markdown adapter resource identity before a separately guarded filesystem read.
 * @param id - a resource identity created from a normalized relative source path.
 * @returns its normalized relative path, without checking existence or access.
 * @throws {SourceError} for a foreign prefix, malformed encoding or invalid path.
 */
export function pathForResourceId(id: ResourceId): string {
  return decodePathId(id, 'resource:')
}

/**
 * Decode a Markdown adapter topic identity without inferring scientific ownership.
 * @param id - a topic identity created from a normalized relative account path.
 * @returns its normalized relative path, which still requires account-recognition and access checks.
 * @throws {SourceError} for a foreign prefix, malformed encoding or invalid path.
 */
export function pathForTopicId(id: TopicId): string {
  return decodePathId(id, 'topic:')
}

function decodePathId(id: string, prefix: string): string {
  if (!id.startsWith(prefix)) throw new SourceError('invalid-request', 'The source identity does not belong to this adapter.')
  let path: string
  try { path = decodeURIComponent(id.slice(prefix.length)) }
  catch (error) { throw new SourceError('invalid-request', `The source identity has invalid encoding: ${error instanceof URIError ? 'URI encoding' : 'encoding'}.`) }
  return normalizedPath(path)
}
