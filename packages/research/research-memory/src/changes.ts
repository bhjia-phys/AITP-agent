/** Source-preserving edits shared by human controls and model tools. */
import { randomUUID } from 'node:crypto'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { ScratchWriter } from './writer.ts'
import { parseMarkdown } from './markdown-model.ts'
import type { MarkdownWorkspace } from './markdown.ts'
import type { WriteOperation, ScratchWriterConfig } from './writer-types.ts'
import type {
  ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview, ReadEnvelope,
  RecordedActor, Result, Revision,
} from './types.ts'

/** Keep the authored heading and line separator while accepting either a complete section or its body. */
function replaceSectionBody(original: string, edited: string): string | undefined {
  if (original === edited) return original
  const heading = fromMarkdown(original).children[0]
  if (heading?.type !== 'heading' || heading.position === undefined) return undefined
  const end = heading.position.end.offset
  if (end === undefined) return undefined
  const prefix = original.slice(0, end)
  const separator = /^(?:[\t ]*\r?\n)+/.exec(original.slice(end))?.[0]
    ?? (original.includes('\r\n') ? '\r\n\r\n' : '\n\n')
  const editedHeading = fromMarkdown(edited).children[0]
  const editedEnd = editedHeading?.type === 'heading' ? editedHeading.position?.end.offset : undefined
  const retainsHeading = editedEnd !== undefined
    && edited.slice(0, editedEnd).replace(/\r\n/g, '\n') === prefix.replace(/\r\n/g, '\n')
  const body = retainsHeading
    ? edited.slice(editedEnd).replace(/^(?:[\t ]*\r?\n)+/, '') : edited
  return prefix + separator + body.replace(/\r?\n/g, original.includes('\r\n') ? '\r\n' : '\n')
}

/** Map the interface's supported fields to exact source passages. */
export class ResearchChanges {
  /** Shared scratch writer used by both UI commands and Session-scoped model tools. */
  readonly writer: ScratchWriter
  constructor(private readonly source: MarkdownWorkspace, config: ScratchWriterConfig) {
    this.writer = new ScratchWriter(source, config)
  }

  /**
   * Prepare a literal replacement only when the displayed field has a source passage.
   * @param intent - proposed field text and its topic; observation tokens are not edit authorization.
   * @returns retained exact passages and remaining integration, or an explicit unsupported/source failure.
   */
  async preview(intent: ChangeIntent): Promise<Result<ReadEnvelope<ChangePreview>>> {
    const read = await this.source.getTopic(intent.topicId)
    if (!read.ok) return read
    const topic = read.value.value
    if (topic.accountResourceId === undefined) return this.unsupported('This topic has no addressable source account.')
    let before: string
    let after: string
    if (intent.command.kind === 'update-scope') {
      before = topic.scope
      after = intent.command.scope
    } else if (intent.command.kind === 'record-answer' && topic.currentAnswer !== null) {
      before = topic.currentAnswer.text
      const qualification = topic.currentAnswer.qualification
      if (qualification && !before.includes(qualification)) {
        return this.unsupported('This answer has separate conditions. Read and edit its complete source passage together.')
      }
      after = intent.command.text.replace(/\r?\n/g, before.includes('\r\n') ? '\r\n' : '\n')
      if (qualification) {
        const replacement = replaceSectionBody(qualification, intent.command.qualification)
        if (replacement === undefined) return this.unsupported('The conditions have no unambiguous authored heading. Prepare an exact source-passage edit instead.')
        const submitted = parseMarkdown('research.md', after).sections
          .filter(section => /^(limitations?|open questions?|局限|未解决问题|缺口)$/i.test(section.title))
        if (submitted.length > 1) return this.unsupported('The answer repeats its conditions. Resolve the duplicate condition sections before previewing.')
        const inAnswer = submitted[0]
        if (inAnswer !== undefined) {
          const original = parseMarkdown('research.md', qualification).sections[0]
          if (original?.title !== inAnswer.title) return this.unsupported('The answer changed its condition heading. Prepare an exact source-passage edit instead.')
          const answerReplacement = replaceSectionBody(qualification, inAnswer.text)
          if (answerReplacement === undefined || after.indexOf(inAnswer.text) !== after.lastIndexOf(inAnswer.text)) {
            return this.unsupported('The conditions in the answer cannot be mapped to one exact passage. Prepare an exact source-passage edit instead.')
          }
          const answerChanged = answerReplacement !== qualification
          const fieldChanged = replacement !== qualification
          if (answerChanged && fieldChanged && answerReplacement !== replacement) {
            return this.unsupported('The answer text and the separate conditions field contain different edits. Reconcile them before previewing.')
          }
          after = after.replace(inAnswer.text, () => fieldChanged ? replacement : answerReplacement)
        } else {
          const separator = /(?:[\t ]*\r?\n)+$/.exec(before.slice(0, before.indexOf(qualification)))?.[0] ?? '\n\n'
          after = after.replace(/[\t \r\n]+$/, '') + separator + replacement
        }
      }
    } else return this.unsupported('This command has no unambiguous source mapping. Prepare an exact source-passage edit instead.')
    if (!before.trim()) return this.unsupported('This field has no recorded source passage to replace.')
    const section = replaceSectionBody(before, after)
    if (section === undefined) return this.unsupported('This field has no unambiguous authored section heading. Prepare an exact source-passage edit instead.')
    after = section
    const result = await this.writer.prepare({ disposition: before === after ? 'no-change' : 'edit',
      rationale: intent.reason ?? 'Researcher edited the displayed source passage.',
      edits: before === after ? [] : [{ resourceId: topic.accountResourceId, originalText: before, replacementText: after,
        rationale: intent.reason ?? 'Researcher edited the displayed source passage.', sourceRefs: [topic.accountResourceId] }],
      remainingUses: ['Inspect the complete argument and any parent passages whose meaning is affected.'],
    })
    if (!result.ok) return result
    return { ok: true, value: this.envelope({ previewId: result.value.operationId, summary: result.value.proposal.rationale,
      bases: [{ target: { kind: 'topic', id: intent.topicId }, revision: read.value.revision }],
      edits: result.value.files.map(file => ({ target: { kind: 'resource' as const, id: file.resourceId }, label: file.relativePath, before: file.beforeText, after: file.afterText })),
      pendingIntegration: result.value.proposal.remainingUses,
    }) }
  }

