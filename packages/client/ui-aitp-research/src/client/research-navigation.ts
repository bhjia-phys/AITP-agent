/** Route discussion citations into the existing Research centre without rebinding its conversation. */
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { isAbsoluteWorkspacePath, parseFileAddress, relativizeToCwd } from '@deepseek-ai/dsh-util-workspace-path'
import type { ResearchDiscussionScope } from './discussion-contract.ts'
import type { ResourceId, TopicId } from './workspace-contract.ts'
import type { createResearchPanelStore, ResearchLocation, ResearchReturnPoint } from './store.ts'
import { parseNoteAddress } from './protocol.ts'

const START: ResearchReturnPoint = { scrollTop: 0, focusIndex: null }

/**
 * Decode only research-owned references and files within the selected Workspace.
 * @param scope - explicit discussion location, never inferred from source ownership.
 * @param address - citation address emitted by a reader or the native conversation.
 * @param workspacePath - Host-observed Workspace path for absolute file references.
 * @returns a centre-reader location; the provider still owns all read authorization.
 */
export function researchCitationLocation(scope: ResearchDiscussionScope, address: string,
  workspacePath?: string): ResearchLocation | undefined {
  const topicId = scope.topicId === undefined ? null : brandString<TopicId>(scope.topicId)
  let resourceId: ResourceId | undefined
  try {
    const url = new URL(address)
    if (url.protocol !== 'dsh-resource:') return undefined
    if (url.hostname === 'aitp-workspace-resource') {
      const parts = url.pathname.split('/')
      if (parts.length !== 5 || parts[1] !== 'workspace' || parts[3] !== 'resource'
        || decodeURIComponent(parts[2] ?? '') !== scope.workspaceId) return undefined
      const id = decodeURIComponent(parts[4] ?? '')
      if (!id || /[\u0000-\u001f\u007f]/u.test(id)) return undefined
      resourceId = brandString<ResourceId>(id)
    } else {
      const note = parseNoteAddress(`${url.protocol}//${url.host}${url.pathname}`)
      const file = parseFileAddress(address)
      if (note !== undefined && note.workspaceId !== scope.workspaceId) return undefined
      const path = note?.path ?? (file === undefined ? undefined : relativizeToCwd(file.path, workspacePath))
      if (path === undefined || isAbsoluteWorkspacePath(path) || /[\\\u0000-\u001f\u007f]/u.test(path)) return undefined
      const parts = path.split('/').filter(part => part !== '.')
      if (parts.length === 0 || parts.some(part => part === '' || part === '..')) return undefined
      resourceId = brandString<ResourceId>(`resource:${encodeURIComponent(parts.join('/'))}`)
    }
  } catch { return undefined }
  return { kind: 'resource', topicId, resourceId }
}

/** Bind renderer-owned actions; never create a second Research store for navigation. */
export class ResearchNavigationController {
  private actions: BoundActions<ReturnType<typeof createResearchPanelStore>> | undefined
  private pending: { scope: ResearchDiscussionScope; location: ResearchLocation; leave: ResearchReturnPoint } | undefined

  constructor(private readonly ctx: Context, private readonly panelId: MainPanelId) {}

  /** @param actions - the shared store's framework-baked mutation interface. */
  bind(actions: BoundActions<ReturnType<typeof createResearchPanelStore>>): void {
    this.actions = actions
    const pending = this.pending
    if (pending === undefined) return
    this.pending = undefined
    actions.open(pending.scope.workspaceId, pending.location, pending.leave)
  }

  /**
   * @param scope - current discussion's scientific scope.
   * @param address - an owned research or Workspace file address.
   * @param leave - current reading position when its owner is mounted.
   * @returns whether Research owns and opened this centre-reader route.
   */
  open(scope: ResearchDiscussionScope, address: string, leave: ResearchReturnPoint = START): boolean {
    const workspace = this.ctx.workspaces.list.getSnapshot().items.find(item => item.workspaceId === scope.workspaceId)
    const location = researchCitationLocation(scope, address, workspace?.path)
    if (location === undefined) return false
    if (this.actions === undefined) this.pending = { scope, location, leave }
    else this.actions.open(scope.workspaceId, location, leave)
    this.ctx.layout.selectPanel(this.panelId)
    return true
  }
}
