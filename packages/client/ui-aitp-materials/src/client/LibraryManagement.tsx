/** Small operational controls; the Host owns grants and durable source sets. */
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SaveSourceSetRequest, SourceSetId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MaterialsManagementFace, MaterialsPanelProps } from './MaterialsPanel.tsx'
import { materialsScopeKey } from './store.ts'
import { MATERIAL_ROOTS, MATERIAL_SETUP, materialSourceSetsAddress } from './resources.ts'
import css from './materials.module.css'

type ManagedProps = MaterialsPanelProps & { readonly management: MaterialsManagementFace }

/**
 * Reopen saved selections and attach only existing Harness Workspaces.
 * @param props - standard resource/workspace hooks and owner commands.
 * @returns a collapsed collection and folder manager inside the existing panel.
 */
export function LibraryManagement(props: ManagedProps): ReactNode {
  const { t } = props
  const scope = props.useStore(state => state.scope)
  const key = materialsScopeKey(scope)
  const draft = props.useStore(state => state.drafts[key])
  const setup = props.useResource<'aitp-material-setup'>(MATERIAL_SETUP)
  const roots = props.useResource<'aitp-material-roots'>(MATERIAL_ROOTS)
  const workspaces = props.useWorkspaces(state => state.items)
  const [paging, setPaging] = useState<{ key: string; cursor: string | null }>({ key, cursor: null })
  const cursor = paging.key === key ? paging.cursor : null
  const sets = props.useResource<'aitp-material-source-sets'>(materialSourceSetsAddress({
    ...cursor === null ? {} : { cursor },
    ...scope.workspaceId === undefined || scope.topicId === undefined ? {}
      : { topic: { workspaceId: scope.workspaceId, topicId: scope.topicId } },
  }))
  const [workspace, setWorkspace] = useState('')
  const [status, setStatus] = useState<{ key: string; busy: boolean; message?: string }>({ key, busy: false })
  const busy = status.busy
  const message = status.key === key ? status.message : undefined
  const load = async (id: SourceSetId): Promise<void> => {
    setStatus({ key, busy: true })
    const result = await props.management.load(id)
    if (result.ok) props.actions.loadSourceSet(key, result.value.sourceSet.id,
      result.value.sourceSet.title, result.value.selections, result.value.sourceSet.topics, scope)
    setStatus({ key, busy: false, ...result.ok ? {} : { message: result.error.message } })
  }
  const attach = async (id: WorkspaceId, disconnect = false): Promise<void> => {
    setStatus({ key, busy: true })
    const result = disconnect ? await props.management.disconnect(id) : await props.management.connect(id)
    setStatus({ key, busy: false, ...result.ok ? {} : { message: result.error.message } })
    if (result.ok) props.refresh()
  }
  return <details className={css.management}>
    <summary>{t('manage')}</summary>
    <section><h2>{t('sourceSets')}</h2>
      <p className={css.muted}>{t('sourceSetsHelp')}</p>
      {sets.value === undefined ? <p role="status">{t(sets.status === 'loading' ? 'loading' : 'setsUnavailable')}</p>
        : <ul className={css.links}>{sets.value.items.map(item => <li key={item.id}>
          <Button size="sm" variant="ghost" disabled={busy || draft?.sending || draft?.pendingSave != null}
            onClick={() => { void load(item.id) }}>{item.title}</Button>
          <span className={css.muted}>{t('selected', { count: item.selectionCount })}</span>
        </li>)}</ul>}
      {sets.value?.items.length === 0 && <p className={css.muted}>{t('noSourceSets')}</p>}
      {cursor !== null && <Button size="sm" variant="ghost" onClick={() => { setPaging({ key, cursor: null }) }}>{t('first')}</Button>}
      {sets.value?.nextCursor != null && <Button size="sm" variant="ghost"
        onClick={() => { setPaging({ key, cursor: sets.value?.nextCursor ?? null }) }}>{t('next')}</Button>}
    </section>
    <section><h2>{t('connectFolders')}</h2>
      <p className={css.muted}>{t('connectHelp')}</p>
      {setup.value?.canConnect === true ? <div className={css.toolbar}>
        <select aria-label={t('workspace')} value={workspace} disabled={busy} onChange={(event) => { setWorkspace(event.currentTarget.value) }}>
          <option value="">{t('chooseWorkspace')}</option>
          {workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={!workspace || busy} onClick={() => { void attach(workspace as WorkspaceId) }}>{t('connect')}</Button>
      </div> : <p className={css.muted}>{t('connectUnavailable')}</p>}
      <ul className={css.links}>{roots.value?.map(root => <li key={root.id}>
        <span title={root.displayPath}>{root.title}</span>
        {root.grants?.flatMap(grant => grant.kind !== 'workspace-connection' || grant.workspaceId === undefined ? []
          : [<Button key={grant.workspaceId} size="sm" variant="ghost" disabled={busy}
            onClick={() => { if (grant.workspaceId !== undefined) void attach(grant.workspaceId, true) }}>{t('disconnect')}</Button>])}
      </li>)}</ul><p className={css.muted}>{t('disconnectHelp')}</p>
    </section>
    {message !== undefined && <p role="alert">{message}</p>}
  </details>
}

/**
 * Save exact references and chosen excerpts, preserving unknown outcomes with the original request.
 * @param props - current explicit question scope and operational owner commands.
 * @returns the small source-set title/save control; original scientific files are never changed.
 */
export function SourceSetSave(props: ManagedProps): ReactNode {
  const { t } = props
  const id = useId()
  const scope = props.useStore(state => state.scope)
  const key = materialsScopeKey(scope)
  const draft = props.useStore(state => state.drafts[key])
  const setup = props.useResource<'aitp-material-setup'>(MATERIAL_SETUP)
  if (draft === undefined || draft.selections.length === 0) return null
  const save = async (): Promise<void> => {
    if (draft.saving || draft.sending) return
    const request: SaveSourceSetRequest = draft.pendingSave ?? {
      operationId: globalThis.crypto.randomUUID(),
      ...draft.sourceSetId === null ? {} : { id: draft.sourceSetId },
      title: draft.sourceSetTitle,
      selections: draft.selections.map(({ ref, locator, selectedText }) => ({ ref,
        ...locator === undefined ? {} : { locator }, ...selectedText === undefined ? {} : { selectedText },
      })),
      topics: draft.sourceSetTopics,
    }
    props.actions.pendingSave(key, request, true)
    const result = await props.management.save(request)
    if (props.management.isCurrent?.() === false) return
    if (result.ok && (result.value.operationId !== request.operationId || result.value.state !== 'saved')) {
      props.actions.pendingSave(key, request, false, t('receiptMismatch'))
      return
    }
    if (result.ok) { props.actions.sourceSetSaved(key, result.value); props.refresh(); return }
    if (result.error.code === 'outcome-unknown' || draft.pendingSave !== null) props.actions.pendingSave(key, request, false, result.error.message)
    else props.actions.sourceSetSaveRejected(key, result.error.message)
  }
  return <section className={css.collection}>
    {scope.workspaceId !== undefined && scope.topicId !== undefined && <label><input type="checkbox"
      checked={draft.sourceSetTopics.some(topic => topic.workspaceId === scope.workspaceId && topic.topicId === scope.topicId)}
      disabled={draft.pendingSave !== null || draft.sending} onChange={(event) => {
        if (scope.workspaceId !== undefined && scope.topicId !== undefined) {
          props.actions.sourceSetTopic({ workspaceId: scope.workspaceId, topicId: scope.topicId }, event.currentTarget.checked)
        }
      }} /> {t('associateTopic')}</label>}
    <label htmlFor={id}>{t('sourceSetTitle')}</label>
    <div className={css.toolbar}><input id={id} className={css.search} value={draft.sourceSetTitle}
      disabled={draft.pendingSave !== null || draft.sending}
      onChange={(event) => { props.actions.sourceSetTitle(event.currentTarget.value) }} />
    <Button size="sm" variant="outline" disabled={setup.value?.canSaveSourceSets !== true || draft.saving || draft.sending || !draft.sourceSetTitle.trim() || !draft.sourceSetDirty && draft.pendingSave === null}
      onClick={() => { void save() }}>{t(draft.saving ? 'savingSet' : draft.pendingSave !== null ? 'checkSave' : 'saveSet')}</Button>
    </div>
    {setup.value?.canSaveSourceSets !== true && <p className={css.muted}>{t('setsUnavailable')}</p>}
    {!draft.sourceSetDirty && draft.sourceSetId !== null && <p role="status">{t('savedSet')}</p>}
    {draft.pendingSave !== null && !draft.saving && <p role="alert">{t('saveUnknown')} <code>{draft.pendingSave.operationId}</code></p>}
    {draft.saveFailure !== null && <p role="alert">{draft.saveFailure}</p>}
  </section>
}
