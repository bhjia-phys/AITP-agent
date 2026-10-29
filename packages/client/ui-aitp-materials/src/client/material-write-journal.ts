/** Same-tab recovery of unconfirmed write intents; receipts and scientific files remain Host-owned. */
import type { MaterialWriteCommand } from './material-write-contracts.ts'

const KEY = 'aitp.materials.pending-files.v1'
const LIMIT = 2_097_152

/** Only original commands awaiting confirmation are stored, never a second material catalog. */
export interface MaterialWriteJournal {
  read(): { readonly commands: Readonly<Record<string, MaterialWriteCommand>>; readonly problem: string | null }
  write(commands: Readonly<Record<string, MaterialWriteCommand>>): string | null
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, limit = 16384): value is string => typeof value === 'string' && value.length > 0 && value.length <= limit && !value.includes('\0')

function command(value: unknown): value is MaterialWriteCommand {
  if (!record(value) || !record(value['scope']) || !text(value['scope']['workspaceId']) || !text(value['operationId'], 256) || !text(value['relativePath'])) return false
  if (value['scope']['topicId'] !== undefined && !text(value['scope']['topicId'])) return false
  if (value['scope']['title'] !== undefined && !text(value['scope']['title'])) return false
  const association = value['association']
  if (association !== undefined && (!record(association) || !text(association['accountPath']) || !text(association['title'])
    || association['description'] !== undefined && typeof association['description'] !== 'string')) return false
  if (value['kind'] === 'text') return typeof value['text'] === 'string'
  return value['kind'] === 'pdf' && record(value['source']) && text(value['source']['rootId']) && text(value['source']['sourceId'])
}

function commands(value: unknown): value is Record<string, MaterialWriteCommand> {
  if (!record(value) || Object.keys(value).length > 16) return false
  const values = Object.entries(value)
  return values.every(([key, entry]) => text(key) && command(entry))
    && new Set(values.map(([, entry]) => (entry as MaterialWriteCommand).operationId)).size === values.length
}

/**
 * Retain bounded pending commands across reload without silently replacing corrupt recovery data.
 * @param storage - browser tab storage, not a scientific filesystem.
 * @param messages - localized actual-storage failure descriptions.
 * @returns original-request recovery only; no automatic retry or filesystem action.
 */
export function createMaterialWriteJournal(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
  messages: { readonly unavailable: string; readonly invalid: string }): MaterialWriteJournal {
  let corrupt = false
  return {
    read: () => {
      if (storage === undefined) return { commands: {}, problem: null }
      try {
        const raw = storage.getItem(KEY)
        if (raw === null) return { commands: {}, problem: null }
        const value: unknown = new TextEncoder().encode(raw).byteLength <= LIMIT ? JSON.parse(raw) : null
        if (!record(value) || value['version'] !== 1 || !commands(value['commands'])) {
          corrupt = true; return { commands: {}, problem: messages.invalid }
        }
        return { commands: value['commands'], problem: null }
      } catch { corrupt = true; return { commands: {}, problem: messages.invalid } }
    },
    write: (pending) => {
      if (corrupt) return messages.invalid
      if (storage === undefined) return Object.keys(pending).length === 0 ? null : messages.unavailable
      try {
        if (Object.keys(pending).length === 0) { storage.removeItem(KEY); return null }
        if (!commands(pending)) return messages.unavailable
        const raw = JSON.stringify({ version: 1, commands: pending })
        if (new TextEncoder().encode(raw).byteLength > LIMIT) return messages.unavailable
        storage.setItem(KEY, raw)
        return null
      } catch { return messages.unavailable }
    },
  }
}
