import type { ZoomPreference } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
/** Shared viewing state and question drafts; scientific content stays in resource observations. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { ResourceDomain, SaveSourceSetRequest, SourceLocator, SourceRef, SourceSelection, SourceSetId, SourceSetReceipt, SourceSetTopic } from '@deepseek-ai/dsh-research-resources/types'
import type { MaterialLocation, MaterialsScope, SelectedMaterial } from './contracts.ts'
import type { SourceSetJournal } from './source-set-journal.ts'

/** One library's retained view. */
export interface LibraryView {
  catalogScrollTop: number
  query: string
  folderPath: string
  rootId: string | null
  cursor: string | null
  location: MaterialLocation
  back: MaterialLocation[]
}

/** Question state belongs to one explicitly selected scope across the three libraries. */
export interface StudyDraft {
  scope: MaterialsScope
  question: string
  selections: SelectedMaterial[]
  sending: boolean
  failure: string | null
  sourceSetId: SourceSetId | null
  sourceSetTitle: string
  sourceSetTopics: SourceSetTopic[]
  sourceSetDirty: boolean
  pendingSave: SaveSourceSetRequest | null
  saving: boolean
  saveFailure: string | null
}

/** Root-scoped presentation state shared by every library entry. */
export interface MaterialsState {
  scope: MaterialsScope
  views: Record<ResourceDomain, LibraryView>
  /** Inactive research scopes retain their own reading history and PDF page. */
  inactiveViews: Record<string, Record<ResourceDomain, LibraryView>>
  drafts: Record<string, StudyDraft>
  recoveryProblem: string | null
}

/** Captured reading identity prevents retired viewer callbacks from changing another source or topic. */
export interface MaterialViewIdentity { readonly scope: string; readonly source: string }

/** Complete mutation interface for the framework-owned state. */
export type MaterialsActions = {
  setCatalogScroll: (draft: MaterialsState, domain: ResourceDomain, top: number, scopeKey: string) => void
  selectForScope: (draft: MaterialsState, scope: MaterialsScope, selection: SelectedMaterial, selected: boolean) => void
  setScope: (draft: MaterialsState, scope: MaterialsScope) => void
  setQuery: (draft: MaterialsState, domain: ResourceDomain, query: string) => void
  setRoot: (draft: MaterialsState, domain: ResourceDomain, rootId: string | null) => void
  setFolder: (draft: MaterialsState, domain: ResourceDomain, path: string) => void
  open: (draft: MaterialsState, domain: ResourceDomain, location: MaterialLocation) => void
  replaceSource: (draft: MaterialsState, domain: ResourceDomain, location: Extract<MaterialLocation, { kind: 'source' }>) => void
  back: (draft: MaterialsState, domain: ResourceDomain) => void
  setLocator: (draft: MaterialsState, domain: ResourceDomain, locator: SourceLocator) => void
  setPdfPage: (draft: MaterialsState, domain: ResourceDomain, page: number, expected?: MaterialViewIdentity) => void
  setPdfZoom: (draft: MaterialsState, domain: ResourceDomain, zoom: ZoomPreference, expected?: MaterialViewIdentity) => void
  setPdfScroll: (draft: MaterialsState, domain: ResourceDomain, top: number, expected?: MaterialViewIdentity) => void
  setReadingScroll: (draft: MaterialsState, domain: ResourceDomain, top: number, expected: MaterialViewIdentity) => void
  setImageZoom: (draft: MaterialsState, domain: ResourceDomain, zoom: ZoomPreference, expected: MaterialViewIdentity) => void
  setImageScroll: (draft: MaterialsState, domain: ResourceDomain, top: number, expected: MaterialViewIdentity) => void
  select: (draft: MaterialsState, selection: SelectedMaterial, selected: boolean) => void
  question: (draft: MaterialsState, question: string) => void
  sending: (draft: MaterialsState, key: string, sending: boolean, failure?: string) => void
  sent: (draft: MaterialsState, key: string) => void
  nextPage: (draft: MaterialsState, domain: ResourceDomain, cursor: string | null) => void
  sourceSetTitle: (draft: MaterialsState, title: string) => void
  sourceSetTopic: (draft: MaterialsState, topic: SourceSetTopic, included: boolean) => void
  loadSourceSet: (draft: MaterialsState, key: string, id: SourceSetId, title: string,
    selections: readonly SelectedMaterial[], topics: readonly SourceSetTopic[], scope: MaterialsScope) => void
  pendingSave: (draft: MaterialsState, key: string, request: SaveSourceSetRequest, saving: boolean, failure?: string) => void
  sourceSetSaved: (draft: MaterialsState, key: string, receipt: SourceSetReceipt) => void
  sourceSetSaveRejected: (draft: MaterialsState, key: string, failure: string) => void
}

