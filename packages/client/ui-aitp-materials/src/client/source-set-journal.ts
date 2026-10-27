/** Same-tab recovery of pending source-set commands; saved collections remain Host-owned. */
import type { SaveSourceSetRequest, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { parseMaterialLocator } from '@deepseek-ai/dsh-research-resources/protocol'
import type { MaterialsScope, SelectedMaterial } from './contracts.ts'

const KEY = 'aitp.materials.pending-source-sets.v1'
const MAX_BYTES = 524_288
/** An original pending command and the labels required to inspect its exact selected sources. */
export interface SourceSetAttempt {
  readonly scope: MaterialsScope
  readonly request: SaveSourceSetRequest
  readonly labels: readonly Pick<SelectedMaterial, 'title' | 'domain'>[]
}
/** Bounded recovery metadata for a tab's unconfirmed source-set commands. */
export interface SourceSetJournal {
  read(): { readonly entries: readonly SourceSetAttempt[]; readonly problem: string | null }
  write(entries: readonly SourceSetAttempt[]): string | null
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, maximum = 4096): value is string => typeof value === 'string' && value.length > 0 && value.length <= maximum && !value.includes('\0')
function selection(value: unknown): value is SourceSelection {
  if (!record(value) || !record(value['ref']) || !text(value['ref']['rootId']) || !text(value['ref']['sourceId'])) return false
  if (value['selectedText'] !== undefined && (typeof value['selectedText'] !== 'string' || value['selectedText'].length > 100_000)) return false
  try { if (value['locator'] !== undefined) parseMaterialLocator(JSON.stringify(value['locator'])); return true }
  catch { return false }
}
function validEntry(value: unknown): value is SourceSetAttempt {
  if (!record(value) || !record(value['scope']) || !record(value['request']) || !Array.isArray(value['labels'])) return false
  const scope = value['scope'], request = value['request']
  if (scope['workspaceId'] !== undefined && !text(scope['workspaceId']) || scope['topicId'] !== undefined && (!text(scope['topicId']) || !text(scope['workspaceId']))) return false
  if (scope['title'] !== undefined && typeof scope['title'] !== 'string') return false
  if (!text(request['operationId'], 256) || !text(request['title'], 2000) || request['id'] !== undefined && !text(request['id'])) return false
  const sources = request['selections']
  if (!Array.isArray(sources) || sources.length === 0 || sources.length > 50 || !sources.every(selection)) return false
  if (request['topics'] !== undefined && (!Array.isArray(request['topics']) || request['topics'].length > 64
    || !request['topics'].every(topic => record(topic) && text(topic['workspaceId']) && text(topic['topicId'])))) return false
  return value['labels'].length === sources.length && value['labels'].every(label => record(label)
    && typeof label['title'] === 'string' && ['literature', 'knowledge', 'code'].includes(String(label['domain'])))
}

/**
 * Preserve unconfirmed source-set commands for explicit same-tab recovery.
 * @param storage - optional sessionStorage; no local filesystem or scientific writes.
 * @param messages - locale-owned storage diagnostics.
 * @returns a bounded journal that never overwrites unreadable pending operations.
 */
export function createSourceSetJournal(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
  messages: { readonly unavailable: string; readonly invalid: string }): SourceSetJournal {
  let corrupted = false
  return {
    read: () => {
      if (storage === undefined) return { entries: [], problem: null }
      try {
        const raw = storage.getItem(KEY)
        if (raw === null) return { entries: [], problem: null }
        const value: unknown = new TextEncoder().encode(raw).byteLength <= MAX_BYTES ? JSON.parse(raw) : null
        if (!record(value) || value['version'] !== 1 || !Array.isArray(value['entries']) || value['entries'].length > 16
          || !value['entries'].every(validEntry)) { corrupted = true; return { entries: [], problem: messages.invalid } }
        const entries = value['entries']
        const scopes = entries.map(entry => JSON.stringify([entry.scope.workspaceId ?? null, entry.scope.topicId ?? null]))
        if (new Set(scopes).size !== entries.length
          || new Set(entries.map(entry => entry.request.operationId)).size !== entries.length) {
          corrupted = true
          return { entries: [], problem: messages.invalid }
        }
        return { entries, problem: null }
      } catch { corrupted = true; return { entries: [], problem: messages.invalid } }
    },
    write: (entries) => {
      if (corrupted) return messages.invalid
      if (storage === undefined) return entries.length === 0 ? null : messages.unavailable
      try {
        if (entries.length === 0) { storage.removeItem(KEY); return null }
        const raw = JSON.stringify({ version: 1, entries })
        if (entries.length > 16 || new TextEncoder().encode(raw).byteLength > MAX_BYTES) return messages.unavailable
        storage.setItem(KEY, raw)
        return null
      } catch { return messages.unavailable }
    },
  }
}
