/** Shared low-density library overview and source-grounded question composer. */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Tooltip, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconChevronLeftOutlineRegular, IconRefreshOutlineRegular, IconSearchOutlineRegular, IconCloseOutlineRegular, IconNewChatOutlineRegular, IconLoadingOutlineRegular, IconFolderOpenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore, PropsRenderFactories, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { ResourceDomain, ResourceLink, ResourcePage, ResourceReading, ResourceResult, RootConnection, SaveSourceSetRequest, SourceRoot, SourceRootId, SourceSelection, SourceSet, SourceSetId, SourceSetReceipt, StudyReceipt, StudyRequest } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { LibraryLabels, MaterialsScope, SelectedMaterial } from './contracts.ts'
import type { LibraryView, MaterialsStore } from './store.ts'
import { materialSelectionKey, materialsScopeKey } from './store.ts'
import { MATERIAL_ROOTS, materialListAddress } from './resources.ts'
import type {} from './locales.ts'
import css from './materials.module.css'
import { LibraryManagement, SourceSetSave } from './LibraryManagement.tsx'

/** Host-owned source sets and read-only Workspace attachment. */
export interface MaterialsManagementFace {
  readonly isCurrent?: () => boolean
  readonly connect: (workspaceId: WorkspaceId) => Promise<ResourceResult<RootConnection>>
  readonly disconnect: (workspaceId: WorkspaceId) => Promise<ResourceResult<{ readonly disconnected: boolean }>>
  readonly save: (request: SaveSourceSetRequest) => Promise<ResourceResult<SourceSetReceipt>>
  readonly load: (id: SourceSetId) => Promise<ResourceResult<{
    readonly sourceSet: SourceSet
    readonly selections: readonly SelectedMaterial[]
  }>>
}

/** Application callbacks bound to this module's registered panel. */
export interface MaterialsPanelFace {
  readonly discussion?: {
    readonly open: (scope: MaterialsScope,
      selections: readonly SourceSelection[], prompt?: string) => void
    readonly setSources: (scope: MaterialsScope, selections: readonly SourceSelection[]) => void
  }
  readonly management?: MaterialsManagementFace
  readonly domain: ResourceDomain
  readonly panelId: MainPanelId
  readonly labels: () => LibraryLabels
  readonly refresh: () => void
  readonly returnTo: () => void
  readonly prepareFullConversation?: (scope: MaterialsScope) => (() => void)
  readonly hasReturn?: (scope: MaterialsScope) => boolean
  readonly preview: (selection: SourceSelection, scope: MaterialsScope) => void
  readonly changeScope: (scope: MaterialsScope) => void
  readonly openLink: (link: ResourceLink, reading: ResourceReading) => boolean
  readonly ask: (request: StudyRequest) => Promise<ResourceResult<StudyReceipt>>
  readonly openSession: (receipt: StudyReceipt) => void
  readonly openSelection: (selection: SelectedMaterial, scope: MaterialsScope) => void
}

/** Derived slot shares; data reads always use the framework resource hook. */
export type MaterialsPanelProps = PropsRuntime<'main'> & PropsRenderFactories & PropsLocale<'aitp.materials'>
  & PropsStore<MaterialsStore> & InjectFace<MaterialsPanelFace>

/**
 * Browse one provider-owned library and ask about an explicit source set.
 * @param props - framework hooks, shared viewing store and injected callbacks.
 * @returns the overview or current source plus the same ordinary-Session question flow.
 */
