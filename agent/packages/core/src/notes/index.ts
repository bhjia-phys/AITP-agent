import { posix } from 'node:path';
import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { math } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';
import type { LinkKind, Outline, ResourceRef, Span, ThreadEntry, ThreadState, Version } from '@aitp/protocol';

type Node = { type: string; value?: string; url?: string; identifier?: string; depth?: number; children?: Node[]; position?: { start: { line: number }; end: { line: number } } };
export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
export function plain(n: Node): string { return n.value ?? (n.children ?? []).map(plain).join(''); }
export function sourceRef(path: string, version: Version, span?: Span): ResourceRef {
  return { kind: 'note', address: { kind: 'workspace', path }, version, ...(span ? { locator: { kind: 'lines', start: span.startLine, end: span.endLine } } : {}) };
}
export function linkTarget(location: string, target: string): { path: string; anchor?: string } | undefined {
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('/')) return undefined;
  const [file, ...hash] = target.split('#');
  let path: string, anchor: string | undefined;
  try { path = file ? decodeURIComponent(file) : location; anchor = hash.length ? decodeURIComponent(hash.join('#')) : undefined; } catch { return undefined; }
  path = file ? posix.normalize(posix.join(posix.dirname(location), path)) : location;
  if (path.startsWith('../') || path.startsWith('/')) return undefined;
  return { path, ...(anchor ? { anchor } : {}) };
}
export function linkKind(target: string): LinkKind {
  if (target.startsWith('#')) return 'anchor';
  if (/arxiv\.org\//i.test(target)) return 'arxiv';
  if (/doi\.org\//i.test(target) || /^doi:/i.test(target)) return 'doi';
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) return 'web';
  const file = target.split('#')[0]!.toLowerCase();
  if (/(?:^|\/)(research\.md|story\.md)$/.test(file)) return 'main-note';
  if (/\.md$/.test(file)) return 'note';
  if (/\.tex$/.test(file)) return 'tex';
  if (/\.pdf$/.test(file)) return 'pdf';
  if (/\.(png|jpe?g|svg|eps|webp)$/.test(file)) return 'figure';
  if (/\.(csv|tsv|json|h5|hdf5|npy|npz|dat)$/.test(file)) return 'data';
  if (/\.(cpp|c|h|hpp|py|f90|f|ts|js|sh)$/.test(file)) return 'code';
  return !posix.extname(file) || file.endsWith('/') ? 'directory' : 'unknown';
}
export function stateOf(s: string): ThreadState {
  const t = normalize(s).toLowerCase();
  if (/^waiting (?:on|for)/.test(t)) {
    if (/researcher|learner/.test(t)) return 'waiting-researcher';
    if (/analysis|replay evidence|branch inputs/.test(t)) return 'waiting-analysis';
    if (/integration/.test(t)) return 'waiting-integration';
    if (/run|job|computation/.test(t)) return 'waiting-run';
    return 'waiting-input';
  }
  for (const state of ['active', 'proposed', 'paused', 'stopped', 'dormant', 'deferred', 'blocked', 'concluded'] as const) if (new RegExp(`^${state}\\b`, 'i').test(t)) return state;
  if (/^open diagnostic question/.test(t)) return 'active';
  return 'unknown';
}
function suggestion(s: string, heading: boolean): string | undefined {
  const cues = [/(?:^|[.!?]\s+)Next:\s*(.+?)(?:[.!?](?:\s|$)|$)/i, /\bThe next (?:prerequisite|step|discriminator) is\s+(.+?)(?:[.!?](?:\s|$)|$)/i, /\b(Start with\b.+?)(?:[.!?](?:\s|$)|$)/i, /\b(Before\s+.+?,\s*.+?)(?:[.!?](?:\s|$)|$)/i];
  for (const cue of cues) { const match = s.match(cue); if (match) return match[1]!.trim(); }
  if (heading) { const body = s.replace(/^.*?\*\*.*?\*\*\s*/, ''); const m = body.match(/^(?:Check|Compare|Read|Derive|Compute|Test|Start|Fix|Determine|Establish|Construct|Evaluate|Write)\b[^.!?]+/i); if (m) return m[0]; }
  return undefined;
}
export function parseNote(location: string, text: string, format: 'markdown' | 'tex', version: Version): Outline {
  const lines = text.split('\n');
  const whole = { startLine: 1, endLine: Math.max(1, lines.length) };
  const out: Outline = { location, version, format, title: '', opening: { span: whole, text }, headings: [], anchors: [], currentWork: null, links: [], plans: [], scope: [], warnings: [] };
  const slice = (span: Span) => lines.slice(span.startLine - 1, span.endLine).join('\n');
  const trimEnd = (start: number, end: number) => { while (end > start && !lines[end - 1]?.trim()) end--; return end; };
  try {
    const slugger = new GithubSlugger();
    let nodes: Node[] = [];
    let tree: Node | undefined;
    if (format === 'markdown') {
      // Standalone anchor tags must not swallow an immediately following heading as a CommonMark HTML block.
      const markdown = text.replace(/^([ \t]*)(<a\b[^>]*>\s*<\/a>)[ \t]*$/gmi, '$1<!-- aitp anchor -->');
      tree = fromMarkdown(markdown, { extensions: [gfm(), math()], mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()] }) as Node;
      nodes = tree.children ?? [];
      const definitions = new Map<string, string>();
      const visit = (root: Node, fn: (n: Node) => void) => { const stack = [root]; while (stack.length) { const n = stack.pop()!; fn(n); stack.push(...[...(n.children ?? [])].reverse()); } };
      visit(tree, n => { if (n.type === 'definition' && n.identifier && n.url) definitions.set(n.identifier.toLowerCase(), n.url); });
      visit(tree, n => {
        const line = n.position?.start.line ?? 1;
        if (n.type === 'heading') out.headings.push({ level: n.depth!, text: plain(n), slug: slugger.slug(plain(n)), line });
        if (n.type === 'link' || n.type === 'linkReference') {
          const target = n.url ?? definitions.get(n.identifier?.toLowerCase() ?? '');
          if (target) out.links.push({ text: plain(n), target, kind: linkKind(target), resolved: null, line });
          else out.warnings.push({ line, message: `Undefined link reference: ${n.identifier}` });
        }
        if (n.type === 'html') for (const m of lines.slice(line - 1, n.position?.end.line ?? line).join('\n').matchAll(/<a\b[^>]*\b(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/gi)) out.anchors.push({ id: m[1]!, line });
      });
      out.title = out.headings.find(h => h.level === 1)?.text ?? '';
      const title = out.headings.find(h => h.level === 1);
      const firstSection = out.headings.find(h => h.level === 2);
      const startLine = Math.min(lines.length, (title?.line ?? 0) + 1);
      const endLine = Math.max(startLine, (firstSection?.line ?? lines.length + 1) - 1);
      out.opening = { span: { startLine: Math.max(1, startLine), endLine }, text: slice({ startLine: Math.max(1, startLine), endLine }) };
    } else {
      out.title = text.match(/\\title\{([^}]+)\}/)?.[1] ?? '';
      for (const [i, line] of lines.entries()) {
        for (const m of line.matchAll(/\\(subsubsection|subsection|section)\*?\{([^}]+)\}/g)) out.headings.push({ level: m[1] === 'section' ? 2 : m[1] === 'subsection' ? 3 : 4, text: m[2]!, slug: slugger.slug(m[2]!), line: i + 1 });
        for (const m of line.matchAll(/\\label\{([^}]+)\}/g)) out.anchors.push({ id: m[1]!, line: i + 1 });
        for (const m of line.matchAll(/\\href\{([^}]+)\}\{([^}]+)\}/g)) out.links.push({ text: m[2]!, target: m[1]!, kind: linkKind(m[1]!), resolved: null, line: i + 1 });
      }
      const abstract = lines.findIndex(l => /\\begin\{abstract\}/.test(l));
      const intro = out.headings.find(h => /^introduction$/i.test(h.text));
      const end = out.headings.find(h => h.text.toLowerCase() !== 'introduction')?.line ?? lines.length + 1;
      const span = { startLine: abstract >= 0 ? abstract + 1 : intro?.line ?? 1, endLine: Math.max(abstract + 1, end - 1, 1) };
      out.opening = { span, text: slice(span) };
    }
    const cw = out.headings.find(h => /^current work$/i.test(h.text.trim()));
    if (cw) {
      const end = (out.headings.find(h => h.line > cw.line && h.level <= cw.level)?.line ?? lines.length + 1) - 1;
      const spans: { span: Span; heading: boolean; name?: string; bold?: string }[] = [];
      if (format === 'tex') {
        const starts = lines.map((l, i) => ({ l, i })).filter(x => x.i + 1 > cw.line && x.i + 1 <= end && /^\s*\\item\b/.test(x.l));
        for (let i = 0; i < starts.length; i++) { const start = starts[i]!.i + 1; let stop = (starts[i + 1]?.i ?? end); while (stop > start && /^(?:\s*$|\\end\{)/.test(lines[stop - 1]!)) stop--; spans.push({ span: { startLine: start, endLine: stop }, heading: false, bold: lines[start - 1]!.match(/\\textbf\{([^}]+)\}/)?.[1] }); }
      } else {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]!; const start = n.position?.start.line ?? 0;
          if (start <= cw.line || start > end) continue;
          if (spans.some(s => s.heading && start > s.span.startLine && start <= s.span.endLine)) continue;
          if (n.type === 'list') for (const item of n.children ?? []) {
            const bold = item.children?.[0]?.children?.find(c => c.type === 'strong');
            spans.push({ span: { startLine: item.position!.start.line, endLine: item.position!.end.line }, heading: false, ...(bold ? { bold: plain(bold) } : {}) });
          }
          else if (n.type === 'heading' && n.depth === 3) {
            let first = start;
            for (let j = i - 1; j >= 0; j--) { const prev = nodes[j]!; if (prev.type !== 'html' || prev.position!.start.line <= cw.line) break; first = prev.position!.start.line; }
            const stop = out.headings.find(h => h.line > start && h.level <= 3)?.line ?? end + 1;
            let entryEnd = trimEnd(first, Math.min(end, stop - 1));
            if (stop <= end) { while (entryEnd > first && /^\s*<a\b/.test(lines[entryEnd - 1]!)) entryEnd = trimEnd(first, entryEnd - 1); }
            spans.push({ span: { startLine: first, endLine: entryEnd }, heading: true, name: plain(n) });
          } else if (n.type !== 'html' && !spans.some(s => start >= s.span.startLine && start <= s.span.endLine)) {
            spans.push({ span: { startLine: start, endLine: n.position!.end.line }, heading: false });
          }
        }
      }
      const keys = new GithubSlugger();
      const entries: ThreadEntry[] = spans.map(({ span, heading, name, bold }, index) => {
        const raw = slice(span);
        const normalized = normalize(raw);
        const pointerLink = bold?.includes('→') ? out.links.find(l => l.line >= span.startLine && l.line <= span.endLine) : undefined;
        const pointer = pointerLink && linkTarget(location, pointerLink.target);
        const form = pointer ? 'pointer' : heading ? 'heading' : bold ? 'thread' : 'raw';
        const entryName = pointer ? bold!.split('→')[0]!.trim() : name ?? bold ?? null;
        let disposition: string | undefined;
        let statusText = '';
        if (form === 'thread') {
          const after = format === 'tex' ? normalized.replace(/^.*?\\textbf\{[^}]*\}/, '').replace(/\$\\cdot\$/g, '·') : normalized.replace(/^.*?\*\*.*?\*\*/, '');
          statusText = after.replace(/^\s*(?:—|–|---|-)\s*/, '').split(/[.!?]/)[0]!;
          disposition = statusText.split(' · ')[0]!.split(';')[0]!.trim();
        } else if (heading) { statusText = normalized.match(/\*\*(.+?)\*\*/)?.[1] ?? ''; disposition = statusText.split(' · ')[0]?.split(/[.;]/)[0]?.trim(); }
        const state = form === 'pointer' ? 'pointer' : stateOf(disposition ?? '');
        const key = entryName ? keys.slug(entryName) || `entry-${index + 1}` : `entry-${index + 1}`;
        const entry: ThreadEntry = { owner: location, index, key, form, name: entryName, state, span, text: raw, anchors: out.anchors.filter(a => a.line >= span.startLine && a.line <= span.endLine).map(a => a.id), links: [] };
        if (disposition) entry.dispositionText = disposition;
        if (pointer) entry.pointer = { target: pointer.path, ...(pointer.anchor ? { anchor: pointer.anchor } : {}), resolved: null };
        if (form !== 'pointer') {
          if (/last consequential change date unrecorded/i.test(statusText)) entry.date = 'unrecorded';
          else { const date = statusText.match(/(?:·|\$\\cdot\$)\s*(\d{4}-\d{2}-\d{2})/); if (date) entry.date = date[1]; }
          const clean = normalize(normalized.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
          const headingLine = heading ? raw.split('\n').findIndex(line => /^###\s/.test(line)) : -1;
          const prose = headingLine >= 0 ? normalize(raw.split('\n').slice(headingLine + 1).join('\n').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')) : clean;
          const next = suggestion(prose, heading);
          if (next) entry.continuation = { value: next, sources: [sourceRef(location, version, span)], builder: 'aitp-current-work', builtAt: version.observedAt, fresh: true, extracted: { kind: 'suggestion', confidence: 'medium' } };
        }
        if (form === 'raw') out.warnings.push({ line: span.startLine, message: 'Unstructured Current work entry preserved' });
        if (['paused', 'deferred', 'dormant'].includes(state)) out.scope.push({ flag: state as 'paused' | 'deferred' | 'dormant', location, thread: key, source: sourceRef(location, version, span) });
        return entry;
      });
      out.currentWork = { span: { startLine: cw.line, endLine: Math.max(cw.line, end) }, entries };
    }
    const opening = normalize(out.opening.text);
    const locationFlags = [
      [/\b(?:analytic(?:al)?(?:[ -]+work)?[ -]+only|purely analytic(?:al)?)\b|\bno numerical (?:solving|tests|calculations)\b|\bexcludes numerical (?:calculations|execution)\b/i, 'analyticOnly'],
      [/\bexcludes\b[^.!?]*\bexecution\b/i, 'executionExcluded'],
      [/\bis dormant\b/i, 'dormant'],
    ] as const;
    for (const [pattern, flag] of locationFlags) if (pattern.test(opening)) {
      out.scope = out.scope.filter(f => f.flag !== flag);
      out.scope.push({ flag, location, source: sourceRef(location, version, out.opening.span) });
    }
    if (!out.title) out.warnings.push({ message: 'No title heading found; source preserved' });
  } catch (error) {
    out.warnings.push({ message: `Unstructured input preserved: ${String(error)}` });
    out.currentWork = { span: whole, entries: [{ owner: location, index: 0, key: 'entry-1', form: 'raw', name: null, state: 'unknown', anchors: [], links: [], span: whole, text }] };
  }
  return out;
}
