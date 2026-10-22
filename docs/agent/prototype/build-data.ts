// Build the prototype's data file from a research workspace, read-only.
//
//   cd agent && node --experimental-strip-types --no-warnings ../docs/agent/prototype/build-data.ts \
//     [--topics DIR] [--knowledge DIR] [--illustrative FILE] [--out FILE]
//
// Defaults use the synthetic fixture workspace and write docs/agent/prototype/data.js. Notes are parsed
// with the agent's own parser (packages/core/src/notes), so the prototype shows what the agent extracts.
// Nothing is written outside --out.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseNote } from '../../../agent/packages/core/src/notes/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const agent = resolve(here, '../../../agent');
const require = createRequire(join(agent, 'package.json'));
const { micromark } = await import(require.resolve('micromark'));
const { gfm, gfmHtml } = await import(require.resolve('micromark-extension-gfm'));
const { math, mathHtml } = await import(require.resolve('micromark-extension-math'));
const GithubSlugger = (await import(require.resolve('github-slugger'))).default;

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? resolve(process.argv[i + 1]!) : fallback;
};
const topicsRoot = arg('topics', join(agent, 'fixtures/workspace/topics'));
const knowledgeRoot = arg('knowledge', join(agent, 'fixtures/workspace/knowledge'));
const illustrative = arg('illustrative', join(here, 'illustrative.json'));
const out = arg('out', join(here, 'data.js'));
const wsRoot = dirname(topicsRoot);
const rel = (p: string) => relative(wsRoot, p).split('\\').join('/');

const SKIP = /^(provenance|snapshots|history|before|aitp-before|superseded|node_modules|\.git|\.aitp|studying_note)$/;
function walk(dir: string, found: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return found; }
  if (entries.length > 2000) return found;
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP.test(e) || (e === 'ref' && basename(dir) === 'workspace') || /backup/i.test(e)) continue;
      walk(p, found);
    } else if (e === 'research.md') found.push(p);
  }
  return found;
}

// Markdown to HTML with KaTeX; heading ids follow GitHub slugs; note links become prototype routes.
function render(md: string, notePath: string, known: Set<string>): string {
  let html = micromark(md, { allowDangerousHtml: true, extensions: [gfm(), math()], htmlExtensions: [gfmHtml(), mathHtml()] });
  const slugger = new GithubSlugger();
  html = html.replace(/<h([1-4])>(.*?)<\/h\1>/g, (_m: string, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
    return `<h${level} id="${slugger.slug(text)}">${inner}</h${level}>`;
  });
  return html.replace(/<a href="([^"]+)"/g, (_m: string, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return `<a href="${href}" target="_blank" rel="noreferrer" class="ext"`;
    if (href.startsWith('#')) return `<a href="#/note/${encodeURIComponent(notePath)}${href}" data-anchor="${href.slice(1)}"`;
    const [file, frag] = href.split('#');
    const target = posix.normalize(posix.join(posix.dirname(notePath), decodeURIComponent(file!)));
    if (known.has(target)) return `<a href="#/note/${encodeURIComponent(target)}${frag ? '#' + frag : ''}" class="note-link"`;
    return `<a href="#/file/${encodeURIComponent(target)}${frag ? '#' + frag : ''}" class="file-link" title="${target}"`;
  });
}

