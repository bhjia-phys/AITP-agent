/** Session header action: where the Session started and the Sources & memory toggle. */
import type { ReactNode } from 'react'
import { IconContextInjectionOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { memoryAddress, type SessionOrigin } from './protocol.ts'
import type { MemoryActionsFace } from './TaskCard.tsx'
import type {} from './locales.ts'
import css from './memory.module.css'

/** Full props of the header action. */
export type OriginActionProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<'aitp.session'> & InjectFace<MemoryActionsFace>

/**
 * Origin wording for the header.
 * @param t - namespace translate.
 * @param origin - recorded Session origin.
 * @returns the label.
 */
export function originText(t: TranslateNS<'aitp.session'>, origin: SessionOrigin): string {
  switch (origin.kind) {
    case 'topic': return origin.thread === undefined ? origin.topic : `${origin.topic} › ${origin.thread}`
    case 'source': return origin.label
    case 'global': return t('origin.global')
  }
}

/**
 * Render the origin and the Sources & memory button once the Session has a memory provider.
 * @param props - header runtime, locale and actions.
 * @returns the action, or nothing without a provider.
 */
export function OriginAction({ t, sessionId, useResource, openMemory }: OriginActionProps): ReactNode {
  const memory = useResource<'aitp-session'>(memoryAddress(sessionId))
  if (memory.status === 'none') return null
  const origin = memory.value?.sessionOrigin
  return (
    <span className={css.originAction}>
      {origin !== undefined && (
        <span className={css.origin} title={`${t('origin.label')}: ${originText(t, origin)}`}>{originText(t, origin)}</span>
      )}
      <Tooltip label={t('memory')} side="bottom" align="end">
        <button type="button" className={css.memoryTrigger} aria-label={t('memory')} onClick={openMemory}>
          <IconContextInjectionOutlineRegular size={16} />
        </button>
      </Tooltip>
    </span>
  )
}
