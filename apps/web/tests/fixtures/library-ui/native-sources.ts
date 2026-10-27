/** Isolated authored file chain for native reading without Session filesystem authority. */
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createLibraryProject, type LibraryProject } from './project.ts'

export const SOURCE_ENTRY = 'Reading a local research record'
export const SOURCE_DETAIL = 'A related note with a local figure'
export const SOURCE_DRAFT = 'Keep this unfinished question while I inspect the figure and implementation.'
export const SOURCE_QUESTION = 'Explain this recorded condition without changing its topic or saving new claims.'
export const DETAIL_PATH = 'notes/中文 空格/相关 说明.md'
export const PNG_PATH = 'notes/中文 空格/图 结果.png'
export const SVG_PATH = 'notes/中文 空格/图 示意.svg'
export const CODE_PATH = 'src/中文 实现.py'

/**
 * Extend only a temporary library project with linked local documents and inert image bytes.
 * @param world - Test-owned temporary root, removed by the scenario.
 * @returns The complete ordinary-source snapshot; the existing Git index remains unchanged.
 */
export async function createNativeSourceProject(world: string): Promise<LibraryProject> {
  const project = await createLibraryProject(world)
  const sources = new Map(project.sources)
  const png = await readFile(new URL('./native-source.png', import.meta.url))
  const entry = [
    '---', 'kind: theorem', 'support: source', 'review: awaiting', '---', `# ${SOURCE_ENTRY}`, '',
    'Only under A. This synthetic record has an explicit unresolved independent control.', '',
    ...Array.from({ length: 20 }, (_, index) => `Context paragraph ${index + 1}: retain the original condition and its limited scope.\n`),
    `[Read the related note](<${DETAIL_PATH}>)`, '',
  ].join('\n')
  const detail = [
    `# ${SOURCE_DETAIL}`, '', 'The local figure illustrates the recorded condition without establishing a new result.', '',
    '[Read the boundary section](#boundary-condition)', '',
    '## Boundary condition', '', 'Only the explicitly stated condition is covered by this section.', '',
    '![Inline boundary figure](<图 结果.png>)', '',
    '[Open the original PNG](<图 结果.png>)', '', '[Open the vector figure](<图 示意.svg>)', '',
    `[Inspect the implementation](<../../${CODE_PATH}>)`, '',
    '[Outside-root note](<../../../outside-note.md>)', '',
    '![Outside-root figure](<../../../outside.png>)', '',
    '![Symlink escape figure](<escape.png>)', '',
    '## Other reading notes', '', 'This paragraph lies outside the located boundary section.', '',
  ].join('\n')
  sources.set('reading.md', entry)
  sources.set(DETAIL_PATH, detail)
  sources.set(PNG_PATH, png)
  sources.set(SVG_PATH, Buffer.from([
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">',
    '<rect width="1200" height="720" fill="#f0f5fa"/>',
    '<path d="M80 620H1120 M80 620V80 M100 540L340 410L580 350L820 240L1080 160" fill="none" stroke="#245878" stroke-width="12"/>',
    '<text x="150" y="100" font-family="sans-serif" font-size="36">Synthetic boundary illustration</text>',
    '<script>parent.document.documentElement.setAttribute("data-native-source-script", "executed")</script>',
    '</svg>',
  ].join('\n')))
  sources.set(CODE_PATH, 'def explicit_boundary(condition):\n    """This source is read, never executed by the browser fixture."""\n    return {"condition": condition, "independent_control": "unresolved"}\n')
  const topic = sources.get('direction/research.md')
  const index = sources.get('index.md')
  if (typeof topic !== 'string' || typeof index !== 'string') throw new Error('The native-source fixture requires the authored topic and knowledge index.')
  sources.set('direction/research.md', `${topic}\n[${SOURCE_ENTRY}](../reading.md)\n`)
  sources.set('index.md', `${index}| ${SOURCE_ENTRY} | theorem | [Reading record](reading.md) | source | awaiting |\n`)
  for (const [relativePath, bytes] of sources) {
    await mkdir(dirname(join(project.path, relativePath)), { recursive: true })
    await writeFile(join(project.path, relativePath), bytes)
  }
  await writeFile(join(world, 'outside-note.md'), '# Outside root\n\nPRIVATE_OUTSIDE_SOURCE_MUST_NOT_BE_READ\n')
  await writeFile(join(world, 'outside.png'), png)
  await symlink(join(world, 'outside.png'), join(project.path, 'notes/中文 空格/escape.png'))
  return { ...project, sources }
}
