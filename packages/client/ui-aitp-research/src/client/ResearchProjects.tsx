/** The same project tree in native Session and Session-independent right Sidebar tabs. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { WorkspaceSidebar, type WorkspaceSidebarFace } from './WorkspaceSidebar.tsx'
import type { createResearchPanelStore } from './store.ts'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import css from './ResearchProjects.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    'aitp.research.projects': {
      scope: 'root'
      locale: 'aitp.research.sidebar'
      store: ReturnType<typeof createResearchPanelStore>
      inject: WorkspaceSidebarFace
    }
  }
}

/** @param props - shared project view state. @returns the existing topic tree with full native tab width. */
export function ResearchProjects(props: FactoryComponentPropsOf<'aitp.research.projects'>): ReactNode {
  return <div className={css.projects}><WorkspaceSidebar {...props} wide expandSidebar={() => {}} /></div>
}

/** @param props - the native Session tab seat. @returns the shared project navigator. */
export function SessionProjects(props: PropsRuntime<'sidebar.right.pane.tab'> & PropsRenderFactories): ReactNode {
  return props.renderFactorySlot('aitp.research.projects', {})
}

/** @param props - a real setup-resource tab, with no Session file authority. @returns the same navigator. */
export function RootProjects(props: PropsRuntime<'sidebar.right.root.tab'> & PropsRenderFactories): ReactNode {
  return props.renderFactorySlot('aitp.research.projects', {})
}
