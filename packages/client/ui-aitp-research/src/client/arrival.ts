/**
 * Reading-region focus and scroll across panel navigation. A location's
 * content may still be loading when it is committed, and a resource released
 * by the previous location can reload once after its first render, so arrival
 * waits for the element marked `data-arrival`, which every settled reading
 * state renders, and re-applies while content is replaced or still arriving.
 * The reader's first wheel, touch, pointer or key input ends the arrival.
 */
import { focusWithoutRing } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ResearchArrival, ResearchReturnPoint } from './store.ts'

/** Controls that take part in the reading region's Tab order. */
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** Input that hands the reading position and focus back to the reader. */
const INTERRUPTIONS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

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
 * Apply an arrival once the region shows settled content for it, and keep it
 * applied while that content is replaced or completed, until the reader acts.
 * @param region - the reading region, or null before it mounts.
 * @param arrival - what to do on arrival.
 * @returns a disposer that stops the arrival.
 */
export function settleArrival(region: HTMLElement | null, arrival: ResearchArrival): () => void {
  if (region === null || arrival.kind === 'none') return () => {}
  if (arrival.kind === 'enter') region.scrollTop = 0
  let focused: HTMLElement | undefined
  const apply = (): void => {
    const landing = region.querySelector<HTMLElement>('[data-arrival]')
    if (landing === null) return
    let target: HTMLElement | undefined
    if (arrival.kind === 'return') {
      if (region.scrollTop !== arrival.scrollTop) region.scrollTop = arrival.scrollTop
      target = (arrival.focusIndex === null ? undefined : focusables(region)[arrival.focusIndex]) ?? landing
    } else if (arrival.focus) {
      target = landing
    }
    if (target === undefined || target === focused) return
    focused = target
    focusWithoutRing(target, { preventScroll: true })
  }
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(region, { childList: true, subtree: true })
  const stop = (): void => {
    observer.disconnect()
    for (const type of INTERRUPTIONS) region.removeEventListener(type, stop, true)
  }
  for (const type of INTERRUPTIONS) region.addEventListener(type, stop, true)
  return stop
}
