/** The task card in the composer context stack: the task and what keeps it on track, in one line. */
import { useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { memoryAddress } from './protocol.ts'
import { AgentItems, GapItems, ResearcherItems } from './sections.tsx'
import type {} from './locales.ts'
import css from './memory.module.css'

/** Callbacks the task card and header action receive from their registration. */
export interface MemoryActionsFace {
  /** Reveal this view's Session and open Sources & memory in its native dock. */
  openMemory: () => void
  /** Open an `aitp-note` address in the dock. */
  openNote: (address: string) => void
}

/** Full props of the task card. */
export type TaskCardProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'aitp.session'> & InjectFace<MemoryActionsFace>

/**
 * Render the task card; it renders nothing until the Session has research memory.
 * @param props - dock runtime, locale and actions.
 * @returns the card, or nothing.
 */
export function TaskCard({ t, sessionId, useResource, openMemory }: TaskCardProps): ReactNode {
  const memory = useResource<'aitp-session'>(memoryAddress(sessionId))
  const [open, setOpen] = useState(false)
  if (memory.value === undefined && memory.failure !== undefined) {
    return (
      <div className={css.dock}>
        <div className={css.card} role="status">
          <p className={css.textMuted}>{t('state.failed', { code: memory.failure.code })}</p>
        </div>
      </div>
    )
  }
  const value = memory.value
  if (value === undefined || value === null) return null
  const task = value.researcher.find(item => item.kind === 'task')
  const others = value.researcher.filter(item => item !== task)
  const active = value.agent.filter(item => item.status === 'active')
  const gap = value.gaps[0]
  const pendingRule = value.rules.some(rule => rule.adoption.kind === 'saved-not-used')
  const omittedItems = value.coverage?.omittedItems ?? 0
  const facts: { key: string; text: string; gap?: boolean }[] = []
  if (others.length > 0) facts.push({ key: 'you', text: value.origin === 'runtime'
    ? t('task.originalInputs', { count: others.length })
    : others.length === 1 ? t('task.fromYou.one') : t('task.fromYou.other', { count: others.length }) })
  if (active.length > 0) facts.push({ key: 'agent', text: active.length === 1 ? t('task.agent.one') : t('task.agent.other', { count: active.length }) })
  if (gap !== undefined) facts.push({ key: 'gap', text: `${t('gap.label')}: ${gap.text}`, gap: true })
  if (pendingRule) facts.push({ key: 'rule', text: t('task.rulePending') })
  if (omittedItems > 0) facts.push({ key: 'omitted', text: t('task.omitted', { count: omittedItems }) })
  if (value.summaries.length > 0) {
    facts.push({ key: 'summaries', text: value.summaries.length === 1 ? t('task.summaries.one') : t('task.summaries.other', { count: value.summaries.length }) })
  }
  return (
    <div className={css.dock}>
      <section className={css.card} aria-label={t('task.label')}>
        {value.origin === 'fixture' && <p className={css.fixtureTag}>{t('fixture.short')}</p>}
        <div className={css.cardRow}>
          <span className={css.cardLabel}>{t('task.label')}</span>
          <span className={css.cardTask} title={task?.text}>{task?.text ?? t('task.none')}</span>
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => { setOpen(!open) }}>
            {open ? t('task.hide') : t('task.details')}
          </Button>
        </div>
        {facts.length > 0 && (
          <p className={css.cardFacts}>
            {facts.map(fact => <span key={fact.key} className={fact.gap === true ? css.factGap : undefined}>{fact.text}</span>)}
          </p>
        )}
        {open && (
          <div className={css.cardDetail}>
            <ResearcherItems t={t} items={value.researcher} />
            {active.length > 0 && <div className={css.section}><AgentItems t={t} items={active} /></div>}
            {value.gaps.length > 0 && <div className={css.section}><GapItems t={t} items={value.gaps} /></div>}
            <div className={css.section}>
              <Button variant="ghost" size="sm" onClick={openMemory}>{t('memory.open')}</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
