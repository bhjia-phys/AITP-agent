/** Source-root reading in the shared native dock, independent of a Conversation Session. */
import { useState, type ReactNode } from 'react'
import { IconDeliverDocRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRenderFactories, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceDomain, SourceSelection, SourceRef } from '@deepseek-ai/dsh-research-resources/types'
import { COLLECTION_SOURCE_ID, materialSourceAddress, parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { MaterialField, MaterialsScope } from './contracts.ts'
import type { MaterialsStore } from './store.ts'
import { materialSelectionKey, materialsScopeKey } from './store.ts'
import type {} from './source-navigation.ts'
import { MaterialUnavailable } from './MaterialsPanel.tsx'
import css from './RootSourceTab.module.css'

/** Reading actions stage explicit sources but never submit a message. */
export interface RootSourceTabFace {
  readonly fields: (domain: ResourceDomain) => readonly MaterialField[]
  readonly refresh: () => void
  readonly openCollection?: (ref: SourceRef, scope: MaterialsScope, domain?: ResourceDomain) => Promise<boolean>
  readonly discuss?: (scope: MaterialsScope, selections: readonly SourceSelection[]) => void
  readonly stage?: (scope: MaterialsScope, selections: readonly SourceSelection[]) => void
}

type SourceProps = PropsRuntime<'sidebar.right.root.tab'> & PropsRenderFactories & PropsLocale<'aitp.materials'>
  & PropsStore<MaterialsStore> & InjectFace<RootSourceTabFace>

/**
 * Keep the document mounted with its native tab while the catalogue and discussion change.
 * @param props - real source resource, retained root tab and explicit scientific scope.
 * @returns the native document presentation or its actual read failure.
 */
export function RootSourceTab(props: SourceProps): ReactNode {
  const [linkFailure, setLinkFailure] = useState(false)
  const reading = props.useResource<'aitp-material-source'>(props.navigation.address)
  const params = props.navigation.params
  const context = params !== undefined && 'libraryDomain' in params ? params : undefined
  const scope = context?.scope ?? {}
  const draft = props.useStore(state => state.drafts[materialsScopeKey(scope)])
  const selected = draft?.selections ?? []
  const busy = draft?.sending === true || draft?.pendingSave != null
  if (reading.value === undefined) return <div className={css.sourceTab} data-material-source={props.navigation.address}>
    <MaterialUnavailable t={props.t} refresh={props.refresh} snapshot={reading} />
  </div>
  const value = reading.value
  const source = parseMaterialSource(props.navigation.address)
  const open = (selection: SourceSelection, linked = false): void => {
    props.onOpen(materialSourceAddress(selection.ref, selection.locator, linked ? undefined : source?.domain), {
      ...context === undefined ? {} : { params: context },
    })
    if (selected.length === 0) props.stage?.(scope, [selection])
  }
  const select = (selection: SourceSelection): SourceSelection[] => {
    const item = { ...selection, title: value.resource.title, domain: value.resource.domain }
    const next = [...selected.filter(current => materialSelectionKey(current) !== materialSelectionKey(selection)), item]
    props.actions.selectForScope(scope, item, true)
    const sources = next.map(({ ref, locator, selectedText }) => ({ ref,
      ...locator === undefined ? {} : { locator }, ...selectedText === undefined ? {} : { selectedText },
    }))
    props.stage?.(scope, sources)
    return sources
  }
  return <div className={css.sourceTab} data-material-ready data-material-source={props.navigation.address}>
    {linkFailure && <p role="alert" className={css.notice}>{props.t('unresolved')}</p>}
    {reading.status === 'failed' && <p role="alert" className={css.notice}>{props.t('readFailed')}</p>}
    {value.body.kind === 'pdf' && props.renderFactorySlot('aitp.materials.write', {
      scope, source: { ref: value.resource.ref, title: value.resource.title }, onInspect: (ref) => { open({ ref }, true) },
    })}
    {props.renderFactorySlot('aitp.materials.reader', {
      presentation: 'dock', reading: value, fields: props.fields(value.resource.domain),
      ...context === undefined ? {} : { libraryDomain: context.libraryDomain },
      onNavigate: (selection) => { open(selection) },
      onLink: (link) => {
        if (link.target === undefined) return false
        if (link.target.sourceId === COLLECTION_SOURCE_ID) {
          if (props.openCollection === undefined) return false
          setLinkFailure(false)
          void props.openCollection(link.target, scope, context?.libraryDomain)
            .then((opened) => { setLinkFailure(!opened) }, () => { setLinkFailure(true) })
          return true
        }
        open({ ref: link.target, ...link.locator === undefined ? {} : { locator: link.locator } }, true)
        return true
      },
      ...busy ? {} : { onSelect: (selection) => { select(selection) } },
      ...busy || props.discuss === undefined ? {} : {
        onDiscuss: (selection) => { props.discuss?.(scope, select(selection)) },
      },
    })}
  </div>
}

/**
 * Use the provider's observed title after loading, retaining a filename while it loads.
 * @param props - root document tab resource and native tab record.
 * @returns the native document icon and title.
 */
export function RootSourceTabTitle(props: PropsRuntime<'sidebar.right.root.tab.title'>): ReactNode {
  const reading = props.useResource<'aitp-material-source'>(props.navigation.address)
  return <><IconDeliverDocRegular size={16} />{reading.value?.resource.title ?? props.tab.title}</>
}
