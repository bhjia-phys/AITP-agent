/** Selection ownership stays with the displayed source, including nested map branches. */
import type { ResourceId, TopicId } from './workspace-contract.ts'

/** Original browser quote plus its explicitly marked source; unsupported layouts stay visible and unsent. */
export interface WorkspaceSelection {
  readonly text: string
  readonly topicId?: TopicId
  readonly resourceId?: ResourceId
  readonly format: 'source' | 'rendered'
  readonly unsupported: boolean
}

/**
 * Mark source-backed presentation without encoding a storage path in the UI.
 * @param topicId - recorded research owner, absent for a root account.
 * @param resourceId - recorded material identity, when the provider supplies one.
 * @param format - whether displayed text is literal or rendered Markdown.
 * @returns DOM metadata read only when the person explicitly selects a passage.
 */
export function selectionSource(
  topicId: TopicId | undefined, resourceId?: ResourceId, format: 'source' | 'rendered' = 'rendered',
): {
  'data-research-source': string | undefined
  'data-research-topic': TopicId | undefined
  'data-research-resource': ResourceId | undefined
  'data-research-format': 'source' | 'rendered'
} {
  return {
    'data-research-source': topicId === undefined && resourceId === undefined ? undefined : '',
    'data-research-topic': topicId,
    'data-research-resource': resourceId,
    'data-research-format': format,
  }
}

function scope(node: Node): Element | null {
  return (node.nodeType === node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest('[data-research-source]') ?? null
}

/**
 * Recover one source owner from both browser selection endpoints.
 * @param selected - live, nonempty Selection already restricted to the reading pane by the caller.
 * @returns exact browser text and ownership; mixed sources and mathematical layout are explicit unsupported selections.
 */
export function readWorkspaceSelection(selected: Selection): WorkspaceSelection {
  const first = selected.anchorNode === null ? null : scope(selected.anchorNode)
  const last = selected.focusNode === null ? null : scope(selected.focusNode)
  const range = selected.rangeCount === 1 ? selected.getRangeAt(0) : undefined
  const math = first === null || range === undefined ? false
    : [...first.querySelectorAll('.katex, .katex-error')].some(node => range.intersectsNode(node))
  const crossedSource = first === null || range === undefined ? false
    : [...first.querySelectorAll('[data-research-source]')].some(node => range.intersectsNode(node))
  const topicId = first?.getAttribute('data-research-topic')
  const resourceId = first?.getAttribute('data-research-resource')
  return {
    text: selected.toString(),
    ...(topicId ? { topicId: topicId as TopicId } : {}),
    ...(resourceId ? { resourceId: resourceId as ResourceId } : {}),
    format: first?.getAttribute('data-research-format') === 'source' ? 'source' : 'rendered',
    unsupported: first === null || first !== last || range === undefined || math || crossedSource,
  }
}
