/** One Research choice for a new native conversation and its recorded scope thereafter. */
import { useEffect, useState, type ReactNode } from 'react'
import { Checkbox, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-session/client'
import type { createWorkflowStore } from './workflow-store.ts'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionMemoryView } from './workspace-contract.ts'
import { workspaceProviderAddress } from './workspace-resources.ts'
import type {} from './locales.ts'
import css from './ResearchWorkflow.module.css'

type ChoiceProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'aitp.research'> & PropsStore<ReturnType<typeof createWorkflowStore>>
type ControlProps = ChoiceProps & { readonly setMode: (sessionId: SessionId, enabled: boolean) => Promise<void> }

/** @param props - exact native Session, recorded mode and one Host mutation. @returns one control beside this Session's composer. */
export function ResearchWorkflowControl(props: ControlProps): ReactNode {
  const blank = props.useSession(state => state.blank)
  const memory = props.useResource<'aitp-session'>(`dsh-resource://aitp-session/session/${encodeURIComponent(props.sessionId)}`)
  const location = memory.value?.researchLocation
  if (location !== undefined) return <BoundChoice key={props.sessionId} {...props} location={location} live={memory.status === 'live'} />
  return blank ? <ResearchWorkflowChoiceControl {...props} /> : null
}

function BoundChoice(props: ControlProps & { readonly location: NonNullable<SessionMemoryView['researchLocation']>; readonly live: boolean }): ReactNode {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { location } = props
  const help = !props.live ? 'workflow.connecting' : location.automaticResearch ? 'workflow.toggleHelp' : 'workflow.unavailable'
  return <div className={css.control}>
    <Tooltip label={props.t(help)}><span className={css.choice}>
      <Checkbox checked={location.automaticResearch && location.workflow} disabled={pending || !props.live || !location.automaticResearch}
        label={props.t('workflow.label')} onChange={(enabled) => {
          setPending(true); setError(null)
          void props.setMode(props.sessionId, enabled).catch((failure: unknown) => {
            setError(failure instanceof Error ? failure.message : String(failure))
          }).finally(() => { setPending(false) })
        }} />
    </span></Tooltip>
    {error !== null && <p className={css.error} role="alert">{error}</p>}
  </div>
}

/** @param props - real Session, native lifecycle and shared mode preference. @returns one default-on choice while the draft is blank. */
export function ResearchWorkflowChoiceControl(props: ChoiceProps): ReactNode {
  const cwd = props.useSessions(state => state.byId[props.sessionId]?.cwd)
  const workspace = props.useWorkspaces(state => state.items.find(item => item.sessionIds.includes(props.sessionId))
    ?? state.items.find(item => item.path === cwd))
  if (workspace === undefined) return null
  return <WorkspaceChoice {...props} workspaceId={workspace.workspaceId} />
}

function WorkspaceChoice(props: ChoiceProps & { readonly workspaceId: WorkspaceId }): ReactNode {
  const blank = props.useSession(state => state.blank)
  const capture = props.actions.capture
  useEffect(() => { if (blank) capture(props.sessionId) }, [blank, capture, props.sessionId])
  const enabled = props.useStore(state => state.drafts[props.sessionId] ?? state.enabledByDefault)
  const provider = props.useResource<'aitp-workspace-provider'>(workspaceProviderAddress(props.workspaceId))
  const automatic = provider.status === 'live' ? provider.value?.capabilities.automaticResearch : undefined
  return <div className={css.control}><Tooltip label={props.t(automatic === true ? 'workflow.help' : automatic === false ? 'workflow.unavailable' : 'workflow.connecting')}><span className={css.choice}>
    <Checkbox checked={automatic === true && enabled} disabled={!blank || automatic !== true} label={props.t('workflow.label')}
      onChange={(value) => { props.actions.choose(props.sessionId, value) }} />
  </span></Tooltip></div>
}

/** @param props - actual Session memory, not the page currently being browsed. @returns its recorded Research status. */
export function ResearchWorkflowStatus(props: PropsRuntime<'conversation.session.header.actions'> & PropsLocale<'aitp.research'>): ReactNode {
  const memory = props.useResource<'aitp-session'>(`dsh-resource://aitp-session/session/${encodeURIComponent(props.sessionId)}`)
  const location = memory.value?.researchLocation
  if (location === undefined) return null
  return <Tooltip label={[location.title, props.t(location.initializing ? 'workflow.initializing' : location.global ? 'workflow.global' : 'workflow.bound')].filter(Boolean).join(' · ')}>
    <span className={css.status}>{props.t('workflow.label')}{(!location.workflow || !location.automaticResearch) && ` · ${props.t('workflow.off')}`}{location.title !== undefined && ` · ${location.title}`}</span>
  </Tooltip>
}
