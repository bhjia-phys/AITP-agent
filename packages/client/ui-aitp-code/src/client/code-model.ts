/** Presentation-only projections over observed repository resources. */
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { ResourceSummary, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'

/** Observed source with its repository path and label for the current directory or search. */
export interface CodeFile { readonly path: string; readonly name: string; readonly resource: ResourceSummary }
/** Directory represented by a descendant in the returned source page. */
export interface CodeFolder { readonly path: string; readonly name: string }

/**
 * Derive only directories represented by the currently returned source page.
 * @param items - provider observations, which may cover only part of the repository.
 * @param folder - current repository-relative directory, or an empty string for its root.
 * @param searching - whether to show matching files with their full paths instead of grouping directories.
 * @returns sorted visible folders and files without inferring undiscovered entries.
 */
export function codeDirectory(items: readonly ResourceSummary[], folder: string, searching: boolean): {
  readonly folders: readonly CodeFolder[]
  readonly files: readonly CodeFile[]
} {
  const folders = new Map<string, CodeFolder>()
  const files: CodeFile[] = []
  const prefix = folder ? `${folder}/` : ''
  for (const resource of items) {
    const path = materialSourcePath(resource.ref.sourceId)
    if (path === undefined || (!searching && !path.startsWith(prefix))) continue
    const relative = searching ? path : path.slice(prefix.length)
    if (!searching && resource.metadata['entryKind'] === 'source-folder' && !relative.includes('/')) {
      folders.set(relative, { name: relative, path })
      continue
    }
    const slash = relative.indexOf('/')
    if (!searching && slash !== -1) {
      const name = relative.slice(0, slash)
      folders.set(name, { name, path: `${prefix}${name}` })
    } else files.push({ path, name: searching ? path : relative, resource })
  }
  return { folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files: files.sort((a, b) => a.path.localeCompare(b.path)) }
}

/**
 * Preserve a provider's precise location when a catalog entry is opened.
 * @param resource - observed source and its optional locator.
 * @returns the source reference with the provider's locator when present.
 */
export function codeSelection(resource: ResourceSummary): SourceSelection {
  return { ref: resource.ref, ...resource.locator === undefined ? {} : { locator: resource.locator } }
}

/**
 * Classify an observed Git XY status without replacing the original code.
 * @param code - provider-supplied Git status code.
 * @returns the display category, with a generic changed label for unrecognized states.
 */
export function codeStatus(code: string): 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict' | 'changed' {
  if (code === '??') return 'untracked'
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflict'
  if (code.includes('R')) return 'renamed'
  if (code.includes('D')) return 'deleted'
  if (code.includes('A')) return 'added'
  return code.includes('M') ? 'modified' : 'changed'
}

/** Observed Git change retaining its raw status and any recorded previous path. */
export interface ChangedFile { readonly path: string; readonly code: string; readonly previousPath?: string }

/**
 * Read the provider's structured status result without guessing malformed entries.
 * @param text - serialized provider response containing the observed status list.
 * @returns the complete validated list, or undefined so the caller can retain the original text.
 */
export function codeChanges(text: string): readonly ChangedFile[] | undefined {
  let value: unknown
  try { value = JSON.parse(text) } catch { return undefined }
  if (typeof value !== 'object' || value === null || !('status' in value) || !Array.isArray(value.status)) return undefined
  const entries: readonly unknown[] = value.status
  const files: ChangedFile[] = []
  for (const item of entries) {
    if (typeof item !== 'object' || item === null || !('path' in item) || typeof item.path !== 'string'
      || !('code' in item) || typeof item.code !== 'string'
      || ('previousPath' in item && typeof item.previousPath !== 'string')) return undefined
    files.push({ path: item.path, code: item.code,
      ...'previousPath' in item && typeof item.previousPath === 'string' ? { previousPath: item.previousPath } : {} })
  }
  return files
}

/** Observed commit identity, date and verbatim subject from the bounded Git history. */
export interface CodeCommit { readonly revision: string; readonly date: string; readonly subject: string }

/**
 * Parse only the bounded, tab-separated Git history contract, retaining commit subjects verbatim.
 * @param text - provider output with revision, date and subject separated by tabs on each line.
 * @returns validated history rows, an empty list for blank output, or undefined for malformed history.
 */
export function codeHistory(text: string): readonly CodeCommit[] | undefined {
  if (text.trim() === '') return []
  const rows: CodeCommit[] = []
  for (const line of text.trimEnd().split('\n')) {
    const first = line.indexOf('\t'), second = line.indexOf('\t', first + 1)
    const revision = line.slice(0, first), date = line.slice(first + 1, second)
    if (first === -1 || second === -1 || !/^[0-9a-f]{40,64}$/u.test(revision) || Number.isNaN(Date.parse(date))) return undefined
    rows.push({ revision, date, subject: line.slice(second + 1) })
  }
  return rows
}
