/**
 * A topic page: question, scope, qualified understanding and what remains open
 * first; branches, materials, claims, work and activity in sections whose open
 * state is kept for the return.
 */
import { useId, useState, type ReactNode } from 'react'
import { Button, FileTypeIcon, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconNewChatOutlineRegular, MarkdownText, Menu, PathLabel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { markdownLabels } from './Passage.tsx'
import { disclosureKey } from './store.ts'
import { Notice } from './states.tsx'
import { ListingStatus, TopicListingView } from './TopicListing.tsx'
import type { Statement, Topic, TopicId } from './workspace-contract.ts'
import { workspaceActivityAddress, workspaceTopicAddress } from './workspace-resources.ts'
import {
  ContributionNote, materialLocator, openTopicResource, QualifiedAnswerView, ReadAt, unavailableCopy, WorkspaceReadingMeta,
  WorkspaceUnavailable, WorkStateLabel, type WorkspaceViewProps,
} from './WorkspaceViews.tsx'
import { WorkspaceEditor } from './WorkspaceEditor.tsx'
import { workspaceEditKey } from './workspace-edit-state.ts'
import css from './workspace.module.css'
import { selectionSource } from './workspace-selection.ts'
import topicCss from './topic.module.css'
import { absentTopicQualification, absentTopicScope, omitAnchorMarkers, topicExcerpt, topicSectionLabels } from './topic-presentation.ts'

/** Sections of a topic page, in reading order. */
export type TopicSection = 'branches' | 'materials' | 'statements' | 'work' | 'activity'

/**
 * A topic page keeps the qualified answer, the work state and the recorded evidence apart.
 * @param props - selected topic and framework reads.
 * @returns the topic page.
 */
export function WorkspaceTopic(props: WorkspaceViewProps & { topicId: TopicId }): ReactNode {
  const [moreOpen, setMoreOpen] = useState(false)
  const readingDetailsKey = disclosureKey(props.workspaceId, 'section', props.topicId, 'reading-details')
  const readingDetailsOpen = props.useStore(state => state.disclosure[readingDetailsKey] ?? false)
  const materialListKey = disclosureKey(props.workspaceId, 'section', props.topicId, 'all-materials')
  const allMaterials = props.useStore(state => state.disclosure[materialListKey] ?? false)
  const result = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  const editKey = workspaceEditKey(props.workspaceId, props.topicId)
  const edit = props.useStore(state => state.pendingEdits[editKey])
  const retry = (): void => { props.retry(props.workspaceId) }
  if (result.value === undefined) return <>
    <WorkspaceEditNotice {...props} topicId={props.topicId} />
    <WorkspaceEditor {...props} topicId={props.topicId} />
    <WorkspaceUnavailable snapshot={result} t={props.t} retry={retry} />
  </>
  const read = result.value
  const topic = read.value
  const { accountResourceId } = topic
  const account = topic.resources.find(resource => resource.id === accountResourceId)
  const { t } = props
  const canEdit = read.provider.capabilities.previewChanges && read.provider.capabilities.applyChanges && result.status !== 'failed'
  const unresolved = edit !== undefined && (edit.pending !== null || edit.uncertain)
  const relation = topic.parentContribution?.relation
  const choicePending = topic.workItems.some(item => item.state === 'waiting-on-researcher' || item.options !== undefined)
  const materials = topic.resources.filter(resource => resource.id !== accountResourceId)
  const answer = topic.currentAnswer === null ? null : {
    ...topic.currentAnswer,
    text: topicExcerpt(topic.currentAnswer.text, topicSectionLabels.answer),
    qualification: topic.currentAnswer.qualification === absentTopicQualification ? t('topic.noQualification')
      : topicExcerpt(topic.currentAnswer.qualification, topicSectionLabels.gap),
  }
  const gap = topic.gap === null ? null : topicExcerpt(topic.gap, topicSectionLabels.gap)
  const gapIsQualification = gap !== null && gap.trim() !== '' && gap.trim() === answer?.qualification.trim()
  const scope = topic.scope === absentTopicScope || topic.scope.trim() === '' ? t('topic.noScope')
    : topicExcerpt(topic.scope, topicSectionLabels.scope)
  const question = topic.question.trim() === `# ${topic.title}` ? t('topic.noQuestion') : topic.question
  const beginEdit = (mode: 'scope' | 'answer'): void => {
    props.actions.beginEdit(editKey, {
      topicId: topic.id, topicTitle: topic.title, mode,
      text: mode === 'scope' ? topic.scope : topic.currentAnswer?.text ?? '',
      qualification: topic.currentAnswer?.qualification ?? '',
      sourceResourceIds: topic.currentAnswer?.attribution.sourceResourceIds ?? [],
      baseRevision: read.revision, prepared: null, pending: null, previewRequestId: null,
      uncertain: false, failure: null, acknowledged: null, hidden: false,
    })
  }
  const section = (name: TopicSection, defaultOpen: boolean, count: number | undefined, body: () => ReactNode): ReactNode => (
    <TopicSectionView {...props} topicId={topic.id} section={name} defaultOpen={defaultOpen} count={count}>{body}</TopicSectionView>
  )
  return (
    <div className={`${css.enter} ${css.topicSurface} ${topicCss.topic}`} {...selectionSource(topic.id, accountResourceId)}>
      <WorkspaceReadingMeta t={t} read={read} stale={result.status === 'failed'} retry={retry} />
      <header className={topicCss.header}>
        <div className={topicCss.heading}>
          {(topic.work.state !== 'unknown' || relation !== undefined) && <p className={css.cardMeta}>
            {topic.work.state !== 'unknown' && <WorkStateLabel t={t} work={topic.work} />}
            {relation !== undefined && <span className={css.relation}>{t(`map.relation.${relation}`)}</span>}
          </p>}
          <h2 className={topicCss.title} tabIndex={-1} data-arrival="">{topic.title}</h2>
          {account?.target.kind === 'workspace-path' && <p className={topicCss.accountLocation}>
            <span>{t('topic.accountLocation')}: </span><PathLabel path={account.target.path} />
          </p>}
          <div className={topicCss.question}><MarkdownText text={omitAnchorMarkers(question)} labels={markdownLabels(t)} /></div>
        </div>
        <div className={topicCss.actions}>
          {props.focusQuestion !== undefined && <Button variant="primary" size="sm"
            icon={<IconNewChatOutlineRegular size={16} />} onClick={props.focusQuestion}>{t('topic.ask')}</Button>}
          <Menu autoFocus open={moreOpen} onClose={() => { setMoreOpen(false) }} align="end"
            items={[
              { id: 'map', label: t('map.showOnMap') },
              { id: 'scope', label: t('workspace.edit.scope'), disabled: unresolved || !canEdit || !read.provider.capabilities.commands.includes('update-scope') },
              { id: 'answer', label: t('workspace.edit.answer'), disabled: unresolved || !canEdit || !read.provider.capabilities.commands.includes('record-answer') },
            ]}
            onSelect={(id) => {
              setMoreOpen(false)
              if (id === 'map') props.navigate({ kind: 'map', focusId: topic.id })
              else if (id === 'scope' || id === 'answer') beginEdit(id)
            }}
            anchor={<Button variant="ghost" size="sm" aria-haspopup="menu" aria-expanded={moreOpen}
              onClick={() => { setMoreOpen(!moreOpen) }}>{t('topic.more')}<IconChevronDownOutlineRegular size={14} /></Button>} />
        </div>
      </header>
      <WorkspaceEditNotice {...props} topicId={props.topicId} />
      <WorkspaceEditor {...props} topicId={props.topicId} read={read} />
      <div className={topicCss.overview}>
        <section className={topicCss.understanding} aria-label={t('workspace.answer')}>
          <div className={topicCss.sectionHead}><h3>{t('workspace.answer')}</h3>
            {accountResourceId !== undefined && <Button variant="outline" size="sm"
              onClick={() => { openTopicResource(props, topic.id, accountResourceId, topic.resources) }}>
              {t('workspace.readAccount')}
            </Button>}</div>
          <QualifiedAnswerView t={t} answer={answer} topicId={topic.id}
            qualificationLabel={gapIsQualification ? t('workspace.gap') : undefined} />
          <div className={topicCss.next}>
            {!gapIsQualification && <section><h3>{t('workspace.gap')}</h3>
              <div {...selectionSource(topic.id, accountResourceId, 'source')}>
                <MarkdownText text={gap ?? t('workspace.noGap')} labels={markdownLabels(t)} />
              </div>
            </section>}
            {topic.work.nextAction !== undefined && <section><h3>{t('workspace.next')}</h3><p>{topic.work.nextAction}</p></section>}
          </div>
        </section>
        <aside className={topicCss.context} aria-label={t('workspace.scope')}>
          <h3>{t('workspace.scope')}</h3>
          <MarkdownText text={scope} labels={markdownLabels(t)} />
          <ContributionNote {...props} parentId={topic.parentId} contribution={topic.parentContribution} />
        </aside>
      </div>
      {section('branches', true, topic.childIds.length, () => topic.childIds.length === 0
        ? <p className={css.note}>{t('map.noBranches')}</p> : <TopicBranches {...props} topic={topic} />)}
      {section('materials', true, materials.length, () => (
        <>
          <div className={topicCss.libraries}>{props.renderFactorySlot('aitp.research.topic-libraries', {
            workspaceId: props.workspaceId, topicId: topic.id, title: topic.title,
            ...props.libraryNavigation === undefined ? {} : { onLeave: props.libraryNavigation.onLeave },
            returnTo: props.libraryNavigation?.returnTo ?? (() => {
              props.navigate({ kind: 'topic', topicId: topic.id }); props.showResearch?.()
            }),
          })}</div>
          {materials.length === 0 ? <p className={topicCss.empty}>{t('workspace.noMaterials')}</p>
            : <>{materials.length > 5 && <p className={topicCss.empty}>{t('topic.materialAvailability')}</p>}<ul className={topicCss.materials}>{(allMaterials ? materials : materials.slice(0, 5)).map(resource => <li key={resource.id}>
              <button type="button" className={topicCss.material} onClick={() => { if (props.openMaterialReference === undefined) props.navigate({ kind: 'resource', topicId: topic.id, resourceId: resource.id }); else props.openMaterialReference(resource, topic.id) }}>
                <span className={topicCss.fileIcon}><FileTypeIcon path={materialLocator(resource)} size={20} /></span>
                <span className={topicCss.materialBody}><strong>{resource.title}</strong>
                  <PathLabel path={materialLocator(resource)} /></span>
                <span className={topicCss.kind}>{t(`workspace.material.${resource.kind}`)}</span>
                <IconChevronRightOutlineRegular size={14} />
              </button>
            </li>)}</ul>{materials.length > 5 && <Button variant="ghost" size="sm" onClick={() => { props.actions.setDisclosed(materialListKey, !allMaterials) }}>
              {t(allMaterials ? 'topic.fewerMaterials' : 'topic.moreMaterials', { count: materials.length })}</Button>}</>}
        </>
      ))}
      {section('statements', false, topic.statements.length, () => <TopicStatements {...props} topic={topic} />)}
      {section('work', choicePending, topic.workItems.length, () => <TopicWork {...props} topic={topic} />)}
      {section('activity', false, undefined, () => (read.provider.capabilities.readActivity
        ? <TopicActivity {...props} topicId={topic.id} cursor={undefined} />
        : <p className={css.note}>{t('workspace.activityUnavailable')}</p>))}
      <details className={topicCss.readingDetails} open={readingDetailsOpen}
        onToggle={(event) => { props.actions.setDisclosed(readingDetailsKey, event.currentTarget.open) }}>
        <summary>{t('topic.readingDetails')}</summary>
        {topic.work.state === 'unknown' && <p><WorkStateLabel t={t} work={topic.work} /></p>}
        <ReadAt t={t} read={read} />
      </details>
    </div>
  )
}

/** One section; its content mounts only while open, so closed sections read nothing. */
function TopicSectionView(props: WorkspaceViewProps & {
  topicId: TopicId
  section: TopicSection
  defaultOpen: boolean
  count: number | undefined
  children: () => ReactNode
}): ReactNode {
  const key = disclosureKey(props.workspaceId, 'section', props.topicId, props.section)
  const open = props.useStore(state => state.disclosure[key] ?? props.defaultOpen)
  const bodyId = useId()
  return (
    <section className={css.pageSection}>
      <h3 className={css.sectionHeading}>
        <button type="button" className={css.sectionToggle} aria-expanded={open} aria-controls={open ? bodyId : undefined}
          onClick={() => { props.actions.setDisclosed(key, !open) }}>
          {open ? <IconChevronDownOutlineRegular size={14} /> : <IconChevronRightOutlineRegular size={14} />}
          <span>{props.t(`workspace.section.${props.section}`)}</span>
          {props.count !== undefined && <span className={css.count}>{props.count}</span>}
        </button>
      </h3>
      {open && <div id={bodyId} className={`${css.sectionBody} ${css.reveal}`}>{props.children()}</div>}
    </section>
  )
}

function WorkspaceEditNotice(props: WorkspaceViewProps & { topicId: TopicId }): ReactNode {
  const key = workspaceEditKey(props.workspaceId, props.topicId)
  const edit = props.useStore(state => state.pendingEdits[key])
  if (edit === undefined || edit.pending !== 'apply' && !edit.uncertain) return null
  return <Notice>{props.t(edit.pending === 'apply' ? 'workspace.edit.pendingNotice' : 'workspace.edit.recoveryNotice', { title: edit.topicTitle })}
    {edit.hidden && <> <button type="button" className={css.linkButton} onClick={() => { props.actions.resumeEdit(key) }}>{props.t('workspace.edit.resume')}</button></>}
  </Notice>
}

function TopicBranches(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  const { t, topic } = props
  const retry = (): void => { props.retry(props.workspaceId) }
  return (
    <TopicListingView {...props} query={{ parentId: topic.id }}
      unavailable={snapshot => <p className={css.inlineState}>{t(unavailableCopy(snapshot)[0])}
        <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></p>}>
      {(listing) => {
        const loaded = new Set(listing.items.map(item => item.id))
        const unread = topic.childIds.filter(id => !loaded.has(id)).length
        const pending = listing.more !== undefined || listing.status === 'loading' || listing.status === 'failed'
        return <>
          <ul className={css.rows}>{listing.items.map(child => <li key={child.id}>
            <button type="button" className={css.branchRow} onClick={() => { props.navigate({ kind: 'topic', topicId: child.id }) }}>
              <span className={css.nodeTitle} {...selectionSource(child.id)}>{child.title}</span>
              <span className={css.nodeMeta}>
                <WorkStateLabel t={t} work={child.work} />
                {child.parentContribution?.relation !== undefined && <span className={css.relation}>{t(`map.relation.${child.parentContribution.relation}`)}</span>}
              </span>
              {child.parentContribution !== undefined && <span className={css.contribution}
                {...selectionSource(topic.id, topic.accountResourceId, 'source')}>{child.parentContribution.text}</span>}
            </button>
          </li>)}</ul>
          {unread > 0 && <p className={css.note}>{t(`map.unread.${pending ? 'more' : 'missing'}.${unread === 1 ? 'one' : 'other'}`, { count: unread })}</p>}
          <ListingStatus t={t} listing={listing} retry={retry} moreLabel={t('map.moreBranches')} />
        </>
      }}
    </TopicListingView>
  )
}

function TopicWork(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  const { topic, t } = props
  if (topic.workItems.length === 0) return <p className={css.note}>{t('workspace.noWork')}</p>
  return <div className={css.items}>{topic.workItems.map((item) => {
    const { contributingTopicId } = item
    const sourceId = item.attribution.sourceResourceIds.length === 1 ? item.attribution.sourceResourceIds[0] : undefined
    return <article key={item.id} className={css.item}>
      <h4>{item.title}</h4>
      <p className={css.itemMeta}><WorkStateLabel t={t} work={{ state: item.state, label: t(`workspace.work.${item.state}`) }} /></p>
      <div className={css.prose} {...selectionSource(topic.id, sourceId)}>
        <MarkdownText text={item.description} labels={markdownLabels(t)} />
      </div>
      {item.continuation !== undefined && <p><strong>{item.continuation.label}</strong> {item.continuation.text}</p>}
      {item.options !== undefined && <ul>{item.options.map(option => <li key={option.id}>{option.label}</li>)}</ul>}
      {contributingTopicId !== undefined && <TopicLink {...props} topicId={contributingTopicId} />}
    </article>
  })}</div>
}

function TopicLink(props: WorkspaceViewProps & { topicId: TopicId }): ReactNode {
  const topic = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  const title = topic.value?.value.title
  return <button type="button" className={css.linkButton} onClick={() => { props.navigate({ kind: 'topic', topicId: props.topicId }) }}>
    {title === undefined ? props.t('workspace.contributingTopic') : props.t('workspace.contributingTopic.named', { title })}
  </button>
}

function TopicStatements(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  if (props.topic.statements.length === 0) return <p className={css.note}>{props.t('workspace.noStatements')}</p>
  return <div className={css.items}>
    {props.topic.statements.map(statement => <TopicStatement key={statement.id} {...props} statement={statement} />)}
  </div>
}

function TopicStatement(props: WorkspaceViewProps & { topic: Topic; statement: Statement }): ReactNode {
  const { t, statement } = props
  const sourceId = statement.attribution.sourceResourceIds.length === 1 ? statement.attribution.sourceResourceIds[0] : undefined
  return <article className={css.item} {...selectionSource(props.topic.id, sourceId)}>
    <h4>{statement.title}</h4>
    <p className={css.itemMeta}><span>{t(`workspace.origin.${statement.origin}`)}</span><span>{t(`workspace.assessment.${statement.assessment}`)}</span>{statement.disposition !== undefined && <span>{t(`workspace.disposition.${statement.disposition}`)}</span>}</p>
    <div className={css.prose}><MarkdownText text={statement.text} labels={markdownLabels(t)} /></div>
    {statement.qualification !== '' && <div className={css.qualification}><MarkdownText text={statement.qualification} labels={markdownLabels(t)} /></div>}
    {statement.checks.map(check => <div key={`${check.kind}:${check.scope}`} className={css.check}>
      <p><strong>{t(`workspace.check.${check.outcome}`)}</strong> · {check.scope}</p>
      {check.resourceIds.map(resourceId => <button key={resourceId} type="button" className={css.linkButton} onClick={() => { openTopicResource(props, props.topic.id, resourceId, props.topic.resources) }}>{props.topic.resources.find(resource => resource.id === resourceId)?.title ?? resourceId}</button>)}
    </div>)}
  </article>
}

function TopicActivity(props: WorkspaceViewProps & { topicId: TopicId; cursor: string | undefined }): ReactNode {
  const [more, setMore] = useState(false)
  const activity = props.useResource<'aitp-workspace-activity'>(workspaceActivityAddress(props.workspaceId, props.topicId, props.cursor))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (activity.value === undefined) return <WorkspaceUnavailable snapshot={activity} t={props.t} retry={retry} />
  const page = activity.value.value
  return <>
    {activity.status === 'failed' && <Notice>{props.t('workspace.retained')}</Notice>}
    {page.items.length === 0 && <p className={css.note}>{props.t('workspace.noActivity')}</p>}
    <ul className={css.activity}>{page.items.map(item => <li key={item.kind === 'change' ? item.changeId : item.kind === 'proposal' ? item.previewId : item.sessionId}>
      {item.kind === 'session'
        ? <button type="button" className={css.linkButton} onClick={() => { props.openSession(item.sessionId as SessionId) }}>{item.title}</button>
        : <p>{item.summary}</p>}
      <p className={css.note}>{item.kind === 'session' ? item.lastActiveAt : item.recordedAt}</p>
    </li>)}</ul>
    {page.completeness === 'partial' && <p className={css.note}>{page.incompleteReason ?? props.t('workspace.partial')}</p>}
    {page.nextCursor !== null && (more ? <TopicActivity key={page.nextCursor} {...props} cursor={page.nextCursor} /> : <Button variant="ghost" size="sm" onClick={() => { setMore(true) }}>{props.t('workspace.more')}</Button>)}
  </>
}
