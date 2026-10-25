/** Cursor pages of one topic query, merged into one list that keeps its limits visible. */
import type { ReactNode } from 'react'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { Notice } from './states.tsx'
import { disclosureKey } from './store.ts'
import type { TopicQuery, TopicSummary } from './workspace-contract.ts'
import { workspaceTopicsAddress } from './workspace-resources.ts'
import type { WorkspaceViewProps } from './WorkspaceViews.tsx'
import css from './workspace.module.css'

/** The merged reading of one topic query. */
export interface TopicListing {
  /** Loaded topics in provider order, without duplicates. */
  readonly items: readonly TopicSummary[]
  /** A page was marked partial, or a further page is unread. */
  readonly partial: boolean
  /** The provider's explanation of a partial page, when it gave one. */
  readonly reason: string | undefined
  /** Reads the next page; absent when no page remains or the next page is being read. */
  readonly more: (() => void) | undefined
  /**
   * `loading` and `failed` describe the next page; `stale` means a page could
   * not be refreshed and shows its last reading.
   */
  readonly status: 'ready' | 'loading' | 'failed' | 'stale'
}

type ListingProps = Pick<WorkspaceViewProps, 'workspaceId' | 'useResource' | 'useStore' | 'actions'> & {
  query: TopicQuery
  /** Rendered instead of the list when the first page has no value. */
  unavailable: (snapshot: ResourceSnapshot<unknown>) => ReactNode
  children: (listing: TopicListing) => ReactNode
}

type PageProps = ListingProps & {
  cursor: string | undefined
  previous: readonly TopicSummary[]
  partial: boolean
  reason: string | undefined
  stale: boolean
}

/**
 * Read a topic query page by page; only the reader's request reads the next
 * page, and the request is kept so a return shows the same pages.
 * @param props - the query, framework reads, view store and the renderers for the list and its absence.
 * @returns the rendered listing.
 */
export function TopicListingView(props: ListingProps): ReactNode {
  return <ListingPage {...props} cursor={undefined} previous={[]} partial={false} reason={undefined} stale={false} />
}

function ListingPage(props: PageProps): ReactNode {
  const key = disclosureKey(props.workspaceId, 'listing', JSON.stringify(props.query), props.cursor ?? '')
  const more = props.useStore(state => state.disclosure[key] ?? false)
  const query = props.cursor === undefined ? props.query : { ...props.query, cursor: props.cursor }
  const result = props.useResource<'aitp-workspace-topics'>(workspaceTopicsAddress(props.workspaceId, query))
  if (result.value === undefined) {
    if (props.cursor === undefined) return props.unavailable(result)
    return props.children({
      items: props.previous, partial: true, reason: props.reason, more: undefined,
      status: result.status === 'loading' ? 'loading' : 'failed',
    })
  }
  const page = result.value.value
  const items = [...new Map([...props.previous, ...page.items.map(item => item.value)].map(topic => [topic.id, topic])).values()]
  const partial = props.partial || page.completeness === 'partial'
  const reason = props.reason ?? page.incompleteReason
  const stale = props.stale || result.status === 'failed'
  const cursor = page.nextCursor
  if (more && cursor !== null) {
    return <ListingPage key={cursor} {...props} cursor={cursor} previous={items} partial={partial} reason={reason} stale={stale} />
  }
  return props.children({
    items, partial: partial || cursor !== null, reason,
    more: cursor === null ? undefined : () => { props.actions.setDisclosed(key, true) },
    status: stale ? 'stale' : 'ready',
  })
}

/**
 * The limits of a listing: a stale reading, a partial page, the next page and its failure.
 * @param props - localized copy, the listing, retry and the label of the next-page action.
 * @returns the listing's status controls, or nothing for a complete fresh listing.
 */
export function ListingStatus({ t, listing, retry, moreLabel }: {
  t: TranslateNS<'aitp.research'>
  listing: TopicListing
  retry: () => void
  moreLabel: string
}): ReactNode {
  const reason = listing.reason ?? (listing.partial && listing.more === undefined && listing.status !== 'loading' && listing.status !== 'failed'
    ? t('workspace.partial') : undefined)
  return <div className={css.listing}>
    {listing.status === 'stale' && <Notice>{t('workspace.retained')} <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></Notice>}
    {reason !== undefined && <p className={css.note}>{reason}</p>}
    {listing.status === 'loading' && <span role="status" aria-label={t('state.loading')}><StateDot state="ongoing" /></span>}
    {listing.status === 'failed' && <p className={css.inlineState} role="status">{t('map.moreFailed')}
      <button type="button" className={css.linkButton} onClick={retry}>{t('workspace.retry')}</button></p>}
    {listing.more !== undefined && <Button variant="ghost" size="sm" onClick={listing.more}>{moreLabel}</Button>}
  </div>
}
