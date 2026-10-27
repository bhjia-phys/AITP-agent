/** One native conversation beside the current research reading surface. */
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Button, IconChevronDownOutlineRegular, IconEditOutlineRegular, IconEllipsisOutlineRegular, IconFullscreenOutlineRegular, IconChevronLeftOutlineRegular, IconNewChatOutlineRegular, Menu, Tooltip, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConversationViewsProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { discussionScopeKey, discussionView } from './discussion-controller.ts'
import { workspaceDiscussionsAddress } from './workspace-resources.ts'
import { DiscussionRename } from './DiscussionRename.tsx'
import type {} from './discussion-contract.ts'
import type {} from './discussion-locales.ts'
import css from './ResearchDiscussion.module.css'

/** Reading-centre sibling. Collapsing retains the actual Session and its draft in the shared controller. */
export function ResearchDiscussion(props: FactoryComponentPropsOf<'aitp.research.discussion'>) {
  const view = props.useDiscussionViews(views => discussionView(views, props.scope))
  const key = discussionScopeKey(props.scope)
  const mount = props.mountDiscussion
  useEffect(() => mount(props.scope, props.openResource, props.returnTo), [key, mount, props.openResource, props.returnTo])
  if (!view.visible) return null
  return <aside className={clsx(css.pane, view.expanded && css.expanded)} aria-label={props.t('title')}
    data-research-discussion="" data-presentation={props.presentation} data-expanded={view.expanded ? 'true' : undefined}>
    <header className={css.header}>
      <div className={css.heading}><span>{props.t('title')}</span><span className={css.scope} title={props.scope.title ?? view.title}>{props.scope.title ?? view.title ?? props.t(props.scope.topicId === undefined ? 'project' : 'topic')}</span></div>
      <div className={css.actions}>
        {props.presentation !== 'main' && <Tooltip label={props.t(view.expanded ? 'restore' : 'expand')}><Button variant="ghost" size="sm" aria-label={props.t(view.expanded ? 'restore' : 'expand')} aria-pressed={view.expanded}
          onClick={() => { props.expandDiscussion(props.scope) }}><IconFullscreenOutlineRegular /></Button></Tooltip>
        }
        <Tooltip label={props.t(props.presentation === 'main' ? 'backToLibrary' : 'close')}><Button variant="ghost" size="sm" aria-label={props.t(props.presentation === 'main' ? 'backToLibrary' : 'close')}
          onClick={() => { props.collapseDiscussion(props.scope) }}><IconChevronLeftOutlineRegular />{props.presentation === 'main' && props.t('backToLibrary')}</Button></Tooltip>
      </div>
    </header>
    <DiscussionPicker {...props} />
    {view.origin !== undefined && <details className={css.context}>
      <summary>{props.t('sources')}<span>{view.origin.selections?.length
        ? props.t('selected', { count: view.origin.selections.length })
        : props.t(view.origin.resourceId === undefined ? 'topicOnly' : 'material')}</span></summary>
      <p>{props.t('topicOnly')}</p>
      {view.origin.selections !== undefined && <ul>{view.origin.selections.map((source, index) => <li key={`${source.ref.rootId}:${source.ref.sourceId}:${index}`}>
        <span>{materialSourcePath(source.ref.sourceId) ?? props.t('sourceNumber', { number: index + 1 })}</span>
        {source.locator?.kind === 'pdf-page' && <span> · {props.t('page', { page: source.locator.page })}</span>}
        {source.locator?.kind === 'code' && <span> · {props.t('lines', { start: source.locator.startLine, end: source.locator.endLine })}</span>}
        {source.selectedText && <blockquote>{source.selectedText}</blockquote>}
      </li>)}</ul>}
      {view.origin.selectedText && <blockquote>{view.origin.selectedText}</blockquote>}
      {(view.origin.resourceId !== undefined || (view.origin.selections?.length ?? 0) > 0) && <Button variant="ghost" size="sm" onClick={() => { props.clearDiscussionSource(props.scope) }}>{props.t('clear')}</Button>}
    </details>}
    {view.error && <div role="alert" className={css.notice}>{view.error}<Button variant="ghost" size="sm" onClick={() => { void props.openDiscussion(props.scope) }}>{props.t('retry')}</Button></div>}
    {view.loading && <div className={css.loading} role="status" aria-label={props.t('loading')}><StateDot state="ongoing" /></div>}
    <div className={css.conversation}>
      {view.reference !== undefined && <props.SessionProvider session={view.reference}>
        {props.renderSlot('aitp.research.discussion.conversation', { workspaceId: props.scope.workspaceId })}
      </props.SessionProvider>}
    </div>
  </aside>
}

