/** Native root-dock locations shared by the real research-library browser scenarios. */
import type { Locator, Page } from 'playwright'
import { expect } from 'vitest'

/** @param page - running application. @returns the visible native dock owned by a root panel. */
export function materialDock(page: Page): Locator {
  return page.locator('[data-sidebar-right-root][data-sidebar-right-panel][data-sidebar-right-open]').filter({ visible: true }).first()
}

/** @param page - running application. @returns the selected source tab, including its loading/failure state. */
export function materialReading(page: Page): Locator {
  return materialDock(page).locator('[data-material-source]').filter({ visible: true }).first()
}

/** @param page - running application. @returns the native tab identity of its selected material. */
export async function materialTabId(page: Page): Promise<string> {
  const id = await materialReading(page).evaluate(element => element.closest('[data-sidebar-right-tab]')?.getAttribute('data-sidebar-right-tab'))
  if (id == null) throw new Error('The material must be hosted by a native sidebar tab.')
  return id
}

/** @param page - running application. @param id - a previously observed native tab. */
export async function selectMaterialTab(page: Page, id: string): Promise<void> {
  const tab = materialDock(page).locator(`[data-dockkit-tab="${id}"]`)
  await tab.focus()
  await tab.press('Enter')
  await expect.poll(() => materialTabId(page)).toBe(id)
}

/** @param reading - a retained material tab. @returns its body scroll offset, independently of the catalogue. */
export async function materialScroll(reading: Locator): Promise<number> {
  return reading.locator('[data-document-markdown]').evaluate((element) => {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent.scrollTop
    }
    throw new Error('The native material body must own a scrollport.')
  })
}
