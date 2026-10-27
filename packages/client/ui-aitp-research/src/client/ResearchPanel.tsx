/** Session-independent research workspace over the asynchronous adapter resources. */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import clsx from 'clsx'
import { Button, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore, PropsRenderFactories, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchOrigin } from '@deepseek-ai/dsh-research-memory/types'
import type { DiscussionResourceNavigation, ResearchDiscussionScope } from './discussion-contract.ts'
import { readWorkspaceSelection, type WorkspaceSelection } from './workspace-selection.ts'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { returnPoint, settleArrival } from './arrival.ts'
import { workspaceLocation, type createResearchPanelStore, type ResearchLocation, type ResearchArrival, type ResearchReturnPoint } from './store.ts'
import type { ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview, ReadEnvelope, Result } from './workspace-contract.ts'
import { ResearchMap } from './ResearchMap.tsx'
import { ResearchTrail } from './ResearchTrail.tsx'
import { WorkspaceMaterial } from './WorkspaceViews.tsx'
import { WorkspaceTopic } from './WorkspaceTopic.tsx'
import { WorkspaceQuestion } from './WorkspaceQuestion.tsx'
import { WorkspaceSetup } from './WorkspaceSetup.tsx'
import { TopicCreation } from './TopicCreation.tsx'
import { workspaceProjectAddress, workspaceSetupAddress, workspaceTopicAddress } from './workspace-resources.ts'
import type {} from './locales.ts'
import css from './research.module.css'
import type { CreateTopicReceipt, CreateTopicRequest, ResearchInitializeRequest, ResearchQuestion, ResearchSetup, ResourceId, TopicId } from './workspace-contract.ts'
import page from './workspace.module.css'

/** Narrow application callbacks bound by the panel registration. */
export interface ResearchPanelFace {
  /** Open the shared native composer with this explicit scientific location and source. */
  beginDiscussion?: (scope: ResearchDiscussionScope, origin: ResearchOrigin) => void
  /** Update only the sources of the next message; admitted messages retain their original context. */
  updateDiscussionSource?: (scope: ResearchDiscussionScope, origin: ResearchOrigin) => void
  /** Open a research-owned source in the centre reader. */
  openDiscussionResource?: (scope: ResearchDiscussionScope, address: string, leave?: ResearchReturnPoint) => boolean
  /** Return from an independent library to this retained research view. */
  showResearch?: () => void
  /** Return to the host's existing Workspace browser and directory-picker flow. */
  showWorkspaces?: () => void
  /** Explicitly enable research access with the chosen write permission. */
  initializeResearch?: (workspaceId: WorkspaceId, request: ResearchInitializeRequest) => Promise<Result<ResearchSetup>>
  /** Create a provider-owned topic with an idempotent operation identity. */
  createTopic?: (workspaceId: WorkspaceId, request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>
  /** Show an existing Harness Session. */
  openSession: (sessionId: SessionId) => void
  /** Prepare a normal Harness conversation; this does not send a model request. */
  startDraft: (workspaceId: WorkspaceId, prompt: string) => void
  /** Send only the question the person submits, with its displayed origin. */
  askQuestion?: (question: ResearchQuestion) => Promise<Result<{ readonly sessionId: SessionId }>>
  /** Prepare a serializable edit against the observed revision. */
  previewChange: (workspaceId: WorkspaceId, intent: ChangeIntent) => Promise<Result<ReadEnvelope<ChangePreview>>>
  /** Apply one previously prepared change, preserving the operation ID on retry. */
  applyChange: (workspaceId: WorkspaceId, request: ApplyRequest) => Promise<Result<ReadEnvelope<ApplyReceipt>>>
  /** Refresh the active workspace's resource readings. */
  retry: (workspaceId: WorkspaceId) => void
}

/** Props composed by the main-slot renderer. */
export type ResearchPanelProps = PropsRuntime<'main'> & PropsLocale<'aitp.research'> & PropsRenderFactories
  & InjectFace<ResearchPanelFace> & PropsStore<ReturnType<typeof createResearchPanelStore>>

/**
 * Research project, topic and resource navigation within Harness.
 * @param props - renderer hooks, declared view store and application callbacks.
 * @returns the current research view.
 */
export function ResearchPanel(props: ResearchPanelProps): ReactNode {
  const workspaces = props.useWorkspaces(snapshot => snapshot.items)
  const chosen = props.useStore(state => state.workspaceId)
  const workspace = workspaces.find(item => item.workspaceId === chosen) ?? workspaces[0]
  return (
    <section className={css.panel} aria-label={props.t('panel')}>
      <header className={css.header}>
        <h1 className={css.headerTitle}>{props.t('panel')}</h1>
        <span className={css.headerSpacer} />
        {workspace !== undefined && <WorkspacePicker t={props.t} workspaces={workspaces}
          current={workspace} onSelect={props.actions.selectWorkspace} />}
      </header>
      {workspace === undefined
        ? <div className={css.center}><div className={css.empty}>
          <p className={css.emptyTitle}>{props.t('state.noWorkspace.title')}</p>
          <p className={css.emptyBody}>{props.t('state.noWorkspace.body')}</p>
          {props.showWorkspaces !== undefined && <div className={css.actions}><Button variant="primary" onClick={props.showWorkspaces}>{props.t('setup.showWorkspaces')}</Button></div>}
        </div></div>
        : <WorkspaceReading key={workspace.workspaceId} {...props} workspaceId={workspace.workspaceId} />}
    </section>
  )
}

function WorkspacePicker({ t, workspaces, current, onSelect }: {
  t: TranslateNS<'aitp.research'>
  workspaces: readonly WorkspaceView[]
  current: WorkspaceView
  onSelect: (workspaceId: WorkspaceId) => void
}): ReactNode {
  const [open, setOpen] = useState(false)
  if (workspaces.length < 2) return <span className={css.workspaceLabel} title={current.path}>{current.title}</span>
  return (
    <Menu autoFocus open={open} onClose={() => { setOpen(false) }} align="end" selectedId={current.workspaceId}
      items={workspaces.map(item => ({ id: item.workspaceId, label: item.title }))}
      onSelect={(id) => { setOpen(false); onSelect(id as WorkspaceId) }}
      anchor={(
        <Button variant="ghost" size="sm" aria-label={t('panel.workspace.choose')} aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open) }}>
          <span className={css.workspaceLabel}>{current.title}</span><IconChevronDownOutlineRegular size={14} />
        </Button>
      )}
    />
  )
}

