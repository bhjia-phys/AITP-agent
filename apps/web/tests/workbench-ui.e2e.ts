/** Real note drafts, responsive reading and transport failure in an isolated application. */
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { createLibraryProject, CONCEPT } from './fixtures/library-ui/project.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'
import { materialDock, materialReading } from './fixtures/library-ui/dock.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
const TITLE = '中文研读笔记：明确假设与长标题的阅读边界 / isolated UI acceptance'
const BODY = '# Conditions\n\n' + 'Keep this finite observation separate from a general conclusion. 中文长正文与来源位置。\n\n'.repeat(36)

/** Wait for the frame tracks and native sidebar to reach their actual viewing geometry. */
async function waitForNativeLayout(page: Page): Promise<void> {
  await expect.poll(() => page.locator('[style*="grid-template-columns"]').first().evaluate(frame =>
    frame.hasAttribute('data-animating') || frame.getAnimations({ subtree: true }).some(animation =>
      'transitionProperty' in animation
      && ['grid-template-columns', 'transform', 'visibility'].includes(String(animation.transitionProperty))
      && animation.playState !== 'finished' && animation.playState !== 'idle'))).toBe(false)
}

it('retains a real note draft, saves only inside the fixture and distinguishes a failed read from empty content', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-workbench-ui-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  onTestFinished(async ({ task }) => {
    if (task.result?.state === 'fail' && owned.page !== undefined) {
      await saveFailureShot(owned.page, 'aitp-workbench-ui-failure')
      await writeFile(join(ARTIFACTS, 'aitp-workbench-ui-failure.log'), `${owned.app?.logs() ?? ''}\n${await owned.page.locator('body').innerText().catch(String)}`)
    }
    await model.close()
    await owned.browser?.close()
    await owned.app?.stop()
    await rm(world, { recursive: true, force: true })
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const project = await createLibraryProject(world)
  for (let index = 0; index < 40; index++) {
    const name = `长列表-${String(index).padStart(2, '0')}`
    await writeFile(join(project.path, `${name}.md`), `---\nkind: theorem\n---\n# ${name}\n\n${BODY}`)
    await appendFile(join(project.path, 'index.md'), `| ${name} | theorem | [${name}](${name}.md) | source | awaiting |\n`)
  }
  const app = new LibraryApp(world, await model.start()); owned.app = app
  const url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  const workspaceId = workspace.workspace.workspaceId
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId } })).toMatchObject({ ok: true })
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: false } })).toMatchObject({ ok: true })
  const browser = await chromium.launch(); owned.browser = browser
  const page = await newEnglishPage(browser); owned.page = page
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(url)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const nav = page.getByRole('navigation', { name: 'Global panels' })
  await nav.getByRole('button', { name: 'Study notes', exact: true }).click()
  const notes = page.locator('section[aria-label="Study notes"]')
  await notes.getByText('No study notes are saved.', { exact: true }).waitFor()
  await notes.getByRole('button', { name: 'New note', exact: true }).click()
  await notes.getByRole('textbox', { name: 'Title', exact: true }).fill(TITLE)
  await notes.getByRole('textbox', { name: 'Note text (Markdown)', exact: true }).fill(BODY)
  await notes.getByRole('button', { name: 'Back to study notes', exact: true }).click()
  await notes.getByRole('button', { name: 'Continue draft', exact: true }).click()
  expect(await notes.getByRole('textbox', { name: 'Title', exact: true }).inputValue()).toBe(TITLE)
  expect(await notes.getByRole('textbox', { name: 'Note text (Markdown)', exact: true }).inputValue()).toBe(BODY)
  await notes.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notes.getByRole('heading', { name: TITLE, exact: true }).waitFor()
  for (const width of [1600, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390) await expect.poll(() => nav.getByRole('button', { name: 'Study notes', exact: true }).innerText()).toBe('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(await notes.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ animations: 'disabled', path: join(ARTIFACTS, `aitp-workbench-study-${width}.png`) })
  }
  await page.setViewportSize({ width: 1600, height: 1000 })
  await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'dark', fontSize: 20 } })
  await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).not.toBeNull()
  await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).getPropertyValue('--dsh-content-font-size').trim())).toBe('20px')
  await page.screenshot({ animations: 'disabled', path: join(ARTIFACTS, 'aitp-workbench-study-dark-large-text.png') })
  await notes.getByRole('button', { name: 'Back to study notes', exact: true }).click()
  await notes.getByRole('textbox', { name: 'Search note titles', exact: true }).fill('absent-note')
  await notes.getByText('No matching notes on this page.', { exact: true }).waitFor()
  await notes.getByRole('textbox', { name: 'Search note titles', exact: true }).fill('中文')
  await notes.getByRole('button', { name: TITLE, exact: true }).waitFor()

  await nav.getByRole('button', { name: 'Knowledge library', exact: true }).click()
  const knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByRole('button', { name: CONCEPT, exact: true }).first().waitFor()
  await page.route('**/api/researchResources/readResource', route => route.abort('connectionfailed'))
  await knowledge.getByRole('button', { name: CONCEPT, exact: true }).first().click()
  await materialReading(page).getByRole('alert').first().waitFor()
  expect(await materialReading(page).innerText()).not.toContain('Nothing has been written in this source yet.')
  await materialReading(page).getByText('Could not read these materials. Try refreshing.', { exact: true }).waitFor()
  await page.screenshot({ animations: 'disabled', path: join(ARTIFACTS, 'aitp-workbench-source-connection-failed.png') })
  await page.unrouteAll({ behavior: 'wait' })
  await materialReading(page).getByRole('alert').getByRole('button', { name: 'Refresh', exact: true }).click()
  await materialReading(page).getByRole('heading', { name: 'Conditional explanation', exact: true }).waitFor()
  await materialDock(page).locator('[data-sidebar-right-toggle]').click()
  await materialDock(page).waitFor({ state: 'hidden' })
  // The open attribute disappears before the frame and sidebar finish their transitions.
  await waitForNativeLayout(page)
  const list = knowledge.locator('[data-material-ready]').first().locator('../..')
  const entry = knowledge.getByRole('button', { name: '长列表-15', exact: true }).first()
  await entry.scrollIntoViewIfNeeded()
  const departure = await list.evaluate(element => element.scrollTop)
  expect(departure).toBeGreaterThan(100)
  await entry.click()
  await materialReading(page).getByRole('heading', { name: '长列表-15', exact: true }).first().waitFor()
  await waitForNativeLayout(page)
  await materialDock(page).locator('[data-sidebar-right-toggle]').click()
  await materialDock(page).waitFor({ state: 'hidden' })
  await waitForNativeLayout(page)
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeCloseTo(departure, 0)
  await page.screenshot({ animations: 'disabled', path: join(ARTIFACTS, 'aitp-workbench-long-list-return.png') })
  expect(model.requests).toHaveLength(0)
})
