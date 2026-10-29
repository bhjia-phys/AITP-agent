/** Topic navigation occupying the host sidebar while Research is selected. */
import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  Button, Menu, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconGlobeOutlineRegular,
  IconNewChatOutlineRegular, StateDot, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { InjectFace, PropsLocale, PropsRenderFactories, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { TopicId, TopicPage, TopicSummary } from './workspace-contract.ts'
import type { ResearchDiscussionScope } from './discussion-contract.ts'
import { workspaceProjectAddress, workspaceSetupAddress, workspaceTopicsAddress } from './workspace-resources.ts'
import { disclosureKey, type createResearchPanelStore } from './store.ts'
import type {} from './sidebar-locales.ts'
import css from './workspace-sidebar.module.css'

/** The host owns switching back to its existing conversation browser. */
export interface WorkspaceSidebarFace {
  /** Check provider enrollment before subscribing to scientific-content resources. */
  checkSetup?: boolean
  /** Show the current conversation and its Workspace/session list. */
  showConversations: () => void
  /** Re-read this Workspace after a failed page or an expired cursor. */
  retry: (workspaceId: WorkspaceId) => void
  /** Open an explicitly requested blank discussion under this topic. */
  newDiscussion?: ((workspaceId: WorkspaceId, topicId: TopicId, title: string) => void) | undefined
  /** Reveal the research reading panel when this navigation is used inside a library. */
  showResearch?: () => void
  /** A scoped library can present its own location without changing the retained research reader. */
  navigationScope?: ResearchDiscussionScope | undefined
}

/** The same declared view store is shared with the main Research panel. */
export type WorkspaceSidebarProps =
  PropsRuntime<'sidebar.context'>
  & PropsLocale<'aitp.research.sidebar'>
  & PropsStore<ReturnType<typeof createResearchPanelStore>>
  & InjectFace<WorkspaceSidebarFace>
  & PropsRenderFactories

/**
 * Render topic navigation in the single host sidebar.
 * @param props - host column geometry, framework hooks, view state and callbacks.
 * @returns the topic browser, or an expand affordance in the rail.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps): ReactNode {
  const { t, useWorkspaces, useStore, wide } = props
  const workspaces = useWorkspaces(snapshot => snapshot.items)
  const [pickerOpen, setPickerOpen] = useState(false)
  const selected = useStore(state => state.workspaceId)
  const shown = props.navigationScope?.workspaceId ?? selected
  const workspace = workspaces.find(item => item.workspaceId === shown) ?? workspaces[0]
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
        <span className={css.navigationTitle}>{t('topicsAndDiscussions')}</span>
        <Button variant="ghost" size="sm" onClick={props.showConversations}>
          {t('allConversations')}
        </Button>
      </div>
      {workspace !== undefined && <div className={css.workspacePicker}><Menu open={pickerOpen} autoFocus align="start"
        onClose={() => { setPickerOpen(false) }} selectedId={workspace.workspaceId}
        items={workspaces.map(item => ({ id: item.workspaceId, label: item.title }))}
        onSelect={(id) => { setPickerOpen(false); props.actions.selectWorkspace(id as WorkspaceId) }}
        anchor={<Button variant="ghost" size="sm" aria-label={t('chooseProject')} aria-haspopup="menu" aria-expanded={pickerOpen}
          onClick={() => { setPickerOpen(!pickerOpen) }}>
          <span>{workspace.title}</span><IconChevronDownOutlineRegular size={14} /></Button>} /></div>}
      {workspace === undefined
        ? <p className={css.notice}>{t('noWorkspace')}</p>
        : <WorkspaceTreeSetup key={workspace.workspaceId} {...props}
          workspaceId={workspace.workspaceId} workspaceTitle={workspace.title} />}
    </nav>
  )
}

function WorkspaceTreeSetup(props: WorkspaceSidebarProps & { workspaceId: WorkspaceId; workspaceTitle: string }): ReactNode {
  const setup = props.useResource<'aitp-workspace-setup'>(workspaceSetupAddress(props.workspaceId))
  const legacy = (setup.status === 'none' && props.checkSetup !== true)
    || (setup.failure?.code === 'aitp/workspace' && setup.failure.details.code === 'unsupported')
  if (legacy || setup.value?.configured === true) return <WorkspaceTree {...props} />
  return <div className={css.treeRegion}>
    <p className={css.notice}>{props.t('setupRequired')}</p>
    {setup.status === 'failed' && <Button variant="ghost" size="sm" onClick={() => { props.retry(props.workspaceId) }}>{props.t('retry')}</Button>}
  </div>
}


function WorkspaceTree(props: WorkspaceSidebarProps & { workspaceId: WorkspaceId; workspaceTitle: string }): ReactNode {
  const { t, useResource, useStore, actions, workspaceId, workspaceTitle } = props
  const project = useResource<'aitp-workspace-project'>(workspaceProjectAddress(workspaceId))
  const topics = useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(workspaceId))
  const location = useStore(state => state.workspaceId === workspaceId ? state.location : null)
  const disclosure = useStore(state => state.disclosure)
  const scopedTopic = props.navigationScope?.topicId === undefined ? null : brandString<TopicId>(props.navigationScope.topicId)
  const selectedTopicId = props.navigationScope === undefined
    ? location === null ? null : location.kind === 'map' ? location.focusId : location.topicId
    : scopedTopic ?? null
  const atOverview = selectedTopicId === null
  const [attempt, setAttempt] = useState(0)
  const current = topics.value
  const disconnected = topics.status === 'none'
    || (topics.failure?.code === 'aitp/workspace' && topics.failure.details.code === 'not-connected')
  const openTopic = (topicId: TopicId): void => {
    actions.visitTopic(workspaceId, topicId)
    props.showResearch?.()
  }
  const activateTopic = (topicId: TopicId): void => {
    if (selectedTopicId !== topicId) openTopic(topicId)
  }
  const outline: Outline = {
    isOpen: (topicId, onPath) => disclosure[disclosureKey(workspaceId, 'outline', topicId)] ?? onPath,
    toggle: (topicId, open) => { actions.setDisclosed(disclosureKey(workspaceId, 'outline', topicId), !open) },
  }
  const retry = (): void => {
    setAttempt(value => value + 1)
    props.retry(workspaceId)
  }
  return (
    <div className={css.treeRegion}>
      {project.value?.value.title !== undefined && project.value.value.title !== workspaceTitle
        && <p className={css.projectTitle}>{project.value.value.title}</p>}
      {(current?.origin ?? project.value?.origin) === 'fixture' && <p className={css.fixture}>{t('fixture')}</p>}
      <button
        type="button"
        className={clsx(css.topicButton, css.overview)}
        aria-current={atOverview ? 'page' : undefined}
        onClick={() => { actions.visitTopic(workspaceId, null); props.showResearch?.() }}
      >{t('overview')}</button>
      {atOverview && props.renderFactorySlot('aitp.research.topic-discussions', {
        scope: { workspaceId, title: project.value?.value.title ?? workspaceTitle },
      })}
      {current === undefined
        ? (
          topics.status === 'loading'
            ? <div className={css.loading} role="status" aria-label={t('loading')}><StateDot state="ongoing" /></div>
            : <><p className={css.notice}>{t(disconnected ? 'disconnected' : 'failed')}</p>
              <Button variant="ghost" size="sm" onClick={retry}>{t('retry')}</Button></>
        )
        : (
          <TopicPages key={JSON.stringify([current.revision, current.value.nextCursor, attempt])}
            t={t} useResource={useResource} workspaceId={workspaceId} selectedTopicId={selectedTopicId}
            onSelect={openTopic} outline={outline}
            renderFactorySlot={props.renderFactorySlot} onActivate={activateTopic} newDiscussion={props.newDiscussion}
            onRetry={retry} page={current.value} previous={[]} partial={false} stale={topics.status === 'failed'} />
        )}
    </div>
  )
}

/** Outline branches open along the current path unless the reader chose otherwise. */
interface Outline {
  /** @param topicId - outline node. @param onPath - whether the node leads to the current topic. @returns whether its branches show. */
  isOpen: (topicId: TopicId, onPath: boolean) => boolean
  /** @param topicId - outline node. @param open - its current state, which the toggle inverts. */
  toggle: (topicId: TopicId, open: boolean) => void
}

type TopicPageProps = Pick<WorkspaceSidebarProps, 't' | 'useResource' | 'renderFactorySlot' | 'newDiscussion'> & {
  workspaceId: WorkspaceId
  selectedTopicId: TopicId | null
  onSelect: (topicId: TopicId) => void
  onActivate: (topicId: TopicId) => void
  outline: Outline
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
  const { t, previous: rows } = props
  const byId = new Map(rows.map(topic => [topic.id, topic]))
  const path = new Set<TopicId>()
  for (let id = props.selectedTopicId; id !== null && !path.has(id);) {
    path.add(id)
    id = byId.get(id)?.parentId ?? null
  }
  const branch = { t, byId, path, workspaceId: props.workspaceId, selectedTopicId: props.selectedTopicId,
    onSelect: props.onSelect, onActivate: props.onActivate, outline: props.outline,
    renderFactorySlot: props.renderFactorySlot, newDiscussion: props.newDiscussion }
  const roots = rows.filter(topic => topic.parentId === null)
  const unplaced = rows.filter(topic => topic.parentId !== null && !byId.has(topic.parentId))
  return <>
    {props.stale && <p className={css.notice} role="status">{t('stale')}</p>}
    {rows.length === 0 && <p className={css.notice}>{t('empty')}</p>}
    <ul className={css.topicList}>
      {roots.map(topic => <TopicBranch key={topic.id} {...branch} topic={topic} />)}
    </ul>
    {unplaced.length > 0 && <section>
      <p className={css.groupLabel}>{t('otherTopics')}</p>
      <ul className={css.topicList}>
        {unplaced.map(topic => <TopicBranch key={topic.id} {...branch} topic={topic} />)}
      </ul>
    </section>}
    {props.partial && <p className={css.notice}>{t('partial')}</p>}
  </>
}

type BranchProps = Pick<TopicPageProps, 't' | 'workspaceId' | 'selectedTopicId' | 'onSelect' | 'onActivate'
  | 'outline' | 'renderFactorySlot' | 'newDiscussion'> & {
    byId: ReadonlyMap<TopicId, TopicSummary>
    /** The selected topic and its loaded ancestors. */
    path: ReadonlySet<TopicId>
  }

function TopicBranch(props: BranchProps & { topic: TopicSummary }): ReactNode {
  const { topic, byId, outline, t } = props
  const children = topic.childIds.flatMap((id) => {
    const child = byId.get(id)
    return child === undefined ? [] : [child]
  })
  const title = topic.shortTitle ?? topic.title
  const open = outline.isOpen(topic.id, props.path.has(topic.id))
  return (
    <li>
      <div className={css.row}>
        <button type="button" className={css.toggle} aria-expanded={open}
          aria-label={t(open ? 'hideBranches' : 'showBranches', { title })} onClick={() => { outline.toggle(topic.id, open) }}>
          {open ? <IconChevronDownOutlineRegular size={14} /> : <IconChevronRightOutlineRegular size={14} />}
        </button>
        <button
          type="button"
          className={css.topicButton}
          aria-current={topic.id === props.selectedTopicId ? 'page' : undefined}
          title={topic.title}
          onClick={() => { props.onSelect(topic.id) }}
        >{title}</button>
        {props.newDiscussion !== undefined && <Tooltip label={t('newDiscussion', { title })}>
          <Button variant="ghost" size="sm" className={css.newDiscussion} aria-label={t('newDiscussion', { title })}
            icon={<IconNewChatOutlineRegular size={14} />} onClick={() => {
              props.onActivate(topic.id)
              props.newDiscussion?.(props.workspaceId, topic.id, title)
            }} />
        </Tooltip>}
      </div>
      {open && (
        <ul className={css.children}>
          {children.map(child => <TopicBranch key={child.id} {...props} topic={child} />)}
          <li>{props.renderFactorySlot('aitp.research.topic-discussions', {
            scope: { workspaceId: props.workspaceId, topicId: topic.id, title },
            active: topic.id === props.selectedTopicId,
            onActivate: () => { props.onActivate(topic.id) },
          })}</li>
        </ul>
      )}
    </li>
  )
}
