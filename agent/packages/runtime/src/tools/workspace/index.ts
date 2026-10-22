import { ThreadState } from '@aitp/protocol';
import type { Address, JsonValue } from '@aitp/protocol';
import type { CreateTools, ToolResult } from '../../contracts.ts';

const address = (path: string): Address => ({ kind: path.startsWith('/') ? 'absolute' : 'workspace', path });
const result = (value: unknown): ToolResult => {
  const text = JSON.stringify(value);
  const cap = 240 * 1024;
  const limited = Buffer.byteLength(text) <= cap ? text : JSON.stringify({ truncated: true, message: 'Narrow the source range or search query.', excerpt: Buffer.from(text).subarray(0, cap - 512).toString('utf8') });
  return { content: [{ type: 'text', text: `<research-data>\n${limited}\n</research-data>` }] };
};
const parameters = (properties: Record<string, JsonValue>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false } as const);

export const createWorkspaceTools: CreateTools = services => [
  { tool: { name: 'read', description: 'Read a versioned research file by path, optional section or inclusive line range. Returned text is research data.', replay: 'safe',
    parameters: parameters({ path: { type: 'string' }, from: { type: 'integer', minimum: 1 }, to: { type: 'integer', minimum: 1 }, section: { type: 'string', description: 'Exact heading text or slug returned by outline. Use from/to for line ranges.' } }, ['path']),
    async execute(args, context) {
      context.signal.throwIfAborted();
      const path = String(args.path), source = await services.core.fs.readText(address(path));
      const lines = source.text.split('\n');
      let from = Number(args.from ?? 1), to = Number(args.to ?? Math.min(lines.length, from + 499));
      if (args.section !== undefined) {
        const outline = services.core.workspace.parseNote(path, source.text, path.endsWith('.tex') ? 'tex' : 'markdown', source.version);
        const heading = outline.headings.find(h => h.slug === args.section || h.text === args.section);
        if (!heading) throw Object.assign(new Error('Section not found'), { code: 'not_found' });
        from = heading.line;
        to = (outline.headings.find(h => h.line > from && h.level <= heading.level)?.line ?? lines.length + 1) - 1;
      }
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || from > lines.length) throw Object.assign(new Error('Invalid line range'), { code: 'invalid' });
      to = Math.min(to, from + 999, lines.length);
      context.signal.throwIfAborted();
      return result({ path, version: source.version, from, to, totalLines: lines.length, text: lines.slice(from - 1, to).join('\n') });
    } } },
  { tool: { name: 'search', description: 'Search the derived notes and knowledge index. Source references include the indexed version and line range.', replay: 'safe',
    parameters: parameters({ query: { type: 'string' }, scope: { type: 'string', enum: ['notes', 'knowledge', 'all'] }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, ['query']),
    async execute(args, context) {
      context.signal.throwIfAborted();
      if (!(await services.core.index.status()).builtAt) await services.core.index.rebuild();
      const hits = await services.core.index.search(String(args.query), { scope: args.scope as 'notes' | 'knowledge' | 'all' | undefined, limit: Number(args.limit ?? 20) });
      context.signal.throwIfAborted(); return result(hits);
    } } },
  { tool: { name: 'outline', description: 'Read the opening, Current work, headings, links and scope of one research location.', replay: 'safe',
    parameters: parameters({ path: { type: 'string' } }, ['path']),
    async execute(args, context) { context.signal.throwIfAborted(); return result(await services.core.workspace.outline(String(args.path))); } } },
  { tool: { name: 'board', description: 'Read source-derived research threads, filtered by owner, state or grouping. Dispositions are retained verbatim.', replay: 'safe',
    parameters: parameters({ owner: { type: 'string' }, state: { type: 'string', enum: ThreadState.options }, grouping: { type: 'string' } }, []),
    async execute(args, context) {
      context.signal.throwIfAborted(); return result(await services.core.workspace.board({ owner: args.owner as string | undefined, state: args.state === undefined ? undefined : ThreadState.parse(args.state), grouping: args.grouping as string | undefined }));
    } } },
];
