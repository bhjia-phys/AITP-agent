/** Shared parts of the workspace views and the material reader, read through Harness resources. */
import type { ReactNode } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { observedLabel } from './format.ts'
import { markdownLabels } from './Passage.tsx'
import type { ResearchPanelProps } from './ResearchPanel.tsx'
import type { ResearchLocation } from './store.ts'
import { Empty, Loading, Notice } from './states.tsx'
import type {
  ParentContribution, QualifiedAnswer, ReadEnvelope, ResourceId, ResourceReference, TopicId, WorkSummary, WorkspaceError,
} from './workspace-contract.ts'
import type { AitpResearchKey } from './locales.ts'
import { workspaceResourceAddress, workspaceTopicAddress } from './workspace-resources.ts'
import css from './workspace.module.css'
import { selectionSource } from './workspace-selection.ts'

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
 * Localized title and detail of a read without a usable value.
 * @param snapshot - read snapshot that has no value.
 * @returns dictionary keys for the state's title and detail.
 */
export function unavailableCopy(snapshot: ResourceSnapshot<unknown>): readonly [AitpResearchKey, AitpResearchKey] {
  if (snapshot.status === 'none') return readFailureCopy['not-connected']
  return snapshot.failure?.code === 'aitp/workspace' ? readFailureCopy[snapshot.failure.details.code] : readFailureCopy['unavailable']
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
  const copy = unavailableCopy(snapshot)
  return (
    <div className={css.unavailableState}>
      <Empty title={t(copy[0])} body={t(copy[1])} />
      <Button variant="outline" size="sm" onClick={retry}>{t('workspace.retry')}</Button>
    </div>
  )
}

/**
 * Fixture label and stale notice of the reading a view shows.
 * @param props - actual read envelope, failed-refresh state and retry action.
 * @returns source and stale notices.
 */
export function WorkspaceReadingMeta({ t, read, stale, retry }: {
  t: T
  read: Pick<ReadEnvelope<unknown>, 'origin'> & { provider?: { notice?: string } }
  stale: boolean
  retry: () => void
}): ReactNode {
  if (read.origin !== 'fixture' && !stale && read.provider?.notice === undefined) return null
  return (
    <div className={css.readingMeta}>
      {read.origin === 'fixture' && <p className={css.fixtureLabel}><strong>{t('workspace.fixture')}</strong> · {t('workspace.fixture.detail')}</p>}
      {stale && <Notice>{t('workspace.retained')} <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></Notice>}
      {read.provider?.notice !== undefined && <Notice>{read.provider.notice}</Notice>}
    </div>
  )
}

/**
 * When the shown value was read; retained values keep their original time.
 * @param props - localized copy and read envelope.
 * @returns the reading-time footer.
 */
export function ReadAt({ t, read }: { t: T; read: Pick<ReadEnvelope<unknown>, 'observedAt'> }): ReactNode {
  return <p className={css.readAt}>{t('workspace.observed', { time: observedLabel(read.observedAt) })}</p>
}

/**
 * Provider-owned work status; it says nothing about scientific verification.
 * @param props - recorded work summary and localized copy for an absent label.
 * @returns the recorded status dot with its verbatim label, or neutral localized absence text.
 */
export function WorkStateLabel({ work, t }: { work: Pick<WorkSummary, 'state' | 'label'>; t: T }): ReactNode {
  return <span className={css.workState} data-state={work.state}>{work.label === '' ? t('workspace.work.unknown') : work.label}</span>
}

/**
 * A current answer with its conditions; the two are never shown apart.
 * @param props - localized copy and the recorded answer, if any.
 * @returns the qualified answer or the explicit absence of one.
 */
export function QualifiedAnswerView({ t, answer, topicId }: { t: T; answer: QualifiedAnswer | null; topicId: TopicId }): ReactNode {
  if (answer === null) return <p className={css.note}>{t('workspace.noAnswer')}</p>
  const sourceId = answer.attribution.sourceResourceIds.length === 1 ? answer.attribution.sourceResourceIds[0] : undefined
  return (
    <div className={css.answer} {...selectionSource(topicId, sourceId)}>
      <MarkdownText text={answer.text} labels={markdownLabels(t)} />
      {answer.qualification !== '' && <div className={css.qualification}>
        <p className={css.label}>{t('workspace.limits')}</p>
        <MarkdownText text={answer.qualification} labels={markdownLabels(t)} />
      </div>}
    </div>
  )
}

