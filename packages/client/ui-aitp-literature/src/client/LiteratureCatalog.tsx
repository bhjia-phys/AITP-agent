/** Bibliographic rows preserve source identity and recorded reading coverage. */
import { Checkbox, ReferenceIconRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import css from './Literature.module.css'

export type LiteratureCatalogProps = PropsRuntime<'aitp.materials.catalog.body'> & PropsLocale<'aitp.materials.literature'>

/** Render an observed collection, with missing bibliographic fields left unclaimed. */
export function LiteratureCatalog({ items, isSelected, disabled, onOpen, onSelect, t }: LiteratureCatalogProps) {
  return <section className={css.catalog} aria-label={t('collection')}>
    <table className={css.table}>
      <thead><tr><th scope="col"><span className={css.hidden}>{t('selection')}</span></th>
        <th scope="col">{t('paper')}</th><th scope="col">{t('authors')}</th>
        <th scope="col">{t('year')}</th><th scope="col">{t('depth')}</th></tr></thead>
      <tbody>{items.map((resource) => {
        const checked = isSelected(resource)
        const kind = resource.metadata.recordKind === 'source-reading' ? t('readingNote') : resource.metadata.format?.toUpperCase()
        return <tr key={resource.id} data-selected={checked || undefined}>
          <td className={css.selectCell}><Checkbox checked={checked} disabled={disabled} className={css.select}
            label={t('select', { title: resource.title })} onChange={(value) => { onSelect(resource, value) }} /></td>
          <td className={css.titleCell}><div className={css.titleLine}><ReferenceIconRegular kind="file" size={16} />
            <button type="button" className={css.title} onClick={() => { onOpen({ ref: resource.ref,
              ...resource.locator === undefined ? {} : { locator: resource.locator } }) }}>{resource.title}</button></div>
          {kind !== undefined && <span className={css.kind}>{kind}</span>}
          </td>
          <td className={css.authors} data-label={t('authors')}>{resource.metadata.authors ?? <span className={css.missing}>{t('notRecorded')}</span>}</td>
          <td className={css.year} data-label={t('year')}>{resource.metadata.year ?? <span className={css.missing}>{t('notRecorded')}</span>}</td>
          <td className={css.coverage} data-label={t('depth')}>{resource.metadata.reading_depth ?? resource.metadata.close_reading ?? <span className={css.missing}>{t('notRecorded')}</span>}</td>
        </tr>
      })}</tbody>
    </table>
  </section>
}
