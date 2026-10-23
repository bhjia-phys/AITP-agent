/** A topic home: the owning note's question, qualified answer and gap, then what the work needs next. */
import type { ReactNode } from 'react'
import { Button, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { observedLabel } from './format.ts'
import { Passage, SourceLine } from './Passage.tsx'
import type { MaterialLink, SourceLocator, ThreadEntry, TopicHomeView } from './protocol.ts'
import { Notice } from './states.tsx'
import css from './research.module.css'

/** Researcher actions a topic home offers; each is a navigation or a draft, never a write. */
export interface TopicHomeActions {
  /** Open a passage or note in the reader. */
  openSource: (locator: SourceLocator) => void
  /** Show an existing Session. */
  openSession: (sessionId: SessionId) => void
  /** Start a Session whose draft cites the locator. */
  startWork: (locator: SourceLocator) => void
}

const MATERIAL_ORDER: readonly MaterialLink['kind'][] = ['paper', 'knowledge', 'code', 'method']

/**
 * The thread the primary action continues: the first one with a recorded Session.
 * @param threads - Current work entries in authored order.
 * @returns the thread and its most recent Session, if any.
 */
function continuable(threads: readonly ThreadEntry[]): { thread: ThreadEntry; sessionId: SessionId } | undefined {
  for (const thread of threads) {
    const sessionId = thread.sessionIds.at(-1)
    if (sessionId !== undefined) return { thread, sessionId }
  }
  return undefined
}

/**
 * Render one topic home.
 * @param props.t - namespace translate.
 * @param props.topic - the topic view.
 * @param props.sessionTitle - display title of a Harness Session, or undefined when unknown.
 * @param props.actions - navigation and draft callbacks.
 * @returns the topic home page.
 */
export function TopicHome({ t, topic, sessionTitle, actions }: {
  t: TranslateNS<'aitp.research'>
  topic: TopicHomeView
  sessionTitle: (sessionId: SessionId) => string | undefined
  actions: TopicHomeActions
}): ReactNode {
  const main = { path: topic.notePath }
  const next = continuable(topic.threads)
  const materials = MATERIAL_ORDER.flatMap(kind => topic.materials.filter(item => item.kind === kind))
  return (
    <article className={css.page}>
      {topic.origin === 'fixture' && <Notice>{t('fixture.notice')}</Notice>}
      <p className={css.eyebrow}>{t('home.eyebrow', { kind: t(`kind.${topic.kind}`), path: topic.notePath })}</p>
      <h2 className={css.title} tabIndex={-1} data-arrival="">{topic.title}</h2>
      <p className={css.meta}>{t('home.observed', { time: observedLabel(topic.observedAt) })}</p>
      <div className={css.actions}>
        {next === undefined
          ? <Button variant="primary" size="sm" onClick={() => { actions.startWork(main) }}>{t('home.startWork')}</Button>
          : (
            <Button variant="primary" size="sm" onClick={() => { actions.openSession(next.sessionId) }}>
              {t('home.continueThread', { title: next.thread.title })}
            </Button>
          )}
        <Button variant="ghost" size="sm" onClick={() => { actions.openSource(main) }}>{t('home.openNote')}</Button>
      </div>

      <section className={css.section} aria-label={t('home.question')}>
        {topic.opening.kind === 'raw'
          ? (
            <>
              <h3 className={css.sectionHeading}>{t('home.opening')}</h3>
              <Passage t={t} passage={topic.opening.passage} onOpen={actions.openSource} />
            </>
          )
          : (
            <div className={css.stack}>
              {topic.opening.question !== undefined && (
                <div>
                  <h3 className={css.sectionHeading}>{t('home.question')}</h3>
                  <Passage t={t} passage={topic.opening.question} onOpen={actions.openSource} />
                </div>
              )}
              {topic.opening.answer !== undefined && (
                <div>
                  <h3 className={css.sectionHeading}>{t('home.answer')}</h3>
                  <Passage t={t} passage={topic.opening.answer} tone="answer" onOpen={actions.openSource} />
                </div>
              )}
              {topic.opening.gap !== undefined && (
                <div>
                  <h3 className={css.sectionHeading}>{t('home.gap')}</h3>
                  <Passage t={t} passage={topic.opening.gap} tone="gap" onOpen={actions.openSource} />
                </div>
              )}
            </div>
          )}
      </section>

      {topic.pending.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('home.needsInput')}</h3>
          {topic.pending.map(({ sessionId, ...choice }) => (
            <div key={`${choice.title}:${choice.passage.locator.path}`} className={css.waitingRow}>
              <IconWarningOutlineRegular size={16} className={css.waitingIcon} aria-hidden />
              <div>
                <p className={css.rowTitle}>{choice.title}</p>
                <p className={css.rowText}>{choice.passage.text}</p>
                <div className={css.sourceLine}>
                  {choice.decider !== undefined && <span>{t('home.decider', { who: choice.decider })}</span>}
                  {sessionId !== undefined && (
                    <button type="button" className={css.linkButton} onClick={() => { actions.openSession(sessionId) }}>
                      {t('home.answerInSession')}
                    </button>
                  )}
                </div>
                <SourceLine t={t} locator={choice.passage.locator} onOpen={actions.openSource} />
              </div>
            </div>
          ))}
        </section>
      )}

      {topic.threads.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('home.currentWork')}</h3>
          <ul className={css.rows}>
            {topic.threads.map(thread => (
              <li key={`${thread.title}:${thread.locator.anchor ?? thread.locator.lines?.[0] ?? ''}`} className={css.row}>
                <ThreadRow t={t} thread={thread} actions={actions} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {topic.failedRoutes.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('home.failedRoutes')}</h3>
          <div className={css.stack}>
            {topic.failedRoutes.map(route => (
              <Passage key={`${route.locator.path}:${route.locator.lines?.[0] ?? route.text}`} t={t} passage={route} onOpen={actions.openSource} />
            ))}
          </div>
        </section>
      )}

      {topic.branches.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('home.branches')}</h3>
          <div className={css.stack}>
            {topic.branches.map(branch => (
              <div key={branch.notePath}>
                <p className={css.rowTitle}>{branch.title}</p>
                <Passage t={t} passage={branch.passage} onOpen={actions.openSource} />
              </div>
            ))}
          </div>
        </section>
      )}

      {materials.length > 0 && (
        <section className={css.section}>
          <h3 className={css.sectionHeading}>{t('home.materials')}</h3>
          <ul className={css.materials}>
            {materials.map(item => (
              <li key={`${item.kind}:${item.title}`}>
                <span className={css.materialKind}>{t(`home.material.${item.kind}`)}</span>
                {item.title}
                {' '}
                <span className={css.materialReason}>{`· ${item.reason}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={css.section}>
        <h3 className={css.sectionHeading}>{t('home.sessions')}</h3>
        {topic.sessions.kind === 'unrecorded'
          ? <p className={css.emptyBody}>{t('home.sessions.unrecorded')}</p>
          : topic.sessions.ids.length === 0
            ? <p className={css.emptyBody}>{t('home.sessions.none')}</p>
            : (
              <ul className={css.rows}>
                {topic.sessions.ids.map(sessionId => (
                  <li key={sessionId} className={css.row}>
                    <p className={css.rowTitle}>{sessionTitle(sessionId) ?? t('home.session.missing')}</p>
                    <Button variant="ghost" size="sm" onClick={() => { actions.openSession(sessionId) }}>{t('home.continue')}</Button>
                  </li>
                ))}
              </ul>
            )}
      </section>

      <p className={css.footer}>{t('home.assembled')}</p>
    </article>
  )
}

/**
 * One Current work entry: title and disposition, its action, its clause and its source line.
 * @param props.t - namespace translate.
 * @param props.thread - the entry.
 * @param props.actions - navigation and draft callbacks.
 * @returns the row's grid cells.
 */
function ThreadRow({ t, thread, actions }: { t: TranslateNS<'aitp.research'>; thread: ThreadEntry; actions: TopicHomeActions }): ReactNode {
  const latest = thread.sessionIds.at(-1)
  return (
    <>
      <p className={css.rowTitle}>
        {thread.title}
        {' '}
        <span className={css.rowDisposition}>{`· ${thread.disposition}`}</span>
      </p>
      {latest === undefined
        ? <Button variant="ghost" size="sm" onClick={() => { actions.startWork(thread.locator) }}>{t('home.startWork')}</Button>
        : <Button variant="ghost" size="sm" onClick={() => { actions.openSession(latest) }}>{t('home.continue')}</Button>}
      <p className={css.rowText}>
        {thread.clause === undefined
          ? t('home.noNext')
          : (
            <>
              <span className={css.clauseLabel}>{`${t(`home.clause.${thread.clause.kind}`)}: `}</span>
              {thread.clause.text}
            </>
          )}
      </p>
      <div className={css.rowText}>
        <SourceLine t={t} locator={thread.locator} onOpen={actions.openSource} />
      </div>
    </>
  )
}
