/** Session-independent research workspace over the asynchronous adapter resources. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Button, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { returnPoint, settleArrival } from './arrival.ts'
import { workspaceLocation, type createResearchPanelStore, type ResearchLocation, type ResearchArrival } from './store.ts'
import { Empty } from './states.tsx'
import type { ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview, ReadEnvelope, Result } from './workspace-contract.ts'
import { ResearchMap } from './ResearchMap.tsx'
import { ResearchTrail } from './ResearchTrail.tsx'
import { WorkspaceMaterial } from './WorkspaceViews.tsx'
import { WorkspaceTopic } from './WorkspaceTopic.tsx'
import { WorkspaceQuestion } from './WorkspaceQuestion.tsx'
import type {} from './locales.ts'
import css from './research.module.css'
import type { ResearchQuestion } from './workspace-contract.ts'
import page from './workspace.module.css'

/** Narrow application callbacks bound by the panel registration. */
export interface ResearchPanelFace {
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
export type ResearchPanelProps = PropsRuntime<'main'> & PropsLocale<'aitp.research'>
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
        ? <Empty title={props.t('state.noWorkspace.title')} body={props.t('state.noWorkspace.body')} />
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
    <Menu open={open} onClose={() => { setOpen(false) }} align="end" selectedId={current.workspaceId}
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
  const location = props.useStore(state => workspaceLocation(state, props.workspaceId))
  const arrival = props.useStore(state => state.workspaceId === props.workspaceId ? state.arrival : NO_ARRIVAL)
  const visit = props.useStore(state => state.visit)
  const canGoBack = props.useStore(state => state.workspaceId === props.workspaceId && state.back.length > 0)
  const reading = useRef<HTMLDivElement>(null)
  // Navigation restores an exact reading position and focus before the new page paints.
  useLayoutEffect(() => settleArrival(reading.current, arrival), [visit])
  const navigate = (next: ResearchLocation): void => { props.actions.open(props.workspaceId, next, returnPoint(reading.current)) }
  return (
    <div className={css.reading} ref={reading}>
      <div className={clsx(page.page, location.kind !== 'map' && page.readingPage)}>
        <ResearchTrail {...props} location={location} canGoBack={canGoBack} navigate={navigate} />
        {location.kind === 'map'
          ? <ResearchMap {...props} focusId={location.focusId} navigate={navigate} />
          : location.kind === 'topic'
            ? <WorkspaceTopic key={location.topicId} {...props} topicId={location.topicId} navigate={navigate} />
            : <WorkspaceMaterial key={location.resourceId} {...props}
              resourceId={location.resourceId} topicId={location.topicId} navigate={navigate} />}
        {props.askQuestion !== undefined && <WorkspaceQuestion key={visit} t={props.t}
          workspaceId={props.workspaceId} location={location} reading={reading}
          ask={props.askQuestion} openSession={props.openSession} />}
      </div>
    </div>
  )
}