const NO_ARRIVAL: ResearchArrival = { kind: 'none' }

function WorkspaceReading(props: ResearchPanelProps & { workspaceId: WorkspaceId }): ReactNode {
  const setup = props.useResource<'aitp-workspace-setup'>(workspaceSetupAddress(props.workspaceId))
  const location = props.useStore(state => workspaceLocation(state, props.workspaceId))
  const arrival = props.useStore(state => state.workspaceId === props.workspaceId ? state.arrival : NO_ARRIVAL)
  const visit = props.useStore(state => state.visit)
  const canGoBack = props.useStore(state => state.workspaceId === props.workspaceId && state.back.length > 0)
  const reading = useRef<HTMLDivElement>(null)
  const questionArrival = useRef<TopicId | null>(null)
  const initializeResearch = props.initializeResearch
  const legacy = (setup.status === 'none' && initializeResearch === undefined)
    || (setup.failure?.code === 'aitp/workspace' && setup.failure.details.code === 'unsupported')
  const readingReady = legacy || setup.value?.configured === true
  // Navigation restores an exact reading position and focus before the new page paints.
  useLayoutEffect(() => {
    if (!readingReady) return
    const stop = settleArrival(reading.current, arrival)
    if (location.kind === 'topic' && location.topicId === questionArrival.current) {
      stop()
      questionArrival.current = null
      reading.current?.querySelector<HTMLTextAreaElement>('[data-research-question]')?.focus()
    }
    return stop
  }, [visit, readingReady])
  const navigate = (next: ResearchLocation): void => {
    props.actions.open(props.workspaceId, next, returnPoint(reading.current))
    const topic = next.kind === 'map' ? next.focusId : next.topicId
    const scope: ResearchDiscussionScope = { workspaceId: props.workspaceId, ...topic === null ? {} : { topicId: topic } }
    props.updateDiscussionSource?.(scope, { ...scope, ...next.kind === 'resource' ? { resourceId: next.resourceId } : {} })
  }
  const initialize = initializeResearch === undefined ? undefined
    : (request: ResearchInitializeRequest) => initializeResearch(props.workspaceId, request)
  if (!readingReady) return <div className={css.reading}>
    <WorkspaceSetup t={props.t} setup={setup.value} initialize={initialize}
      loading={setup.status === 'loading'} unavailable={setup.status === 'failed'} retry={() => { props.retry(props.workspaceId) }} />
  </div>
  const topicId = location.kind === 'map' ? location.focusId : location.topicId
  return <WorkspaceContent {...props} location={location} visit={visit} canGoBack={canGoBack}
    reading={reading} navigate={navigate} questionArrival={questionArrival} setup={setup.value} initialize={initialize} topicId={topicId} />
}