  /**
   * Apply a bound operation and distinguish partial publication from an unknown outcome.
   * @param request - preview identity and stable retry key.
   * @param actor - authenticated UI actor; model-bound proposals use their owning Session tools instead.
   * @returns historical publication separated from current source observations, or a typed uncertain/refused result.
   */
  async apply(request: ApplyRequest, actor: RecordedActor): Promise<Result<ReadEnvelope<ApplyReceipt>>> {
    const prepared = await this.writer.recover(request.previewId)
    if (!prepared.ok) return prepared
    if (prepared.value.proposal.binding !== undefined) return { ok: false, error: { code: 'read-only', message: 'A conversation proposal must be applied from its owning conversation with its current permissions.', retryable: false } }
    const result = await this.writer.apply(request.previewId, request.operationId)
    if (!result.ok) return result
    const operation = result.value
    const changed = operation.files.filter(file => file.state === 'applied').map(file => ({
      target: { kind: 'resource' as const, id: file.resourceId },
      revision: `publication:${operation.operationId}:${file.resourceId}` as Revision,
    }))
    if (operation.state === 'unknown' || operation.state === 'applying') return { ok: false, error: { code: 'outcome-unknown', operationId: request.operationId, message: 'The write outcome is uncertain. Inspect the retained operation before retrying.' } }
    if (operation.state === 'partial') return { ok: false, error: { code: 'partial-apply', operationId: request.operationId,
      message: 'Only the named files were confirmed written; remaining changes need review.', changed,
      remaining: operation.files.filter(file => file.state !== 'applied').map(file => ({ kind: 'resource', id: file.resourceId })),
    } }
    if (operation.state !== 'applied' && operation.state !== 'no-change') return { ok: false, error: { code: 'unavailable', retryable: false,
      message: operation.files.find(file => file.diagnostic)?.diagnostic?.message ?? 'The source change was not applied.' } }
    return { ok: true, value: this.envelope({ operationId: request.operationId, changeId: operation.operationId,
      committedAt: operation.updatedAt, actor, changed, sourceObservations: await this.observeApplied(operation) }) }
  }

  private async observeApplied(operation: WriteOperation): Promise<NonNullable<ApplyReceipt['sourceObservations']>> {
    const observations: NonNullable<ApplyReceipt['sourceObservations']>[number][] = []
    for (const file of operation.files) {
      if (file.state !== 'applied') continue
      const read = await this.source.readSource(file.resourceId)
      observations.push({ target: { kind: 'resource', id: file.resourceId },
        state: read.ok ? (read.value.text === file.afterText ? 'matches-applied' : 'different') : 'unavailable',
        ...(read.ok ? { revision: read.value.revision } : {}),
      })
    }
    return observations
  }

  private revision(): Revision { return `observation:${randomUUID()}` as Revision }
  private envelope<T>(value: T): ReadEnvelope<T> { return { origin: 'runtime', revision: this.revision(), observedAt: new Date().toISOString(), value } }
  private unsupported(message: string): Result<never> { return { ok: false, error: { code: 'unsupported', message, retryable: false } } }
}
