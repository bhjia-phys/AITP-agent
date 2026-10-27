/** Focus targets for a global panel's native document pane and its caller-owned header control. */
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/**
 * @param document - current UI document.
 * @param panelId - real global panel.
 * @param scopeKey - retained reading scope.
 * @returns its visible native pane.
 */
export function visibleRootPane(document: Document, panelId: MainPanelId, scopeKey: string): HTMLElement | undefined {
  const owner = [...document.querySelectorAll<HTMLElement>('[data-sidebar-right-root]')].find(node =>
    node.dataset.sidebarRightRoot === panelId && node.closest<HTMLElement>('[data-sidebar-right-root-scope]')?.dataset.sidebarRightRootScope === scopeKey
    && node.closest('[hidden]') === null)
  return [...owner?.querySelectorAll<HTMLElement>('[data-dockkit-pane], [data-dockkit-float]') ?? []]
    .find(node => node.getAttribute('aria-hidden') !== 'true' && node.closest('[hidden]') === null)
}

/** @param document - current UI document. @param panelId - real global panel. @returns its visible collapsed-reader control. */
export function rootExpandControl(document: Document, panelId: MainPanelId): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-sidebar-right-root-expand]')]
    .find(node => node.dataset.sidebarRightRootExpand === panelId && node.closest('[hidden]') === null)
}
