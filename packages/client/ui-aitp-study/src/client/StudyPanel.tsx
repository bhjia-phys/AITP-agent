/** Provisional artifacts use ordinary resources, explicit edits and the existing Session viewer. */
import { useId, useState, type ReactNode } from 'react'
import { Button, IconChevronRightOutlineRegular, IconChevronLeftOutlineRegular, IconPlusOutlineRegular, IconRefreshOutlineRegular, IconSearchOutlineRegular, StateDot, Tooltip, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { StudyArtifact, StudyArtifactId, StudyArtifactKind, StudyResult } from '@deepseek-ai/dsh-research-study/types'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { StudyOperation, StudyStore } from './store.ts'
import { STUDY_KINDS, STUDY_SETUP, studyArtifactAddress, studyListAddress } from './resources.ts'
import type {} from './locales.ts'
import css from './study.module.css'

export interface StudyFace {
  readonly refresh: () => void
  readonly execute: (operation: StudyOperation, checking?: boolean) => Promise<void>
  readonly exportArtifact: (id: StudyArtifactId) => Promise<StudyResult<{ filename: string; markdown: string }>>
  readonly openSession: (id: SessionId) => void
  readonly openSource: (source: SourceSelection) => Promise<boolean>
}
export type StudyPanelProps = PropsRuntime<'main'> & PropsLocale<'aitp.study'> & PropsStore<StudyStore> & InjectFace<StudyFace>

/** @param props - renderer-owned state and authenticated commands. @returns the list, current draft, or saved artifact. */
export function StudyPanel(props: StudyPanelProps): ReactNode {
  const location = props.useStore(state => state.location)
  const draft = props.useStore(state => state.draft)
  const locked = props.useStore(state => state.pending !== null)
  const failure = props.useStore(state => state.failure)
  const pending = props.useStore(state => state.pending)
  const saving = props.useStore(state => state.saving)
  const recoveryProblem = props.useStore(state => state.recoveryProblem)
  return <section className={css.panel} aria-label={props.t('title')}>
    <header className={css.header}><h1>{props.t('title')}</h1><div className={css.toolbar}>
      <Tooltip label={props.t('refresh')}><Button size="sm" variant="ghost" aria-label={props.t('refresh')} onClick={props.refresh}><IconRefreshOutlineRegular /></Button></Tooltip>
      {location.kind !== 'draft' && <Button size="sm" variant="primary" icon={<IconPlusOutlineRegular />} disabled={locked}
        onClick={() => { if (draft === null) props.actions.create(); else props.actions.resume() }}>{props.t(draft === null ? 'create' : 'resume')}</Button>}
    </div></header>
    <div className={css.scroll}><div className={css.page}>
      {location.kind !== 'list' && <Button size="sm" variant="ghost" icon={<IconChevronLeftOutlineRegular />} disabled={locked}
        onClick={() => { props.actions.list() }}>{props.t('back')}</Button>}
      {location.kind === 'list' ? <ArtifactList {...props} />
        : location.kind === 'draft' ? <DraftEditor {...props} /> : <ArtifactReading {...props} id={location.id} />}
      {pending !== null && !saving && <div className={css.notice} role="alert"><p>{props.t('unknown')}</p>
        <code>{pending.request.operationId}</code><Button size="sm" variant="outline"
          onClick={() => { void props.execute(pending, true) }}>{props.t('check')}</Button></div>}
      {failure !== null && <p role="alert" className={css.notice}>{failure}</p>}
      {recoveryProblem !== null && <p role="alert" className={css.notice}>{recoveryProblem}</p>}
    </div></div>
  </section>
}

function ArtifactList(props: StudyPanelProps): ReactNode {
  const filter = props.useStore(state => state.filter)
  const [query, setQuery] = useState('')
  const cursor = props.useStore(state => state.cursor)
  const pending = props.useStore(state => state.pending)
  const page = props.useResource<'aitp-study-list'>(studyListAddress({
    ...filter === null ? {} : { kind: filter }, ...cursor === null ? {} : { cursor },
  }))
  const items = page.value?.items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? []
  return <><p className={css.intro}>{props.t('description')}</p>
    <div className={css.filters}><label className={css.search}><IconSearchOutlineRegular />
      <input aria-label={props.t('search')} placeholder={props.t('search')} value={query}
        onChange={(event) => { setQuery(event.currentTarget.value) }} /></label>
    <select aria-label={props.t('kind')} value={filter ?? ''}
      onChange={(event) => { props.actions.filter(event.currentTarget.value === '' ? null : event.currentTarget.value as StudyArtifactKind) }}>
      <option value="">{props.t('all')}</option>{STUDY_KINDS.map(kind => <option key={kind} value={kind}>{props.t(kind)}</option>)}
    </select></div>
    {query && <p className={css.muted}>{props.t('searchScope')}</p>}
    {page.value === undefined ? <StudyUnavailable {...props} loading={page.status === 'loading'} />
      : <><ul className={css.list}>{items.map(item => <li key={item.id}>
        <button type="button" className={css.title} disabled={pending !== null}
          onClick={() => { props.actions.open(item.id) }}>{item.title}</button>
        <p className={css.muted}>{props.t(item.kind)} · {props.t('provisional')} · {props.t(item.origin === 'handwritten' ? 'handwritten' : 'captured')}</p>
        <details className={css.metadata}><summary>{props.t('details')}</summary><p>{props.t('observed', { time: item.updatedAt })}</p></details>
      </li>)}</ul>
      {items.length === 0 && <div className={css.empty}><p>{props.t(query ? 'noMatches' : filter === null ? 'empty' : 'emptyKind')}</p>
        <p className={css.muted}>{props.t('emptyHelp')}</p></div>}
      {cursor !== null && <Button size="sm" variant="ghost" onClick={() => { props.actions.page(null) }}>{props.t('first')}</Button>}
      {page.value.nextCursor !== null && <Button size="sm" variant="ghost"
        onClick={() => { props.actions.page(page.value?.nextCursor ?? null) }}>{props.t('next')}</Button>}
      </>}
    {page.value !== undefined && page.status === 'failed' && <p role="alert">{props.t('unavailable')} {page.failure?.message}</p>}
  </>
}

function DraftEditor(props: StudyPanelProps): ReactNode {
  const id = useId()
  const draft = props.useStore(state => state.draft)
  const locked = props.useStore(state => state.pending !== null)
  const saving = props.useStore(state => state.saving)
  const setup = props.useResource<'aitp-study-setup'>(STUDY_SETUP)
  if (draft === null) return null
  const submit = (): void => {
    if (locked || !draft.title.trim()) return
    const operationId = globalThis.crypto.randomUUID()
    const operation: StudyOperation = draft.capture === undefined ? { kind: 'save', request: {
      operationId, ...draft.id === undefined ? {} : { id: draft.id },
      title: draft.title, kind: draft.kind, markdown: draft.markdown, citations: draft.citations,
    } } : { kind: 'capture', request: { operationId, title: draft.title, kind: draft.kind, ...draft.capture } }
    void props.execute(operation)
  }
  return <section className={css.editor}>
    <p className={css.muted}>{props.t('provisional')} · {props.t(draft.origin === 'handwritten' ? 'handwritten' : 'captured')}</p>
    <label htmlFor={`${id}-title`}>{props.t('name')}</label>
    <input id={`${id}-title`} value={draft.title} disabled={locked}
      onChange={(event) => { props.actions.change('title', event.currentTarget.value) }} />
    <label htmlFor={`${id}-kind`}>{props.t('kind')}</label>
    <select id={`${id}-kind`} value={draft.kind} disabled={locked}
      onChange={(event) => { props.actions.change('kind', event.currentTarget.value) }}>
      {STUDY_KINDS.map(kind => <option key={kind} value={kind}>{props.t(kind)}</option>)}
    </select>
    {draft.capture === undefined ? <><label htmlFor={`${id}-body`}>{props.t('markdown')}</label>
      <textarea id={`${id}-body`} value={draft.markdown} disabled={locked}
        onChange={(event) => { props.actions.change('markdown', event.currentTarget.value) }} /></>
      : <><p>{props.t('captureHelp')}</p><p>{props.t('capturePending', { session: draft.capture.sessionId, seq: draft.capture.seq })}</p></>}
    {draft.citations.length > 0 && <section><h2>{props.t('sources')}</h2><p className={css.muted}>{props.t('human')}</p>
      <ul>{draft.citations.map((selection, index) => <li key={index}>{materialSourcePath(selection.ref.sourceId)
        ?? props.t('sourceNumber', { number: index + 1 })}</li>)}</ul></section>}
    <div><Button variant="primary" disabled={locked || !draft.title.trim()
      || (draft.capture === undefined ? setup.value?.canSave !== true : setup.value?.canCapture !== true)}
    onClick={submit}>{props.t(saving ? 'saving' : draft.capture === undefined ? 'save' : 'captureSave')}</Button></div>
    {setup.value === undefined && <p role="status">{props.t('unavailable')}</p>}
  </section>
}

function ArtifactReading(props: StudyPanelProps & { id: StudyArtifactId }): ReactNode {
  const reading = props.useResource<'aitp-study-note'>(studyArtifactAddress(props.id))
  const locked = props.useStore(state => state.pending !== null)
  const [failure, setFailure] = useState<string | null>(null)
  const artifact = reading.value
  if (artifact === undefined) return <StudyUnavailable {...props} loading={reading.status === 'loading'} />
  const exportNote = async (): Promise<void> => {
    const result = await props.exportArtifact(artifact.id)
    if (!result.ok) { setFailure(result.error.message); return }
    const link = document.createElement('a')
    const url = URL.createObjectURL(new Blob([result.value.markdown], { type: 'text/markdown;charset=utf-8' }))
    link.href = url; link.download = result.value.filename; link.click(); URL.revokeObjectURL(url)
    setFailure(null)
  }
  const open = (source: SourceSelection): void => {
    void props.openSource(source).then((opened) => { if (!opened) setFailure(props.t('sourceUnavailable')) })
  }
  return <article className={css.reading}>
    <h2>{artifact.title}</h2><p className={css.muted}>{props.t('provisional')} · {props.t(artifact.kind)} · {props.t(artifact.origin === 'handwritten' ? 'handwritten' : 'captured')}</p>
    {artifact.edited && <p className={css.muted}>{props.t('edited')}</p>}
    <details className={css.metadata}><summary>{props.t('details')}</summary><p>{props.t('version', { version: artifact.version })}</p>
      <p>{props.t('observed', { time: artifact.updatedAt })}</p></details>
    <div className={css.toolbar}>
      <Button size="sm" variant="outline" disabled={locked} onClick={() => { props.actions.edit(artifact) }}>{props.t('edit')}</Button>
      <Button size="sm" variant="ghost" onClick={() => { void exportNote() }}>{props.t('export')}</Button>
      {artifact.source !== undefined ? <Button size="sm" variant="ghost" onClick={() => { if (artifact.source !== undefined) open(artifact.source) }}>{props.t('asSource')}</Button>
        : <span className={css.muted}>{props.t('noSource')}</span>}
    </div>
    <MarkdownText text={artifact.markdown} labels={{ code: { copyLabel: props.t('copy'), copiedLabel: props.t('copied') }, footnotes: props.t('footnotes') }} />
    <ArtifactSources artifact={artifact} open={open} openSession={props.openSession} t={props.t} />
    <details className={css.removal}><summary>{props.t('remove')}</summary><p>{props.t('removeHelp')}</p>
      <Button size="sm" variant="outline" disabled={locked} onClick={() => { void props.execute({ kind: 'remove',
        request: { operationId: globalThis.crypto.randomUUID(), id: artifact.id } }) }}>{props.t('remove')}</Button></details>
    {reading.status === 'failed' && <p role="alert">{props.t('unavailable')} {reading.failure?.message}</p>}
    {failure !== null && <p role="alert">{failure}</p>}
  </article>
}

function ArtifactSources({ artifact, open, openSession, t }: {
  artifact: StudyArtifact
  open: (source: SourceSelection) => void
  openSession: (id: SessionId) => void
} & Pick<StudyPanelProps, 't'>): ReactNode {
  return <section><h3>{t('sources')}</h3><ul className={css.sources}>
    {artifact.citations.map((citation, index) => <li key={index}>
      <Button size="sm" variant="ghost" onClick={() => { open(citation.selection) }}>{materialSourcePath(citation.selection.ref.sourceId)
        ?? t('sourceNumber', { number: index + 1 })}</Button>
      <span className={css.muted}>{t(citation.basis === 'human-linked' ? 'human' : citation.basis === 'selected' ? 'selected'
        : citation.basis === 'recorded-context' ? 'context' : 'read')}</span>
      {citation.selection.selectedText !== undefined && <blockquote>{citation.selection.selectedText}</blockquote>}
    </li>)}
  </ul>
  {artifact.capture !== undefined && <details><summary>{t('context')} · {artifact.capture.provider} / {artifact.capture.model}</summary>
    <Button size="sm" variant="ghost" onClick={() => { if (artifact.capture !== undefined) openSession(artifact.capture.sessionId) }}>{t('original')}</Button>
    {artifact.capture.contexts.map(context => <details key={`${context.seq}:${context.name}`}><summary>{context.name}</summary><pre>{context.text}</pre></details>)}
  </details>}
  </section>
}

/** @param props - the same framework store and single-sidebar runtime. @returns low-density study navigation. */
export function StudySidebar(props: PropsRuntime<'sidebar.context'> & PropsLocale<'aitp.study'> & PropsStore<StudyStore>): ReactNode {
  const locked = props.useStore(state => state.pending !== null)
  const draft = props.useStore(state => state.draft)
  if (!props.wide) return <div className={css.rail}><Button variant="ghost" size="sm"
    aria-label={props.t('expand')} onClick={props.expandSidebar}><IconChevronRightOutlineRegular size={18} /></Button></div>
  return <nav className={css.sidebar} aria-label={props.t('title')}>
    <Button variant="ghost" disabled={locked} onClick={() => { props.actions.list() }}>{props.t('all')}</Button>
    <Button variant="ghost" disabled={locked} onClick={() => { if (draft === null) props.actions.create(); else props.actions.resume() }}>{props.t(draft === null ? 'create' : 'resume')}</Button>
    <p className={css.muted}>{props.t('provisional')}</p>
  </nav>
}

function StudyUnavailable({ loading, t, refresh }: Pick<StudyPanelProps, 't' | 'refresh'> & { loading: boolean }): ReactNode {
  return loading ? <div className={css.empty} role="status" aria-label={t('loading')}><StateDot state="ongoing" /></div>
    : <div className={css.notice} role="alert"><p>{t('unavailable')}</p><Button variant="outline" size="sm" onClick={refresh}>{t('refresh')}</Button></div>
}
