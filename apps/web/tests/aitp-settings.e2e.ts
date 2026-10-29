/** Real settings/profile writes remain separate from currently running research capabilities. */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { newEnglishPage, openSettings } from './support.ts'
import { captureStableAria, compareOrRefreshGolden, webSnapshotMode } from './scaffold.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))

it('saves next-start research choices without changing the live libraries', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-settings-browser-'))
  onTestFinished(() => rm(world, { recursive: true, force: true }))
  await mkdir(join(world, 'Documents'))
  await mkdir(ARTIFACTS, { recursive: true })
  const model = new LibraryModel()
  onTestFinished(() => model.close())
  const app = new LibraryApp(world, await model.start())
  onTestFinished(() => app.stop())
  const url = await app.start()
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await newEnglishPage(browser)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  await openSettings(page, 'en')
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
  await dialog.getByRole('button', { name: 'Research', exact: true }).click()
  await dialog.getByRole('heading', { name: 'Research plugins', exact: true }).waitFor()
  const section = page.getByRole('region', { name: 'Research plugins', exact: true })
  const current = dialog.locator('details').filter({ has: page.locator('summary', { hasText: /^Running now/u }) })
  await current.locator('summary').focus()
  await page.keyboard.press('Enter')
  const overview = current.locator('dl > div').filter({ hasText: 'Research overview' }).locator('dd')
  await expect.poll(() => overview.textContent()).toBe('On')
  await dialog.getByRole('radio', { name: /^Browse research/u }).check()
  const libraries = dialog.locator('details').filter({ has: page.locator('summary', { hasText: /^Optional libraries/u }) })
  await libraries.locator('summary').click()
  await libraries.getByRole('checkbox', { name: /^Code/u }).uncheck()
  await dialog.getByRole('button', { name: 'Save for next start', exact: true }).click()
  await dialog.getByText('Saved for the next start', { exact: true }).waitFor()
  const profile = await readFile(join(world, 'home/profiles/web/cordis.patch.yml'), 'utf8')
  expect(profile).toContain('suite: browse')
  expect(profile).toContain('code: false')
  expect(await overview.textContent()).toBe('On')
  expect(await current.locator('dl > div').filter({ hasText: /^Code/u }).locator('dd').textContent()).toBe('On')
  await compareOrRefreshGolden(fileURLToPath(new URL('./expected/aitp-settings/browse.expected.md', import.meta.url)),
    await captureStableAria(page, 'section[aria-label="Research plugins"]', world), webSnapshotMode())
  for (const theme of ['light', 'dark'] as const) {
    await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: theme } })
    await expect.poll(() => page.locator('body').evaluate(element => element.hasAttribute('data-ds-dark-theme'))).toBe(theme === 'dark')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await dialog.getByRole('heading', { name: 'Research plugins', exact: true }).scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
      expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      if (width === 390) {
        expect((await section.boundingBox())?.width).toBeGreaterThanOrEqual(280)
        const navigation = await dialog.locator('nav').boundingBox()
        const body = await section.boundingBox()
        expect(navigation && body && navigation.y + navigation.height <= body.y).toBe(true)
      }
      await page.screenshot({ path: join(ARTIFACTS, `aitp-settings-${theme}-${width}.png`), animations: 'disabled' })
      await dialog.getByRole('button', { name: 'Save for next start', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: join(ARTIFACTS, `aitp-settings-save-${theme}-${width}.png`), animations: 'disabled' })
    }
  }
  await dialog.getByRole('radio', { name: /^Skills /u }).check()
  await dialog.getByRole('button', { name: 'Save for next start', exact: true }).focus()
  await page.keyboard.press('Enter')
  await dialog.getByText('Saved for the next start', { exact: true }).waitFor()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.reload({ waitUntil: 'load' })
  await openSettings(page, 'en')
  await dialog.getByRole('button', { name: 'Research', exact: true }).click()
  await expect.poll(() => dialog.getByRole('radio', { name: /^Skills /u }).isChecked()).toBe(true)
  expect(await readFile(join(world, 'home/profiles/web/cordis.patch.yml'), 'utf8')).toContain('code: false')
  await app.rpc('settings/update', { ns: 'locale', patch: { preference: 'zh' } })
  await page.getByRole('heading', { name: '科研插件', exact: true }).waitFor()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(ARTIFACTS, `aitp-settings-zh-${width}.png`), animations: 'disabled' })
  }
  expect(model.requests).toEqual([])
  expect(errors).toEqual([])
})
