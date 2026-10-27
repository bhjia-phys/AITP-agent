/** Authored synthetic sources for the three library presentations; no live project files are used. */
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const execFile = promisify(execFileCallback)
export const TOPIC = 'Matched boundary controls'
export const CONCEPT = 'Why does the boundary convention require a matched control?'
export const PAPER = 'Boundary responses in a finite research model: an intentionally long source title that keeps assumptions, numerical controls, and unresolved conventions visible while reading'
export const EMPTY = 'An indexed question with no written answer yet'
export const SOURCE_SET = 'Boundary controls: concept, exact page, implementation'
export const QUESTION = 'Compare the selected condition, exact PDF page and source implementation. State all reading limits.'

/** Immutable source snapshot used to reject accidental editing by a reading-only scenario. */
export interface LibraryProject {
  readonly path: string
  readonly sources: ReadonlyMap<string, string | Buffer>
  readonly gitIndex: Buffer
}

/**
 * Create an isolated real Git checkout with authored source relations, metadata and changed code.
 * @param world - Test-owned temporary directory.
 * @param options - Optional complete PDF bytes for a specialized native reading scenario.
 * @returns Paths and original bytes; the caller owns cleanup of the enclosing world.
 */
export async function createLibraryProject(world: string, options: { paperBytes?: Uint8Array } = {}): Promise<LibraryProject> {
  const path = join(world, 'boundary-project')
  const sources = new Map<string, string | Buffer>([
    ['research.md', `# Boundary research project\n\nThis isolated browser fixture makes no scientific claim.\n\n## Topics\n\n[${TOPIC}](direction/research.md)\n`],
    ['direction/research.md', `# ${TOPIC}\n\n## Question\n\nDoes the implementation preserve the stated boundary condition?\n\n## Scope\n\nFinite synthetic model under A; the independent control remains unresolved.\n\n## Materials\n\n[Conditional explanation](../atom.md)\n[Source reading](../paper-map.md)\n[Exact paper](../papers/boundary-controls.pdf)\n[Implementation](../model.py)\n`],
    ['index.md', `# Research knowledge\n\n| Question | Kind | Note | Support | Review |\n|---|---|---|---|---|\n| ${CONCEPT} | theorem | [Condition explanation](atom.md) | source | awaiting |\n| Boundary source reading | paper | [Reading map](paper-map.md) | source | awaiting |\n| Boundary control route | story | [Question route](stories/boundary-route.md) | provisional | awaiting |\n| Methods used by Fixture | author-collection | [Author methods](authors/fixture.md) | source | awaiting |\n| ${EMPTY} | theorem | [Empty note](empty.md) | unchecked | awaiting |\n| Unrelated convention | theorem | [Unrelated](unrelated.md) | unchecked | awaiting |\n`],
    ['atom.md', '---\nkind: theorem\nsupport: source\nreview: awaiting\n---\n# Conditional explanation\n\nOnly under A. Other conditions remain unresolved.\n\n## Definition\n\nThe matched boundary control uses the same finite model and observable.\n\n## Assumptions\n\nKeep condition A attached to the conclusion. This fixture does not establish an infinite-size result.\n\n## Evidence\n\n[Source reading](paper-map.md) records the pages actually examined.\n\n## Related questions\n\n[Boundary control route](stories/boundary-route.md) retains the next discriminating comparison.\n'],
    ['paper-map.md', `---\nkind: paper\nauthors: A. Fixture; B. Example\nyear: 2026\nreading_depth: AI-read\nclose_reading: partial\nsupport: source\nreview: awaiting\n---\n# ${PAPER}\n\n## Reading position\n\nPage two was inspected. Other pages remain unread.\n\n[Original PDF](papers/boundary-controls.pdf)\n\n## Source conditions\n\nThe interpretation requires [the matched condition](atom.md).\n`],
    ['stories/boundary-route.md', '---\nkind: story\nsupport: provisional\nreview: awaiting\n---\n# Boundary control route\n\nWhich comparison distinguishes a convention from a boundary effect?\n\n[Condition explanation](../atom.md) provides the prerequisite.\n\n[Source reading](../paper-map.md) supplies the current evidence.\n'],
    ['authors/fixture.md', '---\nkind: author-collection\nsupport: source\nreview: awaiting\n---\n# Methods used by Fixture\n\nFollow the explicit hypothesis through the [source reading](../paper-map.md).\n'],
    ['empty.md', ''],
    ['unrelated.md', '---\nkind: theorem\n---\n# Unrelated convention\n\nAn independent convention B is outside the selected direction.\n'],
    ['papers/boundary-controls.pdf', options.paperBytes === undefined
      ? await readFile(fileURLToPath(new URL('../../../../../packages/research/research-literature/tests/fixtures/two-pages.pdf', import.meta.url)))
      : Buffer.from(options.paperBytes)],
    ['references.bib', '@article{boundary, title={Conditional boundary source}, author={Fixture, A. and Example, B.}, year={2026}}\n'],
    ['model.py', 'from src.boundary import matched_control\n\ndef assumption():\n    return "original condition"\n'],
    ['src/boundary.py', 'def matched_control(size, convention):\n    """Keep the finite-size and convention inputs explicit."""\n    return {"size": size, "convention": convention}\n'],
    ['src/observables/response.py', 'def response(values):\n    return sum(values) / len(values)\n'],
    ['tests/test_boundary.py', 'def test_explicit_convention():\n    assert {"size": 6, "convention": "A"}["convention"] == "A"\n'],
    ['docs/implementation.md', '# Implementation notes\n\nThe small fixture is not executed by the library browser.\n'],
  ])
  for (const [relativePath, bytes] of sources) {
    await mkdir(dirname(join(path, relativePath)), { recursive: true })
    await writeFile(join(path, relativePath), bytes)
  }
  const git = (...args: string[]) => execFile('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: path,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' } })
  await git('init', '-q', '-b', 'main')
  await git('add', '.')
  await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Initial bounded sources')
  sources.set('model.py', 'from src.boundary import matched_control\n\ndef assumption():\n    return "modified condition under A"\n')
  await writeFile(join(path, 'model.py'), sources.get('model.py') ?? '')
  return { path, sources, gitIndex: await readFile(join(path, '.git/index')) }
}