const section = (text: string, title: RegExp) => {
  const lines = text.split('\n');
  const start = lines.findIndex(l => /^## /.test(l) && title.test(l.slice(3)));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return { start: start + 1, end, text: lines.slice(start + 1, end).join('\n') };
};
const listItems = (block: string) => {
  const items: string[] = [];
  for (const line of block.split('\n')) {
    if (/^- /.test(line)) items.push(line.slice(2));
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += ' ' + line.trim();
  }
  return items;
};
const firstSentence = (text: string) => {
  const plain = text.replace(/^>.*$/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  const m = plain.match(/^(.+?[.?!])(\s|$)/);
  return (m ? m[1] : plain).slice(0, 400);
};

const files = walk(topicsRoot).sort();
const storyDir = join(knowledgeRoot, 'topics');
const stories = existsSync(storyDir) ? readdirSync(storyDir).map(t => join(storyDir, t, 'story.md')).filter(existsSync) : [];
const known = new Set([...files, ...stories].map(rel));
const version = { observedAt: new Date().toISOString() } as never;

const notes: Record<string, unknown> = {};
const threads: unknown[] = [];
const questions: unknown[] = [];
for (const f of [...files, ...stories]) {
  const text = readFileSync(f, 'utf8');
  const id = rel(f);
  const outline = parseNote(id, text, 'markdown', version);
  const top = relative(topicsRoot, f).split(/[\\/]/)[0]!;
  const project = f.startsWith(topicsRoot) ? (top === 'research.md' ? null : top) : `knowledge:${basename(dirname(f))}`;
  notes[id] = {
    id, project, title: outline.title || basename(dirname(f)), kind: f.startsWith(topicsRoot) ? (top === 'research.md' ? 'root' : 'topic') : 'story',
    lines: text.split('\n').length, modified: statSync(f).mtime.toISOString(),
    question: firstSentence(outline.opening.text),
    opening: render(outline.opening.text, id, known),
    html: render(text, id, known),
    headings: outline.headings.filter(h => h.level <= 3).map(h => ({ level: h.level, text: h.text, slug: h.slug })),
    scope: outline.scope.map(s => s.flag),
  };
  for (const e of outline.currentWork?.entries ?? []) {
    const body = e.text.replace(/^\s*<a id="[^"]+"><\/a>\s*$/gm, '').trim();
    threads.push({
      id: `${id}#${e.key}`, note: id, project, key: e.key, form: e.form, name: e.name, state: e.state,
      disposition: e.dispositionText ?? null, date: e.date ?? null,
      next: e.continuation ? String(e.continuation.value) : null,
      pointer: e.pointer ? posix.normalize(posix.join(posix.dirname(id), e.pointer.target)) : null,
      lines: [e.span.startLine, e.span.endLine], html: render(body, id, known),
    });
  }
  const cw = outline.headings.find(h => /^current work$/i.test(h.text));
  for (const h of outline.headings) {
    if (h.level < 2 || h.level > 3 || (cw && h.line <= cw.line) || /current work|decisions|seeds|agreed|standing/i.test(h.text)) continue;
    if (/\?\s*$/.test(h.text) || /\b(remain|remaining|open)\b/i.test(h.text)) questions.push({ note: id, project, text: h.text, slug: h.slug });
  }
}

// Projects: top-level folders whose home is a main note or a README that maps main notes.
const rootNote = join(topicsRoot, 'research.md');
const rootText = existsSync(rootNote) ? readFileSync(rootNote, 'utf8') : '';
const projects: unknown[] = [];
for (const dir of readdirSync(topicsRoot).sort()) {
  const p = join(topicsRoot, dir);
  if (!statSync(p).isDirectory() || SKIP.test(dir) || dir === 'workspace') continue;
  const memberNotes = Object.values(notes).filter((n: any) => n.project === dir);
  if (!memberNotes.length) continue;
  const home = existsSync(join(p, 'research.md')) ? join(p, 'research.md') : existsSync(join(p, 'README.md')) ? join(p, 'README.md') : null;
  const homeText = home ? readFileSync(home, 'utf8') : '';
  const title = (homeText.match(/^# (.+)$/m)?.[1] ?? dir).trim();
  const isFamily = !existsSync(join(p, 'research.md'));
  const intro = homeText.replace(/^# .+$/m, '').split(/\n## /)[0]!;
  projects.push({
    id: dir, path: rel(p), title, kind: isFamily ? 'family' : 'topic', home: home ? rel(home) : null,
    question: firstSentence(isFamily ? intro : (notes[rel(home!)] as any).question),
    homeHtml: isFamily && home ? render(intro, rel(home), known) : null,
    notes: memberNotes.map((n: any) => n.id),
  });
}
for (const s of stories) {
  const id = `knowledge:${basename(dirname(s))}`;
  const n = notes[rel(s)] as any;
  projects.push({ id, path: rel(dirname(s)), title: n.title, kind: 'learning', home: rel(s), question: n.question, homeHtml: null, notes: [rel(s)] });
}

// Directions from the root: "## N. Title" sections and the projects they link.
const directions: unknown[] = [];
for (const m of rootText.matchAll(/^## (\d+)\. (.+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
  const linked = new Set<string>();
  for (const l of m[3]!.matchAll(/\]\(([^)#]+)/g)) {
    const target = posix.normalize(posix.join('topics', l[1]!));
    const top = target.split('/')[1];
    if (top && (projects as any[]).some(p => p.id === top)) linked.add(top);
    if (/knowledge\//.test(l[1]!)) for (const p of projects as any[]) if (p.kind === 'learning') linked.add(p.id);
  }
  directions.push({ n: Number(m[1]), title: m[2]!.trim(), question: firstSentence(m[3]!), projects: [...linked] });
}

// Ideas (seeds) and decisions with their source passages.
const ideas: unknown[] = [];
const decisions: unknown[] = [];
const rootId = existsSync(rootNote) ? rel(rootNote) : null;
const seedBlock = section(rootText, /^Seeds/i);
if (seedBlock && rootId) listItems(seedBlock.text).forEach((t, i) => ideas.push({ id: `${rootId}#seed-${i + 1}`, note: rootId, html: render(t, rootId, known), text: firstSentence(t) }));
const agreed = section(rootText, /^Agreed choices/i);
if (agreed && rootId) listItems(agreed.text).forEach((t, i) => decisions.push({ id: `${rootId}#choice-${i + 1}`, note: rootId, source: 'root agreed choices', html: render(t, rootId, known), text: firstSentence(t) }));
for (const f of [...files, ...readdirSync(topicsRoot).map(d => join(topicsRoot, d, 'README.md')).filter(existsSync)]) {
  const text = readFileSync(f, 'utf8');
  const id = rel(f);
  const blocks = [section(text, /^Decisions and retained alternatives/i), section(text, /^Standing choices/i)].filter(Boolean);
  for (const b of blocks) listItems(b!.text).forEach((t, i) => decisions.push({ id: `${id}#decision-${i + 1}`, note: id, source: basename(f) === 'README.md' ? 'folder map standing choice' : 'note decisions', html: render(t, id, known), text: firstSentence(t) }));
}

// Papers and knowledge entries.
const frontmatter = (text: string) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const o: Record<string, string> = {};
  if (m) for (const line of m[1]!.split('\n')) { const kv = line.match(/^(\w+):\s*"?(.*?)"?$/); if (kv) o[kv[1]!] = kv[2]!; }
  return o;
};
const papers: unknown[] = [];
const paperDir = join(knowledgeRoot, 'papers');
if (existsSync(paperDir)) for (const f of readdirSync(paperDir).filter(f => f.endsWith('.md')).sort()) {
  const text = readFileSync(join(paperDir, f), 'utf8');
  const fm = frontmatter(text);
  const id = f.replace(/\.md$/, '');
  const pdf = fm.version ? join(knowledgeRoot, 'library/arxiv', fm.version, 'paper.pdf') : '';
  const sec = join(paperDir, id);
  const usedBy = Object.values(notes).filter((n: any) => readFileSync(join(wsRoot, n.id), 'utf8').includes(id)).map((n: any) => n.id);
  papers.push({
    id, title: fm.title ?? id, authors: fm.authors ?? '', year: fm.year ?? '', arxiv: fm.arxiv ?? id, version: fm.version ?? '',
    reading: fm.reading_depth ?? '', closeReading: fm.close_reading ?? '', area: fm.area ?? '', support: fm.support ?? '', review: fm.review ?? '',
    pdf: existsSync(pdf) ? relative(here, pdf).split('\\').join('/') : null,
    sections: existsSync(sec) ? readdirSync(sec).filter(s => s.endsWith('.md')).sort().map(s => ({ file: s, title: readFileSync(join(sec, s), 'utf8').match(/^# (.+)$/m)?.[1] ?? s })) : [],
    map: render(text.replace(/^---[\s\S]*?---\n/, ''), rel(join(paperDir, f)), known), usedBy,
  });
}
const knowledge: unknown[] = [];
for (const sub of ['atoms', 'concepts', 'questions', '.']) {
  const d = join(knowledgeRoot, sub);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter(f => f.endsWith('.md') && !/^(README|index)\.md$/.test(f)).sort()) {
    const text = readFileSync(join(d, f), 'utf8');
    const fm = frontmatter(text);
    const id = rel(join(d, f));
    const usedBy = Object.values(notes).filter((n: any) => readFileSync(join(wsRoot, n.id), 'utf8').includes(f.replace(/\.md$/, ''))).map((n: any) => n.id);
    knowledge.push({ id, title: text.match(/^# (.+)$/m)?.[1] ?? f, kind: fm.kind ?? sub.replace(/s$/, ''), area: fm.area ?? '', support: fm.support ?? '', review: fm.review ?? '', html: render(text.replace(/^---[\s\S]*?---\n/, ''), id, known), usedBy });
  }
}
const indexText = existsSync(join(knowledgeRoot, 'index.md')) ? readFileSync(join(knowledgeRoot, 'index.md'), 'utf8') : '';
const areas = [...indexText.matchAll(/^## (.+)$/gm)].map(m => m[1]!.trim());

// Code checkouts: development folders inside project workspaces.
const checkouts: unknown[] = [];
for (const proj of projects as any[]) {
  const dev = join(wsRoot, proj.path, 'workspace/development');
  if (!existsSync(dev)) continue;
  for (const c of readdirSync(dev).sort()) {
    const p = join(dev, c);
    if (!statSync(p).isDirectory()) continue;
    const head = existsSync(join(p, '.git/HEAD')) ? readFileSync(join(p, '.git/HEAD'), 'utf8').trim().replace(/^ref: refs\/heads\//, '') : null;
    const tree: string[] = [];
    const list = (d: string, depth: number) => {
      for (const e of readdirSync(d).sort()) {
        if (e === '.git' || e === 'build' || e === 'node_modules') continue;
        const q = join(d, e);
        const r = relative(p, q).split('\\').join('/');
        if (statSync(q).isDirectory()) { tree.push(r + '/'); if (depth < 2 && tree.length < 400) list(q, depth + 1); }
        else tree.push(r);
      }
    };
    list(p, 0);
    const samples: Record<string, string> = {};
    for (const t of tree.filter(t => /\.(cpp|f90|py|md|h)$/.test(t)).slice(0, 8)) samples[t] = readFileSync(join(p, t), 'utf8').slice(0, 6000);
    checkouts.push({ id: rel(p), project: proj.id, name: c, branch: head, tree, samples });
  }
}

// Icons from lucide (ISC licence), as inline SVG strings.
const ICONS = ['house', 'folder-tree', 'library-big', 'brain', 'code-xml', 'messages-square', 'search', 'settings', 'git-branch', 'git-commit-horizontal',
  'chevron-right', 'chevron-down', 'chevron-left', 'arrow-left', 'arrow-right', 'plus', 'x', 'circle-dot', 'circle', 'circle-pause', 'circle-dashed', 'circle-alert',
  'circle-check', 'lightbulb', 'scale', 'circle-question-mark', 'file-text', 'file-code', 'file', 'book-open', 'sparkles', 'play', 'square', 'panel-right', 'panel-bottom',
  'panel-left', 'sun', 'moon', 'external-link', 'rotate-ccw-clock', 'link', 'list-tree', 'inbox', 'flask-conical', 'sigma', 'pen-line', 'check', 'git-pull-request',
  'terminal', 'cpu', 'funnel', 'columns-2', 'clock', 'user', 'bot', 'shield-check', 'triangle-alert', 'eye', 'copy', 'ellipsis', 'corner-down-left',
  'message-square-plus', 'notebook-pen', 'quote', 'arrow-up-right', 'layers', 'workflow', 'rotate-ccw', 'zoom-in', 'zoom-out', 'highlighter', 'list', 'hash', 'at-sign', 'command'];
const icons: Record<string, string> = {};
for (const name of ICONS) {
  const file = join(agent, 'node_modules/lucide-react/dist/esm/icons', `${name}.mjs`);
  if (!existsSync(file)) { console.warn('missing icon', name); continue; }
  const { __iconData } = await import(file);
  if (!__iconData) { console.warn('icon without data (alias)', name); continue; }
  icons[name] = __iconData.node.map(([tag, attrs]: [string, Record<string, string>]) =>
    `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
}

const extra = existsSync(illustrative) ? JSON.parse(readFileSync(illustrative, 'utf8')) : {};
for (const c of extra.conversations ?? []) for (const m of c.messages ?? []) if (m.md) m.html = render(m.md, c.note ?? 'topics/research.md', known);
for (const c of extra.conversations ?? []) for (const ch of c.changes ?? []) if (ch.afterMd) ch.afterHtml = render(ch.afterMd, ch.file, known);
const data = {
  label: extra.label ?? 'synthetic', builtAt: new Date().toISOString(), workspace: rel(topicsRoot) || 'topics',
  root: rootId ? { id: rootId, title: (notes[rootId] as any).title } : null,
  directions, projects, notes, threads, questions, ideas, decisions, papers, knowledge, areas, checkouts, icons,
  illustrative: extra,
};
writeFileSync(out, `// Generated by build-data.ts on ${data.builtAt}; do not edit.\nwindow.AITP_DATA = ${JSON.stringify(data)};\n`);
console.log(JSON.stringify({ out, projects: projects.length, notes: Object.keys(notes).length, threads: threads.length, ideas: ideas.length, decisions: decisions.length, papers: papers.length, knowledge: knowledge.length, checkouts: checkouts.length, bytes: statSync(out).size }));
