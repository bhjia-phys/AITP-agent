/**
 * Reading-region focus and scroll across panel navigation. A location's
 * content may still be loading when it is committed, so arrival waits for the
 * element marked `data-arrival`, which every settled reading state renders.
 */
import { focusWithoutRing } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResearchArrival, ResearchReturnPoint } from './store.ts'

/** Controls that take part in the reading region's Tab order. */
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * The reading region's focusable controls in document order.
 * @param region - the reading region.
 * @returns its controls.
 */
function focusables(region: HTMLElement): HTMLElement[] {
  return [...region.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

/**
 * Record where the reader is before leaving the current location.
 * @param region - the reading region, or null before it mounts.
 * @returns the scroll offset and the focused control's position, if focus is inside the region.
 */
export function returnPoint(region: HTMLElement | null): ResearchReturnPoint {
  if (region === null) return { scrollTop: 0, focusIndex: null }
  const active = region.ownerDocument.activeElement
  const index = active instanceof HTMLElement && region.contains(active) ? focusables(region).indexOf(active) : -1
  return { scrollTop: region.scrollTop, focusIndex: index < 0 ? null : index }
}

/**
 * Apply an arrival once the region shows settled content for it.
 * @param region - the reading region, or null before it mounts.
 * @param arrival - what to do on arrival.
 * @returns a disposer that stops waiting.
 */
export function settleArrival(region: HTMLElement | null, arrival: ResearchArrival): () => void {
  if (region === null || arrival.kind === 'none') return () => {}
  if (arrival.kind === 'enter') region.scrollTop = 0
  const apply = (): boolean => {
    const landing = region.querySelector<HTMLElement>('[data-arrival]')
    if (landing === null) return false
    if (arrival.kind === 'return') {
      region.scrollTop = arrival.scrollTop
      const control = arrival.focusIndex === null ? undefined : focusables(region)[arrival.focusIndex]
      focusWithoutRing(control ?? landing, { preventScroll: true })
    } else if (arrival.focus) {
      focusWithoutRing(landing, { preventScroll: true })
    }
    return true
  }
  if (apply()) return () => {}
  const observer = new MutationObserver(() => { if (apply()) observer.disconnect() })
  observer.observe(region, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}
