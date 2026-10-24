// @vitest-environment jsdom
/**
 * Research panel model: navigation history with return points, disclosure
 * choices, locator and time labels, Session drafts, resource addresses, and
 * reading-region arrival (top and landing focus on enter, scroll and control
 * focus on return, waiting for and re-applying over content that is still
 * loading or replaced, until the reader acts).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { returnPoint, settleArrival } from '../src/client/arrival.ts'
import { draftPrompt, locatorLabel, observedLabel } from '../src/client/format.ts'
import { en } from '../src/client/locales.ts'
import { noteAddress, parseNoteAddress, topicAddress, topicsAddress } from '../src/client/protocol.ts'
import type { ResourceId, TopicId } from '../src/client/workspace-contract.ts'
import { createResearchPanelStore, disclosureKey, workspaceLocation } from '../src/client/store.ts'

const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const ws = (id: string): WorkspaceId => id as WorkspaceId
const stay = { scrollTop: 0, focusIndex: null }
const MAP = { kind: 'map', focusId: null } as const

afterEach(() => { document.body.replaceChildren() })

describe('research panel store', () => {
  it('records the return point of each location left and arrives at the top', () => {
    const store = createResearchPanelStore().create()
    expect(store.getSnapshot()).toMatchObject({ location: MAP, back: [], arrival: { kind: 'none' }, visit: 0 })
    store.actions.open(ws('w1'), { kind: 'resource', topicId: 'a' as TopicId, resourceId: 'a-note' as ResourceId }, { scrollTop: 120, focusIndex: 3 })
    expect(store.getSnapshot()).toMatchObject({
      location: { kind: 'resource', resourceId: 'a-note' },
      back: [{ location: MAP, returnTo: { scrollTop: 120, focusIndex: 3 } }],
      arrival: { kind: 'enter', focus: true },
      visit: 1,
    })
    store.actions.open(ws('w1'), { kind: 'topic', topicId: 'b' as TopicId }, stay)
    expect(store.getSnapshot().arrival).toEqual({ kind: 'enter', focus: false })
  })

  it('returns to the recorded point and ignores Back with no history', () => {
    const store = createResearchPanelStore().create()
    store.actions.goBack(ws('w1'))
    expect(store.getSnapshot().visit).toBe(0)
    store.actions.open(ws('w1'), { kind: 'resource', topicId: null, resourceId: 'root-note' as ResourceId }, { scrollTop: 40, focusIndex: 1 })
    store.actions.goBack(ws('w1'))
    store.actions.goBack(ws('w1'))
    expect(store.getSnapshot()).toMatchObject({
      location: MAP, back: [], arrival: { kind: 'return', scrollTop: 40, focusIndex: 1 }, visit: 2,
    })
  })

  it('keeps the latest fifty locations for Back', () => {
    const store = createResearchPanelStore().create()
    for (let index = 0; index < 60; index += 1) store.actions.open(ws('w1'), { kind: 'topic', topicId: `t${index}` as TopicId }, stay)
    const { back } = store.getSnapshot()
    expect(back).toHaveLength(50)
    expect(back[0]?.location).toEqual({ kind: 'topic', topicId: 't9' })
  })

  it('starts a chosen Workspace afresh and ignores choosing the same one', () => {
    const store = createResearchPanelStore().create()
    store.actions.open(ws('w1'), { kind: 'topic', topicId: 'a' as TopicId }, stay)
    store.actions.selectWorkspace(ws('w2'))
    expect(store.getSnapshot()).toMatchObject({ workspaceId: 'w2', location: MAP, back: [], arrival: { kind: 'enter', focus: false }, visit: 2 })
    store.actions.selectWorkspace(ws('w2'))
    expect(store.getSnapshot().visit).toBe(2)
  })

  it('pins navigation to its Workspace and never reuses its topic in a fallback Workspace', () => {
    const store = createResearchPanelStore().create()
    const topic = { kind: 'topic' as const, topicId: 'only-in-w1' as TopicId }
    store.actions.open(ws('w1'), topic, stay)
    expect(store.getSnapshot().workspaceId).toBe('w1')
    expect(workspaceLocation(store.getSnapshot(), ws('w1'))).toEqual(topic)
    expect(workspaceLocation(store.getSnapshot(), ws('w2'))).toEqual(MAP)
    store.actions.goBack(ws('w2'))
    expect(workspaceLocation(store.getSnapshot(), ws('w1'))).toEqual(topic)
    store.actions.open(ws('w2'), { kind: 'topic', topicId: 'only-in-w2' as TopicId }, stay)
    expect(store.getSnapshot()).toMatchObject({ workspaceId: 'w2', back: [{ location: MAP }] })
    store.actions.goBack(ws('w2'))
    expect(store.getSnapshot()).toMatchObject({ workspaceId: 'w2', location: MAP, back: [] })
  })

  it('treats a map focus as a location that Back returns to', () => {
    const store = createResearchPanelStore().create()
    store.actions.open(ws('w1'), { kind: 'map', focusId: 'a' as TopicId }, { scrollTop: 0, focusIndex: 4 })
    store.actions.open(ws('w1'), { kind: 'topic', topicId: 'a' as TopicId }, stay)
    store.actions.goBack(ws('w1'))
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: 'a' })
  })

  it('keeps each disclosure choice by Workspace, region and topic', () => {
    const store = createResearchPanelStore().create()
    const section = disclosureKey(ws('w1'), 'section', 'a', 'materials')
    expect(section).toBe('["w1","section","a","materials"]')
    expect(disclosureKey(ws('w2'), 'map', 'a')).not.toBe(disclosureKey(ws('w1'), 'map', 'a'))
    store.actions.setDisclosed(section, false)
    store.actions.setDisclosed(disclosureKey(ws('w1'), 'map', 'a'), true)
    store.actions.selectWorkspace(ws('w2'))
    expect(store.getSnapshot().disclosure).toEqual({ [section]: false, '["w1","map","a"]': true })
  })
})

describe('research formatting', () => {
  it('labels a locator by anchor, line range, single line or file alone', () => {
    expect(locatorLabel(t, { path: 'spectra/research.md', anchor: 'basis' })).toBe('research.md#basis')
    expect(locatorLabel(t, { path: 'spectra/research.md', lines: [3, 7] })).toBe('research.md · L3–7')
    expect(locatorLabel(t, { path: 'research.md', lines: [9, 9] })).toBe('research.md · L9')
    expect(locatorLabel(t, { path: 'notes/a.md' })).toBe('a.md')
  })

  it('shows clock time for today, the date otherwise, and passes through a non-date', () => {
    const now = new Date('2026-10-22T12:00:00')
    const today = observedLabel('2026-10-22T09:05:00', now)
    const earlier = observedLabel('2026-10-01T09:05:00', now)
    expect(today).not.toBe(earlier)
    expect(earlier.length).toBeGreaterThan(today.length)
    expect(observedLabel('not a time', now)).toBe('not a time')
    expect(observedLabel('2026-10-22T09:05:00')).toBeTypeOf('string')
  })

  it('drafts a Session that cites the note with a Harness mention', () => {
    expect(draftPrompt(t, 'spectra/research.md')).toBe('Working on @spectra/research.md: ')
    expect(draftPrompt(t, 'notes/basis convergence.md', 'stop')).toBe('Working on @"notes/basis convergence.md" (#stop): ')
  })
})

describe('research addresses', () => {
  it('builds encoded addresses and reads a note address back', () => {
    expect(topicsAddress(ws('w 1'))).toBe('dsh-resource://aitp-topics/workspace/w%201')
    expect(topicAddress(ws('w'), 'a/b')).toBe('dsh-resource://aitp-topic/workspace/w/topic/a%2Fb')
    const address = noteAddress(ws('w 1'), 'spectra/research.md')
    expect(address).toBe('dsh-resource://aitp-note/workspace/w%201/note/spectra%2Fresearch.md')
    expect(parseNoteAddress(address)).toEqual({ workspaceId: 'w 1', path: 'spectra/research.md' })
    expect(parseNoteAddress('dsh-resource://aitp-topic/workspace/w/topic/a')).toBeUndefined()
  })
})

/**
 * A reading region with optional content.
 * @param content - inner HTML; omitted for a region still loading.
 * @returns the region.
 */
