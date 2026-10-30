/**
 * The research map: directions and topics at the project level, then one
 * focused topic with its branches, summary and neighbours. Structure comes
 * only from provider records (direction, parent, recorded contribution);
 * nothing is inferred from position or order.
 */
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Button, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, MarkdownText, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import { markdownLabels } from './Passage.tsx'
import { disclosureKey } from './store.ts'
import { ListingStatus, TopicListingView, type TopicListing } from './TopicListing.tsx'
import type { Project, Topic, TopicId, TopicSummary, WorkspaceRead } from './workspace-contract.ts'
import { workspaceProjectAddress, workspaceTopicAddress, workspaceTopicsAddress } from './workspace-resources.ts'
import {
  ContributionNote, MaterialLinks, openTopicResource, QualifiedAnswerView, unavailableCopy, WorkspaceReadingMeta,
  WorkspaceUnavailable, WorkStateLabel, type WorkspaceViewProps,
} from './WorkspaceViews.tsx'
import css from './workspace.module.css'
import { RelatedLibraries } from './RelatedLibraries.tsx'
import { selectionSource } from './workspace-selection.ts'
import { absentTopicQualification, overviewQuestion, topicExcerpt, topicSectionLabels } from './topic-presentation.ts'

/** Move between map nodes with the arrow, Home and End keys; Tab order is unchanged. */
function moveBetweenNodes(event: KeyboardEvent<HTMLElement>): void {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.hasAttribute('data-map-node')) return
  const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-map-node]')]
  const index = nodes.indexOf(target)
  const next = event.key === 'ArrowDown' ? nodes[index + 1]
    : event.key === 'ArrowUp' ? nodes[index - 1]
      : event.key === 'Home' ? nodes[0]
        : event.key === 'End' ? nodes.at(-1)
          : undefined
  if (next === undefined) return
  event.preventDefault()
  next.focus()
}

/**
 * The map at the project level or around one focused topic.
 * @param props - framework reads, navigation and the focused topic, if any.
 * @returns the map view.
 */
export function ResearchMap(props: WorkspaceViewProps & { focusId: TopicId | null }): ReactNode {
  const project = props.useResource<'aitp-workspace-project'>(workspaceProjectAddress(props.workspaceId))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (project.value === undefined) return <WorkspaceUnavailable snapshot={project} t={props.t} retry={retry} />
  return (
    <div onKeyDown={moveBetweenNodes}>
      {props.focusId === null
        ? <MapOverview {...props} project={project.value} stale={project.status === 'failed'} />
        : <MapFocus key={props.focusId} {...props} project={project.value.value} topicId={props.focusId} />}
    </div>
  )
}

function MapOverview(props: WorkspaceViewProps & { project: WorkspaceRead<Project>; stale: boolean }): ReactNode {
  const { t } = props
  const project = props.project.value
  const retry = (): void => { props.retry(props.workspaceId) }
  const seedsId = useId()
  const overviewKey = disclosureKey(props.workspaceId, 'section', 'project-overview')
  const overviewOpen = props.useStore(state => state.disclosure[overviewKey] ?? false)
  return (
    <div className={css.enter}>
      <WorkspaceReadingMeta t={t} read={props.project} stale={props.stale} retry={retry} />
      <header className={css.mapHeader} {...selectionSource(undefined, project.accountResourceId, 'rendered')}>
        <p className={css.eyebrow}>{t('map.eyebrow')}</p>
        <h2 className={css.projectTitle} tabIndex={-1} data-arrival="">{project.title}</h2>
        {project.summary !== undefined && <details className={css.projectOverview} open={overviewOpen}
          onToggle={(event) => {
            if (event.currentTarget.open !== overviewOpen) props.actions.setDisclosed(overviewKey, event.currentTarget.open)
          }}>
          <summary>{t('map.overview')}</summary>
          <div className={css.projectSummary}><MarkdownText text={project.summary} labels={markdownLabels(t)} /></div>
        </details>}
      </header>
      <RelatedLibraries {...props} title={project.title} />
      <TopicListingView {...props} query={{ parentId: null }}
        unavailable={snapshot => <WorkspaceUnavailable snapshot={snapshot} t={t} retry={retry} />}>
        {listing => <DirectionLanes {...props} project={project} listing={listing} />}
      </TopicListingView>
      {project.seeds.length > 0 && <section className={css.seeds} aria-labelledby={seedsId}>
        <h3 id={seedsId} className={css.laneTitle}>{t('workspace.seeds')}</h3>
        <ul className={css.seedList}>{project.seeds.map(seed => <li key={seed.id} className={css.seed}>
          <p>{seed.title}</p><p>{seed.summary}</p>
        </li>)}</ul>
      </section>}
    </div>
  )
}

