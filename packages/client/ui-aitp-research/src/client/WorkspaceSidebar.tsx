/** Topic navigation occupying the host sidebar while Research is selected. */
import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Button, IconGlobeOutlineRegular, StateDot, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { TopicId, TopicPage, TopicSummary } from './workspace-contract.ts'
import { workspaceProjectAddress, workspaceTopicsAddress } from './workspace-resources.ts'
import type { createResearchPanelStore } from './store.ts'
import type {} from './sidebar-locales.ts'
import css from './workspace-sidebar.module.css'

/** The host owns switching back to its existing conversation browser. */
export interface WorkspaceSidebarFace {
  /** Show the current conversation and its Workspace/session list. */
  showConversations: () => void
  /** Re-read this Workspace after a failed page or an expired cursor. */
  retry: (workspaceId: WorkspaceId) => void
}

/** The same declared view store is shared with the main Research panel. */
export type WorkspaceSidebarProps =
  PropsRuntime<'sidebar.context'>
  & PropsLocale<'aitp.research.sidebar'>
  & PropsStore<ReturnType<typeof createResearchPanelStore>>
  & InjectFace<WorkspaceSidebarFace>

/**
 * Render topic navigation in the single host sidebar.
 * @param props - host column geometry, framework hooks, view state and callbacks.
 * @returns the topic browser, or an expand affordance in the rail.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps): ReactNode {
  const { t, useWorkspaces, useStore, wide } = props
  const workspaces = useWorkspaces(snapshot => snapshot.items)
  const selected = useStore(state => state.workspaceId)
  const workspace = workspaces.find(item => item.workspaceId === selected) ?? workspaces[0]
  if (!wide) {
    return (
      <div className={css.rail}>
        <Tooltip label={t('expand')}>
          <Button variant="ghost" size="sm" aria-label={t('expand')} onClick={props.expandSidebar}>
            <IconGlobeOutlineRegular size={18} />
          </Button>
        </Tooltip>
      </div>
    )
  }
  return (
    <nav className={css.browser} aria-label={t('navigation')}>
      <div className={css.switcher}>
        <Button variant="ghost" size="sm" aria-current="page" className={css.currentMode}>
          {t('topics')}
        </Button>
        <Button variant="ghost" size="sm" onClick={props.showConversations}>
          {t('conversations')}
        </Button>
      </div>
      {workspace === undefined
        ? <p className={css.notice}>{t('noWorkspace')}</p>
        : <WorkspaceTree key={workspace.workspaceId} {...props} workspaceId={workspace.workspaceId} workspaceTitle={workspace.title} />}
    </nav>
  )
}

function WorkspaceTree(props: WorkspaceSidebarProps & { workspaceId: WorkspaceId; workspaceTitle: string }): ReactNode {
  const { t, useResource, useStore, actions, workspaceId, workspaceTitle } = props
  const project = useResource<'aitp-workspace-project'>(workspaceProjectAddress(workspaceId))
  const topics = useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(workspaceId))
  const location = useStore(state => state.workspaceId === workspaceId ? state.location : null)
  const selectedTopicId = location === null || location.kind === 'project' ? null : location.topicId
  const [attempt, setAttempt] = useState(0)
  const current = topics.value
  const disconnected = topics.status === 'none'
    || (topics.failure?.code === 'aitp/workspace' && topics.failure.details.code === 'not-connected')
  const openTopic = (topicId: TopicId): void => {
    actions.open(workspaceId, { kind: 'topic', topicId, tab: 'overview' }, { scrollTop: 0, focusIndex: null })
  }
  const retry = (): void => {
    setAttempt(value => value + 1)
    props.retry(workspaceId)
  }
  return (
    <div className={css.treeRegion}>
      <p className={css.projectTitle}>{project.value?.value.title ?? workspaceTitle}</p>
      {(current?.origin ?? project.value?.origin) === 'fixture' && <p className={css.fixture}>{t('fixture')}</p>}
      <button
        type="button"
        className={clsx(css.topicButton, css.overview)}
        aria-current={location === null || location.kind === 'project' ? 'page' : undefined}
        onClick={() => { actions.open(workspaceId, { kind: 'project' }, { scrollTop: 0, focusIndex: null }) }}
      >{t('overview')}</button>
      {current === undefined
        ? (
          topics.status === 'loading'
            ? <div className={css.loading} role="status" aria-label={t('loading')}><StateDot state="ongoing" /></div>
            : <><p className={css.notice}>{t(disconnected ? 'disconnected' : 'failed')}</p>
              <Button variant="ghost" size="sm" onClick={retry}>{t('retry')}</Button></>
        )
        : (
          <TopicPages key={JSON.stringify([current.revision, current.value.nextCursor, attempt])}
            t={t} useResource={useResource} workspaceId={workspaceId} selectedTopicId={selectedTopicId} onSelect={openTopic}
            onRetry={retry} page={current.value} previous={[]} partial={false} stale={topics.status === 'failed'} />
        )}
    </div>
  )
}

type TopicPageProps = Pick<WorkspaceSidebarProps, 't' | 'useResource'> & {
  workspaceId: WorkspaceId
  selectedTopicId: TopicId | null
  onSelect: (topicId: TopicId) => void
  onRetry: () => void
  previous: readonly TopicSummary[]
  partial: boolean
  stale: boolean
}

/** Each resource page stays subscribed; only the deepest loaded page draws the combined tree. */
function TopicPages(props: TopicPageProps & { page: TopicPage }): ReactNode {
  const [more, setMore] = useState(false)
  const rows = [...new Map([...props.previous, ...props.page.items.map(item => item.value)].map(topic => [topic.id, topic])).values()]
  const partial = props.partial || props.page.completeness === 'partial'
  const cursor = props.page.nextCursor
  if (more && cursor !== null) return <TopicContinuation {...props} previous={rows} partial={partial} cursor={cursor} />
  return <>
    <TopicTreeRows {...props} previous={rows} partial={partial || cursor !== null} />
    {props.stale
      ? <Button variant="ghost" size="sm" onClick={props.onRetry}>{props.t('retry')}</Button>
      : cursor !== null && <Button variant="ghost" size="sm" onClick={() => { setMore(true) }}>{props.t('more')}</Button>}
  </>
}

