/** Session dock tab type for `aitp-note` addresses: the same reader beside a conversation. */
import type { ReactNode } from 'react'
import { IconDeliverDocRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { NoteReader } from './NoteReader.tsx'
import { parseNoteAddress } from './protocol.ts'
import type {} from './locales.ts'
import css from './research.module.css'

/** Props of the note tab body. */
export type NoteTabBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'aitp.research'>

/**
 * Read the tab's note address and render the reader without panel navigation.
 * @param props - tab runtime and locale.
 * @returns the reader.
 */
export function NoteTabBody({ t, useTabInfo, useResource }: NoteTabBodyProps): ReactNode {
  const { tab } = useTabInfo()
  const note = useResource<'aitp-note'>(tab.contentId)
  const path = parseNoteAddress(tab.contentId)?.path ?? tab.contentId
  return <div className={css.reading}><NoteReader t={t} note={note} path={path} placement="dock" /></div>
}

/**
 * Tab chip: a document glyph and the title captured at open time.
 * @param props - tab runtime.
 * @returns the chip content.
 */
export function NoteTabTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode {
  const { tab } = useTabInfo()
  return (
    <>
      <IconDeliverDocRegular size={16} />
      {tab.title}
    </>
  )
}