function region(content = ''): HTMLElement {
  const element = document.createElement('div')
  element.innerHTML = content
  document.body.append(element)
  return element
}

const PAGE = '<h2 data-arrival tabindex="-1">Title</h2><button>One</button><button disabled>Off</button><a href="#x">Two</a><button>Three</button>'

describe('reading-region arrival', () => {
  it('records the scroll offset and the focused control, or none when focus is elsewhere', () => {
    expect(returnPoint(null)).toEqual({ scrollTop: 0, focusIndex: null })
    const reading = region(PAGE)
    reading.scrollTop = 0
    expect(returnPoint(reading)).toEqual({ scrollTop: 0, focusIndex: null })
    reading.querySelector<HTMLElement>('a')!.focus()
    expect(returnPoint(reading).focusIndex).toBe(1)
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(returnPoint(reading).focusIndex).toBeNull()
  })

  it('does nothing on first show or before the region mounts', () => {
    const reading = region(PAGE)
    settleArrival(reading, { kind: 'none' })()
    settleArrival(null, { kind: 'enter', focus: true })()
    expect(document.activeElement).toBe(document.body)
  })

  it('enters at the top, focusing the landing only when asked', () => {
    const reading = region(PAGE)
    settleArrival(reading, { kind: 'enter', focus: false })
    expect(document.activeElement).toBe(document.body)
    settleArrival(reading, { kind: 'enter', focus: true })
    expect(document.activeElement?.textContent).toBe('Title')
    expect(reading.scrollTop).toBe(0)
  })

  it('returns focus to the recorded control, or to the landing when it is gone', () => {
    settleArrival(region(PAGE), { kind: 'return', scrollTop: 0, focusIndex: 2 })
    expect(document.activeElement?.textContent).toBe('Three')
    settleArrival(region(PAGE), { kind: 'return', scrollTop: 0, focusIndex: 9 })
    expect(document.activeElement?.textContent).toBe('Title')
    settleArrival(region(PAGE), { kind: 'return', scrollTop: 0, focusIndex: null })
    expect(document.activeElement?.textContent).toBe('Title')
  })

  it('waits for content that is still loading, and stops waiting when disposed', async () => {
    const loading = region()
    settleArrival(loading, { kind: 'return', scrollTop: 0, focusIndex: 0 })
    loading.innerHTML = '<p>Loading</p>'
    await Promise.resolve()
    expect(document.activeElement).toBe(document.body)
    loading.innerHTML = PAGE
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(document.activeElement?.textContent).toBe('One')
    const abandoned = region()
    const stop = settleArrival(abandoned, { kind: 'enter', focus: true })
    stop()
    abandoned.innerHTML = PAGE
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(document.activeElement?.textContent).toBe('One')
  })

  it('re-applies over replaced content until the reader acts', async () => {
    const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0) })
    const reading = region(PAGE)
    settleArrival(reading, { kind: 'return', scrollTop: 40, focusIndex: 2 })
    const first = document.activeElement
    expect(first?.textContent).toBe('Three')
    reading.append(document.createElement('p'))
    await tick()
    expect(document.activeElement).toBe(first)
    reading.innerHTML = PAGE
    await tick()
    expect(document.activeElement).not.toBe(first)
    expect(document.activeElement?.textContent).toBe('Three')
    reading.dispatchEvent(new Event('pointerdown'))
    reading.innerHTML = PAGE
    await tick()
    expect(document.activeElement).toBe(document.body)
  })

  it('refocuses a replaced landing on entry only when entry takes focus', async () => {
    const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0) })
    const quiet = region(PAGE)
    settleArrival(quiet, { kind: 'enter', focus: false })
    quiet.innerHTML = PAGE
    await tick()
    expect(document.activeElement).toBe(document.body)
    const entered = region(PAGE)
    const stop = settleArrival(entered, { kind: 'enter', focus: true })
    entered.innerHTML = PAGE
    await tick()
    expect(document.activeElement?.textContent).toBe('Title')
    expect(entered.contains(document.activeElement)).toBe(true)
    stop()
  })
})
