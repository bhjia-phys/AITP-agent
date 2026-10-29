/** Native model tools for explicit material locations and authorized file publication. */
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SourceId, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from './material-service.ts'
import type { MaterialAssociation, MaterialWriteReceipt } from './material-types.ts'
import type { Result, TopicId } from './types.ts'
import { resourceIdForPath } from './markdown-files.ts'

const associationParameter = { type: 'object' as const, additionalProperties: false as const,
  description: 'Optional ordinary Markdown account or index receiving a link and your stated use. No association is written when omitted.',
  properties: { accountPath: { type: 'string' as const, required: true as const },
    title: { type: 'string' as const, required: true as const }, description: { type: 'string' as const } } }
const destinationParameters = {
  operationId: { type: 'string' as const, required: true as const,
    description: 'Stable 1–128 character operation identity using letters, digits, underscores or hyphens. Reuse it unchanged to inspect or retry this exact request.' },
  relativePath: { type: 'string' as const, required: true as const,
    description: 'Explicit adopted destination relative to the current research root, including filename. Existing names are never replaced.' },
  association: associationParameter,
}
const output = {
  schema: { type: 'object' as const, additionalProperties: false as const,
    properties: { text: { type: 'string' as const, required: true as const } } },
  render: (_args: unknown, value: { text: string }) => [{ type: 'text' as const, text: value.text }],
}

function bounded(value: unknown, maximum: number): { text: string } {
  const result = { text: JSON.stringify(value) }
  if (JSON.stringify(result).length > maximum) throw new Error('The complete material result exceeds the configured output bound. Use a shorter destination or inspect this operation through the workbench.')
  return result
}

function unwrap<T>(result: Result<T>, maximum: number): T {
  if (!result.ok) {
    const text = `Material operation refused (${result.error.code}): ${result.error.message}`
    throw new Error(JSON.stringify({ text }).length <= maximum ? text : `Material operation refused (${result.error.code}). Inspect the selected source and destination.`)
  }
  return result.value
}

function publication(result: MaterialWriteReceipt, maximum: number): { text: string } {
  if (JSON.stringify({ text: JSON.stringify(result) }).length <= maximum) return bounded(result, maximum)
  return bounded({ ...result, issues: [], issuesOmitted: true }, maximum)
}

function reserveOutput(operationId: string, relativePath: string, association: MaterialAssociation | undefined, maximum: number): void {
  bounded({ operationId, relativePath, resourceId: resourceIdForPath(relativePath), mediaType: 'application/pdf',
    byteLength: Number.MAX_SAFE_INTEGER,
    file: { state: 'not-saved', readBack: { state: 'unavailable', observedAt: '9999-12-31T23:59:59.999Z', byteLength: Number.MAX_SAFE_INTEGER } },
    association: { state: 'not-requested', ...(association === undefined ? {} : { accountPath: association.accountPath }) },
    retry: 'new-operation', issues: [], issuesOmitted: true }, maximum)
}

/**
 * Register native tools bound to the current owner-authorized research conversation.
 * @param ctx - existing materials, tools and Session projection services.
 * @param options - complete serialized output bound; at least 1024 characters.
 * @returns disposer for all material tool registrations.
 */
