/** Explicit material destinations and independent file/association observations. */
import type { ResourceId, TopicId } from './types.ts'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** Actual account location after recognition by the existing workspace reader. */
export interface MaterialTopicLocation {
  readonly topicId?: TopicId
  readonly accountPath: string
  readonly directory: string
  readonly resourceId: ResourceId
}

/** Actual source locations, with no inferred layout or source-write grant. */
export interface MaterialLocation extends MaterialTopicLocation {
  readonly rootPath: string
  readonly writable: boolean
}

/** Explicit new-file destination and optional ordinary Markdown using passage. */
export interface SaveMaterialRequest {
  readonly workspaceId: WorkspaceId
  readonly operationId: string
  readonly relativePath: string
  readonly association?: MaterialAssociation
}

/** A selected ordinary account or index receives this authored using passage. */
export interface MaterialAssociation {
  readonly accountPath: string
  readonly title: string
  /** Omission adds only the link; supplied text records the researcher's stated use. */
  readonly description?: string
}

/** Content was either authored for this write or read through an already authorized source capability. */
export type MaterialContent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'pdf'; readonly bytes: Uint8Array }

/** One explicit destination; this operation never chooses or moves an existing material. */
export interface MaterialWriteRequest {
  readonly operationId: string
  readonly relativePath: string
  readonly content: MaterialContent
  /** Omission saves only the file; a supplied account remains a separate publication. */
  readonly association?: MaterialAssociation
}

/** Root authority must be freshly resolved by the caller under its source-write serialization. */
export interface MaterialWriteGrant {
  readonly root: string
  readonly writable: boolean
  readonly stateDirectory: string
  readonly maxContentBytes: number
  /** Separate Markdown-reader limit; a material import must not make its account unreadable. */
  readonly maxAccountBytes: number
  readonly maxOperationBytes: number
}

/** Current file read-back, distinct from the earlier writer's confirmed publication. */
export interface MaterialReadBack {
  readonly state: 'matches' | 'different' | 'missing' | 'unavailable'
  readonly observedAt: string
  readonly byteLength?: number
}

/** Durable publication outcome; no field asserts scientific acceptance. */
export interface MaterialWriteReceipt {
  readonly operationId: string
  readonly relativePath: string
  readonly resourceId: ResourceId
  readonly mediaType: 'text/plain' | 'application/pdf'
  readonly byteLength: number
  readonly file: {
    readonly state: 'saved' | 'conflict' | 'unknown' | 'not-saved'
    readonly readBack: MaterialReadBack
  }
  readonly association: {
    readonly state: 'linked' | 'not-requested' | 'not-linked' | 'unknown' | 'conflict'
    readonly accountPath?: string
  }
  readonly retry: 'same-request' | 'inspect' | 'new-operation' | 'none'
  readonly issues: readonly string[]
}
