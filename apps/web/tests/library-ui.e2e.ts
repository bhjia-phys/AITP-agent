/** Real three-library reading, native scoped discussion, exact source sets and responsive presentation. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type { ResourcePage, ResourceReading, ResourceResult, SourceSet, SourceSetPage } from '@deepseek-ai/dsh-research-resources/types'
import { materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { createLibraryProject, TOPIC, CONCEPT, PAPER, EMPTY, SOURCE_SET, QUESTION } from './fixtures/library-ui/project.ts'
import { nativeLibraryPdf, PDF_PAGE_FIVE, PDF_PAGE_TWO } from './fixtures/library-ui/pdf.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'
import { materialDock, materialReading, materialTabId, selectMaterialTab } from './fixtures/library-ui/dock.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
const PREFIX = process.env.AITP_LIBRARY_UI_ARTIFACT_PREFIX ?? 'aitp-libraries'
const LIBRARIES = ['Literature library', 'Knowledge library', 'Code libraries'] as const
type LibraryTitle = typeof LIBRARIES[number]
function library(page: Page, title: LibraryTitle): Locator { return page.locator(`section[aria-label="${title}"]`).first() }
function discussion(page: Page): Locator { return page.locator('[data-research-discussion]').filter({ visible: true }) }

async function openLibrary(page: Page, title: LibraryTitle): Promise<Locator> {
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: title, exact: true }).click()
  const panel = library(page, title)
  await panel.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor()
  const back = panel.getByRole('button', { name: 'Back to library', exact: true })
  if (await back.isVisible()) await back.click()
  return panel
}
async function noOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
async function shot(page: Page, name: string): Promise<void> {
  await noOverflow(page)
  await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-${name}.png`), fullPage: true, animations: 'disabled' })
}
async function openSource(panel: Locator, title: string): Promise<void> {
  const source = panel.getByRole('button', { name: title, exact: true }).first()
  await source.focus()
  await source.press('Enter')
  await materialReading(panel.page()).getByRole('button', { name: 'Use this source', exact: true }).waitFor()
}

async function diffColors(patch: Locator): Promise<readonly string[]> {
  await patch.locator('.shiki span[style*="--shiki-token-inserted"]').first().waitFor()
  return patch.evaluate((element) => {
    const bodyStyle = getComputedStyle(element.ownerDocument.body)
    return ['inserted', 'deleted'].map((kind) => {
      const token = element.querySelector(`.shiki span[style*="--shiki-token-${kind}"]`)
      if (token === null) throw new Error(`Missing native ${kind} diff token.`)
      const color = getComputedStyle(token).color
      const marker = bodyStyle.getPropertyValue(`--dsw-alias-file-diff-${kind === 'inserted' ? 'added' : 'deleted'}-marker`).trim()
      const normalized = element.ownerDocument.createElement('span').style
      normalized.color = marker
      if (color !== normalized.color) throw new Error(`Native ${kind} diff token resolved to ${color}; expected ${normalized.color}.`)
      return color
    }).concat(bodyStyle.getPropertyValue('--shiki-token-changed').trim())
  })
}

it('presents literature, knowledge and code through real data while preserving scoped reading and source selection', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-library-ui-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = []
  let knowledgeFacts: readonly string[] | undefined
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
    if (failures.length > 0) throw new AggregateError(failures, 'The library acceptance scenario did not close its own resources.')
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const project = await createLibraryProject(world)
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  const url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  const workspaceId = workspace.workspace.workspaceId
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId } })).toMatchObject({ ok: true })
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: false } })).toMatchObject({ ok: true })
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  page.on('pageerror', error => errors.push(String(error)))
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })

  const reader = materialReading(page)
  const representative: Record<LibraryTitle, string> = { 'Literature library': PAPER, 'Knowledge library': CONCEPT, 'Code libraries': 'model.py' }
  for (const title of LIBRARIES) {
    const panel = await openLibrary(page, title)
    if (title === 'Code libraries') {
      await panel.getByRole('button', { name: 'boundary-project', exact: true }).waitFor()
      await shot(page, 'code-repositories')
      await panel.getByRole('button', { name: 'boundary-project', exact: true }).click()
      await panel.getByRole('button', { name: 'Open folder src', exact: true }).click()
      await panel.getByRole('button', { name: 'Open folder observables', exact: true }).click()
      await openSource(panel, 'src/observables/response.py')
      await reader.locator('[aria-label="Source code"]').getByText('response', { exact: false }).first().waitFor()
      await reader.locator('[aria-label="Source code"] .shiki').waitFor()
      await shot(page, 'code-nested-source')
      await panel.getByRole('navigation', { name: 'Repository location', exact: true })
        .getByRole('button', { name: 'observables', exact: true }).waitFor()
      await panel.getByRole('navigation', { name: 'Repository location', exact: true })
        .getByRole('button', { name: 'boundary-project', exact: true }).click()
    }
    await panel.getByRole('button', { name: representative[title], exact: true }).first().waitFor()
    if (title === 'Literature library') {
      for (const name of ['Paper', 'Authors', 'Year', 'Reading coverage']) await panel.getByRole('columnheader', { name, exact: true }).waitFor()
      await panel.getByRole('cell', { name: 'A. Fixture; B. Example', exact: true }).first().waitFor()
    }
    const slug = title.split(' ')[0]!.toLowerCase()
    await shot(page, `${slug}-catalog`)
    await openSource(panel, representative[title])
    const primaryTab = await materialTabId(page)
    if (title === 'Literature library') {
      await reader.locator('summary').filter({ hasText: /^About this reading$/u }).click()
      await reader.getByRole('heading', { name: PAPER, exact: true, level: 2 }).first().waitFor()
      await reader.getByText('A. Fixture; B. Example · 2026', { exact: true }).waitFor()
    }
    if (title === 'Knowledge library') {
      await reader.locator('summary').filter({ hasText: /^About this reading$/u }).click()
      knowledgeFacts = await reader.getByRole('heading', { name: CONCEPT, exact: true, level: 2 }).locator('..').locator('dl')
        .evaluate(element => Array.from(element.querySelectorAll('dd'), value => value.textContent ?? ''))
      expect(knowledgeFacts).toEqual(['Based on a source', 'Awaiting review'])
      await reader.locator('summary').filter({ hasText: /^About this reading$/u }).click()
      await reader.getByRole('button', { name: 'Contents', exact: true }).click()
      const contents = reader.getByRole('navigation', { name: 'Contents', exact: true })
      await contents.getByRole('button', { name: 'Assumptions', exact: true }).focus()
      await page.keyboard.press('Enter')
      await reader.getByRole('button', { name: 'Contents', exact: true }).click()
      await reader.getByRole('button', { name: 'Source reading', exact: true }).last().click()
      await reader.getByText('Page two was inspected. Other pages remain unread.', { exact: true }).waitFor()
      await selectMaterialTab(page, primaryTab)
      await reader.getByText('Only under A. Other conditions remain unresolved.', { exact: true }).waitFor()
    }
    if (title === 'Code libraries') {
      await reader.getByRole('button', { name: 'Changes', exact: true }).click()
      const patch = reader.locator('[aria-label="Git patch"]')
      await patch.waitFor()
      expect(await patch.innerText()).toContain('original condition')
      expect(await patch.innerText()).toContain('modified condition under A')
      await patch.locator('.shiki').waitFor()
      const lightColors = await diffColors(patch)
      expect(lightColors[0]).not.toBe(lightColors[1])
      expect(lightColors[2]).not.toBe('')
      await shot(page, 'code-working-diff')
      await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'dark' } })
      await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).not.toBeNull()
      const darkColors = await diffColors(patch)
      for (const [index, color] of lightColors.entries()) expect(darkColors[index]).not.toBe(color)
      await shot(page, 'code-working-diff-dark')
      await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'light' } })
      await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).toBeNull()
      await reader.getByRole('button', { name: 'Staged', exact: true }).click()
      await reader.getByText('No changes in this comparison.', { exact: true }).waitFor()
      await reader.getByRole('button', { name: 'History', exact: true }).click()
      await reader.getByText('Initial bounded sources', { exact: true }).waitFor()
      await reader.getByRole('button', { name: /^View commit /u }).first().click()
      await patch.waitFor()
      expect(await patch.innerText()).toContain('original condition')
      expect(await patch.innerText()).not.toContain('modified condition under A')
      await reader.getByRole('button', { name: 'Source', exact: true }).click()
      await reader.locator('[aria-label="Source code"] .shiki').waitFor()
    }
    await shot(page, `${slug}-reader`)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.getByRole('navigation', { name: 'Global panels' })
      .getByRole('button', { name: title, exact: true }).innerText()).toBe('')
    await reader.getByRole('button', { name: 'Use this source', exact: true }).waitFor()
    await shot(page, `${slug}-narrow`)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'dark' } })
    await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).not.toBeNull()
    await shot(page, `${slug}-dark`)
    await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'light' } })
    await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).toBeNull()
    const search = panel.getByRole('textbox', { name: 'Search this library', exact: true })
    await search.fill('fixture-no-matching-record-xyz')
    await panel.getByText('No matching materials are recorded.', { exact: true }).waitFor()
    await shot(page, `${slug}-empty-search`)
    await search.fill('')
  }
  expect(model.requests).toHaveLength(0)

  const knowledge = await openLibrary(page, 'Knowledge library')
  const gate = Promise.withResolvers<undefined>()
  let delayed = false
  await page.route('**/api/researchResources/readResource', async (route) => {
    if (!route.request().postData()?.includes('source:empty.md')) { await route.continue(); return }
    delayed = true
    await gate.promise
    await route.continue()
  })
  try {
    await knowledge.getByRole('button', { name: EMPTY, exact: true }).first().click()
    await expect.poll(() => delayed, { timeout: 10_000 }).toBe(true)
    await reader.getByRole('status', { name: 'Reading the source… The first scan of a large project may take longer.', exact: true }).first().waitFor()
    await shot(page, 'knowledge-loading')
  } finally { gate.resolve(undefined) }
  await reader.getByRole('button', { name: 'Use this source', exact: true }).waitFor()
  await reader.getByText('Nothing has been written in this source yet.', { exact: true }).waitFor()
  await shot(page, 'knowledge-empty-note')
  await page.unrouteAll({ behavior: 'wait' })

  await page.getByRole('button', { name: 'New session', exact: true }).last().click()
  await page.getByRole('button', { name: 'Boundary research project', exact: true }).click()
  const research = page.locator('section[aria-label="Research"]')
  await research.locator('[data-map-node]').filter({ hasText: TOPIC }).click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Knowledge library/u }).click()
  await knowledge.getByRole('button', { name: CONCEPT, exact: true }).first().click()
  await reader.getByText('Only under A. Other conditions remain unresolved.', { exact: true }).waitFor()
  await reader.getByRole('button', { name: 'Use this source', exact: true }).click()
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Literature library/u }).click()
  const literature = library(page, 'Literature library')
  await literature.getByRole('row').filter({ has: page.getByText('PDF', { exact: true }) })
    .getByRole('button', { name: PAPER, exact: true }).click()
  await reader.getByRole('img', { name: 'PDF page 1', exact: true }).waitFor()
  await reader.getByRole('img', { name: 'PDF page 2', exact: true }).waitFor()
  // Both small pages fit onscreen: the quotation's native page, not the nearby reading-line page, owns the selection.
  await reader.locator('[data-pdf-page="2"] [data-pdf-text] span').filter({ hasText: 'Page two exact text' }).first().evaluate((element) => {
    const range = element.ownerDocument.createRange()
    range.selectNodeContents(element)
    const selection = element.ownerDocument.defaultView?.getSelection()
    selection?.removeAllRanges(); selection?.addRange(range)
  })
  await reader.getByRole('button', { name: 'Use selected passage', exact: true }).click()
  await literature.getByText('Selected sources (2)', { exact: true }).first().waitFor()
  await shot(page, 'literature-exact-page')
  await literature.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('button', { name: /Related.*Code librar/u }).click()
  const code = library(page, 'Code libraries')
  const repository = code.getByRole('button', { name: 'boundary-project', exact: true })
  const modelSource = code.getByRole('button', { name: 'model.py', exact: true })
  await repository.or(modelSource).first().waitFor()
  if (!await modelSource.isVisible()) await repository.click()
  await openSource(code, 'model.py')
  await reader.locator('pre').filter({ hasText: 'modified condition under A' }).waitFor()
  await reader.getByRole('button', { name: 'Use this source', exact: true }).click()
  const codeSelection = code.getByRole('button', { name: /^Selected sources/u })
  if (await codeSelection.getAttribute('aria-expanded') !== 'true') await codeSelection.click()
  await code.getByRole('textbox', { name: 'Source-set name', exact: true }).fill(SOURCE_SET)
  await code.getByRole('button', { name: 'Save source set', exact: true }).click()
  await code.getByRole('status').filter({ hasText: 'Source set saved in this app.' }).waitFor()
  const sets = await app.rpc<ResourceResult<SourceSetPage>>('researchResources/listSourceSets', { request: {} })
  expect(sets).toMatchObject({ ok: true, value: { items: [{ title: SOURCE_SET, selectionCount: 3 }] } })
  await code.getByRole('button', { name: 'Discuss selected sources', exact: true }).click()
  const input = discussion(page).locator('[data-composer-input]')
  await writeComposerDraft(page, input, QUESTION)
  await input.press('Enter')
  await discussion(page).getByText('The selected source states: Only under A.', { exact: false }).waitFor({ timeout: 30_000 })
  expect(model.requests).toHaveLength(1)
  for (const text of [QUESTION, 'Only under A.', 'Page two exact text', 'modified condition under A', 'topic:direction%2Fresearch.md']) {
    expect(model.requests[0]).toContain(text)
  }
  await shot(page, 'code-source-and-discussion')
  await code.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await discussion(page).getByText('The selected source states: Only under A.', { exact: false }).waitFor()
  expect(model.requests).toHaveLength(1)
  for (const [path, original] of project.sources) expect(await readFile(join(project.path, path))).toEqual(Buffer.from(original))
  expect(await readFile(join(project.path, '.git/index'))).toEqual(project.gitIndex)
  expect(errors).toEqual([])
  await writeFile(join(ARTIFACTS, `${PREFIX}-evidence.json`), JSON.stringify({
    workspaceId, modelRequests: model.requests.length, selectedSourceCount: 3, knowledgeFacts,
    checks: ['three-real-catalogs-and-readers', 'requested-library-metadata', 'authored-source-relation-navigation',
      'repository-folders-retained', 'real-working-staged-and-commit-diffs', 'native-diff-theme-colors', 'knowledge-metadata-spacing',
      'wiki-contents-keyboard', 'keyboard-source-open', '390px', 'dark', 'long-authored-title',
      'empty-search', 'empty-note', 'delayed-real-source-read', 'exact-pdf-page', 'durable-source-set',
      'topic-material-native-discussion-return', 'source-bytes-and-git-index-unchanged'],
  }, null, 2))
}, 240_000)