export function MaterialsPanel(props: MaterialsPanelProps): ReactNode {
  const { t, domain } = props
  const labels = props.labels()
  const scope = props.useStore(state => state.scope)
  const current = props.useStore(state => state.views[domain])
  const scroll = useRef<HTMLDivElement>(null)
  const arriving = useRef(true)
  const arrivalKey = `${materialsScopeKey(scope)}:${domain}`
  const initialScroll = current.catalogScrollTop
  useLayoutEffect(() => {
    const region = scroll.current
    if (region === null) return
    arriving.current = true
    const apply = (): void => {
      if (!arriving.current || !region.querySelector('[data-material-ready]')) return
      region.scrollTop = initialScroll
      if (Math.abs(region.scrollTop - initialScroll) < 1) arriving.current = false
    }
    const observer = new MutationObserver(apply)
    observer.observe(region, { childList: true, subtree: true })
    const size = new ResizeObserver(apply)
    if (region.firstElementChild !== null) size.observe(region.firstElementChild)
    apply()
    return () => { observer.disconnect(); size.disconnect() }
    // A location's saved position is read once on entry, not after each scroll observation.
  }, [arrivalKey])
  const scopeLabel = scope.workspaceId === undefined ? t('global')
    : scope.title === undefined ? t(scope.topicId === undefined ? 'project' : 'direction')
      : t(scope.topicId === undefined ? 'workspaceScope' : 'topicScope', { title: scope.title })
  const roots = props.useResource<'aitp-material-roots'>(MATERIAL_ROOTS)
  const prepareFullConversation = props.prepareFullConversation
  const availableRoots = roots.value?.filter(root => root.domains === undefined || root.domains.includes(domain))
  const codeRootOverview = domain === 'code' && current.rootId === null && !current.query
    && scope.workspaceId === undefined
  return <section className={css.panel} aria-label={labels.title}>
    <header className={css.header}><h1>{labels.title}</h1><div className={css.scope} data-scoped={scope.workspaceId !== undefined}>
      <span className={css.scopeLabel}>{scopeLabel}</span>
      {scope.workspaceId !== undefined && (props.hasReturn?.(scope) ?? true) && <Button variant="ghost" size="sm" icon={<IconChevronLeftOutlineRegular />} onClick={props.returnTo}>
        {t(scope.topicId === undefined ? 'returnProject' : 'returnTopic')}</Button>}
      {scope.workspaceId !== undefined && <Button variant="ghost" size="sm" onClick={() => { props.changeScope({}) }}>{t('clearScope')}</Button>}
      <Tooltip label={t('retry')}><Button variant="ghost" size="sm" aria-label={t('retry')} onClick={props.refresh}><IconRefreshOutlineRegular /></Button></Tooltip>
      {props.renderFactorySlot('sidebar.right.root.expand', { panelId: props.panelId })}
    </div></header>
    <div className={css.workbench}><div className={css.scroll} ref={scroll}
      onWheel={() => { arriving.current = false }} onPointerDown={() => { arriving.current = false }}
      onKeyDown={() => { arriving.current = false }}
      onScroll={(event) => {
        if (!arriving.current) props.actions.setCatalogScroll(domain, event.currentTarget.scrollTop, materialsScopeKey(scope))
      }}><div className={css.page}>
        <PendingSourceSets {...props} />
        <StudyComposer {...props} />
        <>
          <div className={css.catalogToolbar} data-material-ready>
            <label className={css.searchBox}><IconSearchOutlineRegular /><input className={css.search} aria-label={t('search')} placeholder={t('search')} value={current.query}
              onChange={(event) => { props.actions.setQuery(domain, event.currentTarget.value) }} /></label>
            <label className={css.rootFilter}><IconFolderOpenOutlineRegular /><select aria-label={t('roots')} value={current.rootId ?? ''}
              onChange={(event) => { props.actions.setRoot(domain, event.currentTarget.value || null) }}>
              <option value="">{t('allRoots')}</option>{availableRoots?.map(root => <option key={root.id} value={root.id}>{root.title}</option>)}
            </select></label>
            {scope.topicId !== undefined && <label className={css.rootFilter}>{t('materialScope')}<select aria-label={t('materialScope')}
              value={hasTopicFilter(scope, domain, current) ? 'topic' : 'all'}
              onChange={(event) => {
                const all = event.currentTarget.value === 'all'
                if (!all && domain === 'code') props.actions.setRoot(domain, null)
                props.actions.setAllInCollection(domain, all)
              }}>
              <option value="topic">{t('topicMaterials')}</option><option value="all">{t('allMaterials')}</option>
            </select></label>}
          </div>
          {props.renderFactorySlot('aitp.materials.write', { scope, libraryDomain: domain, onInspect: (ref) => { props.preview({ ref }, scope) } })}
          {availableRoots?.length === 0 && <p className={css.notice}>{t('noRoots')}</p>}
          {availableRoots?.length !== 0 && (codeRootOverview
            ? availableRoots === undefined ? <MaterialUnavailable {...props} snapshot={roots} list />
              : <CodeRootOverview {...props} roots={availableRoots} />
            : <LibraryResults {...props} />)}
          {props.management !== undefined && <LibraryManagement {...props} management={props.management} />}
        </>
      </div></div>
    {props.discussion !== undefined && props.renderFactorySlot('aitp.research.discussion', {
      scope, presentation: 'main', ...props.hasReturn?.(scope) === false ? {} : { returnTo: props.returnTo },
      ...prepareFullConversation === undefined ? {} : { prepareFullConversation: () => prepareFullConversation(scope) },
    })}
    </div>
  </section>
}

