import { readFile, writeFile, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { Graph, Grouping, ResearchLocation } from '@aitp/protocol';
import { expect, it } from 'vitest';
import { fixture } from './support.ts';

it('discovers every expected location with scientific parents and narrow scope; exclusions and Unmapped hold', async () => {
  const f = await fixture();
  try {
    const locations = await f.workspace.locations();
    const expected = f.expected.locations as Record<string, Record<string, unknown>>;
    for (const [id, projection] of Object.entries(expected)) {
      const actual = locations.find(l => l.id === id);
      expect(actual, id).toBeDefined();
      ResearchLocation.parse(actual);
      for (const [key, value] of Object.entries(projection)) {
        if (key === 'parents') expect(new Set(actual!.parents), id).toEqual(new Set(value as string[]));
        else if (key === 'scope') expect(actual!.scope.map(s => ({ flag: s.flag, ...(s.thread ? { thread: s.thread } : {}) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), id).toEqual([...(value as unknown[])].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
        else expect(actual![key as keyof typeof actual], `${id} ${key}`).toEqual(value);
      }
    }
    const graph = await f.workspace.graph();
    Graph.parse(graph);
    expect(graph.navigation.unmapped).toEqual(f.expected.unmapped);
    expect(graph.navigation.nodes.unmapped?.title).toBe('Unmapped');
    for (const path of f.expected.excluded as string[]) expect(locations.map(l => l.id)).not.toContain(path);
    const groups = await f.workspace.groupings();
    groups.forEach(g => Grouping.parse(g));
    expect(groups.some(g => g.title.startsWith('2.') && g.members.includes('topics/dynamics/research.md'))).toBe(true);
    expect(groups.some(g => g.id === 'family:topics/spectra/README.md')).toBe(true);
    const stability = graph.navigation.nodes['topics/spectra/selfconsistent/stability/research.md']!;
    expect(stability.alsoUnder).toHaveLength(2);
    expect((await f.workspace.whereUsed(stability.location!)).some(u => u.relation === 'pointer' && u.passage.includes('Static map stability'))).toBe(true);
    const loc = locations.find(l => l.id === 'topics/anomaly/research.md')!;
    const text = await readFile(join(f.root, loc.id), 'utf8');
    for (const flag of loc.scope) { const span = flag.source.locator; expect(span?.kind).toBe('lines'); if (span?.kind === 'lines') expect(text.split('\n').slice(span.start - 1, span.end).join('\n')).toMatch(flag.thread ? /Dormant/i : flag.flag === 'analyticOnly' ? /analytic only/ : /excludes[\s\S]*execution/); }
  } finally { await f.cleanup(); }
});

it('explicit refresh rereads plans and maps without content comparison', async () => {
  const f = await fixture();
  try {
    const path = 'topics/spectra/selfconsistent/research.md';
    const before = await f.workspace.outline(path);
    const changes: string[] = [];
    const stop = f.workspace.onChange(c => changes.push(c.path));
    await utimes(join(f.root, path), new Date(), new Date());
    await f.workspace.refresh([path]);
    expect(changes).toEqual([path]);
    await writeFile(join(f.root, path), (await readFile(join(f.root, path), 'utf8')).replace('active ·', 'blocked on input ·'));
    await f.workspace.refresh([path]);
    expect(changes).toEqual([path, path]);
    const after = await f.workspace.outline(path);
    expect(after.currentWork?.entries[2]?.state).toBe('blocked');
    stop();
    const plan = 'topics/spectra/selfconsistent/plans/mixing-plan.md';
    await writeFile(join(f.root, plan), '# Changed plan\n\n## Operative replacement\nDo this.\n');
    await f.workspace.refresh([plan]);
    expect((await f.workspace.outline(path)).plans[0]?.title).toBe('Changed plan');
  } finally { await f.cleanup(); }
});
it('reports missing targets and anchors while resolving reference links and explicit HTML anchors', async () => {
  const f = await fixture();
  try {
    const path = 'topics/spectra/continuation/research.md';
    const out = await f.workspace.outline(path);
    expect(out.links.find(l => l.target === '#the-obstruction')?.anchorOk).toBe(true);
    expect(out.anchors.some(a => a.id === 'top')).toBe(true);
    const stability = await f.workspace.outline('topics/spectra/selfconsistent/stability/research.md');
    expect(stability.links.find(l => l.target.endsWith('#bound'))?.anchorOk).toBe(true);
    await writeFile(join(f.root, path), '# Continuation\n\n## Current work\n- **Missing → [x](missing.md#absent)** — unresolved.\n- **Bad anchor → [x](../selfconsistent/research.md#absent)** — unresolved.\n');
    await f.workspace.refresh([path]);
    const next = await f.workspace.outline(path);
    expect(next.currentWork?.entries.map(e => e.pointer?.resolved)).toEqual([false, false]);
    expect(next.links[1]?.anchorOk).toBe(false);
    expect(next.warnings.map(w => w.message).join('\n')).toMatch(/Unresolved target/);
    expect(next.warnings.map(w => w.message).join('\n')).toMatch(/Unresolved anchor/);
  } finally { await f.cleanup(); }
});
it('keeps cyclic scientific uses but projects navigation without cycles', async () => {
  const f = await fixture();
  try {
    const a = 'topics/dynamics/research.md', b = 'topics/dynamics/growth/research.md';
    await writeFile(join(f.root, b), '# Growth\n\n## Current work\n- **Parent → [dynamics](../research.md)** — supplies evidence.\n');
    await f.workspace.refresh([b]);
    const graph = await f.workspace.graph();
    expect(graph.edges.some(e => e.kind === 'pointer-to' && e.from === b && e.to === a)).toBe(true);
    const walk = (id: string, ancestors = new Set<string>()) => { expect(ancestors.has(id)).toBe(false); const next = new Set(ancestors).add(id); for (const child of graph.navigation.nodes[id]?.children ?? []) walk(child, next); };
    graph.navigation.roots.forEach(id => walk(id));
  } finally { await f.cleanup(); }
});
it('applies display grouping overrides without changing scientific parents', async () => {
  const f = await fixture();
  try {
    const initial = await f.workspace.groupings(); const id = initial[0]!.id;
    const member = 'topics/spectra/continuation/research.md';
    const parents = (await f.workspace.locations()).find(l => l.id === member)!.parents;
    await writeFile(join(f.root, 'topics/groupings.json'), JSON.stringify([{ id, title: 'Selected', members: [member, 'missing.md'] }]));
    await f.workspace.refresh(['topics/groupings.json']);
    const groups = await f.workspace.groupings();
    expect(groups.filter(g => g.id === id)).toHaveLength(1);
    expect(groups.find(g => g.id === id)?.members).toEqual([member]);
    expect(groups.find(g => g.id === id)?.title).toBe('Selected');
    expect((await f.workspace.locations()).find(l => l.id === member)?.parents).toEqual(parents);
  } finally { await f.cleanup(); }
});
it('resolves allowed absolute file links and reports denied absolute targets', async () => {
  const f = await fixture();
  try {
    const path = 'topics/deferred-idea/research.md';
    const absolute = join(f.root, 'topics/spectra/continuation/research.md');
    await writeFile(join(f.root, path), `# Links\n\n[Allowed](${absolute}#top)\n[Denied](/etc/passwd)\n<person@example.invalid>\n`);
    const out = await f.workspace.outline(path);
    expect(out.links[0]?.resolved?.address).toEqual({ kind: 'workspace', path: 'topics/spectra/continuation/research.md' });
    expect(out.links[0]?.anchorOk).toBe(true);
    expect(out.links[1]?.resolved).toBeNull();
    expect(out.warnings.some(w => w.message.includes('forbidden_path'))).toBe(true);
    expect(out.links[2]?.kind).toBe('web');
    expect(out.links[2]?.resolved?.address.kind).toBe('uri');
  } finally { await f.cleanup(); }
});

it('keeps a root-listed topic a topic when another branch points back to it', async () => {
  const f = await fixture();
  try {
    const root = 'topics/research.md', topic = 'topics/dynamics/research.md', branch = 'topics/dynamics/growth/research.md';
    const rootText = await readFile(join(f.root, root), 'utf8');
    await writeFile(join(f.root, root), rootText + '\n## Additional direction\n\n| Main note | Question |\n| --- | --- |\n| [Dynamics](dynamics/research.md) | Evolution |\n');
    await writeFile(join(f.root, branch), '# Growth\n\n## Current work\n- **Shared framework → [Dynamics](../research.md)** — supplies the framework.\n');
    await f.workspace.refresh([root, branch]);
    const location = (await f.workspace.locations()).find(l => l.id === topic)!;
    expect(location.parents).toContain(root);
    expect(location.parents).toContain(branch);
    expect(location.kind).toBe('topic');
  } finally { await f.cleanup(); }
});
