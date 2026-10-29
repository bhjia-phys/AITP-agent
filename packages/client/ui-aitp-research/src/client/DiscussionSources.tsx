/** Prepared evidence is distinct from the active question and from completed model reads. */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import type { ResearchOrigin } from '@deepseek-ai/dsh-research-memory/types'
import type {} from './discussion-locales.ts'
import css from './DiscussionSources.module.css'

interface Props {
  readonly origin: ResearchOrigin
  readonly t: TranslateNS<'aitp.research.discussion'>
  readonly clear: () => void
}

/** @param props - captured next-message selection and its existing clearing action. @returns compact, expandable source locations. */
export function DiscussionSources({ origin, t, clear }: Props) {
  const selections = origin.selections ?? []
  const first = selections[0]
  const path = first === undefined ? undefined : materialSourcePath(first.ref.sourceId)
  const hasSource = selections.length > 0 || origin.resourceId !== undefined || origin.selectedText !== undefined
  const summary = selections.length > 1 ? t('selected', { count: selections.length })
    : first !== undefined ? path?.split('/').at(-1) ?? t('sourceNumber', { number: 1 })
      : t(origin.resourceId !== undefined ? 'material' : origin.scope === 'global' ? 'noSources' : 'topicOnly')
  return <details className={css.sources}>
    <summary><span className={css.label}>{t('sources')}</span><span className={css.summary} title={path}>{summary}</span></summary>
    <p className={css.help}>{t('sourceHelp')}</p>
    {selections.length > 0 && <ul className={css.list}>{selections.map((source, index) => {
      const path = materialSourcePath(source.ref.sourceId)
      const location = source.locator
      return <li key={JSON.stringify([source.ref, location, source.selectedText])}>
        <div className={css.name} title={path}><strong>{path?.split('/').at(-1) ?? t('sourceNumber', { number: index + 1 })}</strong>
          {location?.kind === 'pdf-page' && <span>{t('page', { page: location.page })}</span>}
          {location?.kind === 'code' && <span>{t('lines', { start: location.startLine, end: location.endLine })}</span>}
          {location?.kind === 'anchor' && <span>#{location.anchor}</span>}
          {location?.kind === 'git' && <span>{location.view}{location.revision === undefined ? '' : ` · ${location.revision}`}</span>}
        </div>
        <div className={css.path}>{source.ref.rootId}{path === undefined ? '' : ` / ${path}`}</div>
        {(source.selectedText || location?.kind === 'text' || location?.kind === 'pdf-page' && location.quote) && <details className={css.passage}>
          <summary>{t('quote')}</summary><blockquote>{source.selectedText || (location?.kind === 'text' || location?.kind === 'pdf-page' ? location.quote : '')}</blockquote>
        </details>}
      </li>
    })}</ul>}
    {origin.resourceId !== undefined && <p className={css.path}>{origin.resourceId}{origin.anchor === undefined ? '' : ` #${origin.anchor}`}</p>}
    {origin.selectedText !== undefined && <details className={css.passage}><summary>{t('quote')}</summary><blockquote>{origin.selectedText}</blockquote></details>}
    {hasSource && <Button variant="ghost" size="sm" onClick={clear}>{t('clear')}</Button>}
  </details>
}
