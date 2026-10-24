/** The Sources & memory dock page: what the task rests on, by source attribution. */
import type { ReactNode } from 'react'
import { IconContextInjectionOutlineRegular, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { memoryAddress } from './protocol.ts'
import { AgentItems, GapItems, ResearcherItems, RuleItems, SourceItems, SummaryItems } from './sections.tsx'
import type { MemoryActionsFace } from './TaskCard.tsx'
import type {} from './locales.ts'
import css from './memory.module.css'

/** Full props of the page body. */
export type MemoryPageProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'aitp.session'> & InjectFace<Pick<MemoryActionsFace, 'openNote'>>

/**
 * Render the Session's research memory; empty sections are absent.
 * @param props - tab runtime, locale and the note opener.
 * @returns the page.
 */
export function MemoryPage({ t, sessionId, useResource, openNote }: MemoryPageProps): ReactNode {
  const memory = useResource<'aitp-session'>(memoryAddress(sessionId))
  const value = memory.value
  if (value === undefined || value === null) {
    return (
      <div className={css.page}>
        <h2 className={css.pageTitle}>{t('memory')}</h2>
        {memory.failure !== undefined
          ? <p className={css.textMuted}>{t('state.failed', { code: memory.failure.code })}</p>
          : memory.status === 'none' || value === null
            ? <p className={css.textMuted}>{t('state.none')}</p>
            : <div className={css.center} role="status" aria-label={t('state.loading')}><StateDot state="ongoing" /></div>}
      </div>
    )
  }
  const count = (kind: 'available' | 'condensed' | 'missing'): number => value.sources.filter(item => item.state.kind === kind).length
  const empty = value.researcher.length + value.agent.length + value.gaps.length + value.sources.length + value.rules.length
    + (value.contextSnapshots?.length ?? 0) === 0
  return (
    <div className={css.page}>
      {value.origin === 'fixture' && <p className={css.notice}>{t('fixture.notice')}</p>}
      {memory.failure !== undefined && <p className={css.notice}>{t('state.failed', { code: memory.failure.code })}</p>}
      <h2 className={css.pageTitle}>{t('memory')}</h2>
      {value.sources.some(item => item.state.kind !== 'unknown') && (
        <p className={css.pageSummary}>{t('page.summary', { available: count('available'), condensed: count('condensed'), missing: count('missing') })}</p>
      )}
      {empty && <p className={css.textMuted}>{t('page.empty')}</p>}
      {value.researcher.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.instructions')} <span className={css.sectionNote}>{`· ${t('section.instructions.note')}`}</span></h3>
          <ResearcherItems t={t} items={value.researcher} />
        </section>
      )}
      {value.gaps.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.gaps')}</h3>
          <GapItems t={t} items={value.gaps} />
        </section>
      )}
      {value.rules.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.rules')}</h3>
          <RuleItems t={t} items={value.rules} />
        </section>
      )}
      {value.agent.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.agent')} <span className={css.sectionNote}>{`· ${t('section.agent.note')}`}</span></h3>
          <AgentItems t={t} items={value.agent} />
        </section>
      )}
      {value.sources.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.sources')} <span className={css.sectionNote}>{`· ${t('section.sources.note')}`}</span></h3>
          <SourceItems t={t} items={value.sources} onOpen={openNote} />
        </section>
      )}
      {value.coverage !== undefined && (
        <section className={css.section}>
          <p className={css.textMuted}>{t('context.coverage')}</p>
          {!value.coverage.contextRecorded && <p className={css.notice}>{t('context.unrecorded')}</p>}
          {value.coverage.omittedItems > 0 && <p className={css.notice}>{t('context.omitted', { count: value.coverage.omittedItems })}</p>}
        </section>
      )}
      {(value.contextSnapshots?.length ?? 0) > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('context.title')}</h3>
          {value.contextSnapshots?.map(snapshot => (
            <div key={snapshot.id} className={css.item}>
              <p className={css.itemLabel}>{`${t('item.turn', { turn: snapshot.turn })} · ${t(`context.${snapshot.state}`)}`}</p>
              <details>
                <summary>{t('context.inspect')}</summary>
                <p className={css.quote}>{snapshot.text}</p>
              </details>
            </div>
          ))}
        </section>
      )}
      {value.summaries.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('section.summaries')} <span className={css.sectionNote}>{`· ${t('section.summaries.note')}`}</span></h3>
          <SummaryItems t={t} items={value.summaries} />
        </section>
      )}
    </div>
  )
}

/**
 * Tab chip for the page.
 * @param props - tab runtime and locale.
 * @returns the chip content.
 */
export function MemoryPageTitle({ t }: PropsRuntime<'sidebar.right.pane.tab.title'> & PropsLocale<'aitp.session'>): ReactNode {
  return (
    <>
      <IconContextInjectionOutlineRegular size={16} />
      {t('memory')}
    </>
  )
}
