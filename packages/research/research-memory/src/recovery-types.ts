/** Host-only recovery callbacks; portable origin declarations do not import Host Session services. */
import type { Session } from '@deepseek-ai/dsh-session'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { ResearchOrigin, ResearchContextRead } from './working-types.ts'

/** Scoped historical evidence; it never carries executable grants or another conversation's tools. */
export interface ResearchRecovery {
  recover(origin: ResearchOrigin, current: Session, signal?: AbortSignal, proposed?: readonly UserMessage[]): Promise<ResearchContextRead>
  readOriginal(origin: ResearchOrigin, current: Session, sourceId: string, offset: number,
    signal?: AbortSignal): Promise<string | undefined>
}
