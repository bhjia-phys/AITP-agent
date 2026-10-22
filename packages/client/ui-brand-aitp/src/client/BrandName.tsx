/** Sidebar identity rendered through the host's existing brand slot. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Props supplied by the slot renderer and locale provider. */
type BrandNameProps = PropsRuntime<'sidebar.brand.name'> & PropsLocale<'aitp.brand'>

/**
 * Render the application name independently of provider selection.
 * @param props - Host slot props and localized copy.
 * @returns the product name.
 */
export function BrandName({ t }: BrandNameProps) {
  return <span>{t('name')}</span>
}
