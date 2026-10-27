/** Optional domain-library contributions receive the topic being viewed, never a material's owner. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { TopicId } from './workspace-contract.ts'

/** The topic being viewed and its reversible return action, independent of material ownership. */
export interface TopicLibraryOwner {
  readonly workspaceId: WorkspaceId
  readonly topicId: TopicId
  readonly title: string
  /** Capture the reader's position at the entry gesture; omitted by owners without retained view state. */
  readonly onLeave?: () => void
  readonly returnTo: () => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Extra related-library entries; missing plugins leave the existing material links available. */
    'aitp.research.topic.libraries': { kind: 'list'; scope: 'root'; owner: TopicLibraryOwner }
  }
  interface SlotFactoryMap {
    'aitp.research.topic-libraries': {
      scope: 'root'
      props: TopicLibraryOwner
      children: { 'aitp.research.topic.libraries': { kind: 'list'; scope: 'root' } }
    }
  }
}

/**
 * Seat optional library contributions inside a Research-owned topic extension.
 * @param props - the explicit current topic and a reversible navigation callback.
 * @returns installed libraries' related-source buttons.
 */
export function TopicLibraries(props: FactoryComponentPropsOf<'aitp.research.topic-libraries'>): ReactNode {
  return props.renderSlot('aitp.research.topic.libraries', {
    workspaceId: props.workspaceId, topicId: props.topicId, title: props.title, returnTo: props.returnTo,
    ...props.onLeave === undefined ? {} : { onLeave: props.onLeave },
  })
}
