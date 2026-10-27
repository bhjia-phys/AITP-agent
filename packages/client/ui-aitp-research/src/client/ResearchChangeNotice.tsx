/** Factual writer feedback above the native conversation; operation details load only on inspection. */
import { useState } from 'react'
import { Button, DiffBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from './research-change-locales.ts'
import { latestResearchChange, type ResearchChangePointer } from './research-change-model.ts'
import { workspaceChangeAddress } from './workspace-resources.ts'
import type { ResearchChangeView } from './workspace-contract.ts'
import css from './ResearchChangeNotice.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    'aitp.research.change-notice': {
      scope: 'session'
      props: { readonly workspaceId: WorkspaceId }
      locale: 'aitp.research.change'
    }
  }
}
type Props = FactoryComponentPropsOf<'aitp.research.change-notice'>

/** Show only results supplied by the research writer; an assistant's success claim is not a receipt. */
export function ResearchChangeNotice(props: Props) {
  const latest = props.useChat(snapshot => latestResearchChange(snapshot.nodes.values()))
  return latest === null ? null : <NoticeBody key={`${props.sessionId}:${latest.operationId}`} {...props} change={latest} />
}

function NoticeBody(props: Props & { readonly change: ResearchChangePointer }) {
  const [expanded, setExpanded] = useState(false)
  return <section className={css.notice} aria-label={props.t(props.change.state)} data-research-change-notice="">
    <div className={css.summary}>
      <span role="status">{props.t(props.change.state)}</span>
      <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => { setExpanded(!expanded) }}>
        {props.t(expanded ? 'close' : 'inspect')}
      </Button>
    </div>
    {expanded && <ChangeDetails {...props} />}
  </section>
}

function ChangeDetails(props: Props & { readonly change: ResearchChangePointer }) {
  const result = props.useResource<'aitp-workspace-change'>(
    workspaceChangeAddress(props.workspaceId, props.sessionId, props.change.operationId),
  )
  const receipt = result.value
  if (receipt === undefined) return <p className={css.message} role="status">
    {result.status === 'failed' ? result.failure?.message ?? props.t('unavailable') : props.t('loading')}
  </p>
  return <>
    {result.failure !== undefined && <p className={css.message} role="status">{props.t('stale')}</p>}
    <ResearchChangeReceipt receipt={receipt} t={props.t} />
  </>
}

/** The receipt distinguishes actual publication from planned text and independently observed later changes. */
export function ResearchChangeReceipt({ receipt, t }: { readonly receipt: ResearchChangeView; readonly t: Props['t'] }) {
  return <div className={css.details}>
    <p className={css.operation}>{t(receipt.state)}</p>
    {receipt.files.map(file => <FileChange key={file.resourceId} file={file} t={t} />)}
    {receipt.completeness === 'partial' && <p className={css.message}>{t('limited', {
      files: receipt.omittedFiles, diffs: receipt.omittedDiffs, uses: receipt.omittedUses,
    })}</p>}
    {receipt.remainingUses.length > 0 && <div className={css.followUp}>
      <p>{t('followUp')}</p><ul>{receipt.remainingUses.map((item, index) => <li key={index}>{item}</li>)}</ul>
    </div>}
  </div>
}

function FileChange({ file, t }: { readonly file: ResearchChangeView['files'][number]; readonly t: Props['t'] }) {
  const confirmed = file.state === 'applied'
  return <div className={css.file}>
    <p className={css.path}>{file.relativePath}</p>
    <p className={css.message}>{t(confirmed ? 'saved' : 'planned')}</p>
    {file.current?.state === 'different' && <p className={css.message}>{t('different')}</p>}
    {file.current?.state === 'unavailable' && <p className={css.message}>{t('currentUnavailable')}</p>}
    {file.beforeText !== undefined && file.afterText !== undefined
      ? <DiffBlock diffs={[{ path: file.relativePath, oldText: file.beforeText, newText: file.afterText }]} maxLines={18}
        labels={{ codeLabel: t('code'), wrapLabel: t('wrap'), unwrapLabel: t('unwrap'), copy: t('copy'), copied: t('copied'),
          collapseAria: t('collapse'), collapse: t('collapse'),
          expandAria: count => t('expand', { count }), expand: count => t('expand', { count }) }} />
      : <p className={css.message}>{t('omittedDiff')}</p>}
  </div>
}
