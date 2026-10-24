/** Remount-surviving edit interaction state; this is not a durable change journal. */
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ApplyReceipt, ChangePreview, DataOrigin, ReadEnvelope, ResourceId, Result, Revision, TopicId, WorkspaceError } from './workspace-contract.ts'

/** Draft and original operation identity retained while an acknowledgement is unresolved. */
export interface WorkspaceEditState {
  readonly topicId: TopicId
  readonly topicTitle: string
  readonly mode: 'scope' | 'answer'
  text: string
  qualification: string
  readonly sourceResourceIds: readonly ResourceId[]
  baseRevision: Revision
  prepared: { readonly preview: ReadEnvelope<ChangePreview>; readonly operationId: string } | null
  pending: 'preview' | 'apply' | null
  previewRequestId: string | null
  /** Once true, transient retry errors cannot establish that the original write failed. */
  uncertain: boolean
  failure: WorkspaceError | null
  acknowledged: DataOrigin | null
  /** Historical application can remain confirmed while its current source changes or disappears. */
  sourceObservations?: ApplyReceipt['sourceObservations']
  hidden: boolean
}

/** View-state owner shared by the panel and contextual sidebar. */
export interface WorkspaceEditOwner {
  pendingEdits: Record<string, WorkspaceEditState | undefined>
}

/**
 * Keep workspace/topic identities distinct even when either contains delimiters.
 * @param workspaceId - resolved Harness workspace.
 * @param topicId - stable topic.
 * @returns the view-state key.
 */
export function workspaceEditKey(workspaceId: WorkspaceId, topicId: TopicId): string {
  return JSON.stringify([workspaceId, topicId])
}

/** Complete mutation surface for editing interactions, including late async settlements. */
export const workspaceEditActions = {
  /**
   * Open a draft, preserving any unresolved operation already owned by this topic.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param edit - initial draft when no protected or resumable draft exists.
   */
  beginEdit(draft: WorkspaceEditOwner, key: string, edit: WorkspaceEditState): void {
    const previous = draft.pendingEdits[key]
    if (previous !== undefined && (previous.pending !== null || previous.uncertain)) {
      previous.hidden = false
      return
    }
    if (previous !== undefined && previous.mode === edit.mode && previous.acknowledged === null) {
      previous.hidden = false
      return
    }
    draft.pendingEdits[key] = edit
  },
  /**
   * Change an unlocked draft field and invalidate its previous preview.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param field - the answer/scope text or its qualification.
   * @param value - replacement field text.
   */
  changeEditText(draft: WorkspaceEditOwner, key: string, field: 'text' | 'qualification', value: string): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.pending !== null || edit.uncertain || edit.acknowledged !== null) return
    edit[field] = value
    edit.prepared = null
    edit.failure = null
  },
  /**
   * Mark an unlocked draft as awaiting one identified preview request.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param requestId - identity used to reject obsolete preview responses.
   */
  prepareEdit(draft: WorkspaceEditOwner, key: string, requestId: string): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.pending !== null || edit.uncertain || edit.acknowledged !== null) return
    edit.pending = 'preview'
    edit.previewRequestId = requestId
    edit.prepared = null
    edit.failure = null
  },
  /**
   * Accept only the outstanding preview response and bind its future application identity.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param requestId - identity of the completed preview request.
   * @param result - adapter preview or typed failure.
   * @param operationId - identity to retain for every retry of this preview's application.
   */
  settlePreview(
    draft: WorkspaceEditOwner, key: string, requestId: string, result: Result<ReadEnvelope<ChangePreview>>, operationId: string,
  ): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.pending !== 'preview' || edit.previewRequestId !== requestId) return
    edit.pending = null
    edit.previewRequestId = null
    if (result.ok) edit.prepared = { preview: result.value, operationId }
    else edit.failure = result.error
  },
  /**
   * Retain the application attempt before the adapter call can outlive its component.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param operationId - prepared operation identity, unchanged on retries.
   */
  submitEdit(draft: WorkspaceEditOwner, key: string, operationId: string): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.pending !== null || edit.prepared?.operationId !== operationId || edit.acknowledged !== null) return
    edit.pending = 'apply'
    edit.failure = null
  },
  /**
   * Settle the original operation; transient retry failures never erase earlier uncertainty.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param operationId - completed attempt's original operation identity.
   * @param result - authoritative receipt or typed failure from the adapter.
   */
  settleApply(draft: WorkspaceEditOwner, key: string, operationId: string, result: Result<ReadEnvelope<ApplyReceipt>>): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.prepared?.operationId !== operationId || edit.acknowledged !== null) return
    edit.pending = null
    if (result.ok) {
      edit.uncertain = false
      edit.failure = null
      edit.acknowledged = result.value.origin
      edit.sourceObservations = result.value.value.sourceObservations ?? []
    } else {
      edit.failure = result.error
      edit.uncertain = edit.uncertain || result.error.code === 'outcome-unknown' || result.error.code === 'partial-apply'
    }
  },
  /**
   * Adopt an explicitly reviewed version as the base of an unlocked draft.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   * @param revision - latest version the researcher chose as the new base.
   */
  rebaseEdit(draft: WorkspaceEditOwner, key: string, revision: Revision): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined || edit.pending !== null || edit.uncertain || edit.acknowledged !== null) return
    edit.baseRevision = revision
    edit.prepared = null
    edit.failure = null
  },
  /**
   * Hide pending or unresolved work; discard only a draft whose outcome is settled.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   */
  closeEdit(draft: WorkspaceEditOwner, key: string): void {
    const edit = draft.pendingEdits[key]
    if (edit === undefined) return
    if (edit.pending !== null || edit.uncertain) edit.hidden = true
    else {
      const { [key]: _closed, ...remaining } = draft.pendingEdits
      draft.pendingEdits = remaining
    }
  },
  /**
   * Reveal a retained draft without creating a new preview or operation.
   * @param draft - registration-owned interaction state.
   * @param key - workspace/topic view-state key.
   */
  resumeEdit(draft: WorkspaceEditOwner, key: string): void {
    const edit = draft.pendingEdits[key]
    if (edit !== undefined) edit.hidden = false
  },
}
