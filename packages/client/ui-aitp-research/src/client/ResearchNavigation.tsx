/** Reuse the research tree inside scoped libraries with the host's existing sidebar geometry. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ResearchDiscussionScope } from './discussion-contract.ts'
import type { createResearchPanelStore } from './store.ts'
import { WorkspaceSidebar, type WorkspaceSidebarFace } from './WorkspaceSidebar.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    'aitp.research.navigation': {
      scope: 'root'
      props: SidebarSectionOwnerProps & { readonly scope?: ResearchDiscussionScope }
      locale: 'aitp.research.sidebar'
      store: ReturnType<typeof createResearchPanelStore>
      inject: WorkspaceSidebarFace
    }
  }
}

/** @param props - the shared research store, topic callbacks and sidebar geometry. @returns the existing topic tree. */
export function ResearchNavigation(props: FactoryComponentPropsOf<'aitp.research.navigation'>): ReactNode {
  return <WorkspaceSidebar {...props} navigationScope={props.scope} />
}
