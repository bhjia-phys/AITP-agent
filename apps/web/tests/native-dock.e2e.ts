/** Real catalogues remain usable beside the native document dock without creating Sessions. */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { createNativeSourceProject, SOURCE_ENTRY, SOURCE_DETAIL } from './fixtures/library-ui/native-sources.ts'
import { PAPER } from './fixtures/library-ui/project.ts'
import { materialDock, materialReading, materialScroll, materialTabId, selectMaterialTab } from './fixtures/library-ui/dock.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/aitp-native-dock-20261027/', import.meta.url))

it('keeps three real catalogues beside native source tabs, retaining reading on collapse without hidden Sessions', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-native-dock-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = [], sessionFileReads: string[] = []
  onTestFinished(async ({ task }) => {
    if (task.result?.state === 'fail' && owned.page !== undefined) await saveFailureShot(owned.page, 'aitp-native-dock-failure')
    await model.close()
    await owned.browser?.close()
    await owned.app?.stop()
    await rm(world, { recursive: true, force: true })
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const project = await createNativeSourceProject(world)
  const app = new LibraryApp(world, await model.start()); owned.app = app
  const url = await app.start()
  const { workspace } = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId: workspace.workspaceId, domains: ['literature', 'knowledge', 'code'] } })).toMatchObject({ ok: true })
  const sessions = async (): Promise<readonly string[]> => {
    const result = await app.rpc<{ items: { sessionId: string }[] }>('session/list', { _request: {} })
    return result.items.map(item => item.sessionId).sort()
  }
  expect(await sessions()).toEqual([])
  const browser = await chromium.launch(); owned.browser = browser
  const page = await newEnglishPage(browser); owned.page = page
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/\/api\/workspaceFiles\/read/u.test(path)) sessionFileReads.push(path)
  })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(url)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  // The ordinary application boot creates its initial blank chat before any library is opened.
  await expect.poll(async () => (await sessions()).length, { timeout: 10_000 }).toBe(1)
  const initialSessions = await sessions()
  const nav = page.getByRole('navigation', { name: 'Global panels' })
  let selectedSources = 0
  for (const [title, source, content] of [
    ['Literature library', 'boundary-controls.pdf', '[data-pdf-preview]'],
    ['Knowledge library', SOURCE_ENTRY, '[data-document-markdown]'],
    ['Code libraries', 'model.py', '.shiki'],
  ] as const) {
    await nav.getByRole('button', { name: title, exact: true }).click()
    const catalog = page.locator(`section[aria-label="${title}"]`).first()
    if (title === 'Code libraries') await catalog.getByRole('button', { name: 'boundary-project', exact: true }).click()
    const search = catalog.getByRole('textbox', { name: 'Search this library', exact: true })
    await search.fill(source)
    const entry = catalog.getByRole('button', { name: title === 'Literature library' ? PAPER : source, exact: true }).first()
    await entry.focus(); await entry.press('Enter')
    await materialReading(page).locator(content).first().waitFor()
    expect(await materialReading(page).locator('[data-material-presentation="dock"]').count()).toBe(1)
    expect(await catalog.locator('article[data-material-domain]').count()).toBe(0)
    expect(await search.isVisible()).toBe(true)
    expect(await entry.isVisible()).toBe(true)
    await materialReading(page).getByRole('button', { name: 'Use this source', exact: true }).click()
    selectedSources++
    await catalog.getByRole('button', { name: `Selected sources (${selectedSources})`, exact: true }).waitFor()
    await expect.poll(async () => {
      const catalogBounds = await catalog.boundingBox(), dockBounds = await materialDock(page).boundingBox()
      if (catalogBounds === null || dockBounds === null) throw new Error('Both catalogue and native dock must be visible.')
      return catalogBounds.x + catalogBounds.width - dockBounds.x
    }).toBeLessThanOrEqual(1)
    await search.fill('no-such-source-in-fixture')
    await catalog.getByText('No matching filenames, titles or metadata in the indexed portion. '
      + 'Source bodies may still contain relevant passages.', { exact: true }).waitFor()
    await materialReading(page).locator(content).first().waitFor()
    await search.fill(source)
    const tab = await materialTabId(page)
    const count = await materialDock(page).locator('[data-dockkit-tab]').count()
    await entry.click()
    expect(await materialTabId(page)).toBe(tab)
    expect(await materialDock(page).locator('[data-dockkit-tab]').count()).toBe(count)
    if (title === 'Literature library') {
      await materialDock(page).locator('[data-sidebar-right-mode]').click()
      await expect.poll(() => materialDock(page).getAttribute('data-sidebar-right-panel')).toBe('fullscreen')
      expect(await materialTabId(page)).toBe(tab)
      await materialDock(page).locator('[data-sidebar-right-mode]').click()
      await expect.poll(() => materialDock(page).getAttribute('data-sidebar-right-panel')).toBe('push')
      expect(await search.isVisible()).toBe(true)
    }
    await page.screenshot({ path: join(ARTIFACTS, `after-${title.split(' ')[0]?.toLowerCase()}-catalogue-and-dock.png`), animations: 'disabled' })
    expect(await sessions()).toEqual(initialSessions)
  }

  await nav.getByRole('button', { name: 'Knowledge library', exact: true }).click()
  const catalog = page.locator('section[aria-label="Knowledge library"]').first()
  const entry = catalog.getByRole('button', { name: SOURCE_ENTRY, exact: true }).first()
  await entry.click()
  const reading = materialReading(page)
  const originalTab = await materialTabId(page)
  const link = reading.getByRole('button', { name: 'Read the related note', exact: true }).first()
  await link.scrollIntoViewIfNeeded()
  const departure = await materialScroll(reading)
  expect(departure).toBeGreaterThan(100)
  await materialDock(page).locator('[data-sidebar-right-toggle]').click()
  await materialDock(page).waitFor({ state: 'hidden' })
  expect(await entry.isVisible()).toBe(true)
  await entry.click()
  await expect.poll(() => materialScroll(materialReading(page))).toBeCloseTo(departure, 0)
  expect(await materialTabId(page)).toBe(originalTab)
  await materialReading(page).getByRole('button', { name: 'Read the related note', exact: true }).first().click()
  await materialReading(page).getByRole('heading', { name: SOURCE_DETAIL, exact: true }).waitFor()
  const relatedTab = await materialTabId(page)
  expect(await entry.isVisible()).toBe(true)
  await selectMaterialTab(page, originalTab)
  const otherTab = materialDock(page).locator(`[data-dockkit-tab="${relatedTab}"]`)
  await otherTab.hover()
  await otherTab.locator('[data-dockkit-tab-close]').click()
  await otherTab.waitFor({ state: 'detached' })
  expect(await entry.isVisible()).toBe(true)
  await expect.poll(() => materialScroll(materialReading(page))).toBeCloseTo(departure, 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => materialDock(page).getAttribute('data-sidebar-right-panel')).toBe('fullscreen')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(ARTIFACTS, 'after-native-dock-narrow.png'), animations: 'disabled' })
  await materialDock(page).locator('[data-sidebar-right-toggle]').click()
  await materialDock(page).waitFor({ state: 'hidden' })
  expect(await entry.isVisible()).toBe(true)
  expect(await sessions()).toEqual(initialSessions)
  expect(model.requests).toHaveLength(0)
  expect(sessionFileReads).toEqual([])
  expect(errors).toEqual([])
  for (const [path, original] of project.sources) {
    expect((await readFile(join(project.path, path))).equals(Buffer.from(original))).toBe(true)
  }
  expect((await readFile(join(project.path, '.git/index'))).equals(project.gitIndex)).toBe(true)
}, 180_000)