export function installMaterialTools(ctx: Context, options: { readonly maxResultCharacters: number }): () => void {
  const maximum = options.maxResultCharacters
  if (!Number.isSafeInteger(maximum) || maximum < 1024) throw new Error('Material tool results require maxResultCharacters of at least 1024.')
  const active = (exec: ToolExecution) => {
    exec.signal.throwIfAborted()
    const agent = exec.agent
    if (agent === undefined) throw new Error('Material tools require an active research conversation.')
    const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')
    const origin = state?.origin
    if (!state?.ownerOrigin || state.restricted || origin === null || origin === undefined
      || agent.session.header.parentSession !== undefined || agent.session.header.origin === 'subagent') {
      throw new Error('Material tools require the current owner-authorized conversation; restricted and delegated conversations cannot broaden source access.')
    }
    if (origin.scope === 'global' || origin.workspaceId === undefined) {
      throw new Error('Choose the intended research workspace before selecting or saving a material destination.')
    }
    const materials = ctx.get('researchMaterialFiles')
    if (materials === undefined) throw new Error('The research material service is unavailable.')
    return { agent, materials, scope: { workspaceId: brandString<WorkspaceId>(origin.workspaceId),
      ...(origin.topicId === undefined ? {} : { topicId: brandString<TopicId>(origin.topicId) }) } }
  }
  const destination = async (exec: ToolExecution) => {
    const selected = active(exec)
    const location = unwrap(await selected.materials.getLocation(selected.scope, exec.signal), maximum)
    const root = await realpath(location.rootPath)
    const authorize = async (): Promise<void> => {
      const current = active(exec)
      if (current.agent.session !== selected.agent.session || current.scope.workspaceId !== selected.scope.workspaceId
        || current.scope.topicId !== selected.scope.topicId) throw new Error('The research destination changed while this operation was waiting. No material was saved.')
      const latest = unwrap(await current.materials.getLocation(current.scope, exec.signal), maximum)
      if (!latest.writable || await realpath(latest.rootPath) !== root) {
        throw new Error('The selected material root changed or no longer permits writing.')
      }
      const policyService = ctx.get('sandboxPolicy')
      if (policyService === undefined) throw new Error('The current Session file policy is unavailable; material writing is disabled.')
      const policy = policyService.resolve({ session: current.agent.session })
      if (policy.mode === 'read-only') throw new Error('The current Session file policy is read-only; no material was saved.')
      if (policy.mode === 'workspace-write') {
        const suffix = relative(await realpath(policy.workspaceRoot), root)
        if (suffix !== '' && (isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`))) {
          throw new Error('The selected material root is outside this Session workspace-write boundary.')
        }
      }
      exec.signal.throwIfAborted()
    }
    await authorize()
    return { ...selected, authorize }
  }
  const disposers = [ctx.tools.register(defineTool({
    name: 'research_material_location',
    description: 'Read the actual main record, directory and current write availability for this conversation\'s research topic. Existing local and shared material links remain authoritative; this tool does not choose a new directory or grant write access.',
    parameters: {}, output,
    async execute(_args, exec) {
      const selected = active(exec)
      return bounded(unwrap(await selected.materials.getLocation(selected.scope, exec.signal), maximum), maximum)
    },
  })), ctx.tools.register(defineTool({
    name: 'research_save_material',
    description: 'Save an explicitly authored note, derivation, code artifact or result at an adopted new path in this conversation\'s research root. Optionally append an ordinary Markdown link and stated use. Existing files are never overwritten. File publication, account linking and current read-back are reported separately. Reuse the same operationId and exact request after interruption; an unknown outcome requires inspection and is never replayed automatically. A saved file is not scientific acceptance.',
    parameters: { ...destinationParameters, text: { type: 'string', required: true } }, output,
    presentCall: args => ({ card: 'generic', kind: 'edit', title: `Save research material · ${args.relativePath}` }),
    async execute(args, exec) {
      reserveOutput(args.operationId, args.relativePath, args.association, maximum)
      const selected = await destination(exec)
      const result = await selected.materials.publishForAgent({ ...selected.scope, kind: 'text', text: args.text,
        operationId: args.operationId, relativePath: args.relativePath,
        ...(args.association === undefined ? {} : { association: args.association }) }, selected.authorize, exec.signal)
      return publication(unwrap(result, maximum), maximum)
    },
  })), ctx.tools.register(defineTool({
    name: 'research_import_pdf',
    description: 'Import original bytes from an explicitly selected authorized PDF source to an adopted new .pdf path in this conversation\'s research root. Supply the exact rootId/sourceId from an admitted source; this never grants new source access or moves the original. Optional account linking is a separate outcome. Reuse the same operationId and request on retry; inspect unknown outcomes before another write.',
    parameters: { ...destinationParameters, source: { type: 'object', required: true, additionalProperties: false,
      properties: { rootId: { type: 'string', required: true }, sourceId: { type: 'string', required: true } } } }, output,
    presentCall: args => ({ card: 'generic', kind: 'edit', title: `Import research PDF · ${args.relativePath}` }),
    async execute(args, exec) {
      reserveOutput(args.operationId, args.relativePath, args.association, maximum)
      const selected = await destination(exec)
      const result = await selected.materials.publishForAgent({ ...selected.scope, kind: 'pdf',
        source: { rootId: brandString<SourceRootId>(args.source.rootId), sourceId: brandString<SourceId>(args.source.sourceId) },
        operationId: args.operationId, relativePath: args.relativePath,
        ...(args.association === undefined ? {} : { association: args.association }) }, selected.authorize, exec.signal)
      return publication(unwrap(result, maximum), maximum)
    },
  }))]
  return () => { for (const dispose of disposers.toReversed()) dispose() }
}