/**
 * The recorded role of a topic in its parent; nothing is shown when it is absent.
 * @param props - view reads, the parent identity and the recorded contribution.
 * @returns the contribution note.
 */
export function ContributionNote(props: Pick<WorkspaceViewProps, 't' | 'useResource' | 'workspaceId'> & {
  parentId: TopicId | null
  contribution: ParentContribution | undefined
}): ReactNode {
  const { parentId, contribution } = props
  if (parentId === null || contribution === undefined) return null
  return <ContributionText {...props} parentId={parentId} contribution={contribution} />
}

function ContributionText(props: Pick<WorkspaceViewProps, 't' | 'useResource' | 'workspaceId'> & {
  parentId: TopicId
  contribution: ParentContribution
}): ReactNode {
  const parent = props.useResource<'aitp-workspace-topic'>(workspaceTopicAddress(props.workspaceId, props.parentId))
  const title = parent.value?.value.shortTitle ?? parent.value?.value.title
  return (
    <p className={css.contribution}>
      <strong>{title === undefined ? props.t('map.contribution.parent') : props.t('map.contribution', { title })}</strong>{' '}
      <span {...selectionSource(props.parentId, parent.value?.value.accountResourceId, 'source')}>{props.contribution.text}</span>
    </p>
  )
}

/**
 * Where a material lives, as recorded by its provider.
 * @param resource - material reference.
 * @returns its path, URI or unavailability reason.
 */
export function materialLocator(resource: Pick<ResourceReference, 'target'>): string {
  const { target } = resource
  return target.kind === 'workspace-path' ? target.path : target.kind === 'uri' ? target.uri : target.reason
}

/**
 * Materials of one topic, each opening its reader.
 * @param props - view callbacks, the current topic and its material references.
 * @returns the material rows, or the explicit absence of materials.
 */
export function MaterialLinks(props: Pick<WorkspaceViewProps, 't' | 'navigate'> & {
  topicId: TopicId
  resources: readonly ResourceReference[]
  showLocator: boolean
}): ReactNode {
  if (props.resources.length === 0) return <p className={css.note}>{props.t('workspace.noMaterials')}</p>
  return <ul className={css.materials}>{props.resources.map(resource => <li key={resource.id}>
    <button type="button" className={css.materialLink} onClick={() => { props.navigate({ kind: 'resource', resourceId: resource.id, topicId: resource.ownerTopicId ?? props.topicId }) }}>
      <span className={css.materialKind}>{props.t(`workspace.material.${resource.kind}`)}</span><strong>{resource.title}</strong>
      {props.showLocator && <span className={css.materialPath}>{materialLocator(resource)}</span>}
    </button>
  </li>)}</ul>
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
    <div className={css.enter}>
      <WorkspaceReadingMeta t={props.t} read={result.value} stale={result.status === 'failed'} retry={retry} />
      <header className={css.materialHeader}>
        <p className={css.eyebrow}>{props.t(`workspace.material.${resource.kind}`)}</p>
        <h2 className={css.pageTitle} tabIndex={-1} data-arrival="">{resource.title}</h2>
        <p className={css.materialLocator}>{props.t('workspace.material.location')}: {materialLocator(resource)}</p>
      </header>
      {resource.content.kind === 'unavailable'
        ? <Empty title={props.t('workspace.material.unavailable')} body={resource.content.detail} />
        : <article className={css.materialBody} {...selectionSource(props.topicId ?? undefined, resource.id, resource.content.kind === 'markdown' ? 'rendered' : 'source')}>{resource.content.kind === 'markdown'
          ? <div className={css.prose}><MarkdownText text={resource.content.text} labels={markdownLabels(props.t)} /></div>
          : <pre className={css.plainText}>{resource.content.text}</pre>}</article>}
      <ReadAt t={props.t} read={result.value} />
    </div>
  )
}
