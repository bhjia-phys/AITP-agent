/** A topic's own account, children, work, materials and recorded activity. */
import { useId, useState, type ReactNode } from 'react'
import { Button, MarkdownText, SegmentedTabs, type SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { markdownLabels } from './Passage.tsx'
import type { TopicTab } from './store.ts'
import { Notice } from './states.tsx'
import type { ResourceReference, Statement, Topic, TopicId } from './workspace-contract.ts'
import { workspaceActivityAddress, workspaceTopicAddress } from './workspace-resources.ts'
import { WorkspaceReadingMeta, WorkspaceTopicCards, WorkspaceUnavailable, type WorkspaceViewProps } from './WorkspaceViews.tsx'
import { WorkspaceEditor } from './WorkspaceEditor.tsx'
import { workspaceEditKey } from './workspace-edit-state.ts'
import css from './research.module.css'

/**
 * A topic detail page keeps qualification and work state separate.
 * @param props - selected topic, view tab and framework reads.
 * @returns the topic's detail view.
 */
export function WorkspaceTopic(props: WorkspaceViewProps & { topicId: TopicId; tab: TopicTab }): ReactNode {
  const result = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  const editKey = workspaceEditKey(props.workspaceId, props.topicId)
  const edit = props.useStore(state => state.pendingEdits[editKey])
  const prefix = useId()
  const retry = (): void => { props.retry(props.workspaceId) }
  if (result.value === undefined) return <>
    <WorkspaceEditNotice {...props} topicId={props.topicId} />
    <WorkspaceEditor {...props} topicId={props.topicId} />
    <WorkspaceUnavailable snapshot={result} t={props.t} retry={retry} />
  </>
  const read = result.value
  const topic = read.value
  const { accountResourceId } = topic
  const { t } = props
  const tab = (value: TopicTab): SegmentedTab<TopicTab> => ({ value, label: t(`workspace.tab.${value}`), id: `${prefix}-${value}`, panelId: `${prefix}-panel-${value}` })
  const tabs: [SegmentedTab<TopicTab>, ...SegmentedTab<TopicTab>[]] = [tab('overview'), tab('work'), tab('statements'), tab('materials'), tab('activity')]
  const canEdit = read.provider.capabilities.previewChanges && read.provider.capabilities.applyChanges && result.status !== 'failed'
  const unresolved = edit !== undefined && (edit.pending !== null || edit.uncertain)
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
  return (
    <>
      {topic.parentId !== null && <TopicParent {...props} topicId={topic.parentId} />}
      <WorkspaceReadingMeta t={t} read={read} stale={result.status === 'failed'} retry={retry} />
      <header className={css.topicHero}>
        <span className={css.workState} data-state={topic.work.state}>{topic.work.label}</span>
        <h2 className={css.title} tabIndex={-1} data-arrival="">{topic.title}</h2>
        <div className={css.topicQuestion}><MarkdownText text={topic.question} labels={markdownLabels(t)} /></div>
        <div className={css.actions}>
          {accountResourceId !== undefined && <Button variant="outline" size="sm"
            onClick={() => { props.navigate({ kind: 'resource', topicId: topic.id, resourceId: accountResourceId }) }}>
            {t('workspace.readAccount')}
          </Button>}
          <Button variant="ghost" size="sm" disabled={unresolved || !canEdit || !read.provider.capabilities.commands.includes('update-scope')}
            title={!canEdit ? t('workspace.edit.unsupported') : undefined} onClick={() => { beginEdit('scope') }}>{t('workspace.edit.scope')}</Button>
          <Button variant="ghost" size="sm" disabled={unresolved || !canEdit || !read.provider.capabilities.commands.includes('record-answer')}
            title={!canEdit ? t('workspace.edit.unsupported') : undefined} onClick={() => { beginEdit('answer') }}>{t('workspace.edit.answer')}</Button>
        </div>
      </header>
      <WorkspaceEditNotice {...props} topicId={props.topicId} />
      <WorkspaceEditor {...props} topicId={props.topicId} read={read} />
      <div className={css.tabsViewport}><SegmentedTabs items={tabs} value={props.tab}
        onChange={(tab) => { props.actions.setTab(props.workspaceId, tab) }} label={t('workspace.tabs')} className={css.topicTabs} /></div>
      <div role="tabpanel" id={`${prefix}-panel-${props.tab}`} aria-labelledby={`${prefix}-${props.tab}`} className={css.topicTabBody}>
        {props.tab === 'overview' && <TopicOverview {...props} topic={topic} />}
        {props.tab === 'work' && <TopicWork {...props} topic={topic} />}
        {props.tab === 'statements' && <TopicStatements {...props} topic={topic} />}
        {props.tab === 'materials' && <TopicMaterials {...props} resources={topic.resources} topicId={topic.id} />}
        {props.tab === 'activity' && (read.provider.capabilities.readActivity
          ? <TopicActivity {...props} topicId={topic.id} /> : <p className={css.quiet}>{t('workspace.activityUnavailable')}</p>)}
      </div>
    </>
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

function TopicParent(props: WorkspaceViewProps & { topicId: TopicId }): ReactNode {
  const parent = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.topicId))
  return <p className={css.parentLink}><button type="button" className={css.linkButton} onClick={() => { props.navigate({ kind: 'topic', topicId: props.topicId, tab: 'overview' }) }}>{parent.value?.value.title ?? props.t('workspace.parent')}</button></p>
}

function TopicOverview(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  const { topic, t } = props
  return (
    <>
      <div className={css.answerGrid}>
        <section className={css.answerBlock}>
          <h3>{t('workspace.answer')}</h3>
          {topic.currentAnswer === null ? <p className={css.quiet}>{t('workspace.noAnswer')}</p> : (
            <><div className={css.prose}><MarkdownText text={topic.currentAnswer.text} labels={markdownLabels(t)} /></div>
              {topic.currentAnswer.qualification !== '' && <div className={css.qualification}><h4>{t('workspace.limits')}</h4><MarkdownText text={topic.currentAnswer.qualification} labels={markdownLabels(t)} /></div>}</>
          )}
        </section>
        <section className={css.gapBlock}><h3>{t('workspace.gap')}</h3><p>{topic.gap ?? t('workspace.noGap')}</p>
          {topic.work.nextAction !== undefined && <div className={css.nextStep}><h4>{t('workspace.next')}</h4><p>{topic.work.nextAction}</p></div>}
        </section>
      </div>
      <section className={css.section}><h3 className={css.sectionHeading}>{t('workspace.scope')}</h3><div className={css.prose}><MarkdownText text={topic.scope} labels={markdownLabels(t)} /></div></section>
      <section className={css.section}><h3 className={css.sectionHeading}>{t('workspace.children')}</h3><WorkspaceTopicCards {...props} query={{ parentId: topic.id }} /></section>
    </>
  )
}

function TopicWork(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  const { topic, t } = props
  if (topic.workItems.length === 0) return <p className={css.quiet}>{t('workspace.noWork')}</p>
  return <div className={css.workList}>{topic.workItems.map((item) => {
    const { contributingTopicId } = item
    return <article key={item.id} className={css.detailCard}>
      <h3>{item.title}</h3><p className={css.workState} data-state={item.state}>{t(`workspace.work.${item.state}`)}</p><div className={css.prose}><MarkdownText text={item.description} labels={markdownLabels(t)} /></div>
      {item.continuation !== undefined && <p className={css.nextStep}>
        <strong>{item.continuation.label}</strong> {item.continuation.text}
      </p>}
      {item.options !== undefined && <ul>{item.options.map(option => <li key={option.id}>{option.label}</li>)}</ul>}
      {contributingTopicId !== undefined && <button type="button" className={css.linkButton}
        onClick={() => { props.navigate({ kind: 'topic', topicId: contributingTopicId, tab: 'overview' }) }}>{t('workspace.children')}</button>}
    </article>
  })}</div>
}

function TopicStatements(props: WorkspaceViewProps & { topic: Topic }): ReactNode {
  if (props.topic.statements.length === 0) return <p className={css.quiet}>{props.t('workspace.noStatements')}</p>
  return <div className={css.workList}>
    {props.topic.statements.map(statement => <TopicStatement key={statement.id} {...props} statement={statement} />)}
  </div>
}

function TopicStatement(props: WorkspaceViewProps & { topic: Topic; statement: Statement }): ReactNode {
  const { t, statement } = props
  return <article className={css.detailCard}>
    <h3>{statement.title}</h3>
    <p className={css.statementMeta}><span>{t(`workspace.origin.${statement.origin}`)}</span><span>{t(`workspace.assessment.${statement.assessment}`)}</span>{statement.disposition !== undefined && <span>{t(`workspace.disposition.${statement.disposition}`)}</span>}</p>
    <div className={css.prose}><MarkdownText text={statement.text} labels={markdownLabels(t)} /></div>
    {statement.qualification !== '' && <div className={css.qualification}><MarkdownText text={statement.qualification} labels={markdownLabels(t)} /></div>}
    {statement.checks.map(check => <div key={`${check.kind}:${check.scope}`} className={css.checkScope}>
      <p><strong>{t(`workspace.check.${check.outcome}`)}</strong> · {check.scope}</p>
      {check.resourceIds.map(resourceId => <button key={resourceId} type="button" className={css.linkButton} onClick={() => { props.navigate({ kind: 'resource', topicId: props.topic.id, resourceId }) }}>{props.topic.resources.find(resource => resource.id === resourceId)?.title ?? resourceId}</button>)}
    </div>)}
  </article>
}

function TopicMaterials(props: WorkspaceViewProps & { resources: readonly ResourceReference[]; topicId: TopicId }): ReactNode {
  if (props.resources.length === 0) return <p className={css.quiet}>{props.t('workspace.noMaterials')}</p>
  return <ul className={css.materialList}>{props.resources.map(resource => <li key={resource.id}>
    <button type="button" className={css.materialButton} onClick={() => { props.navigate({ kind: 'resource', resourceId: resource.id, topicId: props.topicId }) }}>
      <span className={css.materialKind}>{props.t(`workspace.material.${resource.kind}`)}</span><strong>{resource.title}</strong>
      <span className={css.materialPath}>{resource.target.kind === 'workspace-path' ? resource.target.path : resource.target.kind === 'uri' ? resource.target.uri : resource.target.reason}</span>
    </button>
  </li>)}</ul>
}

function TopicActivity(props: WorkspaceViewProps & { topicId: TopicId; cursor?: string }): ReactNode {
  const [more, setMore] = useState(false)
  const activity = props.useResource<'aitp-workspace-activity'>(workspaceActivityAddress(props.workspaceId, props.topicId, props.cursor))
  const retry = (): void => { props.retry(props.workspaceId) }
  if (activity.value === undefined) return <WorkspaceUnavailable snapshot={activity} t={props.t} retry={retry} />
  const page = activity.value.value
  return <>
    {activity.status === 'failed' && <Notice>{props.t('workspace.retained')}</Notice>}
    {page.items.length === 0 && <p className={css.quiet}>{props.t('workspace.noActivity')}</p>}
    <ul className={css.activityList}>{page.items.map(item => <li key={item.kind === 'change' ? item.changeId : item.kind === 'proposal' ? item.previewId : item.sessionId}>
      {item.kind === 'session'
        ? <button type="button" className={css.linkButton} onClick={() => { props.openSession(item.sessionId as SessionId) }}>{item.title}</button>
        : <p>{item.summary}</p>}
      <p className={css.quiet}>{item.kind === 'session' ? item.lastActiveAt : item.recordedAt}</p>
    </li>)}</ul>
    {page.completeness === 'partial' && <p className={css.quiet}>{page.incompleteReason ?? props.t('workspace.partial')}</p>}
    {page.nextCursor !== null && (more ? <TopicActivity key={page.nextCursor} {...props} cursor={page.nextCursor} /> : <Button variant="ghost" size="sm" onClick={() => { setMore(true) }}>{props.t('workspace.more')}</Button>)}
  </>
}