function PendingSourceSets(props: MaterialsPanelProps): ReactNode {
  const drafts = props.useStore(state => Object.values(state.drafts).filter(draft => draft.pendingSave !== null))
  const problem = props.useStore(state => state.recoveryProblem)
  return <>
    {problem !== null && <p role="alert" className={css.notice}>{problem}</p>}
    {drafts.length > 0 && <details className={css.management}><summary>{props.t('pendingSaves', { count: drafts.length })}</summary>
      <ul className={css.links}>{drafts.map(draft => <li key={materialsScopeKey(draft.scope)}>
        <Button variant="ghost" size="sm" onClick={() => { props.changeScope(draft.scope) }}>{draft.sourceSetTitle}</Button>
        <span className={css.muted}>{draft.scope.title ?? props.t(draft.scope.workspaceId === undefined ? 'global'
          : draft.scope.topicId === undefined ? 'project' : 'direction')}</span>
      </li>)}</ul>
    </details>}
  </>
}

/** Open the code root list without first traversing any checkout. */
function CodeRootOverview(props: MaterialsPanelProps & { roots: readonly SourceRoot[] }): ReactNode {
  const scope = props.useStore(state => state.scope)
  const selected = props.useStore(state => state.drafts[materialsScopeKey(scope)]?.selections) ?? []
  const sending = props.useStore((state) => {
    const draft = state.drafts[materialsScopeKey(scope)]
    return draft?.sending === true || draft?.pendingSave != null
  })
  return props.renderFactorySlot('aitp.materials.catalog', {
    domain: 'code', items: [], roots: props.roots, rootId: null, folderPath: '', query: '', selected, disabled: sending,
    isSelected: resource => selected.some(item => materialSelectionKey(item) === materialSelectionKey({ ref: resource.ref,
      ...resource.locator === undefined ? {} : { locator: resource.locator } })),
    onOpen: (selection) => { stageCurrentSource(props, scope, selected, selection); props.preview(selection, scope) },
    onSelect: (resource, checked) => { updateSelection(props, scope, selected, { ref: resource.ref, title: resource.title,
      domain: resource.domain, ...resource.locator === undefined ? {} : { locator: resource.locator } }, checked) },
    onRoot: (id) => { props.actions.setRoot('code', id) },
    onFolder: (path) => { props.actions.setFolder('code', path) },
  })
}

/** A chosen code folder lists its contents; other catalogs can retain the topic association filter. */
function hasTopicFilter(scope: MaterialsScope, domain: ResourceDomain, view: LibraryView): boolean {
  return scope.workspaceId !== undefined && scope.topicId !== undefined && view.allInCollection !== true
    && !(domain === 'code' && view.rootId !== null)
}

/** Observe only the requested library page after the person selects a source or search. */
function LibraryResults(props: MaterialsPanelProps): ReactNode {
  const scope = props.useStore(state => state.scope)
  const current = props.useStore(state => state.views[props.domain])
  const list = props.useResource<'aitp-material-list'>(materialListAddress({ domain: props.domain,
    ...current.rootId === null ? {} : { rootId: current.rootId as SourceRootId },
    ...props.domain === 'code' && current.rootId !== null && !current.query ? { folder: current.folderPath } : {},
    ...current.query ? { query: current.query } : {}, ...current.cursor === null ? {} : { cursor: current.cursor },
    ...!hasTopicFilter(scope, props.domain, current) || scope.workspaceId === undefined || scope.topicId === undefined ? {}
      : { topic: { workspaceId: scope.workspaceId, topicId: scope.topicId } },
  }))
  return <LibraryRows {...props} reading={list} />
}

