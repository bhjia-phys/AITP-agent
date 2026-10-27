/** Human-readable names for the provider's explicitly observed entry kinds. */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

/** Preserve unrecognized authored classifications verbatim. */
export function knowledgeKind(kind: string | undefined, t: PropsLocale<'aitp.materials.knowledge'>['t']): string {
  switch (kind) {
    case 'index': return t('kindIndex')
    case 'atom': return t('kindAtom')
    case 'source-reading': return t('kindReading')
    case 'story': return t('kindStory')
    case 'author-collection': return t('kindAuthor')
    case 'provisional-pointer': return t('kindProvisional')
    case 'entry': case undefined: return t('kindEntry')
    default: return kind
  }
}

/** Present recognized source metadata without inferring a review or evidence claim. */
export function knowledgeFact(field: 'support' | 'review', value: string | undefined, t: PropsLocale<'aitp.materials.knowledge'>['t']): string | undefined {
  if (field === 'support') {
    if (value === 'source') return t('supportSource')
    if (value === 'reconstructed') return t('supportReconstructed')
  }
  if (field === 'review' && value === 'awaiting') return t('reviewAwaiting')
  return value
}