function TopicContinuation(props: TopicPageProps & { cursor: string }): ReactNode {
  const result = props.useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(props.workspaceId, { cursor: props.cursor }))
  const expired = result.failure?.code === 'aitp/workspace' && result.failure.details.code === 'invalid-request'
  if (result.value === undefined || expired) {
    return <>
      <TopicTreeRows {...props} partial />
      {result.status === 'loading'
        ? <div className={css.loading} role="status" aria-label={props.t('loading')}><StateDot state="ongoing" /></div>
        : <><p className={css.notice} role="status">{props.t(expired ? 'expired' : 'moreFailed')}</p>
          <Button variant="ghost" size="sm" onClick={props.onRetry}>{props.t('retry')}</Button></>}
    </>
  }
  return <TopicPages key={JSON.stringify([result.value.revision, result.value.value.nextCursor])}
    {...props} page={result.value.value} stale={props.stale || result.status === 'failed'} />
}

function TopicTreeRows(props: TopicPageProps): ReactNode {
  const { t, previous: rows, selectedTopicId, onSelect } = props
  const byId = new Map(rows.map(topic => [topic.id, topic]))
  const roots = rows.filter(topic => topic.parentId === null)
  const unplaced = rows.filter(topic => topic.parentId !== null && !byId.has(topic.parentId))
  return <>
    {props.stale && <p className={css.notice} role="status">{t('stale')}</p>}
    {rows.length === 0 && <p className={css.notice}>{t('empty')}</p>}
    <ul className={css.topicList}>
      {roots.map(topic => (
        <TopicBranch key={topic.id} topic={topic} byId={byId} selectedTopicId={selectedTopicId} onSelect={onSelect} />
      ))}
    </ul>
    {unplaced.length > 0 && <section>
      <p className={css.groupLabel}>{t('otherTopics')}</p>
      <ul className={css.topicList}>
        {unplaced.map(topic => (
          <TopicBranch key={topic.id} topic={topic} byId={byId} selectedTopicId={selectedTopicId} onSelect={onSelect} />
        ))}
      </ul>
    </section>}
    {props.partial && <p className={css.notice}>{t('partial')}</p>}
  </>
}

function TopicBranch({ topic, byId, selectedTopicId, onSelect }: {
  topic: TopicSummary
  byId: ReadonlyMap<TopicId, TopicSummary>
  selectedTopicId: TopicId | null
  onSelect: (topicId: TopicId) => void
}): ReactNode {
  const children = topic.childIds.flatMap((id) => {
    const child = byId.get(id)
    return child === undefined ? [] : [child]
  })
  return (
    <li>
      <button
        type="button"
        className={css.topicButton}
        aria-current={topic.id === selectedTopicId ? 'page' : undefined}
        onClick={() => { onSelect(topic.id) }}
      >
        <span className={css.topicTitle}>{topic.shortTitle ?? topic.title}</span>{' '}
        <span className={css.workLabel}>{topic.work.label}</span>
      </button>
      {children.length > 0 && (
        <ul className={css.children}>
          {children.map(child => (
            <TopicBranch key={child.id} topic={child} byId={byId} selectedTopicId={selectedTopicId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  )
}
