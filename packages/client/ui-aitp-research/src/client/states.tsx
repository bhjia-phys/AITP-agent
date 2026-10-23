/** Loading, empty and failure presentation shared by the research views. */
import type { ReactNode } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './research.module.css'

/**
 * Page-level loading: one centered loader, no text.
 * @param props.label - accessible name of the busy region.
 * @returns the loading region.
 */
export function Loading({ label }: { label: string }): ReactNode {
  return (
    <div className={css.center} role="status" aria-label={label}>
      <StateDot state="ongoing" />
    </div>
  )
}

/**
 * A state the surface itself is in: nothing to show yet, and why.
 * @param props.title - one-line state.
 * @param props.body - the reason and what the researcher can do.
 * @returns the centered empty state.
 */
export function Empty({ title, body }: { title: string; body?: string | undefined }): ReactNode {
  return (
    <div className={css.center}>
      <div className={css.empty}>
        <p className={css.emptyTitle} tabIndex={-1} data-arrival="">{title}</p>
        {body !== undefined && <p className={css.emptyBody}>{body}</p>}
      </div>
    </div>
  )
}

/**
 * A compact notice above retained content, or the labelled fixture warning.
 * @param props.children - the notice text.
 * @returns the notice.
 */
export function Notice({ children }: { children: ReactNode }): ReactNode {
  return <p className={css.notice} role="note">{children}</p>
}
