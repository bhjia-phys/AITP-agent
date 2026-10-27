import type { ZoomPreference } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
/** Browser-only presentation contracts over the shared local-source service. */
import type { ResourceDomain, ResourceReading, ResourceSummary, SourceLocator, SourceRef, SourceRoot, SourceRootId, SourceSelection, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Explicit question scope, independent of the owners of selected source files. */
export interface MaterialsScope {
  readonly workspaceId?: WorkspaceId
  readonly topicId?: SourceTopicId
  readonly title?: string
}

/** Domain-owned field labels; values remain verbatim source observations. */
export interface MaterialField {
  readonly key: string
  readonly label: string
}

/** Locale-owned presentation supplied by an independently composed library. */
export interface LibraryLabels {
  readonly title: string
  readonly description: string
  readonly fields: readonly MaterialField[]
}

/** One reversible library contribution; no component or filesystem authority crosses this interface. */
export interface LibraryModule {
  readonly domain: ResourceDomain
  readonly panelId: MainPanelId
  readonly order: number
  readonly labels: () => LibraryLabels
}

/** Transient source-selection labels; source bodies stay in framework resources. */
export interface SelectedMaterial extends SourceSelection {
  readonly title: string
  readonly domain: ResourceDomain
  readonly unavailable?: string
}

/** A list or one located source, retained when moving between modules. */
export type MaterialLocation = { readonly kind: 'list'; readonly scrollTop?: number }
  | {
    readonly kind: 'source'
    readonly ref: SourceRef
    readonly locator?: SourceLocator
    /** Null lets linked files choose their actual reader independently of the catalog. */
    readonly readerDomain?: ResourceDomain | null
    readonly scrollTop?: number
    readonly imageZoom?: ZoomPreference
    readonly imageScrollTop?: number
    /** Last physical PDF page viewed here; it does not change the source's citation locator. */
    readonly pdfPage?: number
    readonly pdfZoom?: ZoomPreference
    readonly pdfScrollTop?: number
  }

/** A navigation request from a topic or another material reader. */
export interface OpenMaterials {
  readonly domain: ResourceDomain
  readonly readerDomain?: ResourceDomain | null
  readonly scope?: MaterialsScope
  readonly ref?: SourceRef
  readonly locator?: SourceLocator
  readonly returnTo?: () => void
}

/** Shared reader factory input; all source information is supplied by a resource observation. */
export interface MaterialReaderInput {
  /** Dock content fills the native sidebar; the host owns the document title and navigation. */
  readonly presentation?: 'page' | 'dock'
  /** Catalog context controls domain chrome; file contents still choose their native reader. */
  readonly libraryDomain?: ResourceDomain
  readonly reading: ResourceReading
  readonly fields: readonly MaterialField[]
  readonly onLink: (link: ResourceSummary['links'][number]) => boolean
  /** Navigate within an observed source without changing its research scope. */
  readonly onNavigate?: (selection: SourceSelection) => void
  readonly onSelect?: (selection: SourceSelection) => void
  /** Open the topic's existing discussion with this explicit source or physical PDF page. */
  readonly onDiscuss?: (selection: SourceSelection) => void
  /** The owner retains this physical page across remounts; absent owners keep it only in the mounted reader. */
  readonly imagePosition?: {
    readonly zoom?: ZoomPreference
    readonly onZoomChange?: (zoom: ZoomPreference) => void
    readonly scrollTop?: number
    readonly onScrollTopChange?: (top: number) => void
  }
  readonly pdfPosition?: {
    readonly page: number
    readonly onChange: (page: number) => void
    readonly zoom?: ZoomPreference
    readonly onZoomChange?: (zoom: ZoomPreference) => void
    readonly scrollTop?: number
    readonly onScrollTopChange?: (top: number) => void
  }
}

/** Authorized Markdown assembly shared by domain readers. */
export interface MaterialMarkdownInput {
  readonly reading: ResourceReading
  readonly text: string
  readonly onLink: (link: ResourceSummary['links'][number]) => boolean
}

/** Domain-owned catalog presentation; transport, selection and navigation remain shared. */
export interface MaterialsCatalogInput {
  readonly domain: ResourceDomain
  readonly items: readonly ResourceSummary[]
  readonly roots: readonly SourceRoot[]
  readonly rootId: string | null
  readonly folderPath: string
  readonly query: string
  readonly selected: readonly SourceSelection[]
  readonly disabled: boolean
  readonly isSelected: (resource: ResourceSummary) => boolean
  readonly onOpen: (selection: SourceSelection) => void
  readonly onSelect: (resource: ResourceSummary, checked: boolean) => void
  readonly onRoot: (id: SourceRootId | null) => void
  readonly onFolder: (path: string) => void
}

/** A domain may present source metadata without replacing common reading actions. */
export interface MaterialHeaderInput {
  readonly reading: ResourceReading
  readonly fields: readonly MaterialField[]
}

/** A domain's source body stays inside the shared exact-selection boundary. */
export interface MaterialBodyInput {
  readonly reading: ResourceReading
  readonly text: string
  readonly raw: boolean
  readonly onLink: (link: ResourceSummary['links'][number]) => boolean
  readonly onNavigate: (selection: SourceSelection) => void
}

/** Study plugins may prepare an editable question; only the existing composer submits it. */
export interface MaterialStudyTaskOwner {
  readonly selectionCount: number
  readonly selections: readonly SourceSelection[]
  readonly prepareQuestion: (question: string) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Register under a library domain to render its catalog from supplied entries and selection/navigation callbacks.
     * Absent domains use the shared list.
     */
    'aitp.materials.catalog.body': { kind: 'keyed'; scope: 'root'; owner: MaterialsCatalogInput }
    /**
     * Register under a library domain to present source metadata from the reading and field labels.
     * Absence keeps the shared title and metadata header.
     */
    'aitp.materials.reader.header': { kind: 'keyed'; scope: 'root'; owner: MaterialHeaderInput }
    /**
     * Register under a library domain for its source body, receiving text, raw mode and source navigation.
     * Absence uses native Markdown/code or plain text.
     */
    'aitp.materials.reader.body': { kind: 'keyed'; scope: 'root'; owner: MaterialBodyInput }
    /** Independent study-task shortcuts below an explicit selected-source list. */
    'aitp.materials.tasks': { kind: 'list'; scope: 'root'; owner: MaterialStudyTaskOwner }
  }
}
