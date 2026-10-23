/** One note as currently read, rendered verbatim in the reading face. */
import type { ReactNode } from 'react'
import { Button, IconChevronLeftOutlineRegular, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { observedLabel } from './format.ts'
import { markdownLabels } from './Passage.tsx'
import type { NoteView } from './protocol.ts'
import { Empty, Loading, Notice } from './states.tsx'
import css from './research.module.css'

/** Where the reader sits: the Research panel's reading region or a dock tab. */
export type NoteReaderPlacement = 'panel' | 'dock'

/**
 * Render a note resource in any state.
 * @param props.t - namespace translate.
 * @param props.note - the `aitp-note` resource snapshot.
 * @param props.path - the requested path, shown when the note is missing.
 * @param props.placement - panel or dock layout.
 * @param props.onBack - return to the previous panel location; absent hides Back.
 * @param props.onWork - start a Session drafted against this note; absent hides the action.
 * @returns the reader.
 */
export function NoteReader({ t, note, path, placement, onBack, onWork }: {
  t: TranslateNS<'aitp.research'>
  note: ResourceSnapshot<NoteView>
  path: string
  placement: NoteReaderPlacement
  onBack?: (() => void) | undefined
  onWork?: (() => void) | undefined
}): ReactNode {
  if (note.status === 'none') return <Empty title={t('state.none.title')} body={t('state.none.body')} />
  if (note.status === 'loading') return <Loading label={t('state.loading')} />
  if (note.value === undefined) {
    const failure = note.failure
    return <Empty title={t('state.failed.title')} body={failure?.code === 'aitp/note-missing' ? t('state.noteMissing', { path }) : failure?.message} />
  }
  const value = note.value
  return (
    <article className={placement === 'dock' ? css.dockReader : css.readerPage}>
      {value.origin === 'fixture' && <Notice>{t('fixture.notice')}</Notice>}
      {note.failure !== undefined && (
        <Notice>{note.failure.code === 'aitp/note-missing' ? t('state.noteMissing', { path }) : t('state.failed.retained', { code: note.failure.code })}</Notice>
      )}
      <div className={css.readerBar}>
        {onBack !== undefined && (
          <Button variant="ghost" size="sm" icon={<IconChevronLeftOutlineRegular size={16} />} onClick={onBack}>{t('reader.back')}</Button>
        )}
        <p className={css.eyebrow} tabIndex={-1} data-arrival="">{value.path}</p>
        <span className={css.headerSpacer} />
        {onWork !== undefined && <Button variant="primary" size="sm" onClick={onWork}>{t('reader.work')}</Button>}
      </div>
      <p className={css.meta}>{t('reader.observed', { time: observedLabel(value.observedAt) })}</p>
      <div className={css.prose}>
        <MarkdownText text={value.markdown} labels={markdownLabels(t)} />
      </div>
    </article>
  )
}