function LibraryRows(props: MaterialsPanelProps & { reading: ResourceSnapshot<ResourcePage> }): ReactNode {
  const { reading, t, domain } = props
  const scope = props.useStore(state => state.scope)
  const selected = props.useStore(state => state.drafts[materialsScopeKey(scope)]?.selections)
  const sending = props.useStore((state) => {
    const draft = state.drafts[materialsScopeKey(scope)]
    return draft?.sending === true || draft?.pendingSave != null
  })
  const view = props.useStore(state => state.views[domain])
  const topicFiltered = hasTopicFilter(scope, domain, view)
  const cursor = view.cursor
  const roots = props.useResource<'aitp-material-roots'>(MATERIAL_ROOTS)
  const page = reading.value
  const firstPage = cursor !== null && <Button variant="ghost" size="sm"
    onClick={() => { props.actions.nextPage(domain, null) }}>{t('first')}</Button>
  if (page === undefined) return <><MaterialUnavailable {...props} snapshot={reading} list />
    {reading.status === 'failed' && firstPage && <div className={css.toolbar}>{firstPage}</div>}</>
  return <>
    {reading.status === 'failed' && <MaterialUnavailable {...props} snapshot={reading} />}
    {(page.completeness === 'partial' || page.issues.length > 0) && <details className={css.coverage}>
      <summary><span role="note">{t(page.completeness === 'partial' ? 'coveragePartial' : 'coverageDetails')}</span><span>{t('viewDetails')}</span></summary>
      {page.completeness === 'partial' && <p>{t(topicFiltered ? 'partialTopic' : 'partial')}</p>}
      {page.issues.length > 0 && <ul>{page.issues.map((issue, index) => <li key={index}>{issue.reason}</li>)}</ul>}
    </details>}
    {page.items.length === 0 && !(domain === 'code' && view.rootId !== null && !view.query) ? reading.status === 'failed' ? null : <div className={css.empty}>
      <IconFolderOpenOutlineRegular size={28} />
      <p>{t(!topicFiltered ? page.completeness === 'partial' ? 'emptyPartial' : 'empty'
        : page.completeness === 'partial' ? 'emptyTopicPartial' : 'emptyTopic')}</p>
      {topicFiltered && <Button variant="outline" size="sm" onClick={() => {
        props.actions.setRoot(domain, null); props.actions.setQuery(domain, ''); props.actions.setAllInCollection(domain, true)
      }}>{t('browseAll')}</Button>}
    </div>
      : props.renderFactorySlot('aitp.materials.catalog', {
        domain, items: page.items, roots: roots.value ?? [], rootId: view.rootId, folderPath: view.folderPath,
        query: view.query, ...topicFiltered ? { topicFiltered: true } : {},
        selected: selected ?? [], disabled: sending,
        isSelected: resource => selected?.some(item => materialSelectionKey(item) === materialSelectionKey({ ref: resource.ref,
          ...resource.locator === undefined ? {} : { locator: resource.locator },
        })) ?? false,
        onOpen: (selection) => {
          stageCurrentSource(props, scope, selected ?? [], selection)
          props.preview(selection, scope)
        },
        onSelect: (resource, checked) => { updateSelection(props, scope, selected ?? [], {
          ref: resource.ref, title: resource.title, domain: resource.domain,
          ...resource.locator === undefined ? {} : { locator: resource.locator },
        }, checked) },
        onRoot: (id) => { props.actions.setRoot(domain, id) },
        onFolder: (path) => { props.actions.setFolder(domain, path) },
      })}
    <div className={css.toolbar}>
      {firstPage}
      {page.nextCursor !== null && <Button variant="outline" size="sm" onClick={() => { props.actions.nextPage(domain, page.nextCursor) }}>{t('next')}</Button>}
    </div>
    <details className={css.observation}><summary>{t('readingInfo')}</summary><p className={css.muted}>{t('observed', { time: page.observedAt })}</p></details>
  </>
}

/**
 * Report the real missing-provider, loading or failed source state.
 * @param props - localized copy and the current framework resource status.
 * @returns a stable recovery action without clearing the draft.
 */
