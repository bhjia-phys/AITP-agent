/** An article index follows the existing collection's entry kinds and questions. */
import { Checkbox } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { knowledgeKind, knowledgeFact } from './presentation.ts'
import css from './Knowledge.module.css'

export type KnowledgeCatalogProps = PropsRuntime<'aitp.materials.catalog.body'> & PropsLocale<'aitp.materials.knowledge'>

/** Display only observed entries; reading and review remain independent facts. */
export function KnowledgeCatalog({ items, isSelected, disabled, onOpen, onSelect, t }: KnowledgeCatalogProps) {
  const kinds = [...new Set(items.map(item => item.metadata.entryKind ?? 'entry'))]
  return <section className={css.catalog} aria-label={t('catalog')}>
    {kinds.map(kind => <section className={css.group} key={kind}>
      <h2>{knowledgeKind(kind, t)} <span>{items.filter(item => (item.metadata.entryKind ?? 'entry') === kind).length}</span></h2>
      <ul>{items.filter(item => (item.metadata.entryKind ?? 'entry') === kind).map((resource) => {
        const checked = isSelected(resource)
        return <li key={resource.id} data-selected={checked || undefined}>
          <Checkbox checked={checked} disabled={disabled} className={css.select} label={t('select', { title: resource.title })}
            onChange={(value) => { onSelect(resource, value) }} />
          <div className={css.entry}>
            <button type="button" className={css.title} onClick={() => { onOpen({ ref: resource.ref,
              ...resource.locator === undefined ? {} : { locator: resource.locator } }) }}>{resource.title}</button>
            {resource.description !== undefined && resource.description !== resource.title
      && <p className={css.description}>{resource.description}</p>}
            {(resource.metadata.area !== undefined || resource.metadata.support !== undefined || resource.metadata.review !== undefined)
              && <dl className={css.rowFacts}>
                {resource.metadata.area !== undefined && <div><dt>{t('area')}</dt><dd>{resource.metadata.area}</dd></div>}
                {resource.metadata.support !== undefined && <div><dt>{t('support')}</dt><dd>{knowledgeFact('support', resource.metadata.support, t)}</dd></div>}
                {resource.metadata.review !== undefined && <div><dt>{t('review')}</dt><dd>{knowledgeFact('review', resource.metadata.review, t)}</dd></div>}
              </dl>}
          </div>
        </li>
      })}</ul>
    </section>)}
  </section>
}
