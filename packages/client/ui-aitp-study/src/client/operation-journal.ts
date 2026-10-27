/** Same-tab pending-operation recovery; artifacts and receipts remain Host-owned. */
import type { StudyOperation } from './store.ts'
import { parseMaterialLocator } from '@deepseek-ai/dsh-research-resources/protocol'

const KEY = 'aitp.study.pending-operation.v1'
const MAX_BYTES = 524_288
const KINDS = new Set(['note', 'report', 'comparison', 'outline', 'flashcards', 'mind-map'])
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0')

/** Only this pending command and its display origin can be restored. */
export interface StudyAttempt {
  readonly operation: StudyOperation
  readonly origin: 'handwritten' | 'captured-answer'
}
/** Browser recovery metadata, never a source of saved artifact bodies. */
export interface StudyJournal {
  read(): { readonly entry?: StudyAttempt; readonly problem: string | null }
  write(entry: StudyAttempt | undefined): string | null
}

function valid(value: unknown): value is StudyAttempt {
  if (!record(value) || !record(value['operation']) || !['handwritten', 'captured-answer'].includes(String(value['origin']))) return false
  const operation = value['operation'], request = operation['request']
  if (!record(request) || !text(request['operationId'], 256)) return false
  if (operation['kind'] === 'remove') return text(request['id'])
  if (!text(request['title'], 2000) || !KINDS.has(String(request['kind']))) return false
  if (operation['kind'] === 'capture') return text(request['sessionId']) && typeof request['seq'] === 'number'
    && Number.isSafeInteger(request['seq']) && request['seq'] >= 0 && value['origin'] === 'captured-answer'
  if (operation['kind'] !== 'save' || typeof request['markdown'] !== 'string'
    || request['id'] !== undefined && !text(request['id']) || value['origin'] === 'captured-answer' && request['id'] === undefined) return false
  if (request['citations'] === undefined) return true
  if (!Array.isArray(request['citations']) || request['citations'].length > 50) return false
  return request['citations'].every((source: unknown) => {
    if (!record(source) || !record(source['ref']) || !text(source['ref']['rootId']) || !text(source['ref']['sourceId'])) return false
    if (source['selectedText'] !== undefined && typeof source['selectedText'] !== 'string') return false
    try { if (source['locator'] !== undefined) parseMaterialLocator(JSON.stringify(source['locator'])); return true }
    catch { return false }
  })
}

/**
 * Retain a bounded original operation without automatic replay or identifier changes.
 * @param storage - optional same-tab browser storage.
 * @param messages - locale-owned unavailable and unreadable-record diagnostics.
 * @returns a journal preserving unreadable records instead of overwriting them.
 */
export function createStudyJournal(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
  messages: { readonly unavailable: string; readonly invalid: string }): StudyJournal {
  let corrupted = false
  return {
    read: () => {
      if (storage === undefined) return { problem: null }
      try {
        const raw = storage.getItem(KEY)
        if (raw === null) return { problem: null }
        const value: unknown = new TextEncoder().encode(raw).byteLength <= MAX_BYTES ? JSON.parse(raw) : null
        if (!record(value) || value['version'] !== 1 || !valid(value['entry'])) { corrupted = true; return { problem: messages.invalid } }
        return { entry: value['entry'], problem: null }
      } catch { corrupted = true; return { problem: messages.invalid } }
    },
    write: (entry) => {
      if (corrupted) return messages.invalid
      if (storage === undefined) return entry === undefined ? null : messages.unavailable
      try {
        if (entry === undefined) { storage.removeItem(KEY); return null }
        const raw = JSON.stringify({ version: 1, entry })
        if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return messages.unavailable
        storage.setItem(KEY, raw)
        return null
      } catch { return messages.unavailable }
    },
  }
}
