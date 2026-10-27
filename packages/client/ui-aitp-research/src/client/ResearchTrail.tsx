/**
 * Where the reader is: Back, then the path from the map through the topic's
 * recorded parents to the current item. Each step stays in the current mode,
 * so map steps refocus the map and page steps open topic pages.
 */
import type { ReactNode } from 'react'
import { Button, IconChevronLeftOutlineRegular, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResearchLocation } from './store.ts'
import type { ResourceId, TopicId } from './workspace-contract.ts'
import { workspaceProjectAddress, workspaceResourceAddress, workspaceTopicAddress } from './workspace-resources.ts'
import type { WorkspaceViewProps } from './WorkspaceViews.tsx'
import css from './workspace.module.css'

type TrailProps = WorkspaceViewProps & { mode: 'map' | 'topic' }

/**
 * The location trail above the reading region.
 * @param props - view reads, the current location and whether Back has history.
 * @returns the trail, or nothing at the overview without history.
 */
export function ResearchTrail(props: WorkspaceViewProps & {
  location: ResearchLocation
  canGoBack: boolean
  goBack: () => void
}): ReactNode {
  const { t, location } = props
  const atOverview = location.kind === 'map' && location.focusId === null
  if (atOverview && !props.canGoBack) return null
  return (
    <nav className={css.trail} aria-label={t('workspace.breadcrumb')}>
      {props.canGoBack && <Button variant="ghost" size="sm" onClick={props.goBack}>
        <IconChevronLeftOutlineRegular size={14} />{t('reader.back')}
      </Button>}
      {!atOverview && <ol className={css.trailList}>
        <li><button type="button" className={css.trailLink} onClick={() => { props.navigate({ kind: 'map', focusId: null }) }}>{t('map.eyebrow')}</button></li>
        {location.kind === 'map' && location.focusId !== null && <TrailTopic {...props} mode="map" topicId={location.focusId} current />}
        {location.kind === 'topic' && <TrailTopic {...props} mode="topic" topicId={location.topicId} current />}
        {location.kind === 'resource' && <>
          {location.topicId !== null && <TrailTopic {...props} mode="topic" topicId={location.topicId} current={false} />}
          <TrailMaterial {...props} resourceId={location.resourceId} />
        </>}
      </ol>}
    </nav>
  )
}

function Separator(): ReactNode {
  return <IconChevronRightOutlineRegular size={12} className={css.trailSeparator} />
}

function TrailTopic(props: TrailProps & { topicId: TopicId; current: boolean }): ReactNode {
  const result = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  const topic = result.value?.value
  const label = topic === undefined ? props.t('workspace.parent') : topic.shortTitle ?? topic.title
  const { topicId } = props
  return <>
    {topic !== undefined && (topic.parentId === null
      ? <TrailDirection {...props} directionId={topic.directionId} />
      : <TrailTopic {...props} topicId={topic.parentId} current={false} />)}
    <li>
      <Separator />
      {props.current
        ? <span className={css.trailCurrent} aria-current="location" title={topic?.title}>{label}</span>
        : <button type="button" className={css.trailLink} title={topic?.title}
          onClick={() => { props.navigate(props.mode === 'map' ? { kind: 'map', focusId: topicId } : { kind: 'topic', topicId }) }}>{label}</button>}
    </li>
  </>
}

function TrailDirection(props: TrailProps & { directionId: string | undefined }): ReactNode {
  const project = props.useResource<'aitp-workspace-project'>(workspaceProjectAddress(props.workspaceId))
  const direction = project.value?.value.directions.find(item => item.id === props.directionId)
  if (direction === undefined) return null
  return <li><Separator /><span className={css.trailDirection} title={direction.title}>{direction.title}</span></li>
}

function TrailMaterial(props: WorkspaceViewProps & { resourceId: ResourceId }): ReactNode {
  const result = props.useResource<'aitp-workspace-resource'>(workspaceResourceAddress(props.workspaceId, props.resourceId))
  const title = result.value?.value.title ?? props.t('workspace.material.other')
  return <li><Separator /><span className={css.trailCurrent} aria-current="location" title={title}>{title}</span></li>
}
