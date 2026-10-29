/** Project entry points above the native new-conversation composer. */
import type { ReactNode } from 'react'
import { Button, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { workspaceProjectAddress, workspaceSetupAddress } from './workspace-resources.ts'
import type { DiscussionFace } from './discussion-controller.ts'
import type { createResearchPanelStore } from './store.ts'
import type {} from './locales.ts'
import css from './ResearchHome.module.css'

/** Navigation leaves native drafts and permission selection with their existing owner. */
export interface ResearchHomeFace {
  readonly hooks: Pick<DiscussionFace['hooks'], 'discussionSessions'>
  readonly showProject: (workspaceId: WorkspaceId) => void
  readonly retry: (workspaceId: WorkspaceId) => void
}
export type ResearchHomeProps = PropsRuntime<'conversation.hero.introduction'> & PropsLocale<'aitp.research'>
  & PropsStore<ReturnType<typeof createResearchPanelStore>> & InjectFace<ResearchHomeFace>

/** @param props - live workspaces and explicit navigation. @returns enrolled project entries and the home introduction. */
export function ResearchHome(props: ResearchHomeProps): ReactNode {
  const discussion = props.useDiscussionSessions(sessions => props.sessionId === undefined ? undefined : sessions[props.sessionId])
  const workspaces = props.useWorkspaces(state => state.items)
  const selected = props.useStore(state => state.workspaceId)
  const workspace = workspaces.find(item => item.workspaceId === selected) ?? workspaces[0]
  if (discussion !== undefined) return <section className={css.home} aria-label={props.t('home.resumeResearch')}>
    <h1>{discussion.scope.title ?? props.t('home.resumeResearch')}</h1>
    <p className={css.description}>{props.t('home.researchChatHint')}</p>
  </section>
  return <section className={css.home} aria-label={props.t('home.title')}>
    <h1>{props.t('home.title')}</h1>
    <p className={css.description}>{props.t('home.description')}</p>
    {workspace !== undefined && <div className={css.browse}><Button variant="ghost" size="sm" onClick={() => {
      if (selected !== workspace.workspaceId) props.actions.selectWorkspace(workspace.workspaceId)
      props.showProject(workspace.workspaceId)
    }}>{props.t('home.navigate')}</Button></div>}
    <div className={css.projects} aria-label={props.t('home.projects')}>
      {workspaces.map(workspace => <ProjectEntry key={workspace.workspaceId} {...props} workspace={workspace} />)}
    </div>
    <p className={css.hint}>{props.t('home.chatHint')}</p>
  </section>
}

function ProjectEntry(props: ResearchHomeProps & { readonly workspace: WorkspaceView }): ReactNode {
  const { workspace, t } = props
  const setup = props.useResource<'aitp-workspace-setup'>(workspaceSetupAddress(workspace.workspaceId))
  if (setup.value?.configured === true) return <ConfiguredProject {...props} />
  if (setup.failure !== undefined) return <div className={css.failure} role="status">
    <span>{workspace.title} · {t('home.unavailable')}</span>
    <Button variant="ghost" size="sm" onClick={() => { props.retry(workspace.workspaceId) }}>{t('home.retry')}</Button>
  </div>
  if (setup.status === 'loading') return <span className={css.pending} role="status">{t('home.loading', { title: workspace.title })}</span>
  return null
}

function ConfiguredProject(props: ResearchHomeProps & { readonly workspace: WorkspaceView }): ReactNode {
  const project = props.useResource<'aitp-workspace-project'>(workspaceProjectAddress(props.workspace.workspaceId))
  const title = project.value?.value.title ?? props.workspace.title
  return <button type="button" className={css.project} onClick={() => {
    props.actions.selectWorkspace(props.workspace.workspaceId)
    props.showProject(props.workspace.workspaceId)
  }}>
    <span>{title}</span><IconChevronRightOutlineRegular size={16} />
  </button>
}
