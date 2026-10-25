/** A human-submitted question retains the topic and selected material it concerns. */
import { useCallback, useEffect, useId, useRef, useState, type RefObject, type ReactNode } from 'react'
import { Button, IconCloseOutlineRegular, IconNewChatOutlineRegular, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchLocation } from './store.ts'
import type { ResearchQuestion, Result } from './workspace-contract.ts'
import { readWorkspaceSelection, type WorkspaceSelection } from './workspace-selection.ts'
import type {} from './locales.ts'
import css from './workspace.module.css'

/** Ask about the current view; no question is sent on navigation or selection alone. */
export function WorkspaceQuestion({ t, workspaceId, location, reading, ask, openSession }: {
  t: TranslateNS<'aitp.research'>
  workspaceId: WorkspaceId
  location: ResearchLocation
  reading: RefObject<HTMLDivElement | null>
  ask: (question: ResearchQuestion) => Promise<Result<{ readonly sessionId: SessionId }>>
  openSession: (sessionId: SessionId) => void
}): ReactNode {
  const [question, setQuestion] = useState('')
  const [selected, setSelected] = useState<WorkspaceSelection | undefined>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const form = useRef<HTMLFormElement>(null)
  const candidate = useRef<WorkspaceSelection | undefined>(undefined)
  const rememberSelection = useCallback((): void => {
    const document = reading.current?.ownerDocument
    const selection = document?.getSelection()
    if (selection?.anchorNode && selection.focusNode
      && reading.current?.contains(selection.anchorNode) && reading.current.contains(selection.focusNode)
      && !form.current?.contains(selection.anchorNode) && !form.current?.contains(selection.focusNode)
      && selection.toString().trim()) {
      candidate.current = readWorkspaceSelection(selection)
    } else if (!form.current?.contains(document?.activeElement ?? null)) {
      candidate.current = undefined
    }
  }, [reading])
  // Native focus collapses the document Selection before React receives focus.
  // Cache only this reading pane's browser gesture; attaching still requires entering the composer.
  useEffect(() => {
    const document = reading.current?.ownerDocument
    const rememberBeforeTab = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') rememberSelection()
    }
    document?.addEventListener('selectionchange', rememberSelection)
    // Tab can move focus before the browser delivers its queued selectionchange.
    document?.addEventListener('keydown', rememberBeforeTab, true)
    return () => {
      document?.removeEventListener('selectionchange', rememberSelection)
      document?.removeEventListener('keydown', rememberBeforeTab, true)
    }
  }, [reading, rememberSelection])
  const id = useId()
  const topicId = location.kind === 'map' ? location.focusId : location.topicId
  const visibleError = selected?.unsupported ? t('workspace.ask.unsupportedSelection') : error
  return <form ref={form} className={css.questionComposer} aria-busy={pending} onSubmit={(event) => {
    event.preventDefault()
    if (pending || !question.trim() || selected?.unsupported) return
    setPending(true)
    setError(undefined)
    void ask({ workspaceId, question,
      ...(selected === undefined ? {
        ...(topicId === null ? {} : { topicId }),
        ...(location.kind === 'resource' ? { resourceId: location.resourceId } : {}),
      } : {
        ...(selected.topicId === undefined ? {} : { topicId: selected.topicId }),
        ...(selected.resourceId === undefined ? {} : { resourceId: selected.resourceId }),
        selectedText: selected.text, selectedTextFormat: selected.format,
      }),
    }).then((result) => {
      if (result.ok) openSession(result.value.sessionId)
      else setError(result.error.message)
    }, (reason: unknown) => { setError(reason instanceof Error ? reason.message : t('workspace.ask.failed')) })
      .finally(() => { setPending(false) })
  }}>
    <label className={css.composerLabel} htmlFor={id}>{t('workspace.ask.label')}</label>
    <div className={css.composerSurface}>
      {selected !== undefined && <div className={css.composerSelection}>
        <div className={css.composerSelectionHeader}>
          <span>{t('workspace.ask.selection')}</span>
          <Button variant="ghost" size="sm" disabled={pending} icon={<IconCloseOutlineRegular size={14} />}
            onClick={() => {
              setSelected(undefined)
              candidate.current = undefined
              reading.current?.ownerDocument.getSelection()?.removeAllRanges()
            }}>{t('workspace.ask.clearSelection')}</Button>
        </div>
        <blockquote>{selected.text}</blockquote>
      </div>}
      <textarea id={id} data-research-question="" className={css.composerInput} rows={3} value={question} disabled={pending}
        placeholder={t('workspace.ask.placeholder')} aria-invalid={visibleError !== undefined}
        aria-describedby={`${id}-hint${visibleError === undefined ? '' : ` ${id}-error`}`}
        onPointerDown={rememberSelection}
        onFocus={() => { rememberSelection(); setSelected(candidate.current) }}
        onChange={(event) => { setQuestion(event.target.value) }} />
      <div className={css.composerFooter}>
        <p id={`${id}-hint`} className={css.composerHint}>{t('workspace.ask.hint')}</p>
        <Button type="submit" variant="primary" className={css.composerSubmit} disabled={pending || !question.trim() || selected?.unsupported === true}
          icon={pending ? <StateDot state="ongoing" size={16} /> : <IconNewChatOutlineRegular size={16} />}>
          {t(pending ? 'workspace.ask.sending' : 'workspace.ask.send')}
        </Button>
      </div>
    </div>
    {visibleError !== undefined && <p id={`${id}-error`} className={css.composerError} role="alert">{visibleError}</p>}
  </form>
}