function DirectionLanes(props: WorkspaceViewProps & { project: Project; listing: TopicListing }): ReactNode {
  const { t, project, listing } = props
  const disclosure = props.useStore(state => state.disclosure)
  const expandable = listing.items.filter(topic => topic.childIds.length > 0)
  const allOpen = expandable.length > 0 && expandable.every(topic => disclosure[disclosureKey(props.workspaceId, 'map', topic.id)] === true)
  const known = new Set(project.directions.map(direction => direction.id))
  const lanes = project.directions.map(direction => ({
    id: direction.id, title: direction.title, topics: listing.items.filter(topic => topic.directionId === direction.id),
  }))
  const other = listing.items.filter(topic => topic.directionId === undefined || !known.has(topic.directionId))
  if (other.length > 0) lanes.push({ id: '', title: t(lanes.length === 0 ? 'map.topics' : 'map.otherTopics'), topics: other })
  return (
    <section aria-label={t('map.directions')}>
      {lanes.length === 0 && !listing.partial && <p className={css.note}>{t('workspace.noTopics')}</p>}
      {expandable.length > 0 && <div className={css.mapControls}><Button variant="ghost" size="sm" onClick={() => {
        for (const topic of expandable) props.actions.setDisclosed(disclosureKey(props.workspaceId, 'map', topic.id), !allOpen)
      }}>{t(allOpen ? 'map.collapseShown' : 'map.expandShown')}</Button></div>}
      <div className={css.lanes}>
        {lanes.map(lane => <section key={lane.id} className={css.lane} aria-label={lane.title}>
          <h3 className={css.laneTitle}>{lane.title}</h3>
          {lane.topics.length === 0
            ? <p className={css.note}>{t(listing.partial ? 'map.laneNotLoaded' : 'map.laneEmpty')}</p>
            : <ul className={css.spine}>{lane.topics.map(topic => <MapNode key={topic.id} {...props} topic={topic} />)}</ul>}
        </section>)}
      </div>
      <ListingStatus t={t} listing={listing} retry={() => { props.retry(props.workspaceId) }} moreLabel={t('map.moreTopics')} />
    </section>
  )
}

function MapNode(props: WorkspaceViewProps & { topic: TopicSummary }): ReactNode {
  const { t, topic } = props
  const key = disclosureKey(props.workspaceId, 'map', topic.id)
  const open = props.useStore(state => state.disclosure[key] ?? false)
  const relation = topic.parentContribution?.relation
  const count = topic.childIds.length
  const title = topic.shortTitle ?? topic.title
  return (
    <li className={css.node} data-state={topic.work.state}>
      <div className={css.nodeCard}>
        <button type="button" className={css.nodeButton} data-map-node="" onClick={() => { props.navigate({ kind: 'map', focusId: topic.id }) }}>
          <span className={css.nodeTitle} {...selectionSource(topic.id)}>{title}</span>
          {(topic.work.state !== 'unknown' || topic.work.label !== '' || relation !== undefined) && <span className={css.nodeMeta}>
            {(topic.work.state !== 'unknown' || topic.work.label !== '') && <WorkStateLabel t={t} work={topic.work} />}
            {relation !== undefined && <span className={css.relation}>{t(`map.relation.${relation}`)}</span>}
          </span>}
        </button>
        {count > 0 && <button type="button" className={css.branchToggle} aria-expanded={open}
          aria-label={t(count === 1 ? 'map.toggle.one' : 'map.toggle.other', { count, title })}
          onClick={() => { props.actions.setDisclosed(key, !open) }}>
          {open ? <IconChevronDownOutlineRegular size={14} /> : <IconChevronRightOutlineRegular size={14} />}
          {t(count === 1 ? 'map.branch.one' : 'map.branch.other', { count })}
        </button>}
      </div>
      {open && <div className={css.reveal}><BranchList {...props} parent={topic} /></div>}
    </li>
  )
}