function resourceValue<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function nativePdfPage(panel: Locator, pageNumber: number, phrase: string): Promise<Locator> {
  const observed = panel.locator('details[data-pdf-page]')
  const current = Number(await observed.getAttribute('data-pdf-page'))
  const surface = panel.locator('article[data-material-presentation="dock"][tabindex="0"]')
  await surface.focus()
  // Navigate as the reader does before waiting for a lazy offscreen page to load.
  for (let step = 0; step < Math.abs(pageNumber - current); step++) {
    await surface.press(pageNumber > current ? 'PageDown' : 'PageUp')
    await expect.poll(() => observed.getAttribute('data-pdf-page')).toBe(String(current + (step + 1) * Math.sign(pageNumber - current)))
  }
  const physical = panel.locator(`[data-pdf-preview] [data-pdf-page="${pageNumber}"]`)
  await physical.getByRole('img', { name: `PDF page ${pageNumber}`, exact: true }).waitFor()
  await expect.poll(() => physical.getAttribute('data-pdf-page-ready')).toBe('true')
  const text = physical.locator('[data-pdf-text] span:not(.markedContent)').filter({ hasText: phrase }).first()
  await text.waitFor()
  // Native scroll feedback settles before checking the clamped last-page position.
  await panel.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { resolve() }))))
  await expect.poll(() => observed.getAttribute('data-pdf-page')).toBe(String(pageNumber))
  await expect.poll(async () => {
    const text = await observed.locator('pre').textContent()
    return { page: await observed.getAttribute('data-pdf-page'), text: text?.includes(phrase) === true ? phrase : text }
  }, { timeout: 10_000 }).toEqual({ page: String(pageNumber), text: phrase })
  return text
}

