/** Domain metadata stays outside the shared native content viewer. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import css from './materials.module.css'

/** @param props - source observation and the domain header slot. @returns the source heading and recorded fields. */
export function MaterialReaderHeader(props: FactoryComponentPropsOf<'aitp.materials.reader'>): ReactNode {
  const { reading, fields, t } = props
  const { resource } = reading
  const document = resource.domain === 'code' && props.libraryDomain !== 'code'
    && reading.locator?.kind !== 'git' && /\.(?:md|markdown)$/iu.test(materialSourcePath(resource.ref.sourceId) ?? '')
  return props.renderSlot('aitp.materials.reader.header', { reading, fields }, { entryKey: document ? '' : resource.domain,
    fallback: <header><h2>{resource.title}</h2>
      {fields.some(field => resource.metadata[field.key] !== undefined) && <dl className={css.metadata} aria-label={t('metadata')}>
        {fields.flatMap(field => resource.metadata[field.key] === undefined ? []
          : [<div key={field.key}><dt>{field.label}</dt><dd>{resource.metadata[field.key]}</dd></div>])}
      </dl>}
    </header>,
  })
}

/** @param props - observed links, navigation and a local failure notice. @returns source relationships with their recorded labels. */
export function MaterialReaderLinks(props: Pick<FactoryComponentPropsOf<'aitp.materials.reader'>, 'reading' | 'onLink' | 't'> & {
  readonly onFailure: () => void
}): ReactNode {
  const links = props.reading.resource.links
  return links.length === 0 ? null : <section><h3>{props.t('links')}</h3><ul className={css.links}>
    {links.map((link, index) => <li key={`${link.href}:${index}`}>
      {link.target === undefined && /^https?:\/\//i.test(link.href)
        ? <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
        : <button type="button" onClick={() => { if (!props.onLink(link)) props.onFailure() }}>{link.label}</button>}
      {link.reason !== undefined && <p className={css.muted}>{link.reason}</p>}</li>)}
  </ul></section>
}
