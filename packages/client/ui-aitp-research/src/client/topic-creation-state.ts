/** Workspace-owned topic drafts retain unresolved operations across navigation. */
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { CreateTopicReceipt, CreateTopicRequest, Result, TopicId, WorkspaceError } from './workspace-contract.ts'

/** One researcher-authored request and its current provider acknowledgement. */
export interface TopicCreationDraft {
  readonly currentTopicId: TopicId | undefined
  readonly currentTitle: string | undefined
  parentTopicId: TopicId | undefined
  title: string
  question: string
  scope: string
  directory?: string
  request: CreateTopicRequest | null
  pending: boolean
  uncertain: boolean
  failure: WorkspaceError | null
  receipt: CreateTopicReceipt | null
  hidden: boolean
}

/** Draft ownership follows Workspace identity, independently of the visible map or topic. */
export interface TopicCreationOwner {
  topicDrafts: Record<string, TopicCreationDraft | undefined>
}

/** Mutation callbacks used by the declared Research view store. */
export const topicCreationActions = {
  /**
   * Open a draft or restore the existing attempt instead of replacing it.
   * @param owner - view-state owner.
   * @param workspaceId - selected Workspace.
   * @param parentTopicId - chosen parent, absent for project level.
   * @param currentTopicId - current topic offered as an alternative parent.
   * @param currentTitle - displayed title of that topic.
   */
  beginTopic(
    owner: TopicCreationOwner, workspaceId: WorkspaceId, parentTopicId: TopicId | undefined,
    currentTopicId: TopicId | undefined, currentTitle: string | undefined,
  ): void {
    const existing = owner.topicDrafts[workspaceId]
    if (existing !== undefined) { existing.hidden = false; return }
    owner.topicDrafts[workspaceId] = { parentTopicId, currentTopicId, currentTitle, title: '', question: '', scope: '', directory: '', request: null, pending: false, uncertain: false, failure: null, receipt: null, hidden: false }
  },
  /**
   * Change only a request whose outcome is known and no longer pending.
   * @param owner - view-state owner.
   * @param workspaceId - draft owner.
   * @param field - researcher-authored field.
   * @param value - entered text.
   */
  changeTopic(owner: TopicCreationOwner, workspaceId: WorkspaceId, field: 'title' | 'question' | 'scope' | 'directory', value: string): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft === undefined || draft.pending || draft.uncertain || draft.receipt !== null) return
    draft[field] = value
    draft.request = null
    draft.failure = null
  },
  /**
   * Select project level or the explicitly offered topic.
   * @param owner - view-state owner.
   * @param workspaceId - draft owner.
   * @param parentTopicId - selected parent, absent at project level.
   */
  selectTopicParent(owner: TopicCreationOwner, workspaceId: WorkspaceId, parentTopicId: TopicId | undefined): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft === undefined || draft.pending || draft.uncertain || draft.receipt !== null) return
    draft.parentTopicId = parentTopicId
    draft.request = null
    draft.failure = null
  },
  /**
   * Retain the original request before dispatch; retries reuse it exactly.
   * @param owner - view-state owner.
   * @param workspaceId - draft owner.
   * @param request - prepared request, reused for an unresolved attempt.
   */
  submitTopic(owner: TopicCreationOwner, workspaceId: WorkspaceId, request: CreateTopicRequest): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft === undefined || draft.pending || draft.receipt !== null || !draft.title.trim() || !draft.question.trim()) return
    draft.request ??= request
    draft.pending = true
    draft.failure = null
  },
  /**
   * Settle the same attempt even after its form or Workspace has unmounted.
   * @param owner - view-state owner.
   * @param workspaceId - original Workspace.
   * @param operationId - dispatched request identity.
   * @param result - provider acknowledgement or failure.
   */
  settleTopic(owner: TopicCreationOwner, workspaceId: WorkspaceId, operationId: string, result: Result<CreateTopicReceipt>): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft?.request?.operationId !== operationId) return
    draft.pending = false
    if (result.ok) { draft.receipt = result.value; draft.uncertain = false; draft.failure = null }
    else { draft.failure = result.error; draft.uncertain ||= result.error.code === 'outcome-unknown' || result.error.code === 'partial-apply' }
  },
  /**
   * Hide an unresolved operation; discard only a safe, settled draft.
   * @param owner - view-state owner.
   * @param workspaceId - draft owner.
   */
  closeTopic(owner: TopicCreationOwner, workspaceId: WorkspaceId): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft === undefined) return
    if (draft.pending || draft.uncertain) draft.hidden = true
    else {
      const { [workspaceId]: _closed, ...remaining } = owner.topicDrafts
      owner.topicDrafts = remaining
    }
  },
  /**
   * Retire the acknowledged operation when its active view navigates to the result.
   * @param owner - view-state owner.
   * @param workspaceId - original Workspace.
   */
  finishTopic(owner: TopicCreationOwner, workspaceId: WorkspaceId): void {
    const draft = owner.topicDrafts[workspaceId]
    if (draft !== undefined && draft.receipt !== null) {
      const { [workspaceId]: _finished, ...remaining } = owner.topicDrafts
      owner.topicDrafts = remaining
    }
  },
}
