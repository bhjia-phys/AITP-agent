/** Draft, preview and acknowledgement UI; adapters own every mutation. */
import { useId, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { Topic, TopicId, WorkspaceRead } from './workspace-contract.ts'
import { workspaceEditKey } from './workspace-edit-state.ts'
import type { WorkspaceViewProps } from './WorkspaceViews.tsx'
import css from './research.module.css'

/**
 * Edit state belongs to the declared view store so navigation cannot lose an in-flight operation.
 * @param props - topic identity, optional current reading and adapter callbacks.
 * @returns the inline edit form with preview and durable-for-this-view recovery feedback.
 */
export function WorkspaceEditor(props: WorkspaceViewProps & {
  topicId: TopicId
  read?: WorkspaceRead<Topic> | undefined
}): ReactNode {
  const { t, read, actions, workspaceId } = props
  const key = workspaceEditKey(workspaceId, props.topicId)
  const edit = props.useStore(state => state.pendingEdits[key])
  const prefix = useId()
  if (edit === undefined || edit.hidden) return null
  const { mode, text, qualification, baseRevision, prepared, pending, failure, acknowledged, uncertain } = edit
  const locked = pending !== null || uncertain || acknowledged !== null

  const preview = async (): Promise<void> => {
    if (locked) return
    const requestId = randomUUID()
    actions.prepareEdit(key, requestId)
    const result = await props.previewChange(workspaceId, {
      topicId: edit.topicId,
      expectedRevision: baseRevision,
      command: mode === 'scope'
        ? { kind: 'update-scope', scope: text }
        : { kind: 'record-answer', text, qualification, sourceResourceIds: edit.sourceResourceIds },
    })
    actions.settlePreview(key, requestId, result, randomUUID())
  }
  const apply = async (): Promise<void> => {
    if (prepared === null || pending !== null || acknowledged !== null) return
    // The operation is retained before dispatch. A late response settles this same record after unmount.
    actions.submitEdit(key, prepared.operationId)
    const result = await props.applyChange(workspaceId, { previewId: prepared.preview.value.previewId, operationId: prepared.operationId })
    actions.settleApply(key, prepared.operationId, result)
    if (result.ok) props.retry(workspaceId)
  }
  const errorKey = failure?.code === 'partial-apply' ? 'workspace.edit.partial' : uncertain ? 'workspace.edit.unknown'
    : failure?.code === 'revision-conflict' ? 'workspace.edit.conflict'
      : failure?.code === 'unsupported' || failure?.code === 'read-only' ? 'workspace.edit.unsupported'
        : 'workspace.edit.failed'

  return (
    <section className={css.editor} aria-label={t(mode === 'scope' ? 'workspace.edit.scope' : 'workspace.edit.answer')}>
      <h3>{t(mode === 'scope' ? 'workspace.edit.scope' : 'workspace.edit.answer')}</h3>
      <label className={css.editorLabel} htmlFor={`${prefix}-text`}>{t(mode === 'scope' ? 'workspace.scope' : 'workspace.edit.text')}</label>
      <textarea id={`${prefix}-text`} className={css.editorText} rows={4} value={text} disabled={locked}
        onChange={(event) => { actions.changeEditText(key, 'text', event.currentTarget.value) }} />
      {mode === 'answer' && <>
        <label className={css.editorLabel} htmlFor={`${prefix}-qualification`}>{t('workspace.edit.qualification')}</label>
        <textarea id={`${prefix}-qualification`} className={css.editorText} rows={3} value={qualification} disabled={locked}
          onChange={(event) => { actions.changeEditText(key, 'qualification', event.currentTarget.value) }} />
      </>}
      {prepared !== null && <div className={css.preview}>
        <p>{prepared.preview.value.summary}</p>
        {prepared.preview.value.edits.map(change => <div key={`${change.target.kind}:${change.target.id}`} className={css.previewRow}>
          <h4>{change.label}</h4>
          <div><span>{t('workspace.edit.before')}</span><pre>{change.before}</pre></div>
          <div><span>{t('workspace.edit.after')}</span><pre>{change.after}</pre></div>
        </div>)}
        {prepared.preview.value.pendingIntegration.length > 0 && <div><h4>{t('workspace.edit.pending')}</h4><ul>{prepared.preview.value.pendingIntegration.map(item => <li key={item}>{item}</li>)}</ul></div>}
      </div>}
      {(failure !== null || uncertain) && <div role="alert" className={css.editError}>
        <p>{t(errorKey)}</p>{failure !== null && <p>{failure.message}</p>}
        {failure?.code === 'revision-conflict' && !uncertain && <Button variant="ghost" size="sm" onClick={() => { props.retry(workspaceId) }}>{t('workspace.retry')}</Button>}
        {failure?.code === 'revision-conflict' && !uncertain && read !== undefined && read.revision !== baseRevision && <div className={css.latestVersion}>
          <h4>{t('workspace.edit.latest')}</h4>
          <p>{mode === 'scope' ? read.value.scope : read.value.currentAnswer?.text}</p>
          {mode === 'answer' && <p>{read.value.currentAnswer?.qualification}</p>}
          <Button variant="outline" size="sm" onClick={() => { actions.rebaseEdit(key, read.revision) }}>{t('workspace.edit.adopt')}</Button>
        </div>}
      </div>}
      {acknowledged !== null && <p role="status" className={css.editSuccess}>{t(acknowledged === 'fixture' ? 'workspace.edit.appliedFixture' : 'workspace.edit.applied')}</p>}
      <div className={css.actions}>
        {acknowledged === null && <>
          <Button variant="outline" size="sm" disabled={locked || text.trim() === ''} onClick={() => { void preview() }}>{t(pending === 'preview' ? 'workspace.edit.preparing' : 'workspace.edit.preview')}</Button>
          {prepared !== null && <Button variant="primary" size="sm" disabled={pending !== null || (failure !== null && !uncertain)} onClick={() => { void apply() }}>{t(pending === 'apply' ? 'workspace.edit.applying' : uncertain ? 'workspace.edit.retry' : 'workspace.edit.apply')}</Button>}
        </>}
        <Button variant="ghost" size="sm" onClick={() => { actions.closeEdit(key) }}>{t(pending !== null || uncertain ? 'workspace.edit.hide' : 'workspace.edit.cancel')}</Button>
      </div>
    </section>
  )
}
