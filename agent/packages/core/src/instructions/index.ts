import { posix } from 'node:path';
import type { InstructionSource, Outline, ResearchLocation, ResourceRef } from '@aitp/protocol';
import type { CoreDeps, WorkspaceFs, WorkspaceModel } from '../contracts.ts';
import { linkTarget, parseNote, sourceRef } from '../notes/index.ts';
import { within } from '../paths/index.ts';

type Document = { outline: Outline; text: string };
export async function resolveInstructions(deps: CoreDeps & { fs: WorkspaceFs }, target: Parameters<WorkspaceModel['instructions']>[0], locations: ResearchLocation[], docs: Map<string, Document>, rootPath: string): Promise<InstructionSource[]> {
  const { fs, config } = deps;
  const results: InstructionSource[] = [];
  const appliesTo = { ...(target.location ? { location: target.location } : {}), ...(target.checkout ? { checkout: target.checkout.id } : {}) };
  const load = async (path: string) => {
    const address = path.startsWith('/') ? fs.toAddress(path) : { kind: 'workspace' as const, path };
    if (!(await fs.stat(address))) return undefined;
    const { text, version } = await fs.readText(address);
    return { text, outline: parseNote(path, text, 'markdown', version), address };
  };
  if (target.location) {
    const workspace = await load(posix.join(posix.relative(config.workspace.root, config.workspace.topicsRoot), 'AGENTS.md'));
    if (workspace) results.push({ kind: 'workspace', ref: { ...sourceRef(workspace.outline.location, workspace.outline.version, { startLine: 1, endLine: workspace.text.split('\n').length }), address: workspace.address }, text: workspace.text, appliesTo });
    const families = locations.filter(l => l.kind === 'family' && within(posix.dirname(l.id), target.location!));
    for (const family of families) {
      const doc = docs.get(family.id)!;
      const headings = doc.outline.headings;
      for (let i = 0; i < headings.length; i++) {
        const h = headings[i]!;
        if (!/standing (?:choices|rules|agreements)|(?:^|\b)(?:rules|conventions|defaults|instructions|guidance)(?:\b|$)/i.test(h.text)) continue;
        const end = headings.slice(i + 1).find(x => x.level <= h.level)?.line ?? doc.text.split('\n').length + 1;
        const span = { startLine: h.line, endLine: end - 1 };
        results.push({ kind: 'family-readme', ref: sourceRef(family.id, doc.outline.version, span), text: doc.text.split('\n').slice(h.line - 1, end - 1).join('\n'), appliesTo });
      }
    }
    const root = docs.get(rootPath);
    if (root) {
      const headings = root.outline.headings;
      const lines = root.text.split('\n');
      for (let i = 0; i < headings.length; i++) {
        const h = headings[i]!;
        if (!/^(agreed choices|standing agreements)/i.test(h.text)) continue;
        const end = headings.slice(i + 1).find(x => x.level <= h.level)?.line ?? lines.length + 1;
        // Agreement items, rather than the whole section, retain their authority and scope.
        const starts = lines.map((line, i) => ({ line, n: i + 1 })).filter(x => x.n > h.line && x.n < end && /^[-*+]\s/.test(x.line));
        for (let j = 0; j < starts.length; j++) {
          const start = starts[j]!.n;
          let stop = (starts[j + 1]?.n ?? end) - 1;
          while (stop > start && !lines[stop - 1]?.trim()) stop--;
          const links = root.outline.links.filter(l => l.line >= start && l.line <= stop);
          if (!links.some(l => { const p = linkTarget(rootPath, l.target)?.path; return p === target.location || families.some(f => f.id === p); })) continue;
          const span = { startLine: start, endLine: stop };
          results.push({ kind: 'root-agreement', ref: sourceRef(rootPath, root.outline.version, span), text: lines.slice(start - 1, stop).join('\n'), appliesTo });
        }
      }
    }
  }
  if (target.checkout) {
    const { absolute } = await fs.resolve(target.checkout.address);
    let repository: Awaited<ReturnType<typeof load>>;
    for (const name of ['AGENTS.md', 'CLAUDE.md']) { repository = await load(posix.join(absolute, name)); if (repository) break; }
    if (repository) {
      const ref: ResourceRef = { kind: 'file', address: repository.address, version: repository.outline.version, locator: { kind: 'lines', start: 1, end: repository.text.split('\n').length } };
      results.push({ kind: 'repository', ref, text: repository.text, appliesTo });
      const named = [...repository.text.matchAll(/`([^`\n]+\.md)`|\]\(([^)]+\.md)\)/g)].map(m => m[1] ?? m[2]!);
      for (const path of [...new Set(named)]) {
        const doc = await load(posix.resolve(absolute, path));
        if (!doc) continue;
        results.push({ kind: 'method-guidance', ref: { kind: 'file', address: doc.address, version: doc.outline.version, locator: { kind: 'lines', start: 1, end: doc.text.split('\n').length } }, text: doc.text, appliesTo });
      }
    }
  }
  return results;
}
