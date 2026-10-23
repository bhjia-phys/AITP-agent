/** Source-attribution renderers shared by the task card and the Sources & memory page. */
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentItem, GapItem, ResearcherItem, RuleItem, SourceItem, SummaryItem } from './protocol.ts'
import type {} from './locales.ts'
import css from './memory.module.css'

type T = TranslateNS<'aitp.session'>

/**
 * The researcher's own words, quoted verbatim with their turn.
 * @param props.t - namespace translate.
 * @param props.items - researcher items.
 * @returns the list.
 */
export function ResearcherItems({ t, items }: { t: T; items: readonly ResearcherItem[] }): ReactNode {
  return (
    <ul className={css.items}>
      {items.map(item => (
        <li key={item.id} className={clsx(css.item, css.itemResearcher)}>
          <p className={css.itemLabel}>{`${t(`item.${item.kind}`)} · ${t('item.turn', { turn: item.turn })}`}</p>
          {item.question !== undefined && <p className={css.textMuted}>{t('item.asked', { question: item.question })}</p>}
          <p className={css.quote}>{item.text}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Provisional agent working items; superseded ones stay visible and labelled.
 * @param props.t - namespace translate.
 * @param props.items - agent items.
 * @returns the list.
 */
export function AgentItems({ t, items }: { t: T; items: readonly AgentItem[] }): ReactNode {
  return (
    <ul className={css.items}>
      {items.map(item => (
        <li key={item.id} className={clsx(css.item, css.itemAgent, item.status === 'superseded' && css.itemSuperseded)}>
          <p className={css.itemLabel}>
            {[t('agent.label'), t(`agent.${item.kind}`), t('item.turn', { turn: item.turn }),
              ...(item.status === 'superseded' ? [t('agent.superseded')] : [])].join(' · ')}
          </p>
          <p className={css.text}>{item.text}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Declared gaps with their requirement level and effect.
 * @param props.t - namespace translate.
 * @param props.items - gaps.
 * @returns the list.
 */
export function GapItems({ t, items }: { t: T; items: readonly GapItem[] }): ReactNode {
  return (
    <ul className={css.items}>
      {items.map(item => (
        <li key={item.id} className={clsx(css.item, css.itemGap)}>
          <p className={css.itemLabel}>{`${t('gap.label')} · ${t(`requirement.${item.requirement}`)}`}</p>
          <p className={css.text}>{item.text}</p>
          <p className={css.textMuted}>{item.effect ?? t('gap.continues')}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Availability wording of one source.
 * @param t - namespace translate.
 * @param state - source state.
 * @returns the localized state.
 */
export function sourceStateText(t: T, state: SourceItem['state']): string {
  switch (state.kind) {
    case 'located': return t('source.located')
    case 'attached': return t('source.attached')
    case 'available': return t('source.available', { turn: state.sentTurn })
    case 'condensed': return state.rereadTurn === undefined
      ? t('source.condensed', { turn: state.sentTurn })
      : t('source.condensed.reread', { turn: state.sentTurn, reread: state.rereadTurn })
    case 'missing': return t('source.missing', { reason: state.reason })
    case 'pointer': return t('source.pointer')
  }
}

const SOURCE_DOT: Readonly<Record<SourceItem['state']['kind'], StateDotState>> = {
  located: 'idle', attached: 'idle', available: 'done', condensed: 'warning', missing: 'error', pointer: 'idle',
}

/**
 * Sources with why they are present, their requirement level and what the model has of them.
 * @param props.t - namespace translate.
 * @param props.items - sources.
 * @param props.onOpen - open a note source in the dock.
 * @returns the list.
 */
export function SourceItems({ t, items, onOpen }: { t: T; items: readonly SourceItem[]; onOpen: (address: string) => void }): ReactNode {
  return (
    <ul className={css.sources}>
      {items.map(({ address, ...item }) => (
        <li key={item.id} className={css.source}>
          <span className={css.sourceDot}><StateDot state={SOURCE_DOT[item.state.kind]} /></span>
          <span className={css.sourceLabel}>
            {item.label}
            {item.range !== undefined && <span className={css.sourceRange}>{` · ${item.range}`}</span>}
          </span>
          {address !== undefined
            ? <button type="button" className={css.linkButton} onClick={() => { onOpen(address) }}>{t('source.open')}</button>
            : <span />}
          <span className={css.sourceMeta}>
            {[sourceStateText(t, item.state), t(`requirement.${item.requirement}`), t(`source.reason.${item.reason}`)].join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Adoption wording of one rule.
 * @param t - namespace translate.
 * @param adoption - rule adoption.
 * @returns the localized adoption state.
 */
export function ruleAdoptionText(t: T, adoption: RuleItem['adoption']): string {
  switch (adoption.kind) {
    case 'used': return t('rule.used', { turn: adoption.turn })
    case 'saved-not-used': return t('rule.saved-not-used')
    case 'condensed': return t('rule.condensed', { turn: adoption.loadedTurn })
  }
}

/**
 * Rules and methods in effect with their actual adoption.
 * @param props.t - namespace translate.
 * @param props.items - rules.
 * @returns the list.
 */
export function RuleItems({ t, items }: { t: T; items: readonly RuleItem[] }): ReactNode {
  return (
    <ul className={css.items}>
      {items.map(item => (
        <li key={item.id} className={css.item}>
          <p className={css.itemLabel}>{item.source}</p>
          <p className={css.text}>{item.text}</p>
          <p className={css.textMuted}>{ruleAdoptionText(t, item.adoption)}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Generated compaction summaries, labelled as such.
 * @param props.t - namespace translate.
 * @param props.items - summaries.
 * @returns the list.
 */
export function SummaryItems({ t, items }: { t: T; items: readonly SummaryItem[] }): ReactNode {
  return (
    <ul className={css.items}>
      {items.map(item => (
        <li key={item.id} className={clsx(css.item, css.itemSummary)}>
          <p className={css.textMuted}>{t('summary.item', { turn: item.turn, first: item.covers[0], last: item.covers[1] })}</p>
        </li>
      ))}
    </ul>
  )
}
