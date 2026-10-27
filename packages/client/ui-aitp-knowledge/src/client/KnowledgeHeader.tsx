/** The article's recorded sources stay separate from its argument. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import { knowledgeKind, knowledgeFact } from './presentation.ts'
import css from './Knowledge.module.css'

export type KnowledgeHeaderProps = PropsRuntime<'aitp.materials.reader.header'> & PropsLocale<'aitp.materials.knowledge'>

/** Show support and review as authored, without deriving a certification badge. */
export function KnowledgeHeader({ reading, t }: KnowledgeHeaderProps) {
  const { resource } = reading
  const metadata = resource.metadata
  const facts = [
    { label: t('support'), value: knowledgeFact('support', metadata.support, t) },
    { label: t('review'), value: knowledgeFact('review', metadata.review, t) },
    { label: t('depth'), value: metadata.reading_depth ?? metadata.close_reading },
    { label: t('origin'), value: metadata.origin },
  ].filter(field => field.value !== undefined)
  return <header className={css.header}>
    <p className={css.eyebrow}>{knowledgeKind(metadata.entryKind, t)}{metadata.area === undefined ? '' : ` · ${metadata.area}`}</p>
    <h2>{resource.title}</h2>
    {resource.description !== undefined && resource.description !== resource.title
      && <p className={css.description}>{resource.description}</p>}
    {facts.length > 0 && <dl className={css.facts}>{facts.map(field => <div key={field.label}>
      <dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>}
  </header>
}
