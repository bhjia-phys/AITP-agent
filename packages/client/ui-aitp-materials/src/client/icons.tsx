/** Existing Harness artwork reused for the independently registered library entries. */
import type { ReactNode } from 'react'
import { IconCodeOutlineRegular, IconDeliverDocRegular, IconThinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceDomain } from '@deepseek-ai/dsh-research-resources/types'

/**
 * Use the host's existing glyph family and sidebar-controlled size.
 * @param props - standard icon size and the registered domain.
 * @returns the corresponding existing icon.
 */
export function LibraryIcon(props: PropsRuntime<'sidebar.panellist'> & InjectFace<{ readonly domain: ResourceDomain }>): ReactNode {
  if (props.domain === 'code') return <IconCodeOutlineRegular size={props.size} />
  if (props.domain === 'knowledge') return <IconThinkOutlineRegular size={props.size} />
  return <IconDeliverDocRegular size={props.size} />
}