export function MaterialUnavailable(props: Pick<MaterialsPanelProps, 't' | 'refresh'> & { snapshot: ResourceSnapshot<unknown>; list?: boolean }): ReactNode {
  if (props.snapshot.status === 'loading' && props.list) return <div className={css.skeleton} role="status" aria-label={props.t('loading')}>
    {[0, 1, 2, 3].map(row => <div key={row} aria-hidden="true"><span /><span /></div>)}
  </div>
  if (props.snapshot.status === 'loading') return <div className={css.loading} role="status" aria-label={props.t('loadingSource')}>
    <IconLoadingOutlineRegular size={24} /><span>{props.t('loadingSource')}</span>
  </div>
  const failure = props.snapshot.failure
  const code = failure?.code === 'aitp/materials' ? failure.details.code : undefined
  const messageKey = code === 'permission-denied' ? 'denied' : code === 'not-found' ? 'missing'
    : props.snapshot.status === 'none' ? 'disconnected' : 'readFailed'
  return <div className={css.notice} role="alert">
    <p>{props.t(messageKey)}</p>
    {failure !== undefined && <details className={css.observation}><summary>{props.t('errorDetails')}</summary><p>{failure.message}</p></details>}
    <Button variant="outline" size="sm" onClick={props.refresh}>{props.t('retry')}</Button>
  </div>
}

function StudyComposer(props: MaterialsPanelProps): ReactNode {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const scope = props.useStore(state => state.scope)
  const key = materialsScopeKey(scope)
  const draft = props.useStore(state => state.drafts[key])
  const question = draft?.question ?? ''
  const selected = draft?.selections ?? []
  const discussion = props.discussion
  const scoped = discussion !== undefined
  const disclosed = expanded || Boolean(question.trim()) || draft?.failure != null || draft?.pendingSave != null
  const submit = async (): Promise<void> => {
    if (!question.trim() || selected.length === 0 || draft?.sending) return
    const request: StudyRequest = { question,
      ...scope.workspaceId === undefined ? {} : { workspaceId: scope.workspaceId },
      ...scope.topicId === undefined ? {} : { topicId: scope.topicId },
      ...draft?.sourceSetId == null ? {} : { sourceSetId: draft.sourceSetId },
      selections: selected.map(({ ref, locator, selectedText }) => ({ ref,
        ...locator === undefined ? {} : { locator }, ...selectedText === undefined ? {} : { selectedText },
      })),
    }
    props.actions.sending(key, true)
    const result = await props.ask(request)
    if (!result.ok) { props.actions.sending(key, false, result.error.message); return }
    props.actions.sent(key)
    props.openSession(result.value)
  }
  if (selected.length === 0 && !question.trim() && draft?.failure == null && draft?.pendingSave == null) return null
  return <section className={css.study} aria-label={props.t('selected', { count: selected.length })}>
    <div className={css.selectionHeader}>
      <Button variant="ghost" size="sm" aria-expanded={disclosed} aria-controls={id}
        icon={disclosed ? <IconChevronDownOutlineRegular /> : <IconChevronRightOutlineRegular />}
        onClick={() => { setExpanded(!expanded) }}>{props.t('selected', { count: selected.length })}</Button>
      {scoped && <Button variant="primary" size="sm" icon={<IconNewChatOutlineRegular />} disabled={selected.length === 0}
        onClick={() => { discussion.open(scope, sourceSelections(selected), question || undefined) }}>{props.t('discuss')}</Button>}
    </div>
    <div id={id} hidden={!disclosed}>
      {selected.length > 0 && <ul className={css.selection}>{selected.map(item => <li key={materialSelectionKey(item)}>
        <span>{item.title}</span>
        {item.locator?.kind === 'pdf-page' && <span>{props.t('pageLocation', { page: item.locator.page })}</span>}
        {item.locator?.kind === 'code' && <span>{props.t('lineLocation', { start: item.locator.startLine, end: item.locator.endLine })}</span>}
        {item.selectedText !== undefined && <details><summary>{props.t('passage')}</summary><blockquote>{item.selectedText}</blockquote></details>}
        {item.unavailable !== undefined && <span role="note">{props.t('noContent')} {item.unavailable}</span>}
        <Tooltip label={props.t('remove', { title: item.title })}><button type="button" aria-label={props.t('remove', { title: item.title })} disabled={draft?.sending || draft?.pendingSave != null}
          onClick={() => { updateSelection(props, scope, selected, item, false) }}><IconCloseOutlineRegular size={14} /></button></Tooltip>
      </li>)}</ul>}
      {props.management !== undefined && <SourceSetSave {...props} management={props.management} />}
      {selected.length > 0 && props.renderFactorySlot('aitp.materials.study-tools', {
        selectionCount: selected.length, selections: selected.map(({ ref, locator, selectedText }) => ({ ref,
          ...locator === undefined ? {} : { locator }, ...selectedText === undefined ? {} : { selectedText },
        })), prepareQuestion: (question) => {
          if (scoped) discussion.open(scope, sourceSelections(selected), question)
          else props.actions.question(question)
        },
      })}
      {scoped ? <p className={css.muted}>{props.t('discussionHelp')}</p> : <><label htmlFor={`${id}-question`}>{props.t('question')}</label>
        <textarea id={`${id}-question`} className={css.question} placeholder={props.t('placeholder')} value={question} disabled={draft?.sending}
          onChange={(event) => { props.actions.question(event.currentTarget.value) }} />
        <p className={css.muted}>{props.t(selected.length === 0 ? 'noSelection' : 'notRead')}</p>
        {draft?.failure != null && <p role="alert" className={css.notice}>{props.t('failed')} {draft.failure}</p>}
        <Button variant="primary" icon={<IconNewChatOutlineRegular />} disabled={draft?.sending || !question.trim() || selected.length === 0} onClick={() => { void submit() }}>{props.t(draft?.sending ? 'asking' : 'ask')}</Button></>}
    </div>
  </section>
}

