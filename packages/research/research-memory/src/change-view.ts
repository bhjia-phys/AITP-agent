/** Bounded exact receipt presentation, independent of current source bytes and model prose. */
import { brandString } from '@deepseek-ai/dsh-brand'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResearchChangeQuery, ResearchChangeView, TopicId } from './types.ts'
import type { WriteOperation } from './writer-types.ts'

/**
 * Omit complete file diffs or complete remaining-use entries when they exceed the presentation budget.
 * @param operation - Existing durable receipt with separately refreshed source observations.
 * @param owner - Verified original Session and Workspace.
 * @param maximumCharacters - Complete serialized-response bound.
 * @returns Exact state and independently bounded before/after pairs, never a fabricated all-success result.
 */
export function researchChangeView(operation: WriteOperation, owner: ResearchChangeQuery & { workspaceId: WorkspaceId },
  maximumCharacters: number): ResearchChangeView {
  const files: ResearchChangeView['files'][number][] = []
  const remainingUses: string[] = []
  const view: { -readonly [Key in keyof ResearchChangeView]: ResearchChangeView[Key] } = {
    operationId: operation.operationId, sessionId: owner.sessionId, workspaceId: owner.workspaceId,
    ...(operation.proposal.binding?.topicId === undefined ? {} : { topicId: brandString<TopicId>(operation.proposal.binding.topicId) }),
    state: operation.state, updatedAt: operation.updatedAt, files, remainingUses,
    completeness: 'complete', omittedFiles: operation.files.length,
    omittedDiffs: operation.files.length, omittedUses: operation.proposal.remainingUses.length,
  }
  const fits = (): boolean => JSON.stringify(view).length <= maximumCharacters
  if (!fits()) throw new Error('The change-view bound cannot contain its original ownership and omission counts.')
  for (const file of operation.files) {
    const metadata = { resourceId: file.resourceId, relativePath: file.relativePath, state: file.state,
      ...(file.appliedAt === undefined ? {} : { appliedAt: file.appliedAt }),
      ...(file.current === undefined ? {} : { current: file.current }),
    }
    files.push(metadata)
    view.omittedFiles -= 1
    if (!fits()) { files.pop(); view.omittedFiles += 1; continue }
    const exact = { ...metadata, beforeText: file.beforeText, afterText: file.afterText }
    files[files.length - 1] = exact
    view.omittedDiffs -= 1
    if (!fits()) { files[files.length - 1] = metadata; view.omittedDiffs += 1 }
  }
  for (const use of operation.proposal.remainingUses) {
    remainingUses.push(use)
    view.omittedUses -= 1
    if (!fits()) { remainingUses.pop(); view.omittedUses += 1 }
  }
  if (view.omittedFiles > 0 || view.omittedDiffs > 0 || view.omittedUses > 0) view.completeness = 'partial'
  return view
}
