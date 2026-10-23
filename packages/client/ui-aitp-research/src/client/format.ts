/** Pure formatting for research views: locator labels, observation times and session drafts. */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SourceLocator } from './protocol.ts'
import type {} from './locales.ts'

type T = TranslateNS<'aitp.research'>

/**
 * Short locator label such as `research.md · L7–11` or `research.md#stopping-rule`.
 * @param t - namespace translate.
 * @param locator - passage locator.
 * @returns the label.
 */
export function locatorLabel(t: T, locator: SourceLocator): string {
  const file = locator.path.slice(locator.path.lastIndexOf('/') + 1)
  if (locator.anchor !== undefined) return `${file}#${locator.anchor}`
  if (locator.lines === undefined) return file
  const [first, last] = locator.lines
  return `${file} · ${first === last ? t('source.line', { first }) : t('source.lines', { first, last })}`
}

/**
 * Observation time: clock time today, date and time otherwise.
 * @param iso - ISO-8601 instant from the provider.
 * @param now - reference instant.
 * @returns a localized label, or the input unchanged when it is not a date.
 */
export function observedLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  const sameDay = at.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}

/**
 * Initial Session draft that cites a note through the Harness `@path` mention.
 * @param t - namespace translate.
 * @param path - workspace-relative note path.
 * @param anchor - optional anchor to cite.
 * @returns the draft text, ending where the researcher continues typing.
 */
export function draftPrompt(t: T, path: string, anchor?: string): string {
  const mention = /\s/u.test(path) ? `@"${path}"` : `@${path}`
  return t('draft.prompt', { mention, anchor: anchor === undefined ? '' : ` (#${anchor})` })
}
