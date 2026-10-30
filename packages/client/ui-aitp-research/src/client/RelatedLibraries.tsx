/** Optional related-library entries on a focused topic; filesystem browsing lives in the sidebar. */
import type { ReactNode } from 'react'
import type { Topic } from './workspace-contract.ts'
import type { WorkspaceViewProps } from './WorkspaceViews.tsx'
import css from './workspace.module.css'

/**
 * Show independently installed related-library entries for the viewed topic.
 * @param props - explicit level, source account and framework factory renderer.
 * @returns optional materials-plugin contributions without importing its implementation.
 */
export function RelatedLibraries(props: WorkspaceViewProps & { title: string; topic?: Topic }): ReactNode {
  return <div className={css.levelLibraries}>
    {props.renderFactorySlot('aitp.research.topic-libraries', {
      workspaceId: props.workspaceId, topicId: props.topic?.id, title: props.title,
      ...props.libraryNavigation === undefined ? {} : { onLeave: props.libraryNavigation.onLeave },
      returnTo: props.libraryNavigation?.returnTo ?? (() => { props.navigate({ kind: 'map', focusId: props.topic?.id ?? null }); props.showResearch?.() }),
    })}
  </div>
}
