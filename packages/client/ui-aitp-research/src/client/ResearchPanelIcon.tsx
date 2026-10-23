/** The sidebar's Research entry icon; the sidebar owns the button, label and selected state around it. */
import type { ReactNode } from 'react'
import { IconThinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the research glyph at the size the sidebar asks for.
 * @param props - the sidebar's icon share.
 * @returns the icon element.
 */
export function ResearchPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return <IconThinkOutlineRegular size={size} />
}
