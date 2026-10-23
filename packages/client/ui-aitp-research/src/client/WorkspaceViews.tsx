/** Project cards and exact resource destinations, read through Harness resources. */
import { useState, type ReactNode } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { observedLabel } from './format.ts'
import { markdownLabels } from './Passage.tsx'
import type { ResearchPanelProps } from './ResearchPanel.tsx'
import type { ResearchLocation } from './store.ts'
import { Empty, Loading, Notice } from './states.tsx'
import type { ReadEnvelope, ResourceId, TopicId, TopicQuery, TopicSummary, WorkspaceError } from './workspace-contract.ts'
import type { AitpResearchKey } from './locales.ts'
import { workspaceProjectAddress, workspaceResourceAddress, workspaceTopicAddress, workspaceTopicsAddress } from './workspace-resources.ts'
import css from './research.module.css'

/** Shared runtime props; data remains in the resource layer. */
export type WorkspaceViewProps = ResearchPanelProps & {
  workspaceId: WorkspaceId
  navigate: (location: ResearchLocation) => void
}

type T = TranslateNS<'aitp.research'>

/** Read failures retain their meaning even when the transport has no localized message. */
const readFailureCopy: Record<WorkspaceError['code'], readonly [AitpResearchKey, AitpResearchKey]> = {
  'not-connected': ['workspace.unavailable', 'workspace.unavailable.detail'],
  'not-found': ['workspace.notFound', 'workspace.notFound.detail'],
  'unsupported': ['workspace.unsupported', 'workspace.unsupported.detail'],
  'permission-denied': ['workspace.permissionDenied', 'workspace.permissionDenied.detail'],
  'read-only': ['workspace.readOnly', 'workspace.edit.unsupported'],
  'invalid-request': ['workspace.invalidRequest', 'workspace.invalidRequest.detail'],
  'cancelled': ['workspace.cancelled', 'workspace.cancelled.detail'],
  'unavailable': ['workspace.failed', 'workspace.failed.detail'],
  'preview-expired': ['workspace.previewExpired', 'workspace.previewExpired.detail'],
  'operation-reused': ['workspace.operationReused', 'workspace.operationReused.detail'],
  'revision-conflict': ['workspace.changed', 'workspace.changed.detail'],
  'outcome-unknown': ['workspace.outcomeUnknown', 'workspace.edit.unknown'],
  'partial-apply': ['workspace.partiallyApplied', 'workspace.edit.partial'],
}

/**
 * The state of a read without a usable value.
 * @param props - read snapshot, localized copy and retry action.
 * @returns an explicit loading, disconnected or failed state.
 */
export function WorkspaceUnavailable({ snapshot, t, retry }: {
  snapshot: ResourceSnapshot<unknown>
  t: T
  retry: () => void
}): ReactNode {
  if (snapshot.status === 'loading') return <Loading label={t('state.loading')} />
  const copy = snapshot.status === 'none'
    ? readFailureCopy['not-connected']
    : snapshot.failure?.code === 'aitp/workspace'
      ? readFailureCopy[snapshot.failure.details.code]
      : readFailureCopy['unavailable']
  return (
    <div className={css.workspaceState}>
      <Empty title={t(copy[0])} body={t(copy[1])} />
      <Button variant="outline" size="sm" onClick={retry}>{t('workspace.retry')}</Button>
    </div>
  )
}

/**
 * Retained values keep the time and revision of the successful reading.
 * @param props - actual read envelope, failed-refresh state and retry action.
 * @returns source and stale notices.
 */
export function WorkspaceReadingMeta({ t, read, stale, retry }: {
  t: T
  read: Pick<ReadEnvelope<unknown>, 'origin' | 'observedAt' | 'revision'>
  stale: boolean
  retry: () => void
}): ReactNode {
  return (
    <div className={css.readingMeta}>
      {read.origin === 'fixture' && <p className={css.fixtureLabel}><strong>{t('workspace.fixture')}</strong> · {t('workspace.fixture.detail')}</p>}
      {stale && <Notice>{t('workspace.retained')} <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></Notice>}
      <p className={css.meta}>{t('workspace.observed', { time: observedLabel(read.observedAt) })}</p>
    </div>
  )
}

/**
 * The project page exposes root topics and their direct children.
 * @param props - framework reads and navigation callbacks.
 * @returns the project overview.
 */
export function WorkspaceProject(props: WorkspaceViewProps): ReactNode {
  const project = props.useResource<'aitp-workspace-project'>(workspaceProjectAddress(props.workspaceId))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (project.value === undefined) return <WorkspaceUnavailable snapshot={project} t={props.t} retry={retry} />
  const { value } = project.value
  return (
    <>
      <WorkspaceReadingMeta t={props.t} read={project.value} stale={project.status === 'failed'} retry={retry} />
      <header className={css.projectHero}>
        <p className={css.eyebrow}>{props.t('workspace.overview')}</p>
        <h2 className={css.projectTitle} tabIndex={-1} data-arrival="">{value.title}</h2>
        <p className={css.projectIntro}>{props.t('workspace.intro')}</p>
        {value.directions.length > 0 && <div className={css.directionList}>
          {value.directions.map(item => <span key={item.id}>{item.title}</span>)}
        </div>}
      </header>
      <section aria-label={props.t('workspace.topics')}>
        <h3 className={css.sectionHeading}>{props.t('workspace.topics')}</h3>
        <WorkspaceTopicCards {...props} query={{ parentId: null }} />
      </section>
      {value.seeds.length > 0 && <section className={css.section}>
        <h3 className={css.sectionHeading}>{props.t('workspace.seeds')}</h3>
        <div className={css.seedGrid}>{value.seeds.map(seed => (
          <article key={seed.id} className={css.seedCard}><h4>{seed.title}</h4><p>{seed.summary}</p></article>
        ))}</div>
      </section>}
    </>
  )
}