function WorkspaceContent(props: ResearchPanelProps & {
  workspaceId: WorkspaceId
  location: ResearchLocation
  visit: number
  canGoBack: boolean
  reading: RefObject<HTMLDivElement>
  navigate: (next: ResearchLocation) => void
  questionArrival: MutableRefObject<TopicId | null>
  setup: ResearchSetup | undefined
  initialize: ((request: ResearchInitializeRequest) => Promise<Result<ResearchSetup>>) | undefined
  topicId: TopicId | null
}): ReactNode {
  const { location, canGoBack, navigate, visit, reading, topicId } = props
  const [showSaving, setShowSaving] = useState(false)
  const [managementOpen, setManagementOpen] = useState(false)
  const [selectionError, setSelectionError] = useState(false)
  const creationDraft = props.useStore(state => state.topicDrafts[props.workspaceId])
  const createTopic = props.createTopic
  const creation = {
    t: props.t, workspaceId: props.workspaceId, useStore: props.useStore, actions: props.actions, writable: props.setup?.writable,
    create: createTopic === undefined ? undefined : (request: CreateTopicRequest) => createTopic(props.workspaceId, request),
    created: (receipt: CreateTopicReceipt) => {
      if (props.beginDiscussion === undefined) props.questionArrival.current = receipt.topicId
      navigate({ kind: 'topic', topicId: receipt.topicId })
      const createdScope = { workspaceId: props.workspaceId, topicId: receipt.topicId }
      props.beginDiscussion?.(createdScope, createdScope)
    },
    inspect: (resourceId?: ResourceId) => { navigate(resourceId === undefined ? { kind: 'map', focusId: null } : { kind: 'resource', topicId: null, resourceId }) },
  }
  const libraryReturn = useRef<ResearchReturnPoint>({ scrollTop: 0, focusIndex: null })
  const libraryNavigation = {
    onLeave: (): void => { libraryReturn.current = returnPoint(reading.current) },
    returnTo: (): void => {
      props.actions.restore(props.workspaceId, location, libraryReturn.current)
      props.showResearch?.()
    },
  }
  const scopeOwner = props.useResource<'aitp-workspace-project' | 'aitp-workspace-topic'>(topicId === null
    ? workspaceProjectAddress(props.workspaceId) : workspaceTopicAddress(props.workspaceId, topicId))
  const scope: ResearchDiscussionScope = {
    workspaceId: props.workspaceId, ...topicId === null ? {} : { topicId },
    ...scopeOwner.value?.value.title === undefined ? {} : { title: scopeOwner.value.value.title },
  }
  const selected = useRef<WorkspaceSelection | undefined>(undefined)
  const rememberSelection = (): void => {
    const selection = reading.current?.ownerDocument.getSelection()
    if (selection?.anchorNode && selection.focusNode && reading.current?.contains(selection.anchorNode)
      && reading.current.contains(selection.focusNode) && selection.toString().trim()) {
      selected.current = readWorkspaceSelection(selection)
    }
  }
  useEffect(() => {
    const document = reading.current?.ownerDocument
    const record = (): void => {
      selected.current = undefined
      rememberSelection()
    }
    document?.addEventListener('selectionchange', record)
    return () => { document?.removeEventListener('selectionchange', record) }
  }, [reading, visit])
  const openResource: DiscussionResourceNavigation = (address) => {
    libraryNavigation.onLeave()
    return props.openDiscussionResource?.(scope, address, libraryReturn.current) ?? false
  }
  const focusQuestion = (): void => {
    if (props.beginDiscussion !== undefined) {
      rememberSelection()
      const quote = selected.current
      if (quote?.unsupported || quote?.topicId !== undefined && quote.topicId !== scope.topicId && quote.resourceId === undefined) {
        setSelectionError(true)
        return
      }
      setSelectionError(false)
      props.beginDiscussion(scope, { ...scope,
        ...(location.kind === 'resource' ? { resourceId: location.resourceId } : {}),
        ...(quote === undefined || quote.unsupported ? {} : {
          ...quote.resourceId === undefined ? {} : { resourceId: quote.resourceId },
          selectedText: quote.text, selectedTextFormat: quote.format,
        }),
      })
      return
    }
    const input = reading.current?.querySelector<HTMLTextAreaElement>('[data-research-question]')
    input?.scrollIntoView({ block: 'center' })
    input?.focus({ preventScroll: true })
  }
  const management = <>
    {props.setup?.configured === true && !props.setup.writable && props.setup.canInitialize && <>
      <Button variant="ghost" size="sm" onClick={() => { setShowSaving(!showSaving) }}>{props.t(showSaving ? 'workspace.edit.cancel' : 'setup.enableSaving')}</Button>
      {showSaving && <WorkspaceSetup t={props.t} setup={props.setup} initialize={props.initialize}
        retry={() => { props.retry(props.workspaceId) }} />}
    </>}
    {props.setup !== undefined && (topicId === null ? <TopicCreation {...creation} currentTopicId={null} />
      : <TopicCreationAtTopic {...creation} useResource={props.useResource} topicId={topicId} />)}
  </>
  return (
    <div className={css.workbench}>
      <div className={css.reading} ref={reading} data-research-reading=""
        onScroll={() => { props.actions.rememberReading(props.workspaceId, location, returnPoint(reading.current)) }}
        onFocusCapture={() => { props.actions.rememberReading(props.workspaceId, location, returnPoint(reading.current)) }}>
        <div className={clsx(page.page, location.kind !== 'map' && page.readingPage, location.kind === 'topic' && page.topicPage)}>
          <div className={page.locationBar}>
            <ResearchTrail {...props} location={location} canGoBack={canGoBack} navigate={navigate} />
            {(location.kind === 'map' || location.kind === 'resource' && creationDraft !== undefined)
              && <div className={page.mapManagement}>{management}</div>}
            {props.beginDiscussion !== undefined && location.kind !== 'topic' && <Button variant="primary" size="sm"
              onPointerDown={rememberSelection} onClick={focusQuestion}>{props.t('workspace.ask.open')}</Button>}
          </div>
          {location.kind === 'map'
            ? <ResearchMap {...props} focusId={location.focusId} navigate={navigate} />
            : location.kind === 'topic'
              ? <WorkspaceTopic key={location.topicId} {...props} topicId={location.topicId} navigate={navigate}
                libraryNavigation={libraryNavigation} focusQuestion={focusQuestion} />
              : <WorkspaceMaterial key={location.resourceId} {...props}
                resourceId={location.resourceId} topicId={location.topicId} navigate={navigate} />}
          {selectionError && <p role="alert">{props.t('workspace.ask.unsupportedSelection')}</p>}
          {props.beginDiscussion === undefined && props.askQuestion !== undefined && <WorkspaceQuestion key={visit} t={props.t}
            workspaceId={props.workspaceId} location={location} reading={reading}
            ask={props.askQuestion} openSession={props.openSession} />}
          {location.kind === 'topic' && props.setup !== undefined && <details className={page.topicManagement}
            open={managementOpen || showSaving
            || creationDraft !== undefined && (!creationDraft.hidden || creationDraft.pending || creationDraft.uncertain)}
            onToggle={(event) => { setManagementOpen(event.currentTarget.open) }}>
            <summary>{props.t('topic.management')}</summary>
            {management}
          </details>}
        </div>
      </div>
      {props.beginDiscussion !== undefined && props.renderFactorySlot('aitp.research.discussion', {
        scope, openResource, returnTo: libraryNavigation.returnTo,
      })}
    </div>
  )
}

function TopicCreationAtTopic(props: Omit<Parameters<typeof TopicCreation>[0], 'currentTopicId' | 'currentTopic'>
  & Pick<ResearchPanelProps, 'useResource'> & { workspaceId: WorkspaceId; topicId: TopicId }): ReactNode {
  const topic = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  return <TopicCreation {...props} currentTopicId={props.topicId} currentTopic={topic} />
}