async function nativePdfZoom(page: Page, panel: Locator): Promise<Locator> {
  const frame = panel.locator('[data-document-zoom-frame]')
  await frame.scrollIntoViewIfNeeded()
  const box = await frame.boundingBox()
  if (box === null) throw new Error('The native PDF viewport has no visible bounds.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8)
  await expect.poll(() => panel.locator('[data-document-zoom-controls]').getAttribute('data-document-zoom-visible')).toBe('true')
  return panel.getByRole('button', { name: 'Choose zoom', exact: true })
}

it('uses the native continuous PDF reader for original bytes, retained viewing and exact later-page citations', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-native-library-pdf-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = []
  onTestFinished(async ({ task }) => {
    const failures: unknown[] = []
    if (task.result?.state === 'fail') {
      if (owned.page !== undefined) await saveFailureShot(owned.page, 'aitp-native-pdf-failure')
      if (owned.page !== undefined) {
        const position = await materialReading(owned.page).evaluate((element) => {
          const details = element.querySelector('details[data-pdf-page]')
          const viewport = element.querySelector('[data-document-zoom-scrollport]')
          return { page: details?.getAttribute('data-pdf-page'), text: details?.querySelector('pre')?.textContent,
            viewport: viewport === null ? null : { top: viewport.scrollTop, height: viewport.clientHeight, content: viewport.scrollHeight },
            pages: Array.from(element.querySelectorAll('[data-pdf-preview] [data-pdf-page]'), (page) => {
              const { top, bottom, height } = page.getBoundingClientRect()
              return { page: page.getAttribute('data-pdf-page'), top, bottom, height }
            }) }
        }).catch(String)
        await writeFile(join(ARTIFACTS, 'aitp-native-pdf-failure-position.json'), JSON.stringify(position, null, 2))
      }
      const body = owned.page === undefined || owned.page.isClosed() ? '(page unavailable)' : await owned.page.locator('body').innerText().catch(String)
      await writeFile(join(ARTIFACTS, 'aitp-native-pdf-failure.log'), `${owned.app?.logs() ?? ''}\n${errors.join('\n')}\n${body}`)
        .catch((error: unknown) => failures.push(error))
    }
    await model.close().catch((error: unknown) => failures.push(error))
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'The native PDF scenario did not close its own resources.')
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const pdfBytes = nativeLibraryPdf(1_100_000)
  const project = await createLibraryProject(world, { paperBytes: pdfBytes })
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  const url = await app.start()
  const { workspace } = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  const workspaceId = workspace.workspaceId
  resourceValue(await app.rpc<ResourceResult<unknown>>('researchResources/connectWorkspace', { request: { workspaceId } }))
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: false } })).toMatchObject({ ok: true })
  const catalog = resourceValue(await app.rpc<ResourceResult<ResourcePage>>('researchResources/listResources', {
    request: { domain: 'literature', query: 'boundary-controls.pdf' },
  }))
  const paper = catalog.items.find(item => materialSourcePath(item.ref.sourceId) === 'papers/boundary-controls.pdf')
  if (paper === undefined) throw new Error('The native PDF fixture was not discovered by the real literature provider.')
  const initial = resourceValue(await app.rpc<ResourceResult<ResourceReading>>('researchResources/readResource', {
    request: { ref: paper.ref, domain: 'literature' },
  }))
  expect(initial.body.kind).toBe('pdf')
  if (initial.body.kind !== 'pdf') throw new Error('The actual source is not a PDF reading.')
  expect(initial.body.pageCount).toBe(6)
  expect(initial.body.pages.map(value => value.page)).toEqual([1, 2, 3, 4])
  expect(initial.body.dataBase64).toBeUndefined()
  expect(pdfBytes.byteLength).toBeGreaterThan(1_048_576)

  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  page.on('pageerror', error => errors.push(String(error)))
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  await page.getByRole('button', { name: 'New session', exact: true }).last().click()
  await page.getByRole('button', { name: 'Boundary research project', exact: true }).click()
  const research = page.locator('section[aria-label="Research"]')
  await research.locator('[data-map-node]').filter({ hasText: TOPIC }).click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  await research.getByRole('button', { name: /Related.*Literature library/u }).click()
  const literature = library(page, 'Literature library')
  const reader = materialReading(page)
  await literature.getByRole('row').filter({ has: page.getByText('PDF', { exact: true }) })
    .getByRole('button', { name: PAPER, exact: true }).click()
  await reader.locator('[data-pdf-preview]').waitFor()
  expect(await reader.locator('[data-pdf-preview] [data-pdf-page]').count()).toBe(6)
  await reader.getByRole('img', { name: 'PDF page 1', exact: true }).waitFor()
  expect(model.requests).toHaveLength(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.getByRole('navigation', { name: 'Global panels' })
    .getByRole('button', { name: 'Literature library', exact: true }).innerText()).toBe('')
  const narrowScope = await materialDock(page).evaluate(element => ({
    width: element.getBoundingClientRect().width, availableWidth: innerWidth,
    presentation: element.getAttribute('data-sidebar-right-panel'),
  }))
  expect(narrowScope.presentation).toBe('fullscreen')
  expect(narrowScope.width).toBeLessThanOrEqual(narrowScope.availableWidth)
  await nativePdfZoom(page, reader)
  await shot(page, 'native-pdf-narrow-fit')
  await page.setViewportSize({ width: 1600, height: 1000 })

  const secondText = await nativePdfPage(reader, 2, PDF_PAGE_TWO)
  await secondText.click({ clickCount: 3 })
  await expect.poll(() => page.evaluate(() => globalThis.getSelection()?.toString().trim())).toBe(PDF_PAGE_TWO)
  await reader.getByRole('button', { name: 'Use selected passage', exact: true }).click()
  await literature.getByText('Selected sources (1)', { exact: true }).first().waitFor()
  await literature.getByRole('button', { name: 'Discuss selected sources', exact: true }).click()
  const firstQuestion = 'Explain the selected second physical page, retaining its exact quotation.'
  await writeComposerDraft(page, discussion(page).locator('[data-composer-input]'), firstQuestion)
  await discussion(page).locator('[data-composer-input]').press('Enter')
  await discussion(page).getByRole('link', { name: 'Source passage', exact: true }).waitFor()
  expect(model.requests).toHaveLength(1)
  expect(model.requests[0]).toContain(PDF_PAGE_TWO)

  await nativePdfPage(reader, 5, PDF_PAGE_FIVE)
  await (await nativePdfZoom(page, reader)).click()
  await page.getByRole('menuitem', { name: '150%', exact: true }).click()
  await expect.poll(() => reader.locator('[data-document-zoom-frame]').getAttribute('data-document-zoom-mode')).toBe('fixed')
  await nativePdfPage(reader, 5, PDF_PAGE_FIVE)
  const fifthCanvas = reader.getByRole('img', { name: 'PDF page 5', exact: true })
  await expect.poll(() => fifthCanvas.evaluate((element) => {
    const intrinsic = Number.parseFloat(element.style.getPropertyValue('--pdf-page-width'))
    return element.getBoundingClientRect().width / intrinsic
  })).toBeCloseTo(1.5, 1)
  const scrollport = reader.locator('[data-document-zoom-scrollport]')
  const retainedScrollTop = await scrollport.evaluate(element => element.scrollTop)
  await shot(page, 'native-pdf-page5-fixed-zoom')
  await literature.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: TOPIC, exact: true, level: 2 }).waitFor()
  await openLibrary(page, 'Literature library')
  await expect.poll(() => reader.locator('details[data-pdf-page]').getAttribute('data-pdf-page')).toBe('5')
  await expect.poll(() => scrollport.evaluate(element => element.scrollTop)).toBeCloseTo(retainedScrollTop, 0)
  expect(await reader.locator('[data-document-zoom-frame]').getAttribute('data-document-zoom-mode')).toBe('fixed')
  await literature.getByText('Selected sources (1)', { exact: true }).first().waitFor()
  expect(model.requests).toHaveLength(1)
  await shot(page, 'native-pdf-restored-page-and-zoom')

  // A citation opens its original located page; subsequent scrolling is viewing, not quotation mutation.
  await literature.getByRole('button', { name: 'Discuss selected sources', exact: true }).click()
  await discussion(page).getByRole('link', { name: 'Source passage', exact: true }).click()
  await expect.poll(() => reader.locator('details[data-pdf-page]').getAttribute('data-pdf-page')).toBe('2')
  const fifthText = await nativePdfPage(reader, 5, PDF_PAGE_FIVE)
  await (await nativePdfZoom(page, reader)).click()
  await page.getByRole('menuitem', { name: 'Fit width', exact: true }).click()
  await expect.poll(() => reader.locator('[data-document-zoom-frame]').getAttribute('data-document-zoom-mode')).toBe('fit-width')
  await nativePdfPage(reader, 5, PDF_PAGE_FIVE)
  await nativePdfZoom(page, reader)
  await shot(page, 'native-pdf-page5-fit-width')
  await fifthText.click({ clickCount: 3 })
  await expect.poll(() => page.evaluate(() => globalThis.getSelection()?.toString().trim())).toBe(PDF_PAGE_FIVE)
  await reader.getByRole('button', { name: 'Use selected passage', exact: true }).click()
  await literature.getByRole('button', { name: 'Back to library', exact: true }).click()
  await literature.getByText('Selected sources (2)', { exact: true }).first().waitFor()
  const literatureSelection = literature.getByRole('button', { name: /^Selected sources/u })
  if (await literatureSelection.getAttribute('aria-expanded') !== 'true') await literatureSelection.click()
  await literature.getByRole('textbox', { name: 'Source-set name', exact: true }).fill('Exact physical pages two and five')
  await literature.getByRole('button', { name: 'Save source set', exact: true }).click()
  await literature.getByRole('status').filter({ hasText: 'Source set saved in this app.' }).waitFor()
  const sets = resourceValue(await app.rpc<ResourceResult<SourceSetPage>>('researchResources/listSourceSets', { request: {} }))
  const saved = sets.items.find(item => item.title === 'Exact physical pages two and five')
  if (saved === undefined) throw new Error('The exact PDF selections were not saved.')
  const detail = resourceValue(await app.rpc<ResourceResult<SourceSet>>('researchResources/getSourceSet', { request: { id: saved.id } }))
  expect(detail.selections.map(item => item.locator)).toEqual([
    { kind: 'pdf-page', page: 2, quote: PDF_PAGE_TWO }, { kind: 'pdf-page', page: 5, quote: PDF_PAGE_FIVE },
  ])
  await nativePdfPage(reader, 6, 'Page six exact text: No additional conclusion is established.')
  await nativePdfPage(reader, 5, PDF_PAGE_FIVE)
  await reader.locator('[data-pdf-preview]').evaluate((element) => {
    const from = element.querySelector('[data-pdf-page="5"] [data-pdf-text] span:not(.markedContent)')
    const to = element.querySelector('[data-pdf-page="6"] [data-pdf-text] span:not(.markedContent)')
    if (from === null || to === null) throw new Error('Both native page text layers must exist for the cross-page selection.')
    const range = element.ownerDocument.createRange()
    range.setStartBefore(from)
    range.setEndAfter(to)
    const selection = element.ownerDocument.defaultView?.getSelection()
    selection?.removeAllRanges(); selection?.addRange(range)
  })
  await reader.getByRole('button', { name: 'Use selected passage', exact: true }).click()
  await reader.getByRole('alert').filter({ hasText: 'Select a passage within one PDF page.' }).waitFor()
  await literature.getByText('Selected sources (2)', { exact: true }).first().waitFor()
  await literature.getByRole('button', { name: 'Discuss selected sources', exact: true }).click()
  const secondQuestion = 'Explain the selected fifth physical page without dropping the earlier page conditions.'
  await writeComposerDraft(page, discussion(page).locator('[data-composer-input]'), secondQuestion)
  await discussion(page).locator('[data-composer-input]').press('Enter')
  await expect.poll(() => model.requests.length, { timeout: 30_000 }).toBe(2)
  await expect.poll(() => discussion(page).getByRole('link', { name: 'Source passage', exact: true }).count()).toBe(2)
  expect(model.requests[1]).toContain(secondQuestion)
  expect(model.requests[1]).toContain(PDF_PAGE_FIVE)
  expect(model.requests[1]).toContain('topic:direction%2Fresearch.md')
  await shot(page, 'native-pdf-later-page-citation')
  for (const [path, original] of project.sources) expect(await readFile(join(project.path, path))).toEqual(Buffer.from(original))
  expect(await readFile(join(project.path, '.git/index'))).toEqual(project.gitIndex)
  expect(errors).toEqual([])
  await writeFile(join(ARTIFACTS, 'aitp-native-pdf-evidence.json'), JSON.stringify({
    physicalPages: 6, originalBytes: pdfBytes.byteLength, initialExtractedPages: initial.body.pages.map(value => value.page),
    inlineBytesAbsent: initial.body.dataBase64 === undefined, selectedPages: [2, 5], retainedScrollTop, narrowScope,
    modelRequests: model.requests.length, sourceFilesUnchanged: project.sources.size,
    checks: ['native-continuous-pages', 'native-text-layer-selection', 'original-file-over-inline-limit',
      'fit-width-and-fixed-zoom', '390px-native-pdf', 'visible-page-following', 'page-scroll-and-zoom-restored',
      'old-located-citation-to-later-page', 'exact-later-page-server-read', 'cross-page-selection-refused',
      'native-topic-discussion', 'immutable-saved-quotations'],
  }, null, 2))
}, 240_000)
