/** Explicit enrollment and write choice for the selected Harness Workspace. */
import { useId, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResearchInitializeRequest, ResearchSetup, Result } from './workspace-contract.ts'
import css from './onboarding.module.css'

/**
 * Offer project enrollment without reading or enrolling a directory on navigation.
 * @param props - authoritative setup, localized copy and explicit enrollment action.
 * @returns the setup form with retained failures and a read/write choice.
 */
export function WorkspaceSetup({ t, setup, initialize, retry, loading = false, unavailable = false }: {
  t: TranslateNS<'aitp.research'>
  setup?: ResearchSetup | undefined
  initialize?: ((request: ResearchInitializeRequest) => Promise<Result<ResearchSetup>>) | undefined
  retry: () => void
  loading?: boolean
  unavailable?: boolean
}): ReactNode {
  const id = useId()
  const [writable, setWritable] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const occupied = useRef(false)
  const saving = setup?.configured === true
  return <section className={css.setup} aria-labelledby={id} aria-busy={pending || loading}>
    <h2 id={id}>{t(saving ? 'setup.savingTitle' : 'setup.title')}</h2>
    <p>{t(saving ? 'setup.savingBody' : 'setup.body')}</p>
    {unavailable && <p role="alert">{t('setup.unavailable')}</p>}
    <Checkbox checked={writable} onChange={setWritable} disabled={pending || loading}
      label={t('setup.writable')} />
    <p className={css.hint}>{t(writable ? 'setup.writeHint' : 'setup.readHint')}</p>
    <div className={css.actions}>
      <Button variant="primary" disabled={pending || loading || (saving && !writable)}
        icon={pending ? <StateDot state="ongoing" size={16} /> : undefined}
        onClick={() => {
          if (occupied.current) return
          if (initialize === undefined) { setError(t('setup.unsupported')); return }
          occupied.current = true
          setPending(true)
          setError(undefined)
          void initialize({ writable }).then((result) => {
            if (!result.ok) setError(result.error.code === 'unsupported' ? t('setup.unsupported') : result.error.message)
          }, () => { setError(t('setup.failed')) }).finally(() => { occupied.current = false; setPending(false) })
        }}>{t(pending ? 'setup.enabling' : saving ? 'setup.enableSaving' : 'setup.enable')}</Button>
      {unavailable && <Button variant="ghost" disabled={pending || loading} onClick={retry}>{t('workspace.retry')}</Button>}
    </div>
    {error !== undefined && <p className={css.error} role="alert">{error}</p>}
  </section>
}
