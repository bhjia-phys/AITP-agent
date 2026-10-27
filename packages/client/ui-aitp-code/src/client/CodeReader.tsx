/** Read-only source, status, diff and history views backed by real Git observations. */
import { Button, IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { SourceLocator } from '@deepseek-ai/dsh-research-resources/types'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from './index.ts'
import { codeChanges, codeHistory, codeStatus } from './code-model.ts'
import css from './code.module.css'

type HeaderProps = PropsRuntime<'aitp.materials.reader.header'> & PropsLocale<'aitp.materials.code'>
type BodyProps = PropsRuntime<'aitp.materials.reader.body'> & PropsLocale<'aitp.materials.code'> & PropsRenderFactories

/** Keep file identity and observed branch visible; expand source details on demand. */
export function CodeHeader({ reading, fields, t }: HeaderProps) {
  const { resource } = reading
  const path = materialSourcePath(resource.ref.sourceId)
  const branch = resource.metadata['branch']
  return <header className={css.readerHeading}>
    <p className={css.eyebrow}>{t(path === undefined ? 'repository' : 'sourceFile')}</p>
    <h2>{resource.title}</h2>
    {branch !== undefined && <span className={css.branch}><IconBranchOutlineRegular />{branch === 'detached' ? t('detached') : branch === 'unborn' ? t('unborn') : branch}</span>}
    <details className={css.details}><summary>{t('sourceDetails')}</summary><dl>
      {path !== undefined && path !== resource.title && <><dt>{t('path')}</dt><dd>{path}</dd></>}
      {fields.map(field => resource.metadata[field.key] === undefined ? null
        : <div key={field.key}><dt>{field.label}</dt><dd>{resource.metadata[field.key]}</dd></div>)}
    </dl></details>
  </header>
}

/** Use provider locators for every view change; no branch switches or repository writes. */
export function CodeBody(props: BodyProps) {
  const { reading, t, onNavigate } = props
  const { resource, body } = reading
  if (body.kind !== 'text') return null
  const path = materialSourcePath(resource.ref.sourceId)
  const locator = reading.locator ?? resource.locator
  const git = locator?.kind === 'git' ? locator : undefined
  const view = git?.view ?? 'source'
  const markdown = view === 'source' && !props.raw && (body.format === 'markdown' || /\.(?:md|markdown)$/iu.test(path ?? ''))
  const checkout = resource.metadata['checkoutState'] === 'git'
  const navigate = (next?: SourceLocator) => { onNavigate({ ref: resource.ref, ...next === undefined ? {} : { locator: next } }) }
  const selectGit = (next: 'status' | 'diff' | 'history', scope: 'working-tree' | 'staged' = 'working-tree') => {
    navigate({ kind: 'git', view: next, ...next === 'diff' ? { scope } : {}, ...git?.path === undefined ? {} : { path: git.path } })
  }
  const changes = view === 'status' ? codeChanges(body.text) : undefined
  const commits = view === 'history' ? codeHistory(body.text) : undefined
  return <div className={css.reader}>
    <div className={css.tabs} aria-label={t('views')}>
      {path !== undefined && <Button variant={view === 'source' ? 'outline' : 'ghost'} size="sm" aria-pressed={view === 'source'} onClick={() => { navigate() }}>{t('source')}</Button>}
      {checkout && <>
        {path === undefined && <Button variant={view === 'status' ? 'outline' : 'ghost'} size="sm" aria-pressed={view === 'status'} onClick={() => { selectGit('status') }}>{t('overview')}</Button>}
        <Button variant={view === 'diff' ? 'outline' : 'ghost'} size="sm" aria-pressed={view === 'diff'} onClick={() => { selectGit('diff') }}>{t('changes')}</Button>
        <Button variant={view === 'history' ? 'outline' : 'ghost'} size="sm" aria-pressed={view === 'history'} onClick={() => { selectGit('history') }}>{t('history')}</Button>
      </>}
    </div>
    {git?.path !== undefined && <p className={css.path}>{git.path}</p>}
    {view === 'diff' && <div className={css.diffScope}>
      <Button variant={(git?.scope ?? 'working-tree') === 'working-tree' ? 'outline' : 'ghost'} size="sm" aria-pressed={(git?.scope ?? 'working-tree') === 'working-tree'} onClick={() => { selectGit('diff') }}>{t('workingTree')}</Button>
      <Button variant={git?.scope === 'staged' ? 'outline' : 'ghost'} size="sm" aria-pressed={git?.scope === 'staged'} onClick={() => { selectGit('diff', 'staged') }}>{t('staged')}</Button>
      {git?.scope === 'commit' && <span className={css.revision}>{git.revision?.slice(0, 12)}</span>}
    </div>}
    {changes !== undefined ? <div className={css.fileTable} aria-label={t('changedFiles')}>
      {changes.length === 0 ? <p className={css.empty}>{t('clean')}</p> : changes.map(file => <div className={css.statusRow} key={file.path}>
        <span className={css.fileName}>{file.previousPath === undefined ? file.path : `${file.previousPath} → ${file.path}`}</span>
        <span className={css.fileState} title={file.code}>{t(codeStatus(file.code))}</span>
        {file.code !== '??' && <Button variant="ghost" size="sm" onClick={() => { navigate({ kind: 'git', view: 'diff', scope: 'working-tree', path: file.path }) }}>{t('changes')}</Button>}
      </div>)}
    </div> : commits !== undefined ? <div className={css.history} aria-label={t('history')}>
      <p className={css.note}>{t('historyLimit')}</p>
      {commits.length === 0 ? <p className={css.empty}>{t('noHistory')}</p> : commits.map(commit => <div className={css.commit} key={commit.revision}>
        <div><p>{commit.subject}</p><time dateTime={commit.date}>{commit.date.slice(0, 10)}</time></div>
        <Button variant="ghost" size="sm" aria-label={t('viewCommit', { revision: commit.revision.slice(0, 12) })} onClick={() => { navigate({ kind: 'git', view: 'diff', scope: 'commit', revision: commit.revision, ...git?.path === undefined ? {} : { path: git.path } }) }}>{commit.revision.slice(0, 12)}</Button>
      </div>)}
    </div> : view === 'diff' && body.text === '' ? <p className={css.empty}>{t('noChanges')}</p> : <div aria-label={t(view === 'diff' ? 'patch' : 'sourceCode')}>
      {view === 'source' && body.startLine !== undefined && <p className={css.note}>{t('lineRange', { start: body.startLine, end: body.endLine ?? body.startLine })}</p>}
      {markdown ? props.renderFactorySlot('aitp.materials.markdown', { reading, text: props.text, onLink: props.onLink })
        : props.renderFactorySlot('document.code.reader', { text: body.text,
          ...path === undefined ? {} : { path },
          ...(view === 'diff' ? { language: 'diff' } : body.language === undefined ? {} : { language: body.language }),
          lineNumbers: view === 'source' && (body.startLine === undefined || body.startLine === 1),
        })}
    </div>}
  </div>
}
