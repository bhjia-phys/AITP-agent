import { open, opendir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import type { Address } from '@aitp/protocol';
import type { CreateWorkspaceFs, FileKind } from '../contracts.ts';
import { configDirectories } from '../config/index.ts';

export const within = (root: string, path: string) => path === root || path.startsWith(root + '/');
export const hiddenHomePaths = ['.ssh', '.gnupg', '.codex', '.claude', '.config/aitp-agent', '.local/share/aitp-agent', '.mozilla', '.config/google-chrome', '.config/chromium', '.config/BraveSoftware', 'Library/Application Support/Google/Chrome', 'Library/Application Support/Firefox', 'Library/Safari'];
const mimeTypes: Record<string, string> = { '.md': 'text/markdown', '.tex': 'application/x-tex', '.txt': 'text/plain', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.html': 'text/html', '.csv': 'text/csv', '.py': 'text/x-python', '.ts': 'text/typescript' };
const forbidden = () => Object.assign(new Error('forbidden_path'), { code: 'forbidden_path' });
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT' || (e as NodeJS.ErrnoException).code === 'ENOTDIR';
async function canonical(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (e) { if (!missing(e)) throw e; const parent = dirname(path); if (parent === path) return path; return resolve(await canonical(parent), path.slice(parent.length + 1)); }
}
export const createWorkspaceFs: CreateWorkspaceFs = ({ config, dataDir, clock }) => {
  const root = resolve(config.workspace.root);
  const allowed = [root, config.workspace.topicsRoot, config.workspace.knowledgeRoot, ...config.workspace.extraReadRoots, config.aitp.checkout, ...config.aitp.extraSkillRoots].filter((p): p is string => !!p).map(p => resolve(p));
  const hidden = [...hiddenHomePaths.map(p => resolve(homedir(), p)), resolve(dataDir), configDirectories.get(config) || dirname(resolve(process.env.AITP_AGENT_CONFIG || `${homedir()}/.config/aitp-agent/config.json`)), ...config.sandbox.hiddenPaths];
  let roots: Promise<{ allow: string[]; deny: string[] }> | undefined;
  const getRoots = () => roots ??= Promise.all([Promise.all(allowed.map(canonical)), Promise.all(hidden.map(canonical))]).then(([allow, deny]) => ({ allow, deny }));
  const toAddress = (absolute: string): Address => within(root, absolute) && absolute !== root ? { kind: 'workspace', path: relative(root, absolute) } : { kind: 'absolute', path: absolute };
  const guard = async (address: Address) => {
    if (address.kind !== 'workspace' && address.kind !== 'absolute') throw forbidden();
    if (address.path.includes('\0') || address.path.includes('\\') || address.path.split('/').includes('..') || (address.kind === 'workspace' && isAbsolute(address.path))) throw forbidden();
    const path = address.kind === 'workspace' ? resolve(root, address.path) : address.path;
    if (!isAbsolute(path) || !allowed.some(p => within(p, path)) || hidden.some(p => within(p, path))) throw forbidden();
    const absolute = await canonical(path);
    const { allow, deny } = await getRoots();
    if (!allow.some(p => within(p, absolute)) || deny.some(p => within(p, absolute))) throw forbidden();
    return { absolute, ...(within(root, absolute) && absolute !== root ? { workspacePath: relative(root, absolute) } : {}) };
  };
  const read = async (address: Address, maxBytes = 8 * 1024 * 1024) => {
    const { absolute } = await guard(address);
    const handle = await open(absolute, 'r');
    try {
      // Recheck the opened inode's path on Linux, closing the symlink-swap window.
      if (process.platform === 'linux') await guard({ kind: 'absolute', path: await realpath(`/proc/self/fd/${handle.fd}`) });
      const info = await handle.stat();
      if (!info.isFile()) throw new Error('not_file');
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || info.size > maxBytes) throw new Error('file_too_large');
      const buffer = Buffer.alloc(Math.min(info.size + 1, maxBytes + 1));
      let length = 0;
      while (length < buffer.length) { const r = await handle.read(buffer, length, buffer.length - length, null); if (!r.bytesRead) break; length += r.bytesRead; }
      if (length > maxBytes || length > info.size) throw new Error('file_too_large');
      return { bytes: buffer.subarray(0, length), absolute };
    } finally { await handle.close(); }
  };
  return {
    resolve: guard, toAddress,
    async readText(address, options) { const { bytes } = await read(address, options?.maxBytes); return { text: bytes.toString('utf8'), version: { observedAt: clock.now().toISOString() } }; },
    async readBytes(address, options) {
      const { bytes, absolute } = await read(address, options?.maxBytes);
      const range = options?.range;
      if (range && (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end < range.start || range.end >= bytes.length)) throw new Error('invalid_range');
      return { bytes: range ? bytes.subarray(range.start, range.end + 1) : bytes, mime: mimeTypes[extname(absolute).toLowerCase()] || 'application/octet-stream', size: bytes.length };
    },
    async stat(address) { const { absolute } = await guard(address); try { const s = await stat(absolute); return { kind: s.isDirectory() ? 'directory' : 'file', bytes: s.size, mtimeMs: s.mtimeMs }; } catch (e) { if (missing(e)) return undefined; throw e; } },
    async list(address, options) {
      const { absolute } = await guard(address);
      const limit = Math.min(options?.limit ?? 2000, 2000);
      if (!Number.isInteger(limit) || limit < 0) throw new Error('invalid_limit');
      const entries: { name: string; kind: FileKind }[] = [];
      let truncated = false;
      let scanned = 0;
      const dir = await opendir(absolute);
      try { for await (const e of dir) {
        if (scanned++ === limit) { truncated = true; break; }
        try { await guard({ kind: 'absolute', path: resolve(absolute, e.name) }); } catch { continue; }
        if (entries.length === limit) { truncated = true; break; }
        entries.push({ name: e.name, kind: e.isSymbolicLink() ? 'link' : e.isDirectory() ? 'directory' : 'file' });
      } } finally { await dir.close().catch(() => {}); }
      return { entries, truncated };
    },
  };
};
