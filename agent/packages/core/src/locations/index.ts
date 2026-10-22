import { posix } from 'node:path';
import type { Graph, Grouping, Outline, ResearchLocation, Use, Version } from '@aitp/protocol';
import type { CreateWorkspaceModel } from '../contracts.ts';
import { linkTarget, parseNote, sourceRef } from '../notes/index.ts';
import { parsePlan } from '../plans/index.ts';
import { boardRows } from '../board/index.ts';
import { resolveInstructions } from '../instructions/index.ts';

export function excludedLocation(path: string, directlyLinkedByRoot = false): boolean {
  const segments = path.split('/');
  if (segments.some(s => ['provenance', 'snapshots', 'history', 'before', 'aitp-before', 'superseded', '.aitp', '.git', 'node_modules'].includes(s))) return true;
  if (segments.includes('workspace') && segments.slice(segments.indexOf('workspace')).includes('ref')) return true;
  return segments.includes('studying_note') && !directlyLinkedByRoot;
}
type Document = { text: string; outline: Outline };
export const createWorkspaceModel: CreateWorkspaceModel = deps => {
  const { config, fs, clock } = deps;
  const topics = posix.relative(config.workspace.root, config.workspace.topicsRoot);
  const rootPath = posix.join(topics, 'research.md');
  let docs = new Map<string, Document>();
  let places: ResearchLocation[] = [];
  let groups: Grouping[] = [];
  let currentGraph: Graph;
  let ready: Promise<void> | undefined;
  const listeners = new Set<(change: { path: string; version: Version }) => void>();
  const load = async (path: string): Promise<Document | undefined> => {
    if (docs.has(path)) return docs.get(path);
    const address = { kind: 'workspace' as const, path };
    try {
      const info = await fs.stat(address);
      if (!info || info.kind !== 'file') return undefined;
      const { text, version } = await fs.readText(address);
      const doc = { text, outline: parseNote(path, text, /\.tex$/i.test(path) ? 'tex' : 'markdown', version) };
      docs.set(path, doc);
      return doc;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'forbidden_path' || String(error).includes('file_too_large')) return undefined;
      throw error;
    }
  };
  const build = async () => {
    places = []; groups = [];
    const found = new Map<string, ResearchLocation>();
    const root = await load(rootPath);
    const direct = new Set(root?.outline.links.map(l => linkTarget(rootPath, l.target)?.path).filter((p): p is string => !!p));
    const configured = new Map(config.workspace.locations.map(l => [l.path, l.kind]));
    const queue = [rootPath, posix.join(topics, 'README.md'), ...configured.keys()];
    if (config.workspace.knowledgeRoot) queue.push(posix.join(posix.relative(config.workspace.root, config.workspace.knowledgeRoot), 'index.md'));
    const visited = new Set<string>();
    const enqueue = (p: string) => { if (!visited.has(p) && !queue.includes(p)) queue.push(p); };
    for (let i = 0; i < queue.length && i < 10000; i++) {
      const path = queue[i]!;
      if (visited.has(path) || excludedLocation(path, direct.has(path))) continue;
      visited.add(path);
      const doc = await load(path); if (!doc) continue;
      const out = doc.outline;
      const family = /\/README\.md$/i.test(path) && path !== posix.join(topics, 'README.md') && out.links.some(l => /(?:research|story)\.md(?:#|$)/.test(l.target) && (/^\|.*Main note/im.test(doc.text) || /^[-*+]\s/.test(doc.text.split('\n')[l.line - 1] ?? '')));
      const record = path.includes('/studying_note/') && direct.has(path);
      const story = /(?:^|\/)knowledge\/topics\/[^/]+\/story\.md$/.test(path);
      const main = path === rootPath || configured.has(path) || /(?:^|\/)research\.md$/.test(path) || story || family || record;
      if (main) found.set(path, { id: path, title: out.title || posix.basename(posix.dirname(path)), kind: path === rootPath ? 'root' : path.includes('/studying_note/') ? 'record' : configured.get(path) ?? (family ? 'family' : story ? 'learning' : 'topic'), format: out.format, parents: [], children: [], groupings: [], scope: out.scope, source: configured.has(path) ? 'configured' : family ? 'map' : 'link', version: out.version });
      for (const link of out.links) {
        const target = linkTarget(path, link.target)?.path;
        if (!target || excludedLocation(target, direct.has(target))) continue;
        if (/(?:^|\/)(research|story|README|index)\.md$/.test(target) || configured.has(target) || out.currentWork?.entries.some(e => e.pointer?.target === target)) enqueue(target);
        // A map's explicit Main note column or list item can designate an unusual filename.
        if (/README\.md$/.test(path) && /\.md$/.test(target)) {
          const line = doc.text.split('\n')[link.line - 1] ?? '';
          const header = doc.text.split('\n').slice(0, link.line).reverse().find(l => /^\|.*Main note/i.test(l));
          const column = header?.split('|').findIndex(c => /^\s*Main note\s*$/i.test(c));
          if ((column !== undefined && column >= 0 && line.split('|')[column]?.includes(link.target)) || /^\s*[-*+] /.test(line) && /main note/i.test(line)) { if (!configured.has(target) && !/(?:research|README|story)\.md$/.test(target)) configured.set(target, undefined); enqueue(target); }
        }
      }
    }
    const rootTopics = new Set<string>();
    if (root) for (const link of root.outline.links) {
      const path = linkTarget(rootPath, link.target)?.path;
      if (!path || found.get(path)?.kind !== 'topic') continue;
      const line = root.text.split('\n')[link.line - 1] ?? '';
      const firstOnLine = root.outline.links.find(l => l.line === link.line);
      if (!/^\s/.test(line) && firstOnLine === link) rootTopics.add(path);
    }
    // Scientific parents use pointer entries and reciprocal opening links, never filesystem proximity.
    const addParent = (child: string, parent: string) => { const c = found.get(child); if (c && child !== parent && !c.parents.includes(parent)) c.parents.push(parent); };
    for (const p of found.values()) for (const entry of docs.get(p.id)!.outline.currentWork?.entries ?? []) if (entry.pointer) addParent(entry.pointer.target, p.id);
    for (const child of found.values()) {
      const out = docs.get(child.id)!.outline;
      if (rootTopics.has(child.id)) { addParent(child.id, rootPath); continue; }
      for (const link of out.links.filter(l => l.line >= out.opening.span.startLine && l.line <= out.opening.span.endLine)) {
        const parent = linkTarget(child.id, link.target)?.path;
        if (parent && found.has(parent) && docs.get(parent)!.outline.links.some(l => linkTarget(parent, l.target)?.path === child.id)) addParent(child.id, parent);
      }
    }
    const rootSections = root?.outline.headings.filter(h => h.level === 2) ?? [];
    for (let i = 0; i < rootSections.length; i++) {
      const h = rootSections[i]!;
      if (/connections|seeds|agreed choices|standing agreements/i.test(h.text)) continue;
      const end = rootSections[i + 1]?.line ?? root!.text.split('\n').length + 1;
      const members = [...new Set(root!.outline.links.filter(l => l.line > h.line && l.line < end).map(l => linkTarget(rootPath, l.target)?.path).filter((p): p is string => !!p && found.has(p)))];
      const group: Grouping = { id: `direction:${h.slug}`, title: h.text, source: sourceRef(rootPath, root!.outline.version, { startLine: h.line, endLine: end - 1 }), sectionText: root!.text.split('\n').slice(h.line - 1, end - 1).join('\n'), members };
      groups.push(group);
      for (const member of members) { const p = found.get(member)!; if (!p.parents.length && p.kind === 'topic') addParent(member, rootPath); }
    }
    for (const p of found.values()) {
      if (!rootTopics.has(p.id) && p.parents.some(parent => parent !== rootPath && found.get(parent)?.kind !== 'family') && p.kind === 'topic' && !configured.has(p.id)) p.kind = 'branch';
      if (p.kind === 'family') { const d = docs.get(p.id)!; groups.push({ id: `family:${p.id}`, title: p.title, source: sourceRef(p.id, p.version, { startLine: 1, endLine: d.text.split('\n').length }), sectionText: d.text, members: [...new Set(d.outline.links.map(l => linkTarget(p.id, l.target)?.path).filter((id): id is string => !!id && found.has(id)))] }); }
    }
    // Display-only overrides; no inferred scientific ownership.
    const overrides = await load(posix.join(topics, 'groupings.json'));
    if (overrides) {
      try {
        const raw: unknown = JSON.parse(overrides.text);
        if (!Array.isArray(raw)) throw new Error('Expected a grouping array');
        for (const item of raw) {
          if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || !Array.isArray(item.members)) throw new Error('Invalid grouping');
          const group: Grouping = { id: item.id, title: item.title, source: { ...sourceRef(overrides.outline.location, overrides.outline.version), kind: 'file' }, sectionText: overrides.text, members: item.members.filter((id: unknown): id is string => typeof id === 'string' && found.has(id)) };
          const existing = groups.findIndex(g => g.id === group.id);
          if (existing < 0) groups.push(group); else groups[existing] = group;
        }
      } catch { overrides.outline.warnings.push({ message: 'Invalid groupings.json' }); }
    }
    // Exactly one directory level beneath known locations. Never recursively enumerate a research tree.
    const unmapped: string[] = [];
    for (const dir of new Set([...found.values()].filter(p => p.kind !== 'family' && p.kind !== 'learning').map(p => posix.dirname(p.id)))) {
      const listing = await fs.list({ kind: 'workspace', path: dir }).catch(() => undefined);
      if (!listing || listing.truncated) continue;
      for (const entry of listing.entries) {
        if (entry.kind !== 'directory') continue;
        const candidate = posix.join(dir, entry.name, 'research.md');
        if (found.has(candidate) || excludedLocation(candidate, direct.has(candidate))) continue;
        const d = await load(candidate); if (!d) continue;
        unmapped.push(candidate);
        found.set(candidate, { id: candidate, title: d.outline.title, kind: 'branch', format: d.outline.format, parents: [], children: [], groupings: [], scope: d.outline.scope, source: 'listing', version: d.outline.version });
      }
    }
    for (const p of found.values()) {
      p.children = [...found.values()].filter(c => c.parents.includes(p.id)).map(c => c.id);
      p.groupings = groups.filter(g => g.members.includes(p.id)).map(g => g.id);
    }
    places = [...found.values()];
    const edges: Graph['edges'] = [];
    for (const p of places) {
      const out = docs.get(p.id)!.outline;
      for (const l of out.links) { const t = linkTarget(p.id, l.target); if (!t || !found.has(t.path)) continue; const pointer = out.currentWork?.entries.some(e => e.pointer?.target === t.path && l.line >= e.span.startLine && l.line <= e.span.endLine); edges.push({ from: p.id, to: t.path, kind: pointer ? 'pointer-to' : p.kind === 'family' ? 'maps-to' : 'uses', source: sourceRef(p.id, p.version, { startLine: l.line, endLine: l.line }) }); }
    }
    for (const g of groups) for (const member of g.members) edges.push({ from: g.id, to: member, kind: 'groups', source: g.source });
    const nav: Graph['navigation'] = { roots: [rootPath, ...places.filter(p => p.id !== rootPath && !p.parents.length && !p.groupings.length && p.source !== 'listing').map(p => p.id), ...groups.map(g => g.id), ...(unmapped.length ? ['unmapped'] : [])], nodes: {}, unmapped };
    for (const p of places) nav.nodes[p.id] = { id: p.id, title: p.title, location: p.id, children: p.children, alsoUnder: p.parents };
    for (const g of groups) nav.nodes[g.id] = { id: g.id, title: g.title, children: g.members, alsoUnder: [] };
    if (unmapped.length) nav.nodes.unmapped = { id: 'unmapped', title: 'Unmapped', children: unmapped, alsoUnder: [] };
    // Scientific uses can form cycles. Keep those edges in the graph, while cutting only
    // traversal back-edges from the navigation projection. alsoUnder retains every user.
    const visiting = new Set<string>();
    const finished = new Set<string>();
    const project = (id: string) => {
      if (finished.has(id)) return;
      const node = nav.nodes[id]; if (!node) return;
      visiting.add(id);
      node.children = node.children.filter(child => !visiting.has(child));
      for (const child of node.children) project(child);
      visiting.delete(id); finished.add(id);
    };
    for (const id of [...nav.roots, ...Object.keys(nav.nodes)]) project(id);
    currentGraph = { nodes: [...places.map(p => ({ id: p.id, kind: 'location' as const, location: p.id, title: p.title })), ...groups.map(g => ({ id: g.id, kind: 'grouping' as const, title: g.title }))], edges, navigation: nav, builtAt: clock.now().toISOString() };
  };
  const ensure = () => ready ??= build().catch(e => { ready = undefined; throw e; });
  const resolvedOutline = async (location: string): Promise<Outline> => {
    const doc = await load(location); if (!doc) throw new Error(`missing_note: ${location}`);
    const out = structuredClone(doc.outline);
    for (const link of out.links) {
      const target = linkTarget(location, link.target);
      if (!target) {
        try {
          if (/^[a-z][a-z\d+.-]*:/i.test(link.target)) {
            new URL(link.target);
            link.resolved = { kind: 'web', address: { kind: 'uri', uri: link.target } };
          } else if (link.target.startsWith('/')) {
            const [file, fragment] = link.target.split('#');
            const address = fs.toAddress(decodeURIComponent(file!));
            const info = await fs.stat(address);
            if (!info) throw new Error('missing file');
            link.resolved = { kind: 'file', address };
            if (fragment) {
              const anchor = decodeURIComponent(fragment);
              const source = await fs.readText(address);
              const parsed = parseNote(location, source.text, file!.endsWith('.tex') ? 'tex' : 'markdown', source.version);
              link.resolved.version = source.version;
              link.resolved.locator = { kind: 'anchor', id: anchor };
              link.anchorOk = parsed.headings.some(h => h.slug === anchor) || parsed.anchors.some(a => a.id === anchor);
              if (!link.anchorOk) out.warnings.push({ line: link.line, message: `Unresolved anchor: ${link.target}` });
            }
          } else throw new Error('unsupported local target');
          if (link.resolved) for (const entry of out.currentWork?.entries ?? []) if (link.line >= entry.span.startLine && link.line <= entry.span.endLine) entry.links.push(link.resolved);
        } catch (e) { out.warnings.push({ line: link.line, message: `Unresolved target ${link.target}: ${String(e)}` }); }
        continue;
      }
      try {
        const address = { kind: 'workspace' as const, path: target.path };
        const info = await fs.stat(address);
        if (!info) { out.warnings.push({ line: link.line, message: `Unresolved target: ${link.target}` }); continue; }
        const targetDoc = /\.(md|tex)$/i.test(target.path) ? await load(target.path) : undefined;
        link.resolved = { kind: targetDoc ? 'note' : 'file', address, ...(targetDoc ? { version: targetDoc.outline.version } : {}), ...(target.anchor ? { locator: { kind: 'anchor', id: target.anchor } } : {}) };
        if (target.anchor) {
          link.anchorOk = !!targetDoc && (targetDoc.outline.headings.some(h => h.slug === target.anchor) || targetDoc.outline.anchors.some(a => a.id === target.anchor));
          if (!link.anchorOk) out.warnings.push({ line: link.line, message: `Unresolved anchor: ${link.target}` });
        }
        for (const entry of out.currentWork?.entries ?? []) if (link.line >= entry.span.startLine && link.line <= entry.span.endLine) {
          entry.links.push(link.resolved);
          if (entry.pointer?.target === target.path) entry.pointer.resolved = link.anchorOk !== false;
          if (targetDoc && /plan/i.test(`${link.target} ${link.text}`) && !entry.pointer) {
            const plan = parsePlan(targetDoc.outline, targetDoc.text, link.resolved);
            entry.plan = plan; out.plans.push(plan);
          }
        }
      } catch (e) { out.warnings.push({ line: link.line, message: `Unresolved target ${link.target}: ${String(e)}` }); }
    }
    for (const entry of out.currentWork?.entries ?? []) if (entry.pointer?.resolved === null) { entry.pointer.resolved = false; out.warnings.push({ line: entry.span.startLine, message: `Unresolved pointer: ${entry.pointer.target}` }); }
    return out;
  };
  return {
    parseNote,
    async locations() { await ensure(); return structuredClone(places); },
    async graph() { await ensure(); return structuredClone(currentGraph); },
    async groupings() { await ensure(); return structuredClone(groups); },
    async outline(location) { await ensure(); return resolvedOutline(location); },
    async board(filter) { await ensure(); const outlines = new Map<string, Outline>(); for (const p of places) outlines.set(p.id, await resolvedOutline(p.id)); return boardRows(places, outlines, filter); },
    async instructions(target) { await ensure(); return resolveInstructions(deps, target, places, docs, rootPath); },
    async whereUsed(path, anchor) {
      await ensure(); const uses: Use[] = [];
      for (const p of places) { const doc = docs.get(p.id)!; for (const link of doc.outline.links) { const t = linkTarget(p.id, link.target); if (t?.path !== path || (anchor !== undefined && t.anchor !== anchor)) continue; const entry = doc.outline.currentWork?.entries.find(e => link.line >= e.span.startLine && link.line <= e.span.endLine); const span = entry?.span ?? { startLine: link.line, endLine: link.line }; uses.push({ user: sourceRef(p.id, p.version, span), relation: entry?.pointer ? 'pointer' : 'links', passage: entry?.text ?? doc.text.split('\n')[link.line - 1]! }); } }
      return uses;
    },
    async refresh(paths) {
      await ensure();
      const changed: { path: string; version: Version }[] = [];
      for (const path of paths ?? [...docs.keys()]) {
        docs.delete(path);
        const next = await load(path);
        if (next) changed.push({ path, version: next.outline.version });
      }
      ready = build(); await ready;
      for (const change of changed) for (const listener of listeners) listener(change);
    },
    onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
};
