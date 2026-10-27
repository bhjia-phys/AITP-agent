/** A removable authenticated transport, with framework-owned reading state. */
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { StudyArtifact, StudyArtifactId, StudyArtifactPage, StudyArtifactQuery, StudyArtifactReceipt, StudyFailure, StudyResult, StudySetup } from '@deepseek-ai/dsh-research-study/types'
import type { StudyOperation } from './store.ts'

/** Authenticated owner operations consumed by study resources and explicit commands. */
export interface StudyTransport {
  setup(signal: AbortSignal): Promise<StudyResult<StudySetup>>
  list(query: StudyArtifactQuery, signal: AbortSignal): Promise<StudyResult<StudyArtifactPage>>
  read(id: StudyArtifactId, signal: AbortSignal): Promise<StudyResult<StudyArtifact>>
  write(operation: StudyOperation, signal: AbortSignal): Promise<StudyResult<StudyArtifactReceipt>>
  export(id: StudyArtifactId, signal: AbortSignal): Promise<StudyResult<{ readonly markdown: string; readonly filename: string }>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'aitp/study': StudyFailure }
}

/** Generation-owned study transport; saved bodies remain in framework resources. */
export class StudyConnection {
  private transport: StudyTransport | undefined
  private readonly listeners = new Set<() => void>()
  constructor(private readonly message: () => string, private readonly report: (error: unknown) => void) {}

  /**
   * Bind one generated namespace adapter until its owner leaves.
   * @param transport - the current authenticated owner adapter.
   * @returns a disposer withdrawing this exact generation.
   */
  bind(transport: StudyTransport): () => void {
    if (this.transport !== undefined) throw new Error('Study transport already connected')
    this.transport = transport
    this.changed()
    return () => { if (this.transport === transport) { this.transport = undefined; this.changed() } }
  }

  /** Request fresh observations after an explicit save or refresh. */
  changed(): void { for (const listener of this.listeners) listener() }

  /**
   * Read or mutate operational drafts through their current owner.
   * @param operation - one owner method without a second cache.
   * @param operationId - a mutation's stable uncertainty identity.
   * @returns the real acknowledgement or a retained unavailable/unknown result.
   */
  async run<T>(operation: (transport: StudyTransport) => Promise<StudyResult<T>>, operationId?: string): Promise<StudyResult<T>> {
    if (this.transport === undefined) return this.unavailable()
    try { return await operation(this.transport) }
    catch (error) {
      this.report(error)
      return operationId === undefined ? this.unavailable()
        : { ok: false, error: { code: 'unknown', message: this.message(), retryable: false, operationId } }
    }
  }

  /**
   * Publish authoritative readings after binding and explicit invalidation.
   * @param signal - the resource owner's lifetime.
   * @param read - the bounded owner reading.
   * @returns observed values and honest failures, refreshed only on invalidation.
   */
  async *frames<T>(
    signal: AbortSignal,
    read: (transport: StudyTransport, signal: AbortSignal) => Promise<StudyResult<T>>,
  ): AsyncIterable<RemoteResult<T>> {
    let generation = 0
    let dirty = true
    let wake: (() => void) | undefined
    let current: AbortController | undefined
    const changed = (): void => { generation += 1; dirty = true; current?.abort(); wake?.() }
    const stop = (): void => { current?.abort(); wake?.() }
    this.listeners.add(changed)
    signal.addEventListener('abort', stop, { once: true })
    try {
      while (!signal.aborted) {
        if (!dirty) await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- The owner may abort during the awaited wake-up.
        if (signal.aborted) return
        dirty = false
        const revision = generation
        const transport = this.transport
        if (transport === undefined) { yield studyFailure(this.unavailable().error); continue }
        const lifetime = new AbortController()
        current = lifetime
        let cancel: (() => void) | undefined
        const cancelled = new Promise<undefined>((resolve) => {
          cancel = () => { resolve(undefined) }
          lifetime.signal.addEventListener('abort', cancel, { once: true })
        })
        let result: StudyResult<T> | undefined
        try { result = await Promise.race([read(transport, lifetime.signal), cancelled]) }
        catch (error) { if (!lifetime.signal.aborted) { this.report(error); result = this.unavailable() } }
        finally {
          if (cancel !== undefined) lifetime.signal.removeEventListener('abort', cancel)
          if (current === lifetime) current = undefined
        }
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Source reads yield to external cancellation.
        if (signal.aborted) return
        if (revision !== generation || result === undefined) continue
        yield result.ok ? { ok: true, value: result.value } : studyFailure(result.error)
      }
    } finally { current?.abort(); this.listeners.delete(changed); signal.removeEventListener('abort', stop) }
  }

  private unavailable(): { readonly ok: false; readonly error: StudyFailure } {
    return { ok: false, error: { code: 'unavailable', message: this.message(), retryable: true } }
  }
}

/**
 * Preserve an owner failure in the framework resource error channel.
 * @param error - the study owner's structured rejection.
 * @returns an unsuccessful resource frame carrying the original details.
 */
export function studyFailure(error: StudyFailure): RemoteResult<never> {
  return { ok: false, error: new RemoteError('aitp/study', error.message, error) }
}
