/** Source-derived title and bibliography, separate from physical-page controls. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import css from './Literature.module.css'

export type LiteratureHeaderProps = PropsRuntime<'aitp.materials.reader.header'> & PropsLocale<'aitp.materials.literature'>

/** Present recorded bibliography without inferring an edition from a filename. */
export function LiteratureHeader({ reading, t }: LiteratureHeaderProps) {
  const { resource } = reading
  const metadata = resource.metadata
  const byline = [metadata.authors, metadata.year].filter(value => value !== undefined).join(' · ')
  const details = [
    { label: t('depth'), value: metadata.reading_depth ?? metadata.close_reading },
    { label: t('edition'), value: metadata.edition === 'unknown' ? t('notRecorded') : metadata.edition },
    { label: t('doi'), value: metadata.doi },
    { label: t('arxiv'), value: metadata.arxiv },
  ].filter(field => field.value !== undefined)
  return <header className={css.header}>
    <p className={css.eyebrow}>{metadata.recordKind === 'source-reading' ? t('readingNote') : t('paper')}</p>
    <h2>{resource.title}</h2>
    <p className={css.byline}>{byline || t('bibliographyMissing')}</p>
    {details.length > 0 && <dl className={css.details}>{details.map(field => <div key={field.label}>
      <dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
  </header>
}
