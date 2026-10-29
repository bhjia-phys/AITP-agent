/** Actual Loader and browser material writes: explicit destinations, uncertain acknowledgement and PDF copies. */
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type { CreateTopicReceipt, MaterialLocation, ReadEnvelope, Result, TopicId, TopicPage } from '@deepseek-ai/dsh-research-memory/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { createLibraryProject, PAPER, TOPIC } from './fixtures/library-ui/project.ts'
import { materialReading } from './fixtures/library-ui/dock.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))
const PREFIX = 'aitp-material-writes'
const BRANCHES = ['Finite control branch', 'Asymptotic comparison', 'Fourth-level observable check'] as const
const NOTE = '# Bounded observable check\n\nOnly condition A is established. The independent control remains unresolved.\n'

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function enterDeepTopic(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'New session', exact: true }).last().click()
  await page.getByRole('button', { name: 'Boundary research project', exact: true }).click()
  const research = page.locator('section[aria-label="Research"]')
  for (const title of [TOPIC, ...BRANCHES]) await research.locator('[data-map-node]').filter({ hasText: title }).first().click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  await research.getByRole('heading', { name: BRANCHES[2], exact: true, level: 2 }).waitFor()
  return research
}

async function openWrite(owner: Locator, pdf = false): Promise<Locator> {
  const label = pdf ? 'Import a PDF copy' : 'Save a file'
  const summary = owner.locator('summary').filter({ hasText: new RegExp(`^${label}$`, 'u') })
  await summary.focus()
  await summary.press('Enter')
  const form = owner.getByRole('region', { name: label, exact: true })
  await form.getByRole('textbox', { name: 'File path within the project', exact: true }).waitFor()
  return form
}

async function screenshots(page: Page, app: LibraryApp, form: Locator, name: string, submit: string): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: theme } })
    await expect.poll(() => page.locator('body').evaluate(element => element.hasAttribute('data-ds-dark-theme'))).toBe(theme === 'dark')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await form.locator('..').evaluate((element) => { element.scrollTop = 0; element.scrollIntoView({ block: 'start' }) })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
      expect(await form.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-${name}-${theme}-${width}.png`), animations: 'disabled' })
      const button = form.getByRole('button', { name: submit, exact: true })
      await button.scrollIntoViewIfNeeded()
      await button.focus()
      expect(await button.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)
      if (width === 390) await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-${name}-${theme}-390-actions.png`), animations: 'disabled' })
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'light' } })
}

