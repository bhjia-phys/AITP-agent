/** Verbatim note passages with their source line. */
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { locatorLabel } from './format.ts'
import type { SourceLocator, SourcePassage } from './protocol.ts'
import css from './research.module.css'

/** Accent of the passage rule: plain source, the stated answer, or the decisive gap. */
export type PassageTone = 'plain' | 'answer' | 'gap'

/**
 * Markdown chrome copy for passages and notes.
 * @param t - namespace translate.
 * @returns localized Markdown labels.
 */
export function markdownLabels(t: TranslateNS<'aitp.research'>): MarkdownLabels {
  return { code: { copyLabel: t('markdown.copy'), copiedLabel: t('markdown.copied') }, footnotes: t('markdown.footnotes') }
}

/**
 * The source line under a passage: its locator and an Open action.
 * @param props.t - namespace translate.
 * @param props.locator - where the passage was read.
 * @param props.onOpen - open the passage in the note reader.
 * @returns the source line.
 */
export function SourceLine({ t, locator, onOpen }: {
  t: TranslateNS<'aitp.research'>
  locator: SourceLocator
  onOpen: (locator: SourceLocator) => void
}): ReactNode {
  return (
    <div className={css.sourceLine}>
      <span>{locatorLabel(t, locator)}</span>
      <button type="button" className={css.linkButton} onClick={() => { onOpen(locator) }}>{t('source.open')}</button>
    </div>
  )
}

/**
 * One passage exactly as written, set in the reading face.
 * @param props.t - namespace translate.
 * @param props.passage - the passage and its locator.
 * @param props.tone - rule accent.
 * @param props.onOpen - open the passage in the note reader.
 * @returns the quoted passage.
 */
export function Passage({ t, passage, tone = 'plain', onOpen }: {
  t: TranslateNS<'aitp.research'>
  passage: SourcePassage
  tone?: PassageTone
  onOpen: (locator: SourceLocator) => void
}): ReactNode {
  return (
    <figure className={clsx(css.passage, tone === 'answer' && css.passageAnswer, tone === 'gap' && css.passageGap)}>
      <blockquote className={css.prose}>
        <MarkdownText text={passage.text} labels={markdownLabels(t)} />
      </blockquote>
      <SourceLine t={t} locator={passage.locator} onOpen={onOpen} />
    </figure>
  )
}
