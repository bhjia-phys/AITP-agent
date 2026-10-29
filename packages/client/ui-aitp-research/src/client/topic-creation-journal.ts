/** Tab-owned recovery of researcher drafts and idempotent creation requests. */
import type { CreateTopicRequest, Target, VersionedTarget, WorkspaceError } from './workspace-contract.ts'
import type { TopicCreationDraft, TopicCreationOwner } from './topic-creation-state.ts'

/** Whether this tab can retain topic creation across a reload. */
export type TopicRecoveryState = 'available' | 'unavailable' | 'unreadable'

/** Narrow storage bridge; it owns no scientific-content reads or automatic submissions. */
export interface TopicCreationJournal {
  /** @returns validated drafts, with interrupted dispatches restored as uncertain. */
  load(): { drafts: TopicCreationOwner['topicDrafts']; state: TopicRecoveryState }
  /** @param drafts - current view-owned attempts. @returns whether tab storage acknowledged the write. */
  save(drafts: TopicCreationOwner['topicDrafts']): boolean
}

const KEY = 'dsh.aitp.topic-creation.v1'
const simpleFailures = new Set(['not-connected', 'not-found', 'unsupported', 'read-only', 'permission-denied', 'invalid-request', 'preview-expired', 'operation-reused', 'cancelled', 'unavailable'])
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string'

function request(value: unknown): value is CreateTopicRequest {
  return record(value) && typeof value['operationId'] === 'string' && typeof value['title'] === 'string'
    && typeof value['question'] === 'string' && optionalString(value['directory']) && optionalString(value['scope']) && optionalString(value['parentTopicId'])
}

function target(value: unknown): value is Target {
  return record(value) && typeof value['id'] === 'string'
    && (value['kind'] === 'project' || value['kind'] === 'topic' || value['kind'] === 'resource')
}

function versioned(value: unknown): value is VersionedTarget {
  return record(value) && target(value['target']) && typeof value['revision'] === 'string'
}

function failure(value: unknown): value is WorkspaceError {
  if (!record(value) || typeof value['message'] !== 'string' || typeof value['code'] !== 'string') return false
  if (simpleFailures.has(value['code'])) return typeof value['retryable'] === 'boolean'
  if (value['code'] === 'revision-conflict') return Array.isArray(value['current']) && value['current'].every(versioned)
  if (typeof value['operationId'] !== 'string') return false
  if (value['code'] === 'outcome-unknown') return true
  return value['code'] === 'partial-apply' && Array.isArray(value['changed']) && value['changed'].every(versioned)
    && Array.isArray(value['remaining']) && value['remaining'].every(target)
}

function draft(value: unknown): value is TopicCreationDraft {
  if (!record(value) || typeof value['title'] !== 'string' || typeof value['question'] !== 'string'
    || typeof value['scope'] !== 'string' || !optionalString(value['directory']) || !optionalString(value['currentTopicId']) || !optionalString(value['currentTitle'])
    || !optionalString(value['parentTopicId']) || typeof value['pending'] !== 'boolean'
    || typeof value['uncertain'] !== 'boolean' || typeof value['hidden'] !== 'boolean' || value['receipt'] !== null
    || !(value['failure'] === null || failure(value['failure']))) return false
  const savedRequest = value['request']
  if (savedRequest !== null && !request(savedRequest)) return false
  const savedFailure = value['failure']
  if ((value['pending'] || value['uncertain'] || (record(savedFailure)
    && (savedFailure['code'] === 'outcome-unknown' || savedFailure['code'] === 'partial-apply'))) && savedRequest === null) return false
  return true
}

/**
 * Use this browser tab's storage; an interrupted request is never replayed automatically.
 * @param storage - sessionStorage, absent when the browser refuses access.
 * @param interruptedMessage - localized explanation for an interrupted dispatch.
 * @returns a bounded recovery bridge with explicit read and write failures.
 */
export function createTopicCreationJournal(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined, interruptedMessage: string): TopicCreationJournal {
  return {
    load() {
      if (storage === undefined) return { drafts: {}, state: 'unavailable' }
      let raw: string | null
      try { raw = storage.getItem(KEY) } catch (_error) { return { drafts: {}, state: 'unavailable' } }
      if (raw === null) return { drafts: {}, state: 'available' }
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch (_error) { return { drafts: {}, state: 'unreadable' } }
      if (!record(parsed) || parsed['version'] !== 1 || !record(parsed['drafts'])) return { drafts: {}, state: 'unreadable' }
      const drafts: TopicCreationOwner['topicDrafts'] = {}
      for (const [workspaceId, value] of Object.entries(parsed['drafts'])) {
        if (!draft(value)) return { drafts: {}, state: 'unreadable' }
        if (value.pending && value.request !== null) {
          value.pending = false
          value.uncertain = true
          value.failure = { code: 'outcome-unknown', operationId: value.request.operationId, message: interruptedMessage }
        }
        if (value.failure?.code === 'outcome-unknown' || value.failure?.code === 'partial-apply') value.uncertain = true
        Object.defineProperty(drafts, workspaceId, { value, enumerable: true, writable: true, configurable: true })
      }
      return { drafts, state: 'available' }
    },
    save(drafts) {
      if (storage === undefined) return false
      const retained = Object.fromEntries(Object.entries(drafts).filter(([, value]) => value !== undefined && value.receipt === null))
      try {
        if (Object.keys(retained).length === 0) storage.removeItem(KEY)
        else storage.setItem(KEY, JSON.stringify({ version: 1, drafts: retained }))
        return true
      } catch (_error) { return false }
    },
  }
}
