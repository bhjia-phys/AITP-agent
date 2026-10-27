/** Wiki article rendering with a contents list derived from actual rendered headings. */
import { useId, useRef, useState } from 'react'
import { Button, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-materials/client'
import css from './Knowledge.module.css'

export type KnowledgeBodyProps = PropsRuntime<'aitp.materials.reader.body'> & PropsLocale<'aitp.materials.knowledge'> & PropsRenderFactories

interface Contents { readonly text: string; readonly open: boolean; readonly headings: readonly { label: string; level: string }[] }
const headingSelector = 'h1, h2, h3, h4, h5, h6'

/** Navigate existing DOM headings; no guessed Markdown slugs or source locators are created. */
export function KnowledgeBody(props: KnowledgeBodyProps) {
  const { reading, text, raw, t, onLink } = props
  const article = useRef<HTMLDivElement>(null)
  const contentsId = useId()
  const [contents, setContents] = useState<Contents>({ text: '', open: false, headings: [] })
  if (reading.body.kind !== 'text' || reading.body.format !== 'markdown' || raw) return <pre>{text}</pre>
  const open = contents.open && contents.text === text
  return <div className={css.wiki}>
    {text.trim() !== '' && <div className={css.contents}>
      <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={contentsId}
        icon={open ? <IconChevronUpOutlineRegular /> : <IconChevronDownOutlineRegular />}
        onClick={() => {
          const headings = Array.from(article.current?.querySelectorAll<HTMLHeadingElement>(headingSelector) ?? [])
            .map((heading, index) => ({ label: heading.textContent.trim() || t('untitledSection', { number: index + 1 }), level: heading.tagName }))
          setContents({ text, open: !open, headings })
        }}>{t('contents')}</Button>
      {open && <nav id={contentsId} aria-label={t('contents')}>
        {contents.headings.length === 0 ? <p className={css.emptyContents}>{t('noSections')}</p> : <ol>
          {contents.headings.map((heading, index) => <li key={`${reading.resource.id}:heading:${index}`} data-level={heading.level}>
            <button type="button" onClick={() => { article.current?.querySelectorAll<HTMLHeadingElement>(headingSelector)[index]?.scrollIntoView({ block: 'start' }) }}>{heading.label}</button>
          </li>)}
        </ol>}
      </nav>}
    </div>}
    <div className={css.article} ref={article}>
      {text.trim() === '' ? <p className={css.emptyContents}>{t('emptyArticle')}</p>
        : props.renderFactorySlot('aitp.materials.markdown', { reading, text, onLink })}
    </div>
  </div>
}
