// @vitest-environment jsdom
/** Renaming changes native Session metadata while retaining unsent input and IME behavior. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { DiscussionRename } from '../src/client/DiscussionRename.tsx'
import { discussionEn } from '../src/client/discussion-locales.ts'

afterEach(cleanup)
const t = makeTranslate(discussionEn)

it('waits for explicit confirmation after IME composition and prevents duplicate in-flight renames', async () => {
  let finish!: () => void
  const rename = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
  const close = vi.fn()
  render(<DiscussionRename currentTitle="Original discussion" rename={rename} close={close} t={t} />)
  const input = screen.getByRole('textbox', { name: 'Discussion name' })
  fireEvent.change(input, { target: { value: '  Boundary conditions  ' } })
  fireEvent.compositionStart(input)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(rename).not.toHaveBeenCalled()
  fireEvent.compositionEnd(input)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(rename).toHaveBeenCalledExactlyOnceWith('Boundary conditions')
  expect(input.hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
  expect(rename).toHaveBeenCalledOnce()
  expect(close).not.toHaveBeenCalled()
  await act(async () => { finish() })
  expect(close).toHaveBeenCalledOnce()
})

it('retains the entered title on a refused rename and permits cancel without sending any question', async () => {
  const rename = vi.fn(async () => { throw new Error('The host refused this change.') })
  const close = vi.fn()
  render(<DiscussionRename currentTitle="Original discussion" rename={rename} close={close} t={t} />)
  const input = screen.getByRole('textbox', { name: 'Discussion name' })
  fireEvent.change(input, { target: { value: '   ' } })
  expect(screen.getByRole('button', { name: 'Rename' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: 'A new title' } })
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('The host refused this change.') })
  expect(screen.getByDisplayValue('A new title')).toBeDefined()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(close).toHaveBeenCalledOnce()
  expect(rename).toHaveBeenCalledOnce()
})
