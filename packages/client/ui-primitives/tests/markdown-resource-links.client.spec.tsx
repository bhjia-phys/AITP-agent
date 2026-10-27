// @vitest-environment jsdom
/** Application resources need an explicit current reader capability, without changing Web URL policy. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MarkdownDelegateProvider } from '../src/index.ts'
import { MarkdownText } from './markdown-test-components.tsx'

afterEach(cleanup)
const address = 'dsh-resource://source/root/library/source/paper?location=page2'
const text = `[Evidence](${address}) [Missing](dsh-resource://unknown/path) [Script](javascript:alert) [Web](https://example.com/)`

it('keeps resource citations inert without an application owner and preserves ordinary Web links', () => {
  render(<MarkdownText text={text} />)
  expect(document.body.textContent).toContain('Evidence')
  expect(screen.queryByRole('link', { name: 'Evidence' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Missing' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Script' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Web' }).getAttribute('href')).toBe('https://example.com/')
})

it('opens only recognized application resources and rechecks a withdrawn reader at activation', () => {
  let active = true
  const open = vi.fn<(href: string) => void>()
  const resourceLinks = { canOpen: (href: string) => active && href === address, open }
  render(<MarkdownDelegateProvider resourceLinks={resourceLinks}><MarkdownText text={text} /></MarkdownDelegateProvider>)
  const citation = screen.getByRole('link', { name: 'Evidence' })
  expect(fireEvent.click(citation)).toBe(false)
  expect(open).toHaveBeenCalledExactlyOnceWith(address)
  for (const modified of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }]) {
    expect(fireEvent.click(citation, modified)).toBe(false)
  }
  expect(fireEvent(citation, new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true }))).toBe(false)
  active = false
  expect(fireEvent.click(citation)).toBe(false)
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('link', { name: 'Missing' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Script' })).toBeNull()
})

it('updates cached streaming citations when the nearest owner is replaced', () => {
  const first = vi.fn<(href: string) => void>(), second = vi.fn<(href: string) => void>()
  const canOpen = (href: string): boolean => href === address
  const view = render(<MarkdownDelegateProvider resourceLinks={{ canOpen, open: first }}>
    <MarkdownText text={text} streaming />
  </MarkdownDelegateProvider>)
  fireEvent.click(screen.getByRole('link', { name: 'Evidence' }))
  view.rerender(<MarkdownDelegateProvider resourceLinks={{ canOpen, open: second }}>
    <MarkdownText text={text} streaming />
  </MarkdownDelegateProvider>)
  fireEvent.click(screen.getByRole('link', { name: 'Evidence' }))
  expect(first).toHaveBeenCalledExactlyOnceWith(address)
  expect(second).toHaveBeenCalledExactlyOnceWith(address)
  view.rerender(<MarkdownDelegateProvider><MarkdownText text={text} streaming /></MarkdownDelegateProvider>)
  expect(screen.queryByRole('link', { name: 'Evidence' })).toBeNull()
})
