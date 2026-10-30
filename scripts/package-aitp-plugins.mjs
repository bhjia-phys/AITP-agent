/** Package existing research owners for installation outside this checkout. */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { out: { type: 'string' }, views: { type: 'boolean', default: false },
  build: { type: 'boolean', default: false }, pack: { type: 'string' },
  'dsh-version': { type: 'string', default: '0.2.1-rc.2' },
  version: { type: 'string', default: '0.1.0' } } })
if (!values.out) throw new Error('Usage: node scripts/package-aitp-plugins.mjs --out <new-directory> [--views] [--build] [--dsh-version <version>] [--version <version>] [--pack <new-artifact-directory>]')
const output = resolve(values.out)
const dshVersion = values['dsh-version']
const bundleVersion = values.version
const owners = [
  ['research-memory', 'research/research-memory'],
  ['research-resources', 'research/research-resources'],
  ['research-literature', 'research/research-literature'],
  ['research-knowledge', 'research/research-knowledge'],
  ['research-code', 'research/research-code'],
  ['research-study', 'research/research-study'],
  ['util-markdown-math', 'util/markdown-math'],
  ...values.views ? [
    ['ui-aitp-research', 'client/ui-aitp-research'],
    ['ui-aitp-backend', 'client/ui-aitp-backend'],
    ['ui-aitp-session', 'client/ui-aitp-session'],
    ['ui-aitp-materials', 'client/ui-aitp-materials'],
    ['ui-aitp-literature', 'client/ui-aitp-literature'],
    ['ui-aitp-knowledge', 'client/ui-aitp-knowledge'],
    ['ui-aitp-code', 'client/ui-aitp-code'],
  ] : [],
]
const owned = new Map(owners.map(([id, directory]) => [
  `@deepseek-ai/dsh-${directory.startsWith('client/') ? 'client-' : ''}${id}`, id,
]))
const peers = {}
const dependencies = {}
const entries = {}
const receipts = []

