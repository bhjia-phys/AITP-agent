/** The topic list of one research Workspace. */
import type { ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TopicIndexView } from './protocol.ts'
import css from './research.module.css'

/**
 * Render the root note and topics as navigation rows.
 * @param props.t - namespace translate.
 * @param props.index - the Workspace's topic index.
 * @param props.selectedTopicId - topic on screen, or null when the root note is shown.
 * @param props.rootSelected - whether the root note is on screen.
 * @param props.onTopic - show a topic home.
 * @param props.onRoot - show the root note.
 * @returns the navigator.
 */
export function TopicNavigator({ t, index, selectedTopicId, rootSelected, onTopic, onRoot }: {
  t: TranslateNS<'aitp.research'>
  index: TopicIndexView
  selectedTopicId: string | null
  rootSelected: boolean
  onTopic: (topicId: string) => void
  onRoot: (path: string) => void
}): ReactNode {
  const root = index.root
  return (
    <nav className={css.nav} aria-label={t('nav.label')}>
      {root.kind === 'note' && (
        <>
          <p className={css.navHeading}>{t('nav.root')}</p>
          <button type="button" className={css.navItem} aria-current={rootSelected ? 'page' : undefined} onClick={() => { onRoot(root.path) }}>
            <span className={css.navTitle}>{root.path}</span>
          </button>
        </>
      )}
      <p className={css.navHeading}>{t('nav.topics')}</p>
      {index.topics.map(topic => (
        <button
          key={topic.id}
          type="button"
          className={css.navItem}
          aria-current={!rootSelected && topic.id === selectedTopicId ? 'page' : undefined}
          onClick={() => { onTopic(topic.id) }}
        >
          <span className={css.navTitle}>{topic.title}</span>
          <span className={css.navMeta}>
            {[t(`kind.${topic.kind}`), topic.disposition].filter(part => part !== undefined).join(' · ')}
          </span>
          {topic.waiting > 0 && (
            <span className={`${css.navMeta} ${css.navWaiting}`}>
              {topic.waiting === 1 ? t('nav.waiting.one') : t('nav.waiting.other', { count: topic.waiting })}
            </span>
          )}
        </button>
      ))}
      {index.unmapped > 0 && (
        <p className={css.navNote}>{index.unmapped === 1 ? t('nav.unmapped.one') : t('nav.unmapped.other', { count: index.unmapped })}</p>
      )}
    </nav>
  )
}
