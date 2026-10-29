/** Project navigation lives in the right Sidebar; the left keeps native search and conversation rows. */
import type { PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'

/** @param props - the existing sidebar geometry. @returns native flat Sessions with their original menus and status. */
export function ConversationSidebar(props: PropsRuntime<'sidebar.workspaces'> & PropsRenderFactories) {
  return props.renderFactorySlot('workspace.browser', { wide: props.wide, expandSidebar: props.expandSidebar, presentation: 'sessions' })
}
