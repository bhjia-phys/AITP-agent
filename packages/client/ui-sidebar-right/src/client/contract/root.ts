/** Session-independent document contributions to the same native right Sidebar. */
import type { MainPanelId, RightbarOwnerProps } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { HostObservable, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { createSidebarRightRootStore } from '../root-store.ts'
import type { TabRecord } from '@deepseek-ai/dsh-client-ui-dockkit'
import type { SidebarRightTabNavigation } from './slots.ts'
import type { SidebarRightRootOpenOptions } from '../root-service.ts'

/** Source-owned content receives navigation data and operations, never file authority from a Session. */
export interface SidebarRightRootTabOwner {
  readonly panelId: MainPanelId
  readonly scopeKey: string
  readonly tab: TabRecord
  readonly navigation: SidebarRightTabNavigation
  readonly visible: boolean
  /** @param address - resolved source address. @param options - source-owned placement/navigation. */
  readonly onOpen: (address: string, options?: SidebarRightRootOpenOptions) => void
  readonly onClose: () => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** Native header control for reopening one global panel's retained document Sidebar. */
    'sidebar.right.root.expand': {
      scope: 'root'
      props: { readonly panelId: MainPanelId; readonly openInitial?: () => void }
      locale: 'sidebarRight'
      store: ReturnType<typeof createSidebarRightRootStore>
      inject: { hooks: { shortcuts: HostObservable<readonly ShortcutCatalogEntry[]> } }
    }
  }
  interface SlotMap {
    /** Native document surface for global panels, sharing the right column without a Session. */
    'rightbar.root': { kind: 'single'; scope: 'root'; owner: RightbarOwnerProps }
    /** Source-provider body, keyed by the same native tab definition id as its Session contribution. */
    'sidebar.right.root.tab': { kind: 'keyed'; scope: 'root'; owner: SidebarRightRootTabOwner }
    /** Optional live document title for a global panel's native tab strip and floating header. */
    'sidebar.right.root.tab.title': { kind: 'keyed'; scope: 'root'; owner: SidebarRightRootTabOwner }
  }
}

/** Framework-derived root document body props. */
export type SidebarRightRootTabProps = PropsRuntime<'sidebar.right.root.tab'>
