/** A transient rename form; the native Session owns the accepted title. */
import { useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ResearchDiscussion.module.css'

/** @param props - initial native title and the owning Session rename callback. @returns the host-styled modal. */
export function DiscussionRename(props: {
  readonly currentTitle: string
  readonly rename: (title: string) => Promise<void>
  readonly close: () => void
  readonly t: TranslateNS<'aitp.research.discussion'>
}) {
  const [title, setTitle] = useState(props.currentTitle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const composing = useRef(false)
  const blocked = busy || title.trim() === ''
  const close = (): void => { if (!busy) props.close() }
  const submit = (): void => {
    if (blocked) return
    setBusy(true)
    setError(undefined)
    void props.rename(title.trim()).then(() => { props.close() }, (reason: unknown) => {
      setBusy(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  return <Modal open onClose={close} closeLabel={props.t('closeDialog')} title={props.t('renameTitle')}
    footer={<><Button variant="outline" disabled={busy} onClick={close}>{props.t('cancel')}</Button>
      <Button variant="primary" disabled={blocked} onClick={submit}>{props.t('rename')}</Button></>}>
    <input className={css.renameInput} aria-label={props.t('name')} value={title} disabled={busy} data-modal-autofocus
      onFocus={(event) => { event.currentTarget.select() }}
      onChange={(event) => { setTitle(event.currentTarget.value); setError(undefined) }}
      onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !composing.current) { event.preventDefault(); submit() }
      }} />
    {error !== undefined && <p className={css.notice} role="alert">{error}</p>}
  </Modal>
}