function DiscussionPicker(props: FactoryComponentPropsOf<'aitp.research.discussion'>) {
  const [open, setOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [rename, setRename] = useState<{ sessionId: SessionId; title: string; scope: typeof props.scope } | undefined>(undefined)
  const view = props.useDiscussionViews(views => discussionView(views, props.scope))
  const list = props.useResource<'aitp-workspace-discussions'>(workspaceDiscussionsAddress(props.scope.workspaceId, props.scope.topicId))
  const selectedId = view.reference?.sessionId
  const nativeTitle = props.useSessions(state => selectedId === undefined ? undefined : state.byId[selectedId]?.title)
  const rows = list.value?.items ?? []
  const current = rows.find(item => item.sessionId === selectedId)
  const items = rows.map(item => ({ id: item.sessionId, label: item.title || props.t('unnamed') }))
  if (selectedId !== undefined && current === undefined) items.unshift({ id: selectedId, label: nativeTitle || props.t('unnamed') })
  return <div className={css.picker}>
    <Menu open={open} autoFocus onClose={() => { setOpen(false) }} selectedId={selectedId} items={items}
      onSelect={(id) => {
        setOpen(false)
        const item = items.find(candidate => candidate.id === id)
        if (item !== undefined) void props.selectDiscussion(props.scope, item.id)
      }}
      anchor={<Button variant="ghost" size="sm" className={css.current} aria-label={props.t('choose')}
        aria-expanded={open} aria-haspopup="menu" onClick={() => { setOpen(!open) }}>
        <span>{nativeTitle || current?.title || props.t('unnamed')}</span><IconChevronDownOutlineRegular size={14} />
      </Button>} />
    {view.draft && <span className={css.draft}>{props.t('draft')}</span>}
    <Button variant="outline" size="sm" icon={<IconNewChatOutlineRegular />} disabled={view.loading} onClick={() => { void props.newDiscussion(props.scope) }}>{props.t('new')}</Button>
    <Menu open={actionsOpen} autoFocus onClose={() => { setActionsOpen(false) }} align="end"
      items={[{ id: 'rename', label: props.t('rename'), icon: <IconEditOutlineRegular /> }]}
      onSelect={() => {
        setActionsOpen(false)
        if (selectedId !== undefined) setRename({ sessionId: selectedId, title: nativeTitle || current?.title || '', scope: props.scope })
      }}
      anchor={<Tooltip label={props.t('actions')}><Button variant="ghost" size="sm" disabled={selectedId === undefined || view.loading}
        aria-label={props.t('actions')} aria-expanded={actionsOpen} aria-haspopup="menu" onClick={() => { setActionsOpen(!actionsOpen) }}>
        <IconEllipsisOutlineRegular size={16} />
      </Button></Tooltip>} />
    {rename !== undefined && <DiscussionRename key={rename.sessionId} currentTitle={rename.title} t={props.t}
      rename={title => props.renameDiscussion(rename.scope, rename.sessionId, title)} close={() => { setRename(undefined) }} />}
  </div>
}

/** Existing topic-bound Sessions remain the same identities shown in the ordinary Session catalog. */
export function TopicDiscussions(props: FactoryComponentPropsOf<'aitp.research.topic-discussions'>) {
  const view = props.useDiscussionViews(views => discussionView(views, props.scope))
  const list = props.useResource<'aitp-workspace-discussions'>(workspaceDiscussionsAddress(props.scope.workspaceId, props.scope.topicId))
  const rows = list.value?.items ?? []
  const nativeSessions = props.useSessions(state => state.byId)
  const selectedId = view.reference?.sessionId
  const selectedIsDraft = selectedId !== undefined && !rows.some(item => item.sessionId === selectedId)
  const activate = (sessionId: SessionId): void => { props.onActivate?.(); void props.selectDiscussion(props.scope, sessionId) }
  if (list.status === 'loading' && rows.length === 0 && !selectedIsDraft) return <p className={css.listState}>{props.t('loading')}</p>
  if (list.failure !== undefined) return <p role="alert" className={css.listState}>{props.t('listFailed')}</p>
  return <div className={css.sessions}>
    {rows.length === 0 && !selectedIsDraft && <p className={css.listState}>{props.t('empty')}</p>}
    {selectedIsDraft && <button type="button" className={css.session}
      aria-current={props.active !== false && view.visible ? 'true' : undefined} onClick={() => { activate(selectedId) }}>
      {nativeSessions[selectedId]?.title || props.t('unnamed')}</button>}
    {rows.map(item => <button type="button" key={item.sessionId} className={css.session}
      aria-current={props.active !== false && view.visible && selectedId === item.sessionId ? 'true' : undefined}
      title={nativeSessions[item.sessionId]?.title || item.title}
      onClick={() => { activate(item.sessionId) }}><span className={css.sessionTitle}>
        {nativeSessions[item.sessionId]?.title || item.title || props.t('unnamed')}</span>
      {item.busy && <span className={css.busy} aria-label={props.t('loading')} />}</button>)}
    {list.value?.completeness === 'partial' && <p className={css.listState}>{props.t('partial')}</p>}
  </div>
}

function FixedChatView(props: ConversationViewsProps) { return <>{props.renderSlot('conversation.session', { view: 'chat' })}</> }

/** Reuses native composer, tools, approvals, model controls and stop within an exact retained Session. */
export function DiscussionConversation({ useSession, renderFactorySlot, workspaceId }:
  PropsRuntime<'aitp.research.discussion.conversation'> & PropsRenderFactories) {
  const session = useSession(value => value)
  // The scope is already selected by the reading surface; the global hero's Workspace switcher does not belong here.
  return <>{renderFactorySlot('aitp.research.change-notice', { workspaceId })}
    {renderFactorySlot('conversation.content', { variant: 'embedded', phase: session.openState === 'loading' ? 'settling' : 'active', hero: false },
      { slots: { views: FixedChatView } })}</>
}
