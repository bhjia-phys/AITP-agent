/** The scientific scope captured when a source is opened in the native document dock. */
import type { ResourceDomain } from '@deepseek-ai/dsh-research-resources/types'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { MaterialsScope } from './contracts.ts'

/** Source navigation carries context, never file authority or a synthetic Session. */
export interface MaterialSourceNavigation {
  readonly scope: MaterialsScope
  readonly libraryDomain: ResourceDomain
}

declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightResourceParamsMap {
    'aitp-material-source': MaterialSourceNavigation
  }
}