/**
 * One query page with an explicit continuation instead of silently truncating.
 * @param props - view callbacks and topic query.
 * @returns child-owned cards with paging and availability feedback.
 */
export function WorkspaceTopicCards(props: WorkspaceViewProps & { query: TopicQuery }): ReactNode {
  const [more, setMore] = useState(false)
  const result = props.useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(props.workspaceId, props.query))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (result.value === undefined) return <WorkspaceUnavailable snapshot={result} t={props.t} retry={retry} />
  const page = result.value.value
  return (
    <>
      {result.status === 'failed' && <Notice>{props.t('workspace.retained')} <button type="button" className={css.linkButton} onClick={retry}>{props.t('workspace.retry')}</button></Notice>}
      {page.items.length === 0 && <p className={css.quiet}>{props.t(props.query.parentId == null ? 'workspace.noTopics' : 'workspace.noChildren')}</p>}
      <div className={css.topicGrid}>
        {page.items.map(item => <WorkspaceTopicCard key={item.value.id} {...props} topic={item.value} />)}
      </div>
      {page.completeness === 'partial' && <p className={css.quiet}>{page.incompleteReason ?? props.t('workspace.partial')}</p>}
      {page.nextCursor !== null && (more
        ? <WorkspaceTopicCards key={page.nextCursor} {...props} query={{ ...props.query, cursor: page.nextCursor }} />
        : <Button variant="ghost" size="sm" onClick={() => { setMore(true) }}>{props.t('workspace.more')}</Button>)}
    </>
  )
}

function WorkspaceTopicCard(props: WorkspaceViewProps & { topic: TopicSummary }): ReactNode {
  const { topic, t, navigate } = props
  return (
    <article className={css.topicCard}>
      <div className={css.cardTop}><span className={css.workState} data-state={topic.work.state}>{topic.work.label}</span><span className={css.quiet}>{t('workspace.materialCount', { count: topic.resourceCount })}</span></div>
      <h4 className={css.cardTitle}><button type="button" onClick={() => { navigate({ kind: 'topic', topicId: topic.id, tab: 'overview' }) }}>{topic.title}</button></h4>
      {topic.currentAnswer === null ? <p className={css.quiet}>{t('workspace.noAnswer')}</p> : (
        <div className={css.cardAnswer}>
          <MarkdownText text={topic.currentAnswer.text} labels={markdownLabels(t)} />
          {topic.currentAnswer.qualification !== '' && <p className={css.cardQualification}>{topic.currentAnswer.qualification}</p>}
        </div>
      )}
      {topic.gap !== null && <p className={css.cardGap}><span>{t('workspace.gap')}</span>{topic.gap}</p>}
      {topic.work.nextAction !== undefined && <p className={css.cardNext}><span>{t('workspace.next')}</span>{topic.work.nextAction}</p>}
      {topic.childIds.length > 0 && <div className={css.childLinks} aria-label={t('workspace.children')}>
        {topic.childIds.map(topicId => <WorkspaceTopicShortcut key={topicId} {...props} topicId={topicId} />)}
      </div>}
    </article>
  )
}

function WorkspaceTopicShortcut(props: WorkspaceViewProps & { topicId: TopicId }): ReactNode {
  const topic = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  return <button type="button" className={css.linkButton} onClick={() => { props.navigate({ kind: 'topic', topicId: props.topicId, tab: 'overview' }) }}>{topic.value?.value.shortTitle ?? topic.value?.value.title ?? props.t('workspace.openChild')}</button>
}

/**
 * Read the material by stable identity, preserving the actual content and locator.
 * @param props - selected resource, owning topic and framework reads.
 * @returns the full material or its explicit availability limit.
 */
export function WorkspaceMaterial(props: WorkspaceViewProps & { resourceId: ResourceId; topicId: TopicId | null }): ReactNode {
  const result = props.useResource<'aitp-workspace-resource'>(workspaceResourceAddress(props.workspaceId, props.resourceId))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (result.value === undefined) return <WorkspaceUnavailable snapshot={result} t={props.t} retry={retry} />
  const resource = result.value.value
  return (
    <>
      <WorkspaceReadingMeta t={props.t} read={result.value} stale={result.status === 'failed'} retry={retry} />
      <p className={css.eyebrow}>{props.t(`workspace.material.${resource.kind}`)}</p>
      <h2 className={css.title} tabIndex={-1} data-arrival="">{resource.title}</h2>
      <p className={css.materialLocator}>{props.t('workspace.material.location')}: {resource.target.kind === 'workspace-path' ? resource.target.path : resource.target.kind === 'uri' ? resource.target.uri : resource.target.reason}</p>
      {resource.content.kind === 'unavailable'
        ? <Empty title={props.t('workspace.material.unavailable')} body={resource.content.detail} />
        : <article className={css.materialBody}>{resource.content.kind === 'markdown'
          ? <MarkdownText text={resource.content.text} labels={markdownLabels(props.t)} />
          : <pre className={css.plainText}>{resource.content.text}</pre>}</article>}
    </>
  )
}
