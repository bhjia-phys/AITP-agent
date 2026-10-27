/** A researcher-authored form backed by the Workspace's retained creation attempt. */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button, IconChevronDownOutlineRegular, IconPlusOutlineRegular, Input, Menu, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { CreateTopicReceipt, CreateTopicRequest, ResourceId, Result, Topic, TopicId, WorkspaceRead } from './workspace-contract.ts'
import type { ResearchPanelProps } from './ResearchPanel.tsx'
import type { TopicCreationDraft } from './topic-creation-state.ts'
import css from './onboarding.module.css'

type CreationProps = Pick<ResearchPanelProps, 'useStore' | 'actions'> & {
  t: TranslateNS<'aitp.research'>
  workspaceId: WorkspaceId
  currentTopicId: TopicId | null
  currentTopic?: ResourceSnapshot<WorkspaceRead<Topic>> | undefined
  writable: boolean | undefined
  create?: ((request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>) | undefined
  created: (receipt: CreateTopicReceipt) => void
  inspect?: ((resourceId?: ResourceId) => void) | undefined
}

/**
 * Create a topic without sending a prompt; unresolved requests outlive this component.
 * @param props - Workspace-owned draft, current topic, permission and provider action.
 * @returns creation controls and their explicitly opened form.
 */
export function TopicCreation(props: CreationProps): ReactNode {
  const { t, workspaceId, currentTopicId, currentTopic, writable, create, created, actions } = props
  const draft = props.useStore(state => state.topicDrafts[workspaceId])
  const recovery = props.useStore(state => state.topicRecovery)
  const receipt = draft?.receipt
  useLayoutEffect(() => {
    if (receipt === undefined || receipt === null) return
    actions.finishTopic(workspaceId)
    created(receipt)
  }, [receipt])
  const available = writable === true && create !== undefined && recovery !== 'unreadable'
  const begin = (branch: boolean): void => {
    actions.beginTopic(workspaceId, branch ? currentTopicId ?? undefined : undefined,
      currentTopicId ?? undefined, currentTopic?.value?.value.title)
  }
  return <div className={css.creation}>
    <div className={css.actions}>
      <Button variant="outline" size="sm" disabled={draft?.hidden !== true && (!available || draft !== undefined)}
        icon={<IconPlusOutlineRegular size={14} />} onClick={() => { begin(false) }}>
        {t(draft?.hidden ? 'topic.create.resume' : 'topic.create.new')}</Button>
      {currentTopicId !== null && <Button variant="ghost" size="sm" disabled={!available || draft !== undefined}
        onClick={() => { begin(true) }}>{t('topic.create.branch')}</Button>}
      {!available && <span className={css.hint}>{t(recovery === 'unreadable' ? 'topic.create.recoveryUnreadable' : writable === false ? 'topic.create.readOnly' : 'topic.create.unsupported')}</span>}
    </div>
    {draft !== undefined && !draft.hidden && create !== undefined && <TopicForm {...props} create={create} draft={draft} />}
  </div>
}

function TopicForm(props: CreationProps & { create: NonNullable<CreationProps['create']>; draft: TopicCreationDraft }): ReactNode {
  const { t, draft, actions, workspaceId, create } = props
  const id = useId()
  const [menu, setMenu] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const occupied = useRef(false)
  const { title, question, scope, pending, uncertain, failure, parentTopicId } = draft
  const recovery = props.useStore(state => state.topicRecovery)
  const locked = pending || uncertain
  const parentLabel = parentTopicId === undefined ? t('topic.create.topLevel') : t('topic.create.under', { title: draft.currentTitle ?? t('topic.create.current') })
  const failureCopy = failure?.code === 'partial-apply' ? t('topic.create.partial') : uncertain ? t('topic.create.unknown')
    : failure?.code === 'unsupported' ? t('topic.create.unsupported') : failure?.code === 'read-only' ? t('topic.create.readOnly') : failure?.message
  const createdResource = failure?.code === 'partial-apply' ? failure.changed.find(item => item.target.kind === 'resource')?.target : undefined
  return <form className={css.form} aria-labelledby={`${id}-heading`} aria-busy={pending} onSubmit={(event) => {
    event.preventDefault()
    if (occupied.current || pending) return
    if (!title.trim() || !question.trim()) { setInvalid(true); return }
    const request = draft.request ?? { operationId: randomUUID(), title: title.trim(), question: question.trim(),
      ...(scope.trim() ? { scope: scope.trim() } : {}), ...(parentTopicId === undefined ? {} : { parentTopicId }),
    }
    occupied.current = true
    setInvalid(false)
    actions.submitTopic(workspaceId, request)
    void create(request).then((result) => { actions.settleTopic(workspaceId, request.operationId, result) }, () => {
      actions.settleTopic(workspaceId, request.operationId, { ok: false, error: {
        code: 'outcome-unknown', operationId: request.operationId, message: t('topic.create.failed'),
      } })
    }).finally(() => { occupied.current = false })
  }}>
    <h2 id={`${id}-heading`}>{t('topic.create.heading')}</h2>
    {recovery === 'unavailable' && <p className={css.hint} role="status">{t('topic.create.recoveryUnavailable')}</p>}
    <label htmlFor={`${id}-title`}>{t('topic.create.title')}</label>
    <Input id={`${id}-title`} autoFocus value={title} disabled={locked} onChange={(event) => { actions.changeTopic(workspaceId, 'title', event.currentTarget.value) }} />
    <label htmlFor={`${id}-question`}>{t('topic.create.question')}</label>
    <textarea id={`${id}-question`} rows={3} value={question} disabled={locked} onChange={(event) => { actions.changeTopic(workspaceId, 'question', event.currentTarget.value) }} />
    <label htmlFor={`${id}-scope`}>{t('topic.create.scope')}</label>
    <textarea id={`${id}-scope`} rows={2} value={scope} disabled={locked} onChange={(event) => { actions.changeTopic(workspaceId, 'scope', event.currentTarget.value) }} />
    <span id={`${id}-parent`}>{t('topic.create.parent')}</span>
    <Menu autoFocus open={menu} onClose={() => { setMenu(false) }} selectedId={parentTopicId === undefined ? 'root' : 'current'}
      items={[{ id: 'root', label: t('topic.create.topLevel') }, ...(draft.currentTopicId === undefined ? [] : [{ id: 'current', label: t('topic.create.under', { title: draft.currentTitle ?? t('topic.create.current') }) }])]}
      onSelect={(choice) => { actions.selectTopicParent(workspaceId, choice === 'root' ? undefined : draft.currentTopicId); setMenu(false) }}
      anchor={<Button variant="outline" size="sm" disabled={locked} aria-labelledby={`${id}-parent ${id}-choice`}
        aria-haspopup="menu" aria-expanded={menu} onClick={() => { setMenu(!menu) }}>
        <span id={`${id}-choice`}>{parentLabel}</span><IconChevronDownOutlineRegular size={14} />
      </Button>} />
    {(invalid || failureCopy !== undefined) && <div className={css.error} role="alert">
      <p>{invalid ? t('topic.create.required') : failureCopy}</p>
      {failure !== null && uncertain && <details><summary>{t('topic.create.details')}</summary>
        <p>{failure.message}</p><p>{t('topic.create.operation')}: <code>{draft.request?.operationId}</code></p>
      </details>}
      {uncertain && props.inspect !== undefined && <Button variant="ghost" size="sm" onClick={() => {
        actions.closeTopic(workspaceId)
        props.inspect?.(createdResource?.kind === 'resource' ? createdResource.id : undefined)
      }}>{t(createdResource === undefined ? 'topic.create.inspectProject' : 'topic.create.inspect')}</Button>}
    </div>}
    <div className={css.actions}>
      <Button type="submit" variant="primary" disabled={pending || !props.writable || !title.trim() || !question.trim()}
        icon={pending ? <StateDot state="ongoing" size={16} /> : <IconPlusOutlineRegular size={16} />}>
        {t(pending ? 'topic.create.creating' : failure?.code === 'partial-apply' ? 'topic.create.check' : uncertain ? 'topic.create.retry' : 'topic.create.submit')}</Button>
      <Button variant="ghost" onClick={() => { actions.closeTopic(workspaceId) }}>{t(locked ? 'workspace.edit.hide' : 'workspace.edit.cancel')}</Button>
    </div>
  </form>
}
