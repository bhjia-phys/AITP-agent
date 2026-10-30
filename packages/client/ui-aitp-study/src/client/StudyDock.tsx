/** Saved reading drafts stay beside their source or conversation in the native document sidebar. */
import type { ReactNode } from 'react'
import type { PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { StudyStore } from './store.ts'
import type { StudyFace } from './StudyPanel.tsx'
import css from './study.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    'aitp.study.content': { scope: 'root'; locale: 'aitp.study'; store: StudyStore; inject: StudyFace }
  }
}

/** @param props - current Session document seat. @returns the existing note editor and saved-artifact browser. */
export function SessionStudyDock(props: PropsRuntime<'sidebar.right.pane.tab'> & PropsRenderFactories): ReactNode {
  return <div className={css.dock}>{props.renderFactorySlot('aitp.study.content', {})}</div>
}

/** @param props - current source-library document seat. @returns the same note editor without leaving the library. */
export function RootStudyDock(props: PropsRuntime<'sidebar.right.root.tab'> & PropsRenderFactories): ReactNode {
  return <div className={css.dock}>{props.renderFactorySlot('aitp.study.content', {})}</div>
}
