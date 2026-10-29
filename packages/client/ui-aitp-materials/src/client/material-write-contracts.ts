/** UI intent and observed outcomes for explicit material writes; the Host owns every publication. */
import type { MaterialAssociation, MaterialWriteReceipt, Result } from '@deepseek-ai/dsh-research-memory/types'
import type { ResourceDomain, SourceRef } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MaterialsScope } from './contracts.ts'

/** The actual recognized account and current write grant, read through a framework resource. */
export type { MaterialLocation as MaterialWriteLocation } from '@deepseek-ai/dsh-research-memory/types'

/** One frozen command retains its operation identity across explicit retries and scope changes. */
export type MaterialWriteCommand = {
  readonly scope: MaterialsScope & { readonly workspaceId: WorkspaceId }
  readonly operationId: string
  readonly relativePath: string
  readonly association?: MaterialAssociation
} & ({ readonly kind: 'text'; readonly text: string } | { readonly kind: 'pdf'; readonly source: SourceRef })

/** A write result belongs to its original form, not the topic visible when the reply arrives. */
export interface MaterialWriteAttempt {
  readonly command: MaterialWriteCommand
  readonly busy: boolean
  readonly result?: Result<MaterialWriteReceipt>
}

/** Optional capability supplied by the authenticated material-writing endpoint. */
export interface MaterialWriteFace {
  readonly save: (command: MaterialWriteCommand) => Promise<Result<MaterialWriteReceipt>>
  readonly refresh: () => void
  readonly resolveFile: (scope: MaterialWriteCommand['scope'], path: string) => Promise<SourceRef | undefined>
}

/** A catalog saves authored text; a PDF reader offers only an explicitly requested copy. */
export interface MaterialWriteInput {
  readonly scope: MaterialsScope
  readonly libraryDomain?: ResourceDomain
  readonly source?: { readonly ref: SourceRef; readonly title: string }
  /** The existing reader owner retains its question and return route. */
  readonly onInspect: (ref: SourceRef) => void
}

/**
 * Address the selected account's current destination and write availability.
 * @param scope - selected real account.
 * @returns resource address for the current location observation.
 */
export function materialWriteLocationAddress(scope: MaterialsScope & { readonly workspaceId: WorkspaceId }): string {
  return `dsh-resource://aitp-material-location/workspace/${encodeURIComponent(scope.workspaceId)}${scope.topicId === undefined ? '' : `?topic=${encodeURIComponent(scope.topicId)}`}`
}
