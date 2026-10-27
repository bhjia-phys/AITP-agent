/**
 * The topic-page pilot uses the actual Host, local source readers and ordinary Session path.
 * Only the external model endpoint is deterministic; its answer proves delivery, not research quality.
 */
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import type { WorkspaceCreateValue } from '@deepseek-ai/dsh-api-workspace-controller/types'
import { LibraryApp, LibraryModel } from './fixtures/local-libraries/server.ts'
import { newEnglishPage, saveFailureShot, writeComposerDraft } from './support.ts'

const execFile = promisify(execFileCallback)
const TOPIC = '开放边界下的低能谱'
const LONG_TOPIC = '在有限尺寸和开放边界条件同时变化时，如何区分真实的边界态、数值截断误差，以及尚未满足前提的体相近似？'
const EMPTY_TOPIC = '待探索的对照方向'
const CONDITION = '边界项在什么条件下可以忽略？'
const QUESTION = '依据选定材料，解释当前子方向仍需核对的边界条件，并保留适用范围。'
const ARTIFACTS = fileURLToPath(new URL('../../../.artifacts/', import.meta.url))

/** Locate the topic's actual scrollport without coupling the test to CSS Module names. */
async function scrollPosition(heading: Locator): Promise<number> {
  return heading.evaluate((element) => {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      if (/auto|scroll/u.test(getComputedStyle(parent).overflowY)) return parent.scrollTop
    }
    throw new Error('The topic heading has no reading scrollport.')
  })
}

/** Scroll an actual reading region; returning from a library must restore this retained position. */
async function moveReading(heading: Locator, top: number): Promise<void> {
  await heading.evaluate((element, target) => {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      if (/auto|scroll/u.test(getComputedStyle(parent).overflowY)) { parent.scrollTop = target; return }
    }
    throw new Error('The topic heading has no reading scrollport.')
  }, top)
}

/** Screenshots are acceptance output, so a failed capture fails the scenario. */
async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(ARTIFACTS, `aitp-topic-pilot-${name}.png`), fullPage: true, animations: 'disabled' })
}

async function noOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

