/** Explicit file destinations with separate file, association and read-back outcomes. */
import { useId, useState, type ReactNode } from 'react'
import { Button, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { FactoryComponentPropsOf, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { MaterialWriteAttempt, MaterialWriteCommand, MaterialWriteFace, MaterialWriteLocation } from './material-write-contracts.ts'
import { materialWriteLocationAddress } from './material-write-contracts.ts'
import { materialRefKey, materialsScopeKey } from './store.ts'
import css from './materials.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap { 'aitp-material-location': MaterialWriteLocation }
}

type Props = FactoryComponentPropsOf<'aitp.materials.write'> & InjectFace<MaterialWriteFace>
type FormProps = Props & { readonly formKey: string; readonly attempt: MaterialWriteAttempt | undefined; readonly dismiss: () => void }

/**
 * Keep optional write controls compact beside the existing catalog or PDF reader.
 * @param props - explicit context and authenticated writing capability.
 * @returns a form retaining the original request across navigation and explicit retry.
 */
export function MaterialWrite(props: Props): ReactNode {
  const key = `${materialsScopeKey(props.scope)}:${props.source === undefined ? 'text' : materialRefKey(props.source.ref)}`
  const attempt = props.useStore(state => state.materialWrites[key])
  const recoveryProblem = props.useStore(state => state.materialWriteRecoveryProblem)
  const [open, setOpen] = useState(attempt !== undefined && (attempt.result?.ok !== true || attempt.result.value.retry !== 'none'))
  return <details className={props.source === undefined ? css.materialWrite : `${css.materialWrite} ${css.readerWrite}`}
    open={open} onToggle={(event) => { setOpen(event.currentTarget.open) }}>
    <summary><IconChevronRightOutlineRegular size={14} />{props.t(props.source === undefined ? 'writeFile' : 'importPdfCopy')}</summary>
    {open && recoveryProblem !== null && <p role="alert">{recoveryProblem}</p>}
    {open && <MaterialWriteForm key={key} {...props} formKey={key} attempt={attempt} dismiss={() => { setOpen(false) }} />}
  </details>
}

function MaterialWriteForm(props: FormProps): ReactNode {
  const { t, attempt } = props
  const id = useId()
  const workspaces = props.useWorkspaces(state => state.items)
  const [workspace, setWorkspace] = useState(attempt?.command.scope.workspaceId ?? props.scope.workspaceId ?? '')
  const [topic, setTopic] = useState<string>(attempt?.command.scope.topicId ?? props.scope.topicId ?? '')
  const [path, setPath] = useState(attempt?.command.relativePath ?? '')
  const [text, setText] = useState(attempt?.command.kind === 'text' ? attempt.command.text : '')
  const [link, setLink] = useState(attempt === undefined ? props.scope.topicId !== undefined : attempt.command.association !== undefined)
  const [title, setTitle] = useState(attempt?.command.association?.title ?? props.source?.title ?? '')
  const [description, setDescription] = useState(attempt?.command.association?.description ?? '')
  const frozen = attempt !== undefined
  return <section className={css.writeForm} aria-label={t(props.source === undefined ? 'writeFile' : 'importPdfCopy')}>
    {props.source !== undefined && <p className={css.writeHelp}>{t('importPdfHelp')}</p>}
    <label htmlFor={`${id}-workspace`}>{t('writeWorkspace')}</label>
    <select id={`${id}-workspace`} value={workspace} disabled={frozen} onChange={(event) => {
      setWorkspace(event.currentTarget.value); setTopic(''); setPath(''); setLink(false)
    }}><option value="">{t('chooseWorkspace')}</option>
      {workspace && !workspaces.some(item => item.workspaceId === workspace)
        && <option value={workspace}>{props.scope.title ?? workspace}</option>}
      {workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}
    </select>
    {workspace && <MaterialWriteDestination {...props} workspaceId={workspace as WorkspaceId} topic={topic} setTopic={(value) => {
      setTopic(value); setPath(''); setLink(value !== '')
    }} frozen={frozen}>
      {location => <>
        <dl className={css.metadata}><div><dt>{t('writeRoot')}</dt><dd>{location.rootPath}</dd></div>
          <div><dt>{t('writeTopicDirectory')}</dt><dd>{location.directory || '.'}</dd></div></dl>
        {!location.writable && <p role="note" className={css.notice}>{t('writeReadOnly')}</p>}
        <label htmlFor={`${id}-path`}>{t('writeRelativePath')}</label>
        <input id={`${id}-path`} value={path} disabled={frozen} placeholder={t('writePathPlaceholder')}
          onChange={(event) => { setPath(event.currentTarget.value) }} />
        {path && <p className={css.writePath} aria-label={t('writeDestination')}>{location.rootPath.replace(/[\\/]$/, '')}/{path}</p>}
        {props.source === undefined && <><label htmlFor={`${id}-text`}>{t('writeContent')}</label>
          <textarea id={`${id}-text`} rows={8} value={text} disabled={frozen}
            onChange={(event) => { setText(event.currentTarget.value) }} /></>}
        <label className={css.writeCheck}><input type="checkbox" checked={link} disabled={frozen}
          onChange={(event) => { setLink(event.currentTarget.checked) }} />{t('writeLinkAccount')}</label>
        {link && <>
          <p className={css.writePath}>{location.accountPath}</p>
          <label htmlFor={`${id}-title`}>{t('writeLinkTitle')}</label>
          <input id={`${id}-title`} value={title} disabled={frozen} onChange={(event) => { setTitle(event.currentTarget.value) }} />
          <label htmlFor={`${id}-purpose`}>{t('writePurpose')}</label>
          <textarea id={`${id}-purpose`} rows={2} value={description} disabled={frozen}
            onChange={(event) => { setDescription(event.currentTarget.value) }} />
        </>}
        <p className={css.writeHelp}>{t(props.source === undefined && props.libraryDomain === 'knowledge' ? 'writeIndexHelp' : 'writePublicationHelp')}</p>
        {attempt === undefined && <Button size="sm" variant="primary" disabled={!location.writable || !path.trim() || link && !title.trim()}
          onClick={() => {
            const scope = { workspaceId: workspace as WorkspaceId, ...topic ? { topicId: topic as SourceTopicId } : {} }
            const command: MaterialWriteCommand = { scope, operationId: randomUUID(), relativePath: path,
              ...link ? { association: { accountPath: location.accountPath, title,
                ...description ? { description } : {} } } : {},
              ...props.source === undefined ? { kind: 'text', text } : { kind: 'pdf', source: props.source.ref },
            }
            void submit(props, command)
          }}>{t(props.source === undefined ? 'writeSave' : 'writeImport')}</Button>}
      </>}
    </MaterialWriteDestination>}
    {attempt !== undefined && <MaterialWriteOutcome {...props} attempt={attempt} />}
    {attempt === undefined && <Button size="sm" variant="ghost" onClick={props.dismiss}>{t('writeCancel')}</Button>}
  </section>
}

type DestinationProps = FormProps & {
  readonly workspaceId: WorkspaceId
  readonly topic: string
  readonly setTopic: (topic: string) => void
  readonly frozen: boolean
  readonly children: (location: MaterialWriteLocation) => ReactNode
}

function MaterialWriteDestination(props: DestinationProps): ReactNode {
  const { t } = props
  const [page, setPage] = useState<{ workspaceId: WorkspaceId; cursor: string | null }>({ workspaceId: props.workspaceId, cursor: null })
  const cursor = page.workspaceId === props.workspaceId ? page.cursor : null
  const topics = props.useResource<'aitp-workspace-topics'>(`dsh-resource://aitp-workspace-topics/workspace/${encodeURIComponent(props.workspaceId)}${cursor === null ? '' : `?cursor=${encodeURIComponent(cursor)}`}`)
  const options = topics.value?.value.items ?? []
  const location = props.useResource<'aitp-material-location'>(materialWriteLocationAddress({ workspaceId: props.workspaceId,
    ...props.topic ? { topicId: props.topic as SourceTopicId } : {} }))
  return <>
    <label>{t('writeTopic')}<select aria-label={t('writeTopic')} value={props.topic} disabled={props.frozen}
      onChange={(event) => { props.setTopic(event.currentTarget.value) }}>
      <option value="">{t('writeRootAccount')}</option>
      {props.topic && !options.some(item => item.value.id === props.topic)
        && <option value={props.topic}>{props.scope.topicId === props.topic ? props.scope.title ?? props.topic : props.topic}</option>}
      {options.map(item => <option key={item.value.id} value={item.value.id}>{item.value.title}</option>)}
    </select></label>
    {topics.value === undefined && <p className={css.writeHelp}>{t('writeTopicsUnavailable')}</p>}
    {topics.value?.value.completeness === 'partial' && <p className={css.writeHelp}>{t('writeTopicsPartial')}</p>}
    {!props.frozen && <div className={css.writePaging}>
      {cursor !== null && <Button size="sm" variant="ghost" onClick={() => { setPage({ workspaceId: props.workspaceId, cursor: null }) }}>{t('first')}</Button>}
      {topics.value?.value.nextCursor != null && <Button size="sm" variant="ghost"
        onClick={() => { setPage({ workspaceId: props.workspaceId, cursor: topics.value?.value.nextCursor ?? null }) }}>{t('next')}</Button>}
    </div>}
    {location.value === undefined || location.status !== 'live'
      ? <><p role="status" className={css.writeHelp}>{t(location.status === 'loading' ? 'writeLocationLoading' : 'writeLocationUnavailable')}</p>
        {location.status !== 'loading' && <Button size="sm" variant="ghost" onClick={props.refresh}>{t('retry')}</Button>}</>
      : props.children(location.value)}
  </>
}

async function submit(props: FormProps, command: MaterialWriteCommand): Promise<void> {
  props.actions.beginMaterialWrite(props.formKey, command)
  const result = await props.save(command)
  props.actions.finishMaterialWrite(props.formKey, command.operationId, result)
  props.refresh()
}

function MaterialWriteOutcome(props: FormProps & { readonly attempt: MaterialWriteAttempt }): ReactNode {
  const { attempt, t } = props
  const { result } = attempt
  const [openFailed, setOpenFailed] = useState(false)
  if (attempt.busy) return <p role="status">{t('writeSaving')}</p>
  const receipt = result?.ok === true ? result.value : undefined
  const uncertain = result === undefined || ! result.ok && ['outcome-unknown', 'partial-apply'].includes(result.error.code)
    || receipt?.file.state === 'unknown' || receipt?.association.state === 'unknown'
  const retry = result === undefined ? true : result.ok ? result.value.retry === 'same-request'
    : uncertain || 'retryable' in result.error && result.error.retryable
  const inspect = receipt?.retry === 'inspect'
  return <section className={css.writeOutcome} aria-label={t('writeOutcome')}>
    {receipt !== undefined && <>
      <dl className={css.metadata}>
        <div><dt>{t('writeFileState')}</dt><dd>{t(({ saved: 'writeSaved', conflict: 'writeConflict', unknown: 'writeUnknown', 'not-saved': 'writeNotSaved' } as const)[receipt.file.state])}</dd></div>
        <div><dt>{t('writeAssociationState')}</dt><dd>{t(({ linked: 'writeLinked', 'not-requested': 'writeNotRequested', 'not-linked': 'writeNotLinked', unknown: 'writeUnknown', conflict: 'writeConflict' } as const)[receipt.association.state])}</dd></div>
        <div><dt>{t('writeReadBack')}</dt><dd>{t(({ matches: 'writeMatches', different: 'writeDifferent', missing: 'writeMissing', unavailable: 'writeUnavailable' } as const)[receipt.file.readBack.state])}</dd></div>
      </dl>
      {receipt.issues.length > 0 && <ul>{receipt.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
    </>}
    {result?.ok === false && <p role="alert">{result.error.message}</p>}
    {(uncertain || inspect) && <p className={css.notice}>{t(inspect ? 'writeInspectHelp' : 'writeUnknownHelp')}</p>}
    <div className={css.toolbar}>
      {retry && <Button size="sm" variant="outline" onClick={() => { void submit(props, attempt.command) }}>{t('writeRetry')}</Button>}
      {inspect && <Button size="sm" variant="outline" onClick={() => { void submit(props, attempt.command) }}>{t('writeRecheck')}</Button>}
      {receipt !== undefined && receipt.file.state !== 'not-saved' && <Button size="sm" variant="outline"
        onClick={() => { void props.resolveFile(attempt.command.scope, receipt.relativePath).then((ref) => {
          setOpenFailed(ref === undefined)
          if (ref !== undefined) {
            if (!uncertain && receipt.retry === 'none') props.dismiss()
            props.onInspect(ref)
          }
        }) }}>{t('writeOpenFile')}</Button>}
      {!uncertain && !retry && <Button size="sm" variant="ghost" onClick={() => { props.actions.clearMaterialWrite(props.formKey) }}>{t('writeAnother')}</Button>}
    </div>
    {openFailed && <p role="alert">{t('writeOpenUnavailable')}</p>}
  </section>
}