/** Sidebar keeps source folders and selections in the existing Harness footprint. */
export type MaterialsSidebarProps = PropsRuntime<'sidebar.context'> & PropsRenderFactories & PropsLocale<'aitp.materials'>
  & PropsStore<MaterialsStore> & InjectFace<MaterialsPanelFace>

/**
 * Choose connected source roots without creating or changing a scientific topic.
 * @param props - the same view store used by the library panel.
 * @returns source-root navigation and selected material links.
 */
export function MaterialsSidebar(props: MaterialsSidebarProps): ReactNode {
  const roots = props.useResource<'aitp-material-roots'>(MATERIAL_ROOTS)
  const root = props.useStore(state => state.views[props.domain].rootId)
  const scope = props.useStore(state => state.scope)
  const selections = props.useStore(state => state.drafts[materialsScopeKey(scope)]?.selections)
  if (!props.wide) return <div className={css.rail}><Button variant="ghost" size="sm"
    aria-label={props.t('expand')} onClick={props.expandSidebar}><IconChevronRightOutlineRegular size={18} /></Button></div>
  return <nav className={css.sidebar} aria-label={props.labels().title}>
    <h2>{props.t('roots')}</h2><ul>
      <li><button type="button" aria-current={root === null ? 'page' : undefined} onClick={() => { props.actions.setRoot(props.domain, null) }}>{props.t('allRoots')}</button></li>
      {roots.value?.filter(item => item.domains === undefined || item.domains.includes(props.domain)).map(item => <li key={item.id}><button type="button" aria-current={root === item.id ? 'page' : undefined}
        title={item.displayPath} onClick={() => { props.actions.setRoot(props.domain, item.id) }}>{item.title}</button></li>)}
    </ul>
    <h2>{props.t('selected', { count: selections?.length ?? 0 })}</h2><ul>
      {selections?.map(item => <li key={materialSelectionKey(item)}><button type="button" onClick={() => { props.openSelection(item, scope) }}>{item.title}
        {item.locator?.kind === 'pdf-page' && <span> · {props.t('pageLocation', { page: item.locator.page })}</span>}</button></li>)}
    </ul>
  </nav>
}

/** Keep source-set labels local while the next message receives exact source references. */
function sourceSelections(selected: readonly SourceSelection[]): SourceSelection[] {
  return selected.map(({ ref, locator, selectedText }) => ({ ref,
    ...locator === undefined ? {} : { locator }, ...selectedText === undefined ? {} : { selectedText },
  }))
}

/** Reading supplies a current source only while no explicitly staged source set takes precedence. */
function stageCurrentSource(props: MaterialsPanelProps, scope: MaterialsScope, selected: readonly SelectedMaterial[],
  source: SourceSelection): void {
  if (selected.length === 0) {
    props.discussion?.setSources(scope, [source])
  }
}

/** Only explicit selection actions update the discussion; PDF navigation never changes a quotation. */
function updateSelection(props: MaterialsPanelProps, scope: MaterialsScope, selected: readonly SelectedMaterial[],
  item: SelectedMaterial, included: boolean): SelectedMaterial[] {
  const next = selected.filter(current => materialSelectionKey(current) !== materialSelectionKey(item))
  if (included) next.push(item)
  props.actions.select(item, included)
  props.discussion?.setSources(scope, sourceSelections(next))
  return next
}
