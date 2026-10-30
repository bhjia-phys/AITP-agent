/** A repository overview and folder browser over the shared source catalog. */
import { Button, FileTypeIcon, IconBranchOutlineRegular, IconCodeOutlineRegular, IconFolderCloseRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { codeDirectory, codeSelection, codeStatus } from './code-model.ts'
import type {} from './index.ts'
import css from './code.module.css'

type Props = PropsRuntime<'aitp.materials.catalog.body'> & PropsLocale<'aitp.materials.code'>

/** Show observed repositories, or the selected repository's current folder. */
export function CodeCatalog(props: Props) {
  const { items, roots, rootId, folderPath, query, t } = props
  const root = roots.find(item => item.id === rootId)
  const repositories = roots.filter(item => (item.domains === undefined || item.domains.includes('code'))
    && (props.topicFiltered !== true || items.some(entry => entry.ref.rootId === item.id && entry.metadata['entryKind'] === 'checkout')))
  const searching = query.trim() !== ''
  const directory = codeDirectory(items, folderPath, searching || rootId === null)
  const observation = items.find(item => item.ref.rootId === rootId && item.metadata['entryKind'] === 'checkout')
    ?? items.find(item => item.ref.rootId === rootId)
  return <section className={css.catalog} aria-label={t('files')}>
    {rootId === null && !searching ? <div className={css.repositories}>
      {repositories.length === 0 && <p className={css.empty}>{t(props.topicFiltered === true ? 'noTopicRepositories' : 'noRepositories')}</p>}
      {repositories.map((repository) => {
        const entry = items.find(item => item.ref.rootId === repository.id && item.metadata['entryKind'] === 'checkout')
          ?? items.find(item => item.ref.rootId === repository.id)
        return <div className={css.repository} key={repository.id}>
          <div className={css.repositoryHeading}><IconCodeOutlineRegular /><button type="button" className={css.link} onClick={() => { props.onRoot(repository.id) }}>{repository.title}</button></div>
          <p className={css.path}>{repository.displayPath}</p>
          <RepositoryFacts metadata={entry?.metadata} t={t} />
        </div>
      })}
    </div> : <>
      <nav className={css.breadcrumbs} aria-label={t('location')}>
        <button type="button" onClick={() => { props.onRoot(null) }}>{t('repositories')}</button>
        {root !== undefined && <><span aria-hidden="true">/</span><button type="button" onClick={() => { props.onFolder('') }}>{root.title}</button></>}
        {!searching && folderPath.split('/').filter(Boolean).map((part, index, all) => <span className={css.crumb} key={all.slice(0, index + 1).join('/')}><span aria-hidden="true">/</span><button type="button" onClick={() => { props.onFolder(all.slice(0, index + 1).join('/')) }}>{part}</button></span>)}
      </nav>
      {root !== undefined && <div className={css.repositoryBar}>
        <RepositoryFacts metadata={observation?.metadata} t={t} />
        {observation?.metadata['entryKind'] === 'checkout' && <Button variant="ghost" size="sm" onClick={() => { props.onOpen(codeSelection(observation)) }}>{t('overview')}</Button>}
      </div>}
      <div className={css.fileTable}>
        {!searching && folderPath !== '' && <button type="button" className={css.parent} onClick={() => { props.onFolder(folderPath.split('/').slice(0, -1).join('/')) }}>{t('parent')}</button>}
        {directory.folders.map(folder => <div className={css.fileRow} key={folder.path}>
          <span className={css.selectionSpace} /><IconFolderCloseRegular />
          <button type="button" className={css.fileName} aria-label={t('openFolder', { name: folder.name })} onClick={() => { props.onFolder(folder.path) }}>{folder.name}</button>
          <span className={css.fileState}>{t('folder')}</span>
        </div>)}
        {directory.files.map((file) => {
          const selected = props.isSelected(file.resource)
          const status = file.resource.metadata['fileStatus']
          return <div className={css.fileRow} key={file.resource.id}>
            <input type="checkbox" checked={selected} disabled={props.disabled} aria-label={t('select', { name: file.path })} onChange={(event) => { props.onSelect(file.resource, event.currentTarget.checked) }} />
            <FileTypeIcon path={file.path} size={16} /><button type="button" className={css.fileName} aria-label={file.path} onClick={() => { props.onOpen(codeSelection(file.resource)) }}>{file.name}{rootId === null && <span className={css.fileRoot}>{roots.find(item => item.id === file.resource.ref.rootId)?.title ?? file.resource.ref.rootId}</span>}</button>
            {status !== undefined && <span className={css.fileState} title={status}>{t(codeStatus(status))}</span>}
          </div>
        })}
        {directory.folders.length === 0 && directory.files.length === 0 && <p className={css.empty}>{t(searching ? 'noMatches' : 'noFiles')}</p>}
      </div>
    </>}
  </section>
}

function RepositoryFacts({ metadata, t }: { readonly metadata: Readonly<Record<string, string>> | undefined } & PropsLocale<'aitp.materials.code'>) {
  return <div className={css.facts}>
    {metadata?.['checkoutState'] === 'not-a-checkout' ? <span>{t('localFolder')}</span> : <>
      {metadata?.['branch'] !== undefined && <span className={css.branch}><IconBranchOutlineRegular />{metadata['branch'] === 'detached' ? t('detached') : metadata['branch'] === 'unborn' ? t('unborn') : metadata['branch']}</span>}
      {metadata?.['dirtyCount'] !== undefined && <span>{metadata['dirtyCount'] === '0' ? t('clean') : t('changedCount', { count: metadata['dirtyCount'] })}</span>}
    </>}
  </div>
}
