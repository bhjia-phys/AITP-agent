/** Existing source selections and real completed-message identities are the only action inputs. */
import type { ReactNode } from 'react'
import { Button, IconDeliverDocRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import type { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type {} from './locales.ts'
import css from './study.module.css'

export type StudyTasksProps = PropsRuntime<'aitp.materials.tasks'> & PropsLocale<'aitp.study'> & InjectFace<{
  newNote: (selections: readonly SourceSelection[]) => void
}>

/** @param props - selected references and editable-question callback. @returns no model traffic, only prepared user tasks. */
export function StudyTasks(props: StudyTasksProps): ReactNode {
  if (props.selectionCount === 0) return null
  const tasks = [
    ['comparison', 'comparisonTask'], ['report', 'reportTask'], ['outline', 'outlineTask'],
    ['flashcards', 'flashcardsTask'], ['mind-map', 'mapTask'],
  ] as const
  return <details className={css.tasks}><summary>{props.t('tasks')}</summary><p className={css.muted}>{props.t('taskHelp')}</p>
    <div className={css.toolbar}>{tasks.map(([kind, task]) => <Button key={kind} size="sm" variant="outline"
      onClick={() => { props.prepareQuestion(props.t(task)) }}>{props.t(kind)}</Button>)}
    <Button size="sm" variant="ghost" onClick={() => { props.newNote(props.selections) }}>{props.t('newWithSources')}</Button></div>
  </details>
}

export interface CaptureFace {
  capture: (seq: SessionSeq) => void
}
export type CaptureActionProps = PropsRuntime<'conversation.chat.assistant-actions'> & PropsLocale<'aitp.study'> & InjectFace<CaptureFace>

/**
 * Offer capture only for the durable completed assistant row actually being displayed.
 * @param props - the owner's message ID and the existing Session's published Chat window.
 * @returns a navigation action; the Host later restores the actual answer and checks its origin.
 */
export function CaptureAction(props: CaptureActionProps): ReactNode {
  const node = props.useChat(snapshot => snapshot.legacy.nodes.find(item => item.kind === 'assistant' && item.messageId === props.messageId))
  if (node?.kind !== 'assistant' || node.interrupted || !Number.isSafeInteger(node.seq) || node.seq < 0) return null
  const seq = node.seq as SessionSeq
  return <Tooltip label={props.t('capture')}><button type="button" className={css.capture} aria-label={props.t('capture')}
    onClick={() => { props.capture(seq) }}><IconDeliverDocRegular size={16} /></button></Tooltip>
}

/** @param props - sidebar-owned icon geometry. @returns existing Harness document artwork. */
export function StudyIcon(props: PropsRuntime<'sidebar.panellist'>): ReactNode { return <IconDeliverDocRegular size={props.size} /> }