function run(command, args, cwd, failure) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${failure} (${result.status})`)
}

/** Compile before bundling: Host entries consume the TypeScript output. */
function buildOwners(face, directories) {
  run(process.execPath, ['--max-old-space-size=2048', join(root, 'node_modules/typescript/bin/tsc'), '-b', ...directories], root,
    `Research ${face} build failed`)
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsdown', '--config-loader', 'native',
    `--env.DSH_BUILD_FACE=${face}`, ...directories.flatMap(directory => ['--filter', directory])], root,
  `Research ${face} build failed`)
}

/** Resolve the dependency version actually used by the built owner. */
async function installedVersion(require, name) {
  let directory = dirname(require.resolve(name))
  while (true) {
    let manifest
    try { manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (manifest?.name === name) return manifest.version
    const parent = dirname(directory)
    if (parent === directory) throw new Error(`Cannot locate the installed manifest for ${name}`)
    directory = parent
  }
}

/** A packed bundle must point Loader at a file, never a package directory. */
function bundleEntry(manifest) {
  const candidate = typeof manifest.main === 'string' ? manifest.main
    : typeof manifest.exports?.['.'] === 'string' ? manifest.exports['.']
    : manifest.exports?.['.']?.default
  if (typeof candidate !== 'string' || candidate.startsWith('/') || candidate.includes('..')) {
    throw new Error(`Cannot derive a safe ESM entry for ${manifest.name}`)
  }
  return `./node_modules/${manifest.name}/${candidate.replace(/^\.\//, '')}`
}

// An existing output may contain a user's installation; never replace it.
await mkdir(output)
if (values.build) {
  buildOwners('host', owners.filter(([, directory]) => !directory.startsWith('client/')).map(([, directory]) => `packages/${directory}`))
  if (values.views) buildOwners('client', owners.filter(([, directory]) => directory.startsWith('client/')).map(([, directory]) => `packages/${directory}`))
}
await mkdir(join(output, 'packages'))
for (const [id, directory] of owners) {
  const source = join(root, 'packages', directory)
  const manifestPath = join(source, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const require = createRequire(manifestPath)
  const runtime = {}
  const shared = {}
  const clientPeers = Object.fromEntries((manifest.dsh?.client?.inject ?? []).map(name => [name, '*']))
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...clientPeers })) {
    const internal = owned.get(name)
    if (internal) runtime[name] = `file:../${internal}`
    else if (name.startsWith('@deepseek-ai/')) {
      const detectedVersion = await installedVersion(require, name)
      // The workbench uses the host's DSH services. Build metadata must name
      // the exact target runtime rather than the maintainer checkout's type
      // packages, so the host resolver supplies one coherent DSH instance.
      const version = name.startsWith('@deepseek-ai/dsh-') ? dshVersion : detectedVersion
      shared[name] = version
      if (peers[name] !== undefined && peers[name] !== version) {
        throw new Error(`Research owners disagree on the shared version of ${name}`)
      }
      peers[name] = version
    } else runtime[name] = await installedVersion(require, name)
  }
  const target = join(output, 'packages', id)
  await mkdir(target)
  await cp(join(source, 'lib'), join(target, 'lib'), { recursive: true })
  const { devDependencies: _development, scripts: _scripts, private: _private,
    dependencies: _dependencies, peerDependencies: _peers, ...metadata } = manifest
  delete metadata.exports?.['./src/*']
  await writeFile(join(target, 'package.json'), JSON.stringify({ ...metadata,
    dependencies: runtime, peerDependencies: shared, files: ['lib'],
  }, null, 2) + '\n')
  dependencies[manifest.name] = `file:./packages/${id}`
  entries[manifest.name] = bundleEntry(manifest)
  receipts.push({ name: manifest.name, source: directory, shared, dependencies: runtime })
}
await writeFile(join(output, 'package.json'), JSON.stringify({
  name: 'dsh-aitp-research', version: bundleVersion, type: 'module', license: 'MIT',
  description: 'AITP research services for native DSH profiles',
  engines: { dsh: dshVersion },
  files: ['cordis.patch.yml', 'packages', 'README.md'],
  dependencies, peerDependencies: peers,
  // A local-directory plugin is linked by DSH and therefore needs its own
  // install.  Release artifacts are packed with these private owners bundled
  // so `dsh plugin add <artifact.tgz>` is self-contained instead.
  bundledDependencies: Object.keys(dependencies),
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}, null, 2) + '\n')
// `pnpm pack` can only bundle direct local dependencies from a physical,
// hoisted layout. The generated directory is maintainer staging; the packed
// tarball is the user-installable artifact.
await writeFile(join(output, '.npmrc'), 'auto-install-peers=false\nnode-linker=hoisted\n')
await writeFile(join(output, 'cordis.patch.yml'), `- insert:
    - id: aitp-sources
      name: '${entries['@deepseek-ai/dsh-research-resources']}'
      config:
        roots: []
        workspaceRootsInCatalog: false
        watchMode: bounded
    - id: aitp-records
      name: '${entries['@deepseek-ai/dsh-research-memory']}'
      config:
        roots: []
        automaticResearch: ${values.views ? 'true' : 'false'}
        watchMode: bounded
    - id: aitp-literature
      name: '${entries['@deepseek-ai/dsh-research-literature']}'
    - id: aitp-knowledge
      name: '${entries['@deepseek-ai/dsh-research-knowledge']}'
    - id: aitp-code
      name: '${entries['@deepseek-ai/dsh-research-code']}'
    - id: aitp-study
      name: '${entries['@deepseek-ai/dsh-research-study']}'
${values.views ? `    - id: aitp-research-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-research']}'
    - id: aitp-research-transport
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-backend']}'
    - id: aitp-session-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-session']}'
    - id: aitp-materials-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-materials']}'
    - id: aitp-literature-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-literature']}'
    - id: aitp-knowledge-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-knowledge']}'
    - id: aitp-code-view
      name: '${entries['@deepseek-ai/dsh-client-ui-aitp-code']}'
` : ''}`)
await writeFile(join(output, 'README.md'), `# AITP research services for DSH

Generated from the existing research owners by scripts/package-aitp-plugins.mjs.
Build a distributable artifact with
\`node scripts/package-aitp-plugins.mjs --out <new-staging-directory> --views --build --pack <new-artifact-directory>\`.
The generated staging directory is for maintainers only. Users install the resulting tarball in one step:
\`dsh plugin --profile <name> add <path>/dsh-aitp-research-${bundleVersion}.tgz\`.
The artifact is pinned to DSH ${dshVersion}; do not force it onto another DSH version.
The shared DSH services come from the running host. ${values.views
  ? 'This build includes research browsing, source readers and the three library panels. Native conversation and write integration require the acceptance checks described in the development plan.'
  : 'This services build does not install the research UI.'} Source roots require explicit configuration;
automatic research context is ${values.views ? 'enabled for research views' : 'initially disabled'}.
Change automaticResearch through the aitp-records profile configuration.
Portable AITP Skills are installed separately from their original repository.
Enrolled workspaces supply explicitly linked sources without becoming full-library catalogs.
Configure shared library roots separately when a browsable collection is wanted.
`)
await writeFile(join(output, 'packaging-receipt.json'), JSON.stringify({ owners: receipts,
  workbenchUI: values.views ? 'native workbench; host acceptance required' : 'not included',
  context: { automaticResearch: values.views, hostAcceptance: 'required for this artifact' },
}, null, 2) + '\n')
if (values.pack) {
  const artifacts = resolve(values.pack)
  // Refuse to reuse an artifact directory so a release cannot silently
  // overwrite a previously handed-off tarball.
  await mkdir(artifacts)
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  run(pnpm, ['install', '--ignore-scripts', '--node-linker=hoisted'], output,
    'Research release dependency installation failed')
  run(pnpm, ['pack', '--config.node-linker=hoisted', '--pack-destination', artifacts], output,
    'Research release packing failed')
  console.log(JSON.stringify({ output, artifacts, version: bundleVersion, dshVersion, owners: receipts.length,
    sharedPackages: Object.keys(peers).length }))
} else {
  console.log(JSON.stringify({ output, version: bundleVersion, dshVersion, owners: receipts.length,
    sharedPackages: Object.keys(peers).length }))
}