it('keeps topic scope, source selection, return position and readable boundary states through the actual application', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-topic-pilot-'))
  const project = join(world, '边界效应研究 · 界面示例')
  const model = new LibraryModel()
  const owned: { app?: LibraryApp; browser?: Browser; page?: Page } = {}
  onTestFinished(async () => {
    const failures: unknown[] = []
    await owned.browser?.close().catch((error: unknown) => failures.push(error))
    await owned.app?.stop().catch((error: unknown) => failures.push(error))
    await model.close().catch((error: unknown) => failures.push(error))
    await rm(world, { recursive: true, force: true }).catch((error: unknown) => failures.push(error))
    if (failures.length > 0) throw new AggregateError(failures, 'The topic pilot did not close its owned resources.')
  })
  await mkdir(project)
  await mkdir(ARTIFACTS, { recursive: true })
  const sources = new Map<string, string | Buffer>([
    ['research.md', '# 边界条件与有限尺寸效应\n\n用于界面验收的合成科研项目。以下内容用于展示资料关联，不代表真实科研结论。\n\n## Topics\n\n[开放边界下的低能谱](direction/research.md)\n'],
    ['direction/research.md', `# ${TOPIC}\n\n## Question\n\n有限系统中的低能态变化，来自边界条件本身，还是计算中采用的近似？\n\n## Current answer\n\n当前只建立了有限尺寸的对照思路。需要在相同系统规模和截断条件下，比较开放边界与周期边界，才能判断差异来自哪一项假设。\n\n已有材料说明了需要检查的边界项，但尚未完成数值与推导的一致性核对。示例代码仅用于演示关联阅读，不构成物理验证。\n\n## Scope\n\n只讨论明确给出的有限系统、边界条件和近似。每个结论都应能返回对应的原文段落或计算记录。\n\n## Open questions\n\n边界项是否改变当前近似的适用范围？还需确认有限尺寸对照，并记录尚未阅读的页面。\n\n## Current work\n\n先核对条件说明，再阅读原文相应页面，最后检查实现中采用的边界约定。不同来源一致之前，保留当前结论的暂定状态。\n\n## Topics\n\n[${LONG_TOPIC}](../long/research.md)\n[${EMPTY_TOPIC}](../empty/research.md)\n\n## Materials\n\n[边界项的适用条件](../condition.md)用于核对当前推导的前提。\n[有限系统示例论文](../paper.pdf)保留物理页码，尚未逐页精读。\n[边界条件实现](../model.py)用于对照源码中的约定。\n[有限尺寸对照清单](../comparison.md)列出后续需要记录的比较条件。\n`],
    ['long/research.md', `# ${LONG_TOPIC}\n\n## Question\n\n需要增加哪一个最小对照，才能区分这几种来源？\n\n## Scope\n\n这是用于长标题检查的合成子方向，尚未开展计算。\n`],
    ['empty/research.md', `# ${EMPTY_TOPIC}\n`],
    ['index.md', `# 示例知识索引\n\n| Question | Kind | Note | Support | Review |\n|---|---|---|---|---|\n| ${CONDITION} | theorem | [边界项的适用条件](condition.md) | source | awaiting |\n| 与本课题无关的示例 | theorem | [其他条件](unrelated.md) | unchecked | awaiting |\n`],
    ['condition.md', '---\nkind: theorem\nsupport: source\nreview: awaiting\n---\n# 边界项的适用条件\n\nOnly under A. Other conditions remain unresolved.\n\n这是一段用于检验来源定位的合成文字。使用结论前应核对系统规模、边界约定与近似条件；选择这份材料，不等于已经完成验证。\n\n## 依据与限制\n\n[当前子方向](direction/research.md)提出了需要核对的问题。原文未读部分与数值对照仍待补充。\n'],
    ['unrelated.md', '# 其他条件\n\n此材料没有被当前子方向引用。\n'],
    ['comparison.md', '# 有限尺寸对照清单\n\n统一系统规模、求解精度、边界条件和能量单位后再比较。所有结果仍待计算。\n'],
    ['paper.pdf', await readFile(fileURLToPath(new URL('../../../packages/research/research-literature/tests/fixtures/two-pages.pdf', import.meta.url)))],
    ['references.bib', '@article{boundary_fixture, title={Boundary conditions in a finite system}, author={Example, A. and Sample, B.}, year={2026}, note={Synthetic UI example}}\n'],
    ['model.py', 'def boundary_condition():\n    return "periodic boundary; synthetic example"\n'],
  ])
  await Promise.all([...sources].map(async ([path, text]) => {
    await mkdir(dirname(join(project, path)), { recursive: true })
    await writeFile(join(project, path), text)
  }))
  const git = (...args: string[]) => execFile('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: project,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } })
  await git('init', '-q')
  await git('add', '.')
  await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Synthetic topic pilot')
  const originalIndex = await readFile(join(project, '.git/index'))
  sources.set('model.py', 'def boundary_condition():\n    return "open boundary; condition not yet verified"\n')
  await writeFile(join(project, 'model.py'), sources.get('model.py') ?? '')
  const app = new LibraryApp(world, await model.start())
  owned.app = app
  const url = await app.start()
  const workspace = await app.rpc<WorkspaceCreateValue>('workspace/create', { request: { path: project } })
  const workspaceId = workspace.workspace.workspaceId
  expect(await app.rpc('researchResources/connectWorkspace', { request: { workspaceId } })).toMatchObject({ ok: true })
  expect(await app.rpc('researchMemory/initialize', { request: { workspaceId, writable: false } })).toMatchObject({ ok: true })
  const browser = await chromium.launch()
  owned.browser = browser
  const page = await newEnglishPage(browser)
  owned.page = page
  await page.setViewportSize({ width: 1440, height: 1000 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  // Finished hooks run in reverse registration order, before the owned app is closed.
  onTestFinished(async ({ task }) => {
    if (task.result?.state !== 'fail') return
    await saveFailureShot(page, 'aitp-topic-pilot-failure')
    await writeFile(join(ARTIFACTS, 'aitp-topic-pilot-failure.log'), `${app.logs()}\n${errors.join('\n')}\n${await page.locator('body').innerText()}`)
  })
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 20_000 })
  await page.getByRole('navigation', { name: 'Global panels' }).getByRole('button', { name: 'Research', exact: true }).click()
  let research = page.locator('section[aria-label="Research"]')
  await research.locator('[data-map-node]').filter({ hasText: TOPIC }).click()
  await research.getByRole('button', { name: 'Open topic', exact: true }).click()
  let heading = research.getByRole('heading', { name: TOPIC, exact: true, level: 2 })
  await heading.waitFor()
  await research.getByRole('button', { name: 'Ask about this topic', exact: true }).waitFor()
  const more = research.getByRole('button', { name: 'More actions', exact: true })
  await more.waitFor()
  expect(await research.innerText()).not.toContain('## Open questions')
  expect(await research.getByText('Current answer', { exact: true }).count()).toBe(0)
  expect(await research.getByText('Open questions', { exact: true }).count()).toBe(0)
  expect(await research.getByText('Scope', { exact: true }).count()).toBe(1)
  await noOverflow(page)

  await more.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu')
  await menu.waitFor()
  await page.keyboard.press('ArrowDown')
  const mapAction = menu.getByRole('menuitem', { name: 'Show on map', exact: true })
  await expect.poll(() => mapAction.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)
  await shot(page, 'menu')
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  expect(await more.getAttribute('aria-expanded')).toBe('false')
  await expect.poll(() => more.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)

  // Removing structural headings from the overview must not alter the full source account.
  await research.getByRole('button', { name: 'Read full account', exact: true }).click()
  for (const title of ['Question', 'Current answer', 'Scope', 'Open questions', 'Current work']) {
    await research.getByRole('heading', { name: title, exact: true }).waitFor()
  }
  await research.getByText('当前只建立了有限尺寸的对照思路。需要在相同系统规模和截断条件下，比较开放边界与周期边界，才能判断差异来自哪一项假设。', { exact: true }).waitFor()
  await shot(page, 'full-account')
  await research.getByRole('navigation', { name: 'Research location' }).getByRole('button', { name: 'Back', exact: true }).click()
  await heading.waitFor()

  await page.setViewportSize({ width: 1440, height: 780 })
  const entry = research.getByRole('button', { name: /Related.*Knowledge library/u })
  await page.keyboard.press('Tab')
  await moveReading(heading, 120)
  await entry.scrollIntoViewIfNeeded()
  await entry.focus()
  const departureScroll = await scrollPosition(heading)
  expect(departureScroll).toBeGreaterThan(0)
  await entry.click()
  let knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByText(`Current topic: ${TOPIC}`, { exact: true }).waitFor()
  await knowledge.getByRole('button', { name: CONDITION, exact: true }).click()
  await knowledge.getByText('Only under A. Other conditions remain unresolved.', { exact: true }).waitFor()
  await knowledge.getByRole('button', { name: 'Use this source', exact: true }).click()
  await knowledge.getByText('Selected sources (1)', { exact: true }).waitFor()
  await shot(page, 'material')
  await knowledge.getByRole('button', { name: 'Discuss selected sources', exact: true }).click()
  const discussion = page.locator('[data-research-discussion]')
  const composer = discussion.locator('[data-composer-input]')
  await writeComposerDraft(page, composer, QUESTION)
  expect(await composer.textContent(), 'Unicode keyboard automation must preserve the complete draft before submission.').toBe(QUESTION)
  // Exercise the browser's real IME composition events as well as Playwright's unkeyed Unicode insertion.
  await writeComposerDraft(page, composer, '')
  const ime = await page.context().newCDPSession(page)
  try {
    await ime.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Process', code: 'Unidentified', windowsVirtualKeyCode: 229 })
    await ime.send('Input.imeSetComposition', { text: QUESTION.slice(0, 1), selectionStart: 1, selectionEnd: 1 })
    await ime.send('Input.insertText', { text: QUESTION.slice(0, 1) })
    await ime.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Process', code: 'Unidentified', windowsVirtualKeyCode: 229 })
    await page.keyboard.insertText(QUESTION.slice(1))
    expect(await composer.textContent(), 'Committed IME text must retain the first Chinese character.').toBe(QUESTION)
    // Observe the committed draft after composition closes; its closing Enter is intentionally not a send gesture.
    await composer.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => { requestAnimationFrame(() => { resolve() }) })
    }))
  } finally { await ime.detach() }
  await composer.press('Enter')
  const chat = page.locator('[data-slot="conversation.chat.flow"]')
  await chat.getByText('The selected source states: Only under A.', { exact: false }).waitFor({ timeout: 30_000 })
  await shot(page, 'session')
  expect(model.requests).toHaveLength(1)
  for (const delivered of [QUESTION, 'Only under A.', 'aitp-research-memory', 'topic:direction%2Fresearch.md', workspaceId]) {
    expect(model.requests[0]).toContain(delivered)
  }
  await discussion.getByRole('button', { name: 'Back to reading', exact: true }).click()
  knowledge = page.locator('section[aria-label="Knowledge library"]')
  await knowledge.getByText(`Current topic: ${TOPIC}`, { exact: true }).waitFor()
  await knowledge.getByText('Selected sources (1)', { exact: true }).waitFor()
  await knowledge.getByRole('button', { name: 'Return to topic', exact: true }).click()
  await heading.waitFor()
  await expect.poll(() => scrollPosition(heading)).toBeCloseTo(departureScroll, 0)
  await expect.poll(() => entry.evaluate(element => element === element.ownerDocument.activeElement)).toBe(true)
  await shot(page, 'return')

  await app.rpc('settings/update', { ns: 'locale', patch: { preference: 'zh' } })
  research = page.locator('section[aria-label="研究"]')
  heading = research.getByRole('heading', { name: TOPIC, exact: true, level: 2 })
  await heading.waitFor()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.keyboard.press('Tab')
  await moveReading(heading, 0)
  expect(await research.getByText('Scope', { exact: true }).count()).toBe(0)
  await shot(page, 'desktop')
  await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'dark' } })
  await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).not.toBeNull()
  await noOverflow(page)
  await shot(page, 'dark')
  await app.rpc('settings/update', { ns: 'ui-theme', patch: { preference: 'light' } })
  await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).toBeNull()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await shot(page, 'narrow')
  await research.getByRole('button', { name: LONG_TOPIC, exact: false }).first().click()
  const longHeading = research.getByRole('heading', { name: LONG_TOPIC, exact: true, level: 2 })
  await longHeading.waitFor()
  expect(await longHeading.innerText()).toBe(LONG_TOPIC)
  const titleBox = await longHeading.boundingBox()
  expect(titleBox).not.toBeNull()
  expect(titleBox?.x).toBeGreaterThanOrEqual(0)
  expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(390)
  await noOverflow(page)
  await shot(page, 'long-title')
  await research.getByRole('button', { name: '返回', exact: true }).click()
  await heading.waitFor()
  await page.setViewportSize({ width: 1440, height: 1000 })

  const gate = Promise.withResolvers<undefined>()
  let delayed = false
  await page.route('**/api/researchMemory/getTopic', async (route) => {
    if (!route.request().postData()?.includes('empty%2Fresearch.md')) { await route.continue(); return }
    delayed = true
    await gate.promise
    await route.continue()
  })
  try {
    await research.getByRole('button', { name: EMPTY_TOPIC, exact: false }).first().click()
    await expect.poll(() => delayed, { timeout: 10_000 }).toBe(true)
    await research.getByRole('status', { name: '加载中', exact: true }).first().waitFor()
    await noOverflow(page)
    await shot(page, 'loading')
  } finally { gate.resolve(undefined) }
  await research.getByRole('heading', { name: EMPTY_TOPIC, exact: true, level: 2 }).waitFor()
  await research.getByText('此课题尚未关联资料。', { exact: true }).waitFor()
  await noOverflow(page)
  await shot(page, 'empty')
  await page.unroute('**/api/researchMemory/getTopic')
  expect(errors).toEqual([])
  for (const [path, bytes] of sources) expect(await readFile(join(project, path))).toEqual(typeof bytes === 'string' ? Buffer.from(bytes) : bytes)
  expect(await readFile(join(project, '.git/index'))).toEqual(originalIndex)
  await writeFile(join(ARTIFACTS, 'aitp-topic-pilot-proof.json'), JSON.stringify({
    modelMode: 'Deterministic external endpoint: delivery and interface evidence, not research quality.',
    modelRequests: model.requests.length, scope: 'topic:direction%2Fresearch.md', selectedSources: 1,
    departureScroll, returnFocus: 'Related Knowledge library', sourceFilesPreserved: sources.size,
    checks: ['topic-material-question-return', 'menu-keyboard-escape-focus', 'overview-without-source-headings', 'full-account-keeps-source-headings', 'dark-theme', '390px', 'long-title', 'empty', 'delayed-real-read'],
    screenshots: ['desktop', 'dark', 'narrow', 'long-title', 'empty', 'loading', 'menu', 'full-account', 'material', 'session', 'return'],
  }, null, 2))
})
