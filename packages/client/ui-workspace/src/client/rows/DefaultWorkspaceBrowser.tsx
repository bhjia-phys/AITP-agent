/** Default browser keeps the user's saved grouping; product hosts can reuse the same native factory. */
import type { PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** @param props - sidebar geometry. @returns the native workspace browser with its saved presentation. */
export function DefaultWorkspaceBrowser(props: PropsRuntime<'sidebar.workspaces'> & PropsRenderFactories) {
  return props.renderFactorySlot('workspace.browser', { wide: props.wide, expandSidebar: props.expandSidebar })
}