/**
 * Keep independent question drafts for Global and each explicit research scope.
 * @param scope - selected question scope.
 * @returns its draft identity without using a source owner.
 */
export function materialsScopeKey(scope: MaterialsScope): string {
  return JSON.stringify([scope.workspaceId ?? null, scope.topicId ?? null])
}

/**
 * Distinguish equal filenames in different authorized roots.
 * @param ref - root-qualified source.
 * @returns an unambiguous selection identity.
 */
export function materialRefKey(ref: SourceRef): string {
  return JSON.stringify([ref.rootId, ref.sourceId])
}

/**
 * Keep several locations or quotations of one source independently selected.
 * @param selection - one precise source or passage choice.
 * @returns its identity; several physical pages or excerpts of one source remain distinct.
 */
export function materialSelectionKey(selection: SourceSelection): string {
  const locator = selection.locator
  const location = locator === undefined ? null
    : locator.kind === 'text' ? ['text', locator.start, locator.end, locator.quote]
      : locator.kind === 'anchor' ? ['anchor', locator.anchor]
        : locator.kind === 'code' ? ['code', locator.startLine, locator.endLine, locator.revision ?? null]
          : locator.kind === 'git' ? ['git', locator.view, locator.scope ?? null, locator.revision ?? null, locator.path ?? null]
            : ['pdf-page', locator.page, locator.quote ?? null,
              locator.region === undefined ? null : [locator.region.x, locator.region.y, locator.region.width, locator.region.height]]
  return JSON.stringify([selection.ref.rootId, selection.ref.sourceId, location, selection.selectedText ?? null])
}

/**
 * Create a fresh local question and source-set draft.
 * @param scope - the explicitly chosen question scope.
 * @returns an empty draft without copied source bodies.
 */
export function emptyStudyDraft(scope: MaterialsScope = {}): StudyDraft {
  return { scope, question: '', selections: [], sending: false, failure: null, sourceSetId: null, sourceSetTitle: '', sourceSetTopics: [], sourceSetDirty: true, pendingSave: null, saving: false, saveFailure: null }
}

function currentDraft(state: MaterialsState): StudyDraft {
  const key = materialsScopeKey(state.scope)
  const existing = state.drafts[key]
  if (existing !== undefined) return existing
  const created = emptyStudyDraft(state.scope)
  if (state.scope.workspaceId !== undefined && state.scope.topicId !== undefined) {
    created.sourceSetTopics = [{ workspaceId: state.scope.workspaceId, topicId: state.scope.topicId }]
  }
  return state.drafts[key] = created
}

function view(): LibraryView {
  return { catalogScrollTop: 0, query: '', folderPath: '', rootId: null, cursor: null, location: { kind: 'list' }, back: [] }
}

/**
 * Declare shared viewing state and bounded pending-operation recovery.
 * @param journal - optional same-tab recovery of unconfirmed source-set commands.
 * @returns a registration-owned store; production instances are created by the renderer.
 */
