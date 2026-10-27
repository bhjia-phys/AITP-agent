/** Real research reading + native discussions: durable scope, per-Session drafts, sources and confirmed writes. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type { DiscussionPage, Result } from '@deepseek-ai/dsh-research-memory/types'
import { LibraryApp } from './fixtures/local-libraries/server.ts'
import { WorkbenchModel } from './fixtures/workbench/model.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'
import { materialReading } from './fixtures/library-ui/dock.ts'

const ALPHA = 'Finite boundary direction'
const BETA = 'Independent control direction'
const OLD_SCOPE = 'ALPHA_ONLY_CONDITION: finite N=6 under assumption A; the boundary control is still missing.'
const NEW_SCOPE = 'ALPHA_ONLY_CONDITION: finite N=6 under assumption A; compare both matched boundary controls before generalizing.'
const BETA_SCOPE = 'BETA_ONLY_CONDITION: independent convention B; no inference from the finite A control.'
const SOURCE_QUESTION = 'Which condition supports the finite boundary direction?'
const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))

function research(page: Page): Locator { return page.locator('section[aria-label="Research"]') }
function discussion(page: Page): Locator { return page.locator('[data-research-discussion]').filter({ visible: true }) }
function input(page: Page): Locator { return discussion(page).locator('[data-composer-input]') }

async function openTopic(page: Page, title: string): Promise<void> {
  const panel = research(page)
  await panel.waitFor()
  const map = panel.getByRole('navigation', { name: 'Research location' }).getByRole('button', { name: 'Research map', exact: true })
  if (await map.isVisible()) await map.click()
  await panel.locator('[data-map-node]').filter({ hasText: title }).click()
  await panel.getByRole('button', { name: 'Open topic', exact: true }).click()
  await panel.getByRole('heading', { name: title, exact: true, level: 2 }).waitFor()
}

async function send(page: Page, question: string): Promise<void> {
  await writeComposerDraft(page, input(page), question)
  await input(page).press('Enter')
}

async function reply(page: Page, number: number): Promise<void> {
  await discussion(page).getByText(`Workbench reply ${number}. The stated conditions remain in force.`, { exact: false }).waitFor({ timeout: 30_000 })
}

async function chooseDiscussion(page: Page, title: string): Promise<void> {
  const picker = discussion(page).getByRole('button', { name: 'Discussions in this direction', exact: true })
  await picker.focus()
  await picker.press('Enter')
  const item = page.getByRole('menuitem', { name: title, exact: true })
  await item.focus()
  await item.press('Enter')
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(ARTIFACTS, `aitp-workbench-${name}.png`), fullPage: true, animations: 'disabled' })
}

it('keeps two directions, multiple native discussions, source navigation and real source writes together across restart', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-workbench-')), project = join(world, 'research-project')
  const model = new WorkbenchModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  const errors: string[] = []
  onTestFinished(async ({ task }) => {
    const failures: unknown[] = []
    if (task.result?.state === 'fail') {
      const page = owned.page
      if (page !== undefined) await saveFailureShot(page, 'aitp-workbench-failure')
      const body = page === undefined || page.isClosed() ? '(page unavailable)' : await page.locator('body').innerText().catch(String)
      await writeFile(join(ARTIFACTS, 'aitp-workbench-failure.log'),
        `${owned.app?.logs() ?? ''}\n${errors.join('\n')}\n${model.failures.join('\n')}\n${body}`).catch((error: unknown) => failures.push(error))
    }
    await model.close().catch((error: unknown) => failures.push(error))
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'The workbench scenario did not close its owned resources.')
  })
  await mkdir(ARTIFACTS, { recursive: true })
  const longContext = Array.from({ length: 8 }, (_, index) => `Synthetic reading detail ${index + 1}: keep the finite-system conditions attached to this direction; the parent question remains unresolved.`).join('\n\n')
  const sources = new Map([
    ['research.md', `# Synthetic research project\n\nThis isolated fixture makes no scientific claim.\n\n## Topics\n\n[${ALPHA}](a/research.md)\n[${BETA}](b/research.md)\n`],
    ['a/research.md', `# ${ALPHA}\n\n## Question\n\nWhich matched finite control distinguishes the boundary effects?\n\n## Current answer\n\nNo accepted boundary conclusion yet.\n\n## Scope\n\n${OLD_SCOPE}\n\n## Current work\n\n${longContext}\n\n## Materials\n\n[Condition](../condition.md)\n[Alpha research record](research.md)\n`],
    ['b/research.md', `# ${BETA}\n\n## Question\n\nWhich independent convention is required?\n\n## Scope\n\n${BETA_SCOPE}\n\n## Materials\n\n[Independent note](../independent.md)\n`],
    ['index.md', `# Synthetic knowledge index\n\n| Question | Kind | Note | Support | Review |\n|---|---|---|---|---|\n| ${SOURCE_QUESTION} | theorem | [Condition](condition.md) | source | awaiting |\n| Alpha research record | theorem | [Alpha account](a/research.md) | source | awaiting |\n| Independent note | theorem | [Independent](independent.md) | source | awaiting |\n`],
    ['condition.md', '# Finite boundary condition\n\nOnly under A. Other conditions remain unresolved.\n'],
    ['independent.md', '# Independent condition\n\nOnly under independent convention B.\n'],
  ])
  for (const [path, text] of sources) {
    await mkdir(dirname(join(project, path)), { recursive: true })
    await writeFile(join(project, path), text)
  }
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  let url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project } })
  const workspaceId = workspace.workspace.workspaceId
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId } })).toMatchObject({ ok: true })
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: true } })).toMatchObject({ ok: true })
  const list = async (direction: 'a' | 'b'): Promise<DiscussionPage> => {
    const result = await app.rpc<Result<DiscussionPage>>('researchMemory/listDiscussions', {
      request: { workspaceId, topicId: `topic:${direction}%2Fresearch.md` },
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  await page.setViewportSize({ width: 1600, height: 1000 })
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
  await openTopic(page, ALPHA)
  expect(model.requests).toHaveLength(0)
  expect((await list('a')).items).toHaveLength(0)

  await research(page).getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  await writeComposerDraft(page, input(page), 'ALPHA_FIRST_QUESTION')
  await openTopic(page, BETA)
  await research(page).getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  await writeComposerDraft(page, input(page), 'BETA_FIRST_QUESTION')
  expect(model.requests).toHaveLength(0)
  await openTopic(page, ALPHA)
  await expect.poll(() => input(page).innerText()).toBe('ALPHA_FIRST_QUESTION')
  await input(page).press('Enter')
  await reply(page, 1)
  expect(model.requests[0]).toContain(OLD_SCOPE)
  expect(model.requests[0]).not.toContain(BETA_SCOPE)
  const alphaFirst = (await list('a')).items[0]
  if (alphaFirst === undefined) throw new Error('The admitted Alpha discussion was not discoverable.')
  await discussion(page).getByRole('button', { name: 'New', exact: true }).click()
  await send(page, 'ALPHA_SECOND_QUESTION')
  await reply(page, 2)
  const alphaRows = (await list('a')).items
  expect(alphaRows).toHaveLength(2)
  const alphaSecond = alphaRows.find(item => item.sessionId !== alphaFirst.sessionId)
  if (alphaSecond === undefined) throw new Error('Explicit New reused the first nonblank discussion.')
  await writeComposerDraft(page, input(page), 'ALPHA_SECOND_UNSENT_DRAFT')
  await chooseDiscussion(page, alphaFirst.title)
  await writeComposerDraft(page, input(page), 'ALPHA_FIRST_UNSENT_DRAFT')
  await chooseDiscussion(page, alphaSecond.title)
  await expect.poll(() => input(page).innerText()).toBe('ALPHA_SECOND_UNSENT_DRAFT')
  await chooseDiscussion(page, alphaFirst.title)
  await expect.poll(() => input(page).innerText()).toBe('ALPHA_FIRST_UNSENT_DRAFT')
  const actions = discussion(page).getByRole('button', { name: 'Discussion actions', exact: true })
  await actions.focus()
  await actions.press('Enter')
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor()
  expect(await page.getByRole('menu').evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => actions.evaluate(element => element === document.activeElement)).toBe(true)
  await actions.press('Enter')
  const renameItem = page.getByRole('menuitem', { name: 'Rename', exact: true })
  await renameItem.focus()
  await renameItem.press('Enter')
  const rename = page.getByRole('dialog', { name: 'Rename discussion', exact: true })
  await rename.waitFor()
  await page.keyboard.press('Tab')
  expect(await rename.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await rename.getByRole('textbox', { name: 'Discussion name', exact: true }).fill('Boundary control discussion')
  await rename.getByRole('button', { name: 'Rename', exact: true }).click()
  await expect.poll(async () => (await list('a')).items.find(item => item.sessionId === alphaFirst.sessionId)?.title)
    .toBe('Boundary control discussion')
  await discussion(page).getByRole('button', { name: 'Discussions in this direction', exact: true })
    .getByText('Boundary control discussion', { exact: true }).waitFor()
  expect(model.requests).toHaveLength(2)
  await shot(page, 'native-topic-and-discussions')

  await openTopic(page, BETA)
  await expect.poll(() => input(page).innerText()).toBe('BETA_FIRST_QUESTION')
  await input(page).press('Enter')
  await reply(page, 3)
  expect(model.requests[2]).toContain(BETA_SCOPE)
  expect(model.requests[2]).not.toContain(OLD_SCOPE)
  const beta = (await list('b')).items[0]
  if (beta === undefined) throw new Error('The admitted Beta discussion was not discoverable.')
  expect(alphaRows.every(item => item.sessionId !== beta.sessionId)).toBe(true)

  await openTopic(page, ALPHA)
  const held = model.holdNext()
  await send(page, 'ALPHA_IN_FLIGHT_QUESTION')
  await held.received
  expect((await list('a')).items.find(item => item.sessionId === alphaFirst.sessionId)?.busy).toBe(true)
  await openTopic(page, BETA)
  await send(page, 'BETA_WHILE_ALPHA_IS_RUNNING')
  await reply(page, 5)
  expect(model.requests[3]).toContain('topic:a%2Fresearch.md')
  expect(model.requests[3]).not.toContain(BETA_SCOPE)
  expect(model.requests[4]).toContain('topic:b%2Fresearch.md')
  expect(model.requests[4]).not.toContain(OLD_SCOPE)
  held.release()
  await openTopic(page, ALPHA)
  await reply(page, 4)
  expect((await list('a')).items).toHaveLength(2)
  expect((await list('b')).items).toHaveLength(1)

  const reading = research(page).locator('[data-research-reading]')
  await reading.evaluate((element) => { element.scrollTop = 180 })
  const departure = await reading.evaluate(element => element.scrollTop)
  await research(page).getByRole('button', { name: /Related.*Knowledge library/u }).click()
  const knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByRole('button', { name: SOURCE_QUESTION, exact: true }).click()
  await materialReading(page).getByRole('button', { name: 'Discuss this source', exact: true }).click()
  await send(page, 'MATERIAL_QUESTION_WITH_EXACT_DIRECTION')
  await reply(page, 6)
  expect(model.requests[5]).toContain('Only under A. Other conditions remain unresolved.')
  expect(model.requests[5]).toContain('topic:a%2Fresearch.md')
  await discussion(page).getByRole('link', { name: 'Source passage', exact: true }).last().click()
  await materialReading(page).getByRole('heading', { name: 'Finite boundary condition', exact: true }).waitFor()
  expect(await discussion(page).locator('[data-composer-input]').count()).toBe(1)
  await shot(page, 'material-citation-and-native-chat')
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research(page).getByRole('heading', { name: ALPHA, exact: true, level: 2 }).waitFor()
  await expect.poll(() => reading.evaluate(element => element.scrollTop)).toBeCloseTo(departure, 0)
  await reply(page, 6)

  // The actual model tools write only the temporary account. Both reader families must observe that result.
  await research(page).getByRole('button', { name: /Related.*Knowledge library/u }).click()
  await knowledge.getByRole('button', { name: 'Alpha research record', exact: true }).click()
  await materialReading(page).getByText(OLD_SCOPE, { exact: true }).waitFor()
  await materialReading(page).getByRole('button', { name: 'Discuss this source', exact: true }).click()
  await discussion(page).locator('[aria-label^="Access mode"]').click()
  await page.getByRole('menuitem', { name: 'Workspace Write', exact: true }).click()
  await discussion(page).locator('[aria-label="Access mode, current: Workspace Write"]').waitFor()
  model.writeNext('resource:a%2Fresearch.md', OLD_SCOPE, NEW_SCOPE)
  await send(page, 'Save the synthetic corrected scope in this direction, preserving its finite N=6 and A conditions.')
  await discussion(page).getByText('WORKBENCH_CONFIRMED_SAVE:', { exact: false }).waitFor({ timeout: 30_000 })
  const notice = discussion(page).locator('[data-research-change-notice]')
  await notice.getByRole('status').filter({ hasText: 'Research record updated' }).waitFor()
  await notice.getByRole('button', { name: 'View changes', exact: true }).click()
  await notice.getByText('Confirmed saved change', { exact: true }).waitFor()
  await notice.getByText(OLD_SCOPE, { exact: false }).waitFor()
  await notice.getByText(NEW_SCOPE, { exact: false }).waitFor()
  await shot(page, 'confirmed-change-diff')
  await notice.getByRole('button', { name: 'Hide changes', exact: true }).click()
  await materialReading(page).getByText(NEW_SCOPE, { exact: true }).waitFor({ timeout: 15_000 })
  expect(await readFile(join(project, 'a/research.md'), 'utf8')).toContain(NEW_SCOPE)
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await research(page).locator('[data-research-reading]').getByText(NEW_SCOPE, { exact: true }).waitFor()
  await expect.poll(() => reading.evaluate(element => element.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')))
    .toBe(false)
  await shot(page, 'confirmed-source-write-refreshed')
  for (const [path, original] of sources) if (path !== 'a/research.md') expect(await readFile(join(project, path), 'utf8')).toBe(original)

  const requestsBeforeRestart = model.requests.length
  const port = Number(new URL(url).port)
  await app.stop()
  url = await app.start(port)
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
  await openTopic(page, ALPHA)
  await research(page).getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  await discussion(page).getByText('WORKBENCH_CONFIRMED_SAVE:', { exact: false }).waitFor({ timeout: 30_000 })
  expect(model.requests).toHaveLength(requestsBeforeRestart)
  expect((await list('a')).items.map(item => item.sessionId).sort()).toEqual(alphaRows.map(item => item.sessionId).sort())
  expect((await list('a')).items.find(item => item.sessionId === alphaFirst.sessionId)?.title).toBe('Boundary control discussion')
  await discussion(page).locator('[data-research-change-notice]').getByRole('status')
    .filter({ hasText: 'Research record updated' }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await shot(page, 'restored-narrow')
  expect(errors).toEqual([])
  expect(model.failures).toEqual([])
  await writeFile(join(ARTIFACTS, 'aitp-workbench-evidence.json'), JSON.stringify({
    workspaceId, alphaSessions: alphaRows.map(item => item.sessionId), betaSession: beta.sessionId,
    requests: model.requests.length, retainedAfterRestart: true, confirmedSource: 'a/research.md',
    actualModelOnlyIsDeterministic: true, screenshots: ['native-topic-and-discussions', 'material-citation-and-native-chat',
      'confirmed-change-diff', 'confirmed-source-write-refreshed', 'restored-narrow'],
  }, null, 2))
}, 240_000)
