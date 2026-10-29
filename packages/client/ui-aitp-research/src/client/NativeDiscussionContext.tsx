/** Keep the scope and next-message source visible when the reading-side Session uses the normal Conversation. */
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DiscussionFace } from './discussion-controller.ts'
import { DiscussionSources } from './DiscussionSources.tsx'
import css from './NativeDiscussionContext.module.css'

type Props = PropsRuntime<'conversation.input.dock'> & PropsLocale<'aitp.research.discussion'> & InjectFace<DiscussionFace>

/** @param props - native Session identity and the shared discussion owner. @returns the retained scope, without a second draft. */
export function NativeDiscussionContext(props: Props): ReactNode {
  const view = props.useDiscussionSessions(state => state[props.sessionId])
  if (view === undefined) return null
  const scope = view.scope
  return <div className={css.context}>
    <div className={css.row}><span>{props.t('context')} · {scope.title ?? props.t(scope.workspaceId === undefined ? 'global' : scope.topicId === undefined ? 'project' : 'topic')}</span>
      {view.canReturn && <Button variant="ghost" size="sm" onClick={() => { void props.returnSessionToReading(props.sessionId) }}>{props.t('backToReading')}</Button>}</div>
    <DiscussionSources origin={view.origin} t={props.t} clear={() => { props.clearSessionSource(props.sessionId) }} />
  </div>
}