/**
 * The loaded branches of one topic. Children the parent names but this reading
 * lacks are counted as not loaded or not available; they are never omitted silently.
 */
function BranchList(props: WorkspaceViewProps & { parent: TopicSummary }): ReactNode {
  const { t, parent } = props
  const retry = (): void => { props.retry(props.workspaceId) }
  return (
    <TopicListingView {...props} query={{ parentId: parent.id }}
      unavailable={snapshot => <BranchesUnavailable t={t} snapshot={snapshot} retry={retry} />}>
      {(listing) => {
        const loaded = new Set(listing.items.map(item => item.id))
        const unread = parent.childIds.filter(id => !loaded.has(id)).length
        const pending = listing.more !== undefined || listing.status === 'loading' || listing.status === 'failed'
        return <>
          {listing.items.length > 0 && <ul className={css.spine}>
            {listing.items.map(child => <MapNode key={child.id} {...props} topic={child} />)}
          </ul>}
          {unread > 0 && <p className={css.note}>{t(`map.unread.${pending ? 'more' : 'missing'}.${unread === 1 ? 'one' : 'other'}`, { count: unread })}</p>}
          <ListingStatus t={t} listing={listing} retry={retry} moreLabel={t('map.moreBranches')} />
        </>
      }}
    </TopicListingView>
  )
}

function BranchesUnavailable({ t, snapshot, retry }: { t: WorkspaceViewProps['t']; snapshot: ResourceSnapshot<unknown>; retry: () => void }): ReactNode {
  if (snapshot.status === 'loading') return <span role="status" aria-label={t('state.loading')}><StateDot state="ongoing" /></span>
  return <p className={css.inlineState}>{t(unavailableCopy(snapshot)[0])}
    <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></p>
}