it('saves a file and explicitly imports a PDF into a fourth-level topic through the real workbench', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-material-writes-'))
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = []
  onTestFinished(async ({ task }) => {
    const failures: unknown[] = []
    if (task.result?.state === 'fail') {
      if (owned.page !== undefined) await saveFailureShot(owned.page, `${PREFIX}-failure`)
      const body = owned.page === undefined || owned.page.isClosed() ? '(page unavailable)' : await owned.page.locator('body').innerText().catch(String)
      await writeFile(join(ARTIFACTS, `${PREFIX}-failure.log`), `${owned.app?.logs() ?? ''}\n${errors.join('\n')}\n${body}`)
        .catch((error: unknown) => failures.push(error))
    }
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await model.close().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'Material-writing fixture cleanup failed.')
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const project = await createLibraryProject(world)
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  const url = await app.start()
  const { workspace } = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project.path } })
  const workspaceId = workspace.workspaceId
  value(await app.rpc<Result<unknown>>('researchMemory/initialize', { request: { workspaceId, writable: true } }))
  value(await app.rpc<Result<unknown>>('researchResources/connectWorkspace', { request: { workspaceId } }))
  const topics = value(await app.rpc<Result<ReadEnvelope<TopicPage>>>('researchMemory/listTopics', { request: { workspaceId, query: {} } }))
  let topicId: TopicId | undefined = topics.value.items.find(item => item.value.title === TOPIC)?.value.id
  if (topicId === undefined) throw new Error('The authored starting topic was not discovered.')
  for (const [index, title] of BRANCHES.entries()) {
    const created: CreateTopicReceipt = value(await app.rpc<Result<CreateTopicReceipt>>('researchMemory/createTopic', { request: {
      workspaceId, operationId: randomUUID(), parentTopicId: topicId, directory: `control-${index + 2}`, title,
      question: 'Which finite-system condition remains untested?', scope: 'Synthetic fixture only; no new result is asserted.',
    } }))
    topicId = created.topicId
  }
  const location = value(await app.rpc<Result<MaterialLocation>>('researchMaterialFiles/getLocation', { request: { workspaceId, topicId } }))
  expect(location.writable).toBe(true)
  const notePath = `${location.directory}/notes/有限控制与尚待核对的边界条件.md`
  const pdfPath = `${location.directory}/papers/explicit-boundary-controls-copy.pdf`
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  page.on('pageerror', error => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  const research = await enterDeepTopic(page)
  await research.getByRole('button', { name: /Related.*Knowledge library/u }).click()
  const knowledge = page.locator('section[aria-label="Knowledge library"]').first()
  let form = await openWrite(knowledge)
  expect(await form.locator('..').evaluate(element => getComputedStyle(element).overflowY)).toBe('visible')
  const fillNote = async (): Promise<void> => {
    const path = form.getByRole('textbox', { name: 'File path within the project', exact: true })
    await path.fill(notePath)
    await path.press('Tab')
    expect(await form.getByRole('textbox', { name: 'File content', exact: true }).evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)
    await form.getByRole('textbox', { name: 'File content', exact: true }).fill(NOTE)
    await form.getByRole('textbox', { name: 'Link title', exact: true }).fill('Fourth-level bounded note')
    await form.getByRole('textbox', { name: 'How this file is used (optional)', exact: true }).fill('Keep the finite-system limitation attached to this comparison.')
  }
  await fillNote()
  expect(await form.getByLabel('Destination preview', { exact: true }).innerText()).toBe(join(project.path, notePath))
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect.poll(() => readFile(join(project.path, notePath)).then(() => 'exists', (error: unknown) => (error as NodeJS.ErrnoException).code)).toBe('ENOENT')
  form = await openWrite(knowledge)
  await fillNote()
  await screenshots(page, app, form, 'new-file', 'Save file')
  const operations: string[] = []
  await page.route('**/api/researchMaterialFiles/saveText', async (route) => {
    const data = route.request().postDataJSON() as { payload: { args: { request: { operationId: string } } } }
    operations.push(data.payload.args.request.operationId)
    if (operations.length === 1) { await route.fetch(); await route.abort('failed') }
    else await route.continue()
  })
  await form.getByRole('button', { name: 'Save file', exact: true }).click()
  await form.getByRole('button', { name: 'Retry the same operation', exact: true }).waitFor()
  expect(await readFile(join(project.path, notePath), 'utf8')).toBe(NOTE)
  expect(await form.getByRole('textbox', { name: 'File path within the project', exact: true }).isDisabled()).toBe(true)
  await form.getByRole('button', { name: 'Retry the same operation', exact: true }).click()
  await form.getByText('Saved', { exact: true }).waitFor()
  await form.getByText('Linked', { exact: true }).waitFor()
  await form.getByText('Matches the submitted content', { exact: true }).waitFor()
  expect(operations).toHaveLength(2)
  expect(operations[0]).toBe(operations[1])
  await page.unrouteAll({ behavior: 'wait' })
  expect((await readFile(join(project.path, location.accountPath), 'utf8')).match(/Fourth-level bounded note/gu)).toHaveLength(1)
  await form.getByRole('button', { name: 'Inspect file', exact: true }).click()
  await expect.poll(() => knowledge.getByRole('region', { name: 'Save a file', exact: true }).count()).toBe(0)
  const reader = materialReading(page)
  await reader.getByText('Only condition A is established. The independent control remains unresolved.', { exact: true }).waitFor()
  await reader.locator('summary').filter({ hasText: /^Source location/u }).click()
  await reader.getByText(project.path, { exact: true }).waitFor()
  await reader.getByText(notePath, { exact: true }).filter({ visible: true }).last().waitFor()
  await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-actual-note-location.png`), animations: 'disabled' })
  for (const theme of ['light', 'dark'] as const) {
    await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: theme } })
    await expect.poll(() => page.locator('body').evaluate(element => element.hasAttribute('data-ds-dark-theme'))).toBe(theme === 'dark')
    await page.setViewportSize({ width: 390, height: 1000 })
    await reader.getByText(notePath, { exact: true }).filter({ visible: true }).last().scrollIntoViewIfNeeded()
    expect(await reader.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: join(ARTIFACTS, `${PREFIX}-actual-note-location-${theme}-390.png`), animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'light' } })
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: BRANCHES[2], exact: true, level: 2 }).waitFor()
  await research.getByRole('button', { name: /Related.*Literature library/u }).click()
  const literature = page.locator('section[aria-label="Literature library"]').first()
  await expect.poll(() => literature.getByRole('region', { name: 'Save a file', exact: true }).count()).toBe(0)
  await literature.getByRole('combobox', { name: 'Materials shown', exact: true }).selectOption('all')
  await literature.getByRole('row').filter({ has: page.getByText('PDF', { exact: true }) })
    .getByRole('button', { name: PAPER, exact: true }).click()
  await reader.locator('[data-pdf-preview]').waitFor()
  const pdf = await openWrite(reader, true)
  expect(await pdf.locator('..').evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
  await pdf.getByRole('textbox', { name: 'File path within the project', exact: true }).fill(pdfPath)
  expect(await pdf.getByRole('checkbox', { name: 'Add a link to the selected research account', exact: true }).isChecked()).toBe(true)
  await screenshots(page, app, pdf, 'import-pdf', 'Import PDF copy')
  await pdf.getByRole('button', { name: 'Import PDF copy', exact: true }).click()
  await pdf.getByText('Saved', { exact: true }).waitFor()
  await pdf.getByText('Linked', { exact: true }).waitFor()
  const originalPdf = project.sources.get('papers/boundary-controls.pdf')
  expect(await readFile(join(project.path, pdfPath))).toEqual(originalPdf)
  expect(await readFile(join(project.path, 'papers/boundary-controls.pdf'))).toEqual(originalPdf)
  const accountAfterCopy = await readFile(join(project.path, location.accountPath), 'utf8')
  expect(accountAfterCopy).toContain('explicit-boundary-controls-copy.pdf')
  await pdf.getByRole('button', { name: 'Edit destination or content', exact: true }).click()
  await pdf.getByRole('button', { name: 'Import PDF copy', exact: true }).click()
  await pdf.getByText('Conflict — inspect the existing file', { exact: true }).waitFor()
  expect(await readFile(join(project.path, pdfPath))).toEqual(originalPdf)
  expect(await readFile(join(project.path, location.accountPath), 'utf8')).toBe(accountAfterCopy)
  await pdf.getByRole('button', { name: 'Inspect file', exact: true }).click()
  await reader.locator('[data-pdf-preview]').waitFor()
  await literature.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research.getByRole('heading', { name: BRANCHES[2], exact: true, level: 2 }).waitFor()
  expect(await readFile(join(project.path, 'index.md'), 'utf8')).toBe(project.sources.get('index.md'))
  expect(await readFile(join(project.path, 'model.py'), 'utf8')).toBe(project.sources.get('model.py'))
  expect(await readFile(join(project.path, '.git/index'))).toEqual(project.gitIndex)
  expect(model.requests).toHaveLength(0)
  expect(errors).toEqual([])
  await writeFile(join(ARTIFACTS, `${PREFIX}-evidence.json`), JSON.stringify({ workspaceId, topicId, directory: location.directory,
    notePath, pdfPath, operations, modelRequests: model.requests.length,
    checks: ['actual-loader-and-browser', 'four-topic-levels', 'cancel-does-not-write', 'explicit-relative-path',
      'lost-acknowledgement-same-operation-retry', 'file-link-readback-separate', 'native-inspect-return-to-original-topic',
      'authorized-pdf-explicit-copy', 'same-name-conflict-preserves-bytes-and-account', 'original-pdf-index-code-and-git-index-unchanged',
      'keyboard-open-tab-submit-focus', 'catalog-one-scrollport', 'completed-form-collapses-and-stays-collapsed-across-libraries',
      'light-dark-1440-390-no-horizontal-overflow'] }, null, 2))
}, 300_000)
