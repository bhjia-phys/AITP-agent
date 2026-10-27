/** Real native file reading retains the research scope, discussion and material-chain position. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type { DiscussionPage, Result } from '@deepseek-ai/dsh-research-memory/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { TOPIC } from './fixtures/library-ui/project.ts'
import { createNativeSourceProject, SOURCE_ENTRY, SOURCE_DETAIL, SOURCE_DRAFT, SOURCE_QUESTION } from './fixtures/library-ui/native-sources.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'
import { materialReading, materialScroll, materialTabId, selectMaterialTab } from './fixtures/library-ui/dock.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
const PREFIX = 'aitp-native-sources'
function reader(page: Page): Locator { return materialReading(page) }
function discussion(page: Page): Locator { return page.locator('[data-research-discussion]').filter({ visible: true }) }
async function heading(page: Page, title: string): Promise<void> {
  await reader(page).getByRole('heading', { name: title, exact: true }).first().waitFor()
}
async function shot(page: Page, name: string): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-${name}.png`), fullPage: true, animations: 'disabled' })
}
async function readingScroll(page: Page): Promise<number> { return materialScroll(reader(page)) }
async function zoomMenu(page: Page): Promise<Locator> {
  const frame = reader(page).locator('[data-document-zoom-frame]')
  await frame.scrollIntoViewIfNeeded()
  const bounds = await frame.boundingBox()
  if (bounds === null) throw new Error('The original image has no visible native zoom viewport.')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8)
  await expect.poll(() => reader(page).locator('[data-document-zoom-controls]').getAttribute('data-document-zoom-visible')).toBe('true')
  return reader(page).getByRole('button', { name: 'Choose zoom', exact: true })
}

it('reads local Markdown, inline and original images, and code in one retained topic discussion', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-native-sources-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = [], sessionFileReads: string[] = []
  onTestFinished(async ({ task }) => {
    const failures: unknown[] = []
    if (task.result?.state === 'fail') {
      if (owned.page !== undefined) await saveFailureShot(owned.page, `${PREFIX}-failure`)
      const body = owned.page === undefined || owned.page.isClosed() ? '(page unavailable)' : await owned.page.locator('body').innerText().catch(String)
      await writeFile(join(ARTIFACTS, `${PREFIX}-failure.log`), `${owned.app?.logs() ?? ''}\n${errors.join('\n')}\n${body}`)
        .catch((error: unknown) => failures.push(error))
    }
    await model.close().catch((error: unknown) => failures.push(error))
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'The native source scenario did not close its own resources.')
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const project = await createNativeSourceProject(world)
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  const url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  const workspaceId = workspace.workspace.workspaceId
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId } })).toMatchObject({ ok: true })
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: false } })).toMatchObject({ ok: true })
  const sessions = async (): Promise<DiscussionPage> => {
    const result = await app.rpc<Result<DiscussionPage>>('researchMemory/listDiscussions', { request: {
      workspaceId, topicId: 'topic:direction%2Fresearch.md',
    } })
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  page.on('pageerror', error => errors.push(String(error)))
  page.on('request', (request) => {
    const endpoint = new URL(request.url()).pathname
    if (/\/api\/workspaceFiles\/read/u.test(endpoint)) sessionFileReads.push(endpoint)
  })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
  const research = page.locator('section[aria-label="Research"]')
  await research.locator('[data-map-node]').filter({ hasText: TOPIC }).click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  await research.getByRole('button', { name: /Related.*Knowledge library/u }).click()
  const knowledge = page.locator('section[aria-label="Knowledge library"]').first()
  await knowledge.getByRole('button', { name: SOURCE_ENTRY, exact: true }).first().click()
  await heading(page, SOURCE_ENTRY)
  const entryTab = await materialTabId(page)
  await reader(page).getByRole('button', { name: 'Reading', exact: true }).waitFor()
  expect(model.requests).toHaveLength(0)
  await reader(page).getByRole('button', { name: 'Discuss this source', exact: true }).click()
  await writeComposerDraft(page, discussion(page).locator('[data-composer-input]'), SOURCE_QUESTION)
  await discussion(page).locator('[data-composer-input]').press('Enter')
  await discussion(page).getByRole('link', { name: 'Source passage', exact: true }).waitFor({ timeout: 30_000 })
  expect(model.requests).toHaveLength(1)
  expect(model.requests[0]).toContain('topic:direction%2Fresearch.md')
  const initialDiscussions = await sessions()
  expect(initialDiscussions.items).toHaveLength(1)
  const initialSessionId = initialDiscussions.items[0]?.sessionId
  await writeComposerDraft(page, discussion(page).locator('[data-composer-input]'), SOURCE_DRAFT)

  const related = reader(page).getByRole('button', { name: 'Read the related note', exact: true }).first()
  await related.scrollIntoViewIfNeeded()
  const entryScroll = await readingScroll(page)
  expect(entryScroll).toBeGreaterThan(100)
  await related.focus()
  await related.press('Enter')
  await heading(page, SOURCE_DETAIL)
  const detailTab = await materialTabId(page)
  expect(await reader(page).getByRole('button', { name: 'History', exact: true }).count()).toBe(0)
  await reader(page).getByRole('button', { name: 'Read the boundary section', exact: true }).first().click()
  await heading(page, 'Boundary condition')
  expect(await reader(page).locator('[data-document-markdown]').innerText())
    .not.toContain('This paragraph lies outside the located boundary section.')
  await selectMaterialTab(page, detailTab)
  await heading(page, SOURCE_DETAIL)
  await reader(page).getByText('This paragraph lies outside the located boundary section.', { exact: true }).waitFor()
  const inline = reader(page).getByRole('img', { name: 'Inline boundary figure', exact: true })
  await inline.scrollIntoViewIfNeeded()
  await expect.poll(() => inline.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  await reader(page).getByRole('button', { name: 'Open image: Inline boundary figure', exact: true }).click()
  const lightbox = page.getByRole('dialog', { name: 'Image preview', exact: true })
  await lightbox.getByRole('img', { name: 'Inline boundary figure', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await lightbox.waitFor({ state: 'hidden' })
  expect(await reader(page).getByRole('button', { name: 'Open image: Inline boundary figure', exact: true })
    .evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)
  await shot(page, 'markdown-inline-image-and-discussion')

  const outside = reader(page).getByRole('button', { name: 'Outside-root note', exact: true }).first()
  if (await outside.count() > 0) {
    await outside.click()
    await reader(page).getByRole('alert').filter({ hasText: 'This reference could not be resolved to a connected local source.' }).waitFor()
  } else await reader(page).getByText('Outside-root note', { exact: true }).first().waitFor()
  expect(await reader(page).getByRole('img', { name: 'Outside-root figure', exact: true }).count()).toBe(0)
  expect(await reader(page).getByRole('img', { name: 'Symlink escape figure', exact: true }).count()).toBe(0)
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE_OUTSIDE_SOURCE_MUST_NOT_BE_READ')
  expect(sessionFileReads).toEqual([])

  await reader(page).getByRole('button', { name: 'Open the original PNG', exact: true }).first().click()
  const png = reader(page).getByRole('img', { name: /^Image preview: .*图 结果\.png$/u })
  await png.waitFor()
  expect(await png.evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight })))
    .toEqual({ width: 480, height: 280 })
  await selectMaterialTab(page, detailTab)
  await heading(page, SOURCE_DETAIL)
  await reader(page).getByRole('button', { name: 'Open the vector figure', exact: true }).first().click()
  const vector = reader(page).getByRole('img', { name: /^Image preview: .*图 示意\.svg$/u })
  await vector.waitFor()
  await expect.poll(() => vector.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1200)
  expect(await page.locator('html').getAttribute('data-native-source-script')).toBeNull()
  await (await zoomMenu(page)).click()
  await page.getByRole('menuitem', { name: '150%', exact: true }).click()
  await expect.poll(() => vector.evaluate((element: HTMLImageElement) => element.getBoundingClientRect().width / element.naturalWidth))
    .toBeCloseTo(1.5, 1)
  await shot(page, 'original-svg-fixed-zoom')
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Knowledge library', exact: true }).click()
  await vector.waitFor()
  expect(await reader(page).locator('[data-document-zoom-frame]').getAttribute('data-document-zoom-mode')).toBe('fixed')
  await expect.poll(() => vector.evaluate((element: HTMLImageElement) => element.getBoundingClientRect().width / element.naturalWidth))
    .toBeCloseTo(1.5, 1)
  await (await zoomMenu(page)).click()
  await page.getByRole('menuitem', { name: 'Fit width', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await vector.waitFor()
  await zoomMenu(page)
  await shot(page, 'original-svg-narrow-fit')
  await page.setViewportSize({ width: 1600, height: 1000 })
  await selectMaterialTab(page, detailTab)
  await heading(page, SOURCE_DETAIL)
  await reader(page).getByRole('button', { name: 'Discuss this source', exact: true }).click()
  expect(await discussion(page).locator('[data-composer-input]').innerText()).toBe(SOURCE_DRAFT)
  await reader(page).getByRole('button', { name: 'Inspect the implementation', exact: true }).first().click()
  await reader(page).locator('.shiki').filter({ hasText: 'explicit_boundary' }).waitFor()
  await knowledge.getByText(`Current topic: ${TOPIC}`, { exact: true }).waitFor()
  expect(await discussion(page).locator('[data-composer-input]').innerText()).toBe(SOURCE_DRAFT)
  await shot(page, 'linked-code-and-retained-discussion')
  await selectMaterialTab(page, detailTab)
  await heading(page, SOURCE_DETAIL)
  await selectMaterialTab(page, entryTab)
  await heading(page, SOURCE_ENTRY)
  await expect.poll(() => readingScroll(page)).toBeCloseTo(entryScroll, 0)
  expect(await discussion(page).locator('[data-composer-input]').innerText()).toBe(SOURCE_DRAFT)
  await discussion(page).getByRole('link', { name: 'Source passage', exact: true }).click()
  await heading(page, SOURCE_ENTRY)
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Code libraries', exact: true }).click()
  const code = page.locator('section[aria-label="Code libraries"]').first()
  await code.getByRole('button', { name: 'boundary-project', exact: true }).click()
  await code.getByRole('button', { name: 'reading.md', exact: true }).click()
  await reader(page).getByRole('button', { name: 'Reading', exact: true }).waitFor()
  await reader(page).getByText('Only under A. This synthetic record has an explicit unresolved independent control.', { exact: true }).waitFor()
  expect(await reader(page).getByRole('button', { name: 'Reading', exact: true }).getAttribute('aria-pressed')).toBe('true')
  await shot(page, 'markdown-opened-from-code-catalog')
  await code.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  expect(await discussion(page).locator('[data-composer-input]').innerText()).toBe(SOURCE_DRAFT)
  expect(model.requests).toHaveLength(1)
  expect((await sessions()).items.map(item => item.sessionId)).toEqual([initialSessionId])
  expect(sessionFileReads).toEqual([])
  expect(errors).toEqual([])
  for (const [path, original] of project.sources) expect(await readFile(join(project.path, path))).toEqual(Buffer.from(original))
  expect(await readFile(join(project.path, '.git/index'))).toEqual(project.gitIndex)
  await writeFile(join(ARTIFACTS, `${PREFIX}-evidence.json`), JSON.stringify({
    workspaceId, sessionId: initialSessionId, modelRequests: model.requests.length, entryScroll,
    sourceFilesUnchanged: project.sources.size, sessionFileReads,
    checks: ['native-markdown', 'relative-markdown', 'exact-markdown-anchor-section-and-return',
      'chinese-and-space-paths', 'inline-original-png-lightbox',
      'standalone-png-and-svg', 'svg-script-inert', 'image-fixed-and-fit-zoom', 'image-zoom-retained', '390px',
      'source-kind-routing', 'markdown-from-code-catalog', 'native-source-tab-switching-and-scroll', 'same-topic-session-and-draft', 'citation-return',
      'outside-root-and-symlink-not-read-through-session'],
  }, null, 2))
}, 180_000)
