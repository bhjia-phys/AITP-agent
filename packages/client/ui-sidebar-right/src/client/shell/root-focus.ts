/** Focus targets for a global panel's native document pane and its caller-owned header control. */
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/**
 * Find a visible native document pane belonging to the requested panel and reading scope.
 * @param document - current UI document.
 * @param panelId - real global panel.
 * @param scopeKey - retained reading scope.
 * @returns the first visible pane, or undefined when that scope has no visible document pane.
 */
export function visibleRootPane(document: Document, panelId: MainPanelId, scopeKey: string): HTMLElement | undefined {
  const owner = [...document.querySelectorAll<HTMLElement>('[data-sidebar-right-root]')].find(node =>
    node.dataset.sidebarRightRoot === panelId && node.closest<HTMLElement>('[data-sidebar-right-root-scope]')?.dataset.sidebarRightRootScope === scopeKey
    && node.closest('[hidden]') === null)
  return [...owner?.querySelectorAll<HTMLElement>('[data-dockkit-pane], [data-dockkit-float]') ?? []]
    .find(node => node.getAttribute('aria-hidden') !== 'true' && node.closest('[hidden]') === null)
}

/**
 * Find the caller-owned header control for reopening a global panel's collapsed documents.
 * @param document - current UI document.
 * @param panelId - real global panel.
 * @returns the visible reopen control, or undefined when no matching control is rendered.
 */
export function rootExpandControl(document: Document, panelId: MainPanelId): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-sidebar-right-root-expand]')]
    .find(node => node.dataset.sidebarRightRootExpand === panelId && node.closest('[hidden]') === null)
}
