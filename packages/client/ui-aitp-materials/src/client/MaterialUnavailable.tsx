/** Shared material read failures without depending on a library panel. */
import type { ReactNode } from 'react'
import { Button, IconLoadingOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { MaterialsPanelProps } from './MaterialsPanel.tsx'
import css from './materials.module.css'

/**
 * Report the real missing-provider, loading or failed source state.
 * @param props - localized copy and the current framework resource status.
 * @returns a stable recovery action without clearing the draft.
 */
export function MaterialUnavailable(props: Pick<MaterialsPanelProps, 't' | 'refresh'> & { snapshot: ResourceSnapshot<unknown>; list?: boolean }): ReactNode {
  if (props.snapshot.status === 'loading' && props.list) return <div className={css.skeleton} role="status" aria-label={props.t('loading')}>
    {[0, 1, 2, 3].map(row => <div key={row} aria-hidden="true"><span /><span /></div>)}
  </div>
  if (props.snapshot.status === 'loading') return <div className={css.loading} role="status" aria-label={props.t('loadingSource')}>
    <IconLoadingOutlineRegular size={24} /><span>{props.t('loadingSource')}</span>
  </div>
  const failure = props.snapshot.failure
  const code = failure?.code === 'aitp/materials' ? failure.details.code : undefined
  const messageKey = code === 'permission-denied' ? 'denied' : code === 'not-found' ? 'missing'
    : props.snapshot.status === 'none' ? 'disconnected' : 'readFailed'
  return <div className={css.notice} role="alert">
    <p>{props.t(messageKey)}</p>
    {failure !== undefined && <details className={css.observation}><summary>{props.t('errorDetails')}</summary><p>{failure.message}</p></details>}
    <Button variant="outline" size="sm" onClick={props.refresh}>{props.t('retry')}</Button>
  </div>
}