export function createMaterialsStore(journal?: SourceSetJournal): EngineStoreHandle<MaterialsState, MaterialsActions> {
  const persist = (state: MaterialsState): void => {
    state.recoveryProblem = journal?.write(Object.values(state.drafts).flatMap(draft => draft.pendingSave === null ? [] : [{
      scope: draft.scope, request: draft.pendingSave, labels: draft.selections.map(({ title, domain }) => ({ title, domain })),
    }])) ?? null
  }
  return defineStore({
    init: (): MaterialsState => {
      const recovery = journal?.read()
      const drafts: MaterialsState['drafts'] = {}
      for (const entry of recovery?.entries ?? []) {
        drafts[materialsScopeKey(entry.scope)] = { ...emptyStudyDraft(entry.scope), pendingSave: entry.request,
          sourceSetId: entry.request.id ?? null, sourceSetTitle: entry.request.title, sourceSetTopics: [...entry.request.topics ?? []],
          selections: entry.request.selections.map((selection, index) => ({ ...selection,
            title: entry.labels[index]?.title ?? selection.ref.sourceId, domain: entry.labels[index]?.domain ?? 'knowledge' })),
        }
      }
      return { scope: {}, views: { knowledge: view(), literature: view(), code: view() }, inactiveViews: {}, drafts,
        recoveryProblem: recovery?.problem ?? null }
    },
    actions: {
      setCatalogScroll: (draft, domain, top, scopeKey) => {
        if (scopeKey === materialsScopeKey(draft.scope)) draft.views[domain].catalogScrollTop = top
      },
      selectForScope: (draft, scope, selection, selected) => {
        const current = draft.drafts[materialsScopeKey(scope)] ??= emptyStudyDraft(scope)
        if (current.sending || current.pendingSave !== null) return
        const key = materialSelectionKey(selection)
        current.selections = current.selections.filter(item => materialSelectionKey(item) !== key)
        if (selected) current.selections.push(selection)
        current.sourceSetDirty = true
        current.failure = null
      },
      setScope: (draft, scope: MaterialsScope) => {
        const previous = materialsScopeKey(draft.scope)
        const next = materialsScopeKey(scope)
        if (previous !== next) {
          draft.inactiveViews[previous] = draft.views
          draft.views = draft.inactiveViews[next] ?? { knowledge: view(), literature: view(), code: view() }
          draft.inactiveViews = Object.fromEntries(Object.entries(draft.inactiveViews).filter(([key]) => key !== next))
        }
        draft.scope = scope
      },
      setQuery: (draft, domain: ResourceDomain, query: string) => { draft.views[domain].query = query; draft.views[domain].cursor = null; draft.views[domain].location = { kind: 'list' } },
      setRoot: (draft, domain: ResourceDomain, rootId: string | null) => { draft.views[domain].rootId = rootId; draft.views[domain].folderPath = ''; draft.views[domain].cursor = null; draft.views[domain].location = { kind: 'list' } },
      setFolder: (draft, domain: ResourceDomain, path: string) => { draft.views[domain].folderPath = path },
      open: (draft, domain: ResourceDomain, location: MaterialLocation) => {
        const current = draft.views[domain]
        current.back.push(current.location)
        current.back = current.back.slice(-40)
        current.location = location
      },
      replaceSource: (draft, domain: ResourceDomain, location: Extract<MaterialLocation, { kind: 'source' }>) => {
        draft.views[domain].location = location
      },
      back: (draft, domain: ResourceDomain) => {
        const current = draft.views[domain]
        current.location = current.back.pop() ?? { kind: 'list' }
      },
      setLocator: (draft, domain: ResourceDomain, locator: SourceLocator) => {
        const current = draft.views[domain]
        if (current.location.kind === 'source') current.location = { kind: 'source', ref: current.location.ref, locator,
          ...current.location.readerDomain === undefined ? {} : { readerDomain: current.location.readerDomain } }
      },
      setPdfPage: (draft, domain: ResourceDomain, page: number, expected?: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected !== undefined && (expected.scope !== materialsScopeKey(draft.scope)
          || current.location.kind !== 'source' || expected.source !== materialSelectionKey(current.location))) return
        if (current.location.kind === 'source') current.location = { ...current.location, pdfPage: page }
      },
      setPdfZoom: (draft, domain: ResourceDomain, zoom: ZoomPreference, expected?: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected !== undefined && (expected.scope !== materialsScopeKey(draft.scope)
          || current.location.kind !== 'source' || expected.source !== materialSelectionKey(current.location))) return
        if (current.location.kind === 'source') current.location = { ...current.location, pdfZoom: zoom }
      },
      setPdfScroll: (draft, domain: ResourceDomain, top: number, expected?: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected !== undefined && (expected.scope !== materialsScopeKey(draft.scope)
          || current.location.kind !== 'source' || expected.source !== materialSelectionKey(current.location))) return
        if (current.location.kind === 'source') current.location = { ...current.location, pdfScrollTop: top }
      },
      setReadingScroll: (draft, domain: ResourceDomain, value: number, expected: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected.scope !== materialsScopeKey(draft.scope)
          || expected.source !== (current.location.kind === 'source' ? materialSelectionKey(current.location) : 'list')) return
        current.location = { ...current.location, scrollTop: value }
      },
      setImageZoom: (draft, domain: ResourceDomain, value: ZoomPreference, expected: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected.scope !== materialsScopeKey(draft.scope) || current.location.kind !== 'source'
          || expected.source !== materialSelectionKey(current.location)) return
        current.location = { ...current.location, imageZoom: value }
      },
      setImageScroll: (draft, domain: ResourceDomain, value: number, expected: MaterialViewIdentity) => {
        const current = draft.views[domain]
        if (expected.scope !== materialsScopeKey(draft.scope) || current.location.kind !== 'source'
          || expected.source !== materialSelectionKey(current.location)) return
        current.location = { ...current.location, imageScrollTop: value }
      },
      select: (draft, selection: SelectedMaterial, selected: boolean) => {
        const current = currentDraft(draft)
        if (current.sending || current.pendingSave !== null) return
        const key = materialSelectionKey(selection)
        current.selections = current.selections.filter(item => materialSelectionKey(item) !== key)
        if (selected) current.selections.push(selection)
        current.sourceSetDirty = true
        current.failure = null
      },
      question: (draft, question: string) => { currentDraft(draft).question = question },
      sending: (draft, key: string, sending: boolean, failure?: string) => {
        const current = draft.drafts[key] ??= emptyStudyDraft()
        current.sending = sending
        current.failure = failure ?? null
      },
      sent: (draft, key: string) => {
        const current = draft.drafts[key]
        if (current !== undefined) { current.sending = false; current.failure = null; current.question = '' }
      },
      nextPage: (draft, domain: ResourceDomain, cursor: string | null) => { draft.views[domain].cursor = cursor },
      sourceSetTitle: (draft, title: string) => {
        const current = currentDraft(draft)
        if (current.pendingSave === null) { current.sourceSetTitle = title; current.sourceSetDirty = true }
      },
      sourceSetTopic: (draft, topic: SourceSetTopic, included: boolean) => {
        const current = currentDraft(draft)
        if (current.pendingSave !== null) return
        current.sourceSetTopics = current.sourceSetTopics.filter(item => item.workspaceId !== topic.workspaceId
          || item.topicId !== topic.topicId)
        if (included) current.sourceSetTopics.push(topic)
        current.sourceSetDirty = true
      },
      loadSourceSet: (draft, key: string, id: SourceSetId, title: string,
        selections: readonly SelectedMaterial[], topics: readonly SourceSetTopic[], scope: MaterialsScope) => {
        const current = draft.drafts[key] ??= emptyStudyDraft(scope)
        if (current.sending || current.pendingSave !== null) return
        current.sourceSetId = id; current.sourceSetTitle = title; current.selections = [...selections]
        current.sourceSetTopics = [...topics]
        current.saveFailure = null; current.sourceSetDirty = false
      },
      pendingSave: (draft, key: string, request: SaveSourceSetRequest, saving: boolean, failure?: string) => {
        const current = draft.drafts[key] ??= emptyStudyDraft()
        current.pendingSave = request; current.saving = saving; current.saveFailure = failure ?? null
        persist(draft)
      },
      sourceSetSaved: (draft, key: string, receipt: SourceSetReceipt) => {
        const current = draft.drafts[key] ??= emptyStudyDraft()
        current.sourceSetTopics = [...current.pendingSave?.topics ?? current.sourceSetTopics]
        current.sourceSetId = receipt.id; current.pendingSave = null; current.saving = false
        current.saveFailure = null; current.sourceSetDirty = false
        persist(draft)
      },
      sourceSetSaveRejected: (draft, key: string, failure: string) => {
        const current = draft.drafts[key] ??= emptyStudyDraft()
        current.pendingSave = null; current.saving = false; current.saveFailure = failure
        persist(draft)
      },
    },
  })
}

/** Declared handle shared across panel and sidebar registrations. */
export type MaterialsStore = ReturnType<typeof createMaterialsStore>
