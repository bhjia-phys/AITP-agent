/** A quiet knowledge list with optional type filtering and source details. */
import { useState } from 'react'
import { Checkbox } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { knowledgeKind, knowledgeFact } from './presentation.ts'
import css from './Knowledge.module.css'

export type KnowledgeCatalogProps = PropsRuntime<'aitp.materials.catalog.body'> & PropsLocale<'aitp.materials.knowledge'>

/**
 * Present titles first, keeping actual evidence and review details available on demand.
 * @param props - observed entries and the existing selection/open actions.
 * @returns the current page's entries, type filter and collapsed collection guides.
 */
export function KnowledgeCatalog({ items, isSelected, disabled, onOpen, onSelect, t }: KnowledgeCatalogProps) {
  const [kind, setKind] = useState('')
  const indexes = items.filter(item => item.metadata.entryKind === 'index')
  const entries = items.filter(item => item.metadata.entryKind !== 'index')
  const kinds = [...new Set(entries.map(item => item.metadata.entryKind ?? 'entry'))]
  const filter = kinds.includes(kind) ? kind : ''
  const visible = filter === '' ? entries : entries.filter(item => (item.metadata.entryKind ?? 'entry') === filter)
  return <section className={css.catalog} aria-label={t('catalog')}>
    {kinds.length > 1 && <div className={css.catalogTools}>
      <label>{t('kind')} <select aria-label={t('kind')} value={filter} onChange={(event) => { setKind(event.currentTarget.value) }}>
        <option value="">{t('allTypes')}</option>
        {kinds.map(value => <option key={value} value={value}>{knowledgeKind(value, t)}</option>)}
      </select></label>
    </div>}
    <ul className={css.entries}>{visible.map((resource) => {
      const checked = isSelected(resource)
      const provisional = resource.metadata.entryKind === 'provisional-pointer'
      const review = resource.metadata.review ?? resource.metadata.status
      const facts = resource.metadata.area !== undefined || resource.metadata.support !== undefined || review !== undefined
      return <li key={resource.id} data-selected={checked || undefined}>
        <Checkbox checked={checked} disabled={disabled} className={css.select} label={t('select', { title: resource.title })}
          onChange={(value) => { onSelect(resource, value) }} />
        <div className={css.entry}>
          <button type="button" className={css.title} onClick={() => { onOpen({ ref: resource.ref,
            ...resource.locator === undefined ? {} : { locator: resource.locator } }) }}>{resource.title}</button>
          {resource.description !== undefined && resource.description !== resource.title
            && <p className={css.description} title={resource.description}>{resource.description}</p>}
          {provisional && <p className={css.provisional}>{t('provisionalStatus')}</p>}
          {facts && <details className={css.entryDetails}><summary>{t('entryDetails')}</summary>
            {resource.description !== undefined && resource.description.length > 180 && <p>{resource.description}</p>}
            <dl className={css.rowFacts}>
              {resource.metadata.area !== undefined && <div><dt>{t('area')}</dt><dd>{resource.metadata.area}</dd></div>}
              {resource.metadata.support !== undefined && <div><dt>{t('support')}</dt><dd>{knowledgeFact('support', resource.metadata.support, t)}</dd></div>}
              {review !== undefined && <div><dt>{t('review')}</dt><dd>{knowledgeFact('review', review, t)}</dd></div>}
            </dl>
          </details>}
        </div>
      </li>
    })}</ul>
    {indexes.length > 0 && <details className={css.guides}><summary>{t('collectionGuides', { count: indexes.length })}</summary>
      <ul>{indexes.map(resource => <li key={resource.id}><button type="button" className={css.guideLink}
        onClick={() => { onOpen({ ref: resource.ref, ...resource.locator === undefined ? {} : { locator: resource.locator } }) }}>
        {resource.title}</button></li>)}</ul>
    </details>}
  </section>
}
