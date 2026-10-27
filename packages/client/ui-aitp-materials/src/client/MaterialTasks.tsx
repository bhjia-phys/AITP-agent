/** One shared declaration keeps independently unloadable study tools outside library ownership. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * @param props - editable-question callback and selected-source count.
 * @returns optional contributions from the separately composed study plugin.
 */
export function MaterialTasks(props: FactoryComponentPropsOf<'aitp.materials.study-tools'>): ReactNode {
  return props.renderSlot('aitp.materials.tasks', {
    selectionCount: props.selectionCount, selections: props.selections, prepareQuestion: props.prepareQuestion,
  })
}