function MapFocus(props: WorkspaceViewProps & { project: Project; topicId: TopicId }): ReactNode {
  const { t } = props
  const result = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  const summaryId = useId()
  const retry = (): void => { props.retry(props.workspaceId) }
  if (result.value === undefined) return <WorkspaceUnavailable snapshot={result} t={t} retry={retry} />
  const read = result.value
  const topic = read.value
  const { accountResourceId } = topic
  const relation = topic.parentContribution?.relation
  const answer = topic.currentAnswer === null ? null : { ...topic.currentAnswer,
    text: topicExcerpt(topic.currentAnswer.text, topicSectionLabels.answer),
    qualification: topic.currentAnswer.qualification === absentTopicQualification ? t('topic.noQualification')
      : topicExcerpt(topic.currentAnswer.qualification, topicSectionLabels.gap) }
  const gap = topic.gap === null ? null : topicExcerpt(topic.gap, topicSectionLabels.gap)
  const gapIsQualification = gap !== null && gap.trim() !== '' && gap.trim() === answer?.qualification.trim()
  const materials = topic.resources.filter(resource => resource.id !== accountResourceId && resource.id !== props.project.accountResourceId)
  return (
    <div className={clsx(css.enter, css.focusLayout)} {...selectionSource(topic.id, accountResourceId)}>
      <WorkspaceReadingMeta t={t} read={read} stale={result.status === 'failed'} retry={retry} />
      <article className={css.focusCard}>
        {(topic.work.state !== 'unknown' || topic.work.label !== '' || relation !== undefined) && <p className={css.cardMeta}>
          {(topic.work.state !== 'unknown' || topic.work.label !== '') && <WorkStateLabel t={t} work={topic.work} />}
          {relation !== undefined && <span className={css.relation}>{t(`map.relation.${relation}`)}</span>}
        </p>}
        <h2 className={css.focusTitle} tabIndex={-1} data-arrival="">{topic.title}</h2>
        <div className={css.question}><MarkdownText text={overviewQuestion(topic.question)} labels={markdownLabels(t)} /></div>
        <ContributionNote {...props} parentId={topic.parentId} contribution={topic.parentContribution} />
      </article>
      <aside className={css.summary} aria-labelledby={summaryId}>
        <div>
          <h3 id={summaryId} className={css.label}>{t('workspace.answer')}</h3>
          <QualifiedAnswerView t={t} answer={answer} topicId={topic.id} qualificationLabel={gapIsQualification ? t('workspace.gap') : undefined} />
        </div>
        {gap !== null && !gapIsQualification && <div><h3 className={css.label}>{t('workspace.gap')}</h3><div {...selectionSource(topic.id, accountResourceId, 'source')}><MarkdownText text={gap} labels={markdownLabels(t)} /></div></div>}
        {topic.work.nextAction !== undefined && <div><h3 className={css.label}>{t('workspace.next')}</h3><p>{topic.work.nextAction}</p></div>}
        {materials.length > 0 && <div>
          <h3 className={css.label}>{t('workspace.section.materials')}</h3>
          <MaterialLinks t={t} navigate={props.navigate} openMaterialReference={props.openMaterialReference}
            topicId={topic.id} resources={materials.slice(0, 3)} showLocator={false} />
          {materials.length > 3 && <p>{t('map.materialSummary.other', { count: materials.length })}</p>}
        </div>}
        <div className={css.actions}>
          <Button variant="primary" size="sm" onClick={() => { props.navigate({ kind: 'topic', topicId: topic.id }) }}>{t('map.openTopic')}</Button>
          {accountResourceId !== undefined && <Button variant="outline" size="sm"
            onClick={() => { openTopicResource(props, topic.id, accountResourceId, topic.resources) }}>{t('workspace.readAccount')}</Button>}
        </div>
      </aside>
      <section className={css.focusBranches} aria-label={t('map.branches', { title: topic.shortTitle ?? topic.title })}>
        <h3 className={css.label}>{t('workspace.section.branches')}</h3>
        {topic.childIds.length === 0 ? <p className={css.note}>{t('map.noBranches')}</p> : <BranchList {...props} parent={topic} />}
      </section>
      <RelatedLibraries {...props} title={topic.title} topic={topic} />
      <Siblings {...props} topic={topic} />
    </div>
  )
}

/**
 * Topics on the first page that shares the focused topic's parent, or its
 * direction at the root; a further or partial page links to the complete level.
 */
function Siblings(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  const { t, topic } = props
  const headingId = useId()
  const result = props.useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(props.workspaceId, { parentId: topic.parentId }))
  const page = result.value?.value
  const siblings = (page?.items ?? []).map(item => item.value)
    .filter(item => item.id !== topic.id && (topic.parentId !== null || item.directionId === topic.directionId))
  const more = page !== undefined && (page.nextCursor !== null || page.completeness === 'partial')
  if (siblings.length === 0 && !more) return null
  return (
    <section className={css.siblings} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.label}>{t(topic.parentId === null ? 'map.siblings.root' : 'map.siblings')}</h3>
      <ul className={css.siblingList}>{siblings.map(sibling => <li key={sibling.id}>
        <button type="button" className={css.sibling} data-map-node="" onClick={() => { props.navigate({ kind: 'map', focusId: sibling.id }) }}>
          <span {...selectionSource(sibling.id)}>{sibling.shortTitle ?? sibling.title}</span>
          {(sibling.work.state !== 'unknown' || sibling.work.label !== '') && <WorkStateLabel t={t} work={sibling.work} />}
        </button>
      </li>)}
      {more && <li className={css.siblingMore}><button type="button" className={css.linkButton}
        onClick={() => { props.navigate({ kind: 'map', focusId: topic.parentId }) }}>{t('map.siblings.all')}</button></li>}
      </ul>
    </section>
  )
}
