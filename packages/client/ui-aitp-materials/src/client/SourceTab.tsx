/** The same located source reader opened beside a normal Harness conversation. */
import type { ReactNode } from 'react'
import { IconDeliverDocRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsRenderFactories } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceLink } from '@deepseek-ai/dsh-research-resources/types'
import type {} from './resources.ts'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { MaterialUnavailable } from './MaterialsPanel.tsx'
import css from './RootSourceTab.module.css'

/** Injected reader actions have no authority to submit a question from browsing. */
export interface SourceTabFace { readonly refresh: () => void; readonly onLink: (link: ResourceLink) => boolean }

/**
 * Read the source URL in the existing Session's dock without attaching it to a model.
 * @param props - tab resource hooks, locale and narrow navigation actions.
 * @returns the shared source reader or actual unavailable state.
 */
export function SourceTab(props: PropsRuntime<'sidebar.right.pane.tab'> & PropsRenderFactories & PropsLocale<'aitp.materials'> & InjectFace<SourceTabFace>): ReactNode {
  const { tab } = props.useTabInfo()
  const reading = props.useResource<'aitp-material-source'>(tab.contentId)
  if (reading.value === undefined) return <MaterialUnavailable t={props.t} refresh={props.refresh} snapshot={reading} />
  return <div className={css.sourceTab}>
    {reading.value.body.kind === 'pdf' && props.renderFactorySlot('aitp.materials.write', {
      scope: {}, source: { ref: reading.value.resource.ref, title: reading.value.resource.title },
      onInspect: (ref) => { props.onLink({ href: '', label: '', target: ref }) },
    })}
    {props.renderFactorySlot('aitp.materials.reader', { reading: reading.value, fields: [], presentation: 'dock',
      onLink: props.onLink })}</div>
}

/**
 * Reuse the host's document glyph with the captured source title.
 * @param props - current tab title.
 * @returns the dock title.
 */
export function SourceTabTitle(props: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode {
  return <><IconDeliverDocRegular size={16} />{props.useTabInfo().tab.title}</>
}
