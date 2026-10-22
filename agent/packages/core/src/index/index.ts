import { mkdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DerivedIndex, CreateDerivedIndex } from '../contracts.ts';
import type { SearchHit } from '@aitp/protocol';
import { excludedLocation, createWorkspaceModel } from '../locations/index.ts';
import { linkTarget, parseNote, sourceRef } from '../notes/index.ts';

export const createDerivedIndex: CreateDerivedIndex = deps => {
  const { fs, config, dataDir, clock } = deps;
  const knowledge = config.workspace.knowledgeRoot ? posix.relative(config.workspace.root, config.workspace.knowledgeRoot) : undefined;
  const withDb = <T>(fn: (db: DatabaseSync) => T): T => {
    mkdirSync(dataDir, { recursive: true });
    const db = new DatabaseSync(join(dataDir, 'index.sqlite'));
    try {
      db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS cache(namespace TEXT, key TEXT, value TEXT, PRIMARY KEY(namespace,key));
        CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY, scope TEXT, hash TEXT, observed TEXT);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT);
        CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(path UNINDEXED, scope UNINDEXED, heading, text, start UNINDEXED, end UNINDEXED);`);
      return fn(db);
    } finally { db.close(); }
  };
  const index: DerivedIndex = {
    async rebuild() {
      const workspace = createWorkspaceModel({ ...deps, index });
      const queue = (await workspace.locations()).map(l => l.id);
      if (knowledge) queue.push(posix.join(knowledge, 'index.md'), posix.join(knowledge, 'README.md'));
      const topics = posix.relative(config.workspace.root, config.workspace.topicsRoot);
      const seen = new Set<string>();
      const queued = new Set(queue);
      // Paths alone stay in memory; process and release each source and its passages in turn.
      for (let i = 0; i < queue.length && i < 20000; i++) {
        const path = queue[i]!;
        if (seen.has(path)) continue;
        let file;
        try { file = await fs.readText({ kind: 'workspace', path }); } catch { continue; }
        seen.add(path);
        const scope = knowledge && path.startsWith(knowledge + '/') ? 'knowledge' : 'notes';
        const outline = parseNote(path, file.text, path.endsWith('.tex') ? 'tex' : 'markdown', file.version);
        for (const link of outline.links) {
          const target = linkTarget(path, link.target)?.path;
          if (target && (target.startsWith(topics + '/') || knowledge && target.startsWith(knowledge + '/')) && target.endsWith('.md') && !excludedLocation(target) && !target.split('/').some(s => ['workspace', 'runs', 'node_modules', 'templates'].includes(s)) && !queued.has(target)) { queue.push(target); queued.add(target); }
        }
        withDb(db => {
          db.exec('BEGIN');
          try {
            db.prepare('DELETE FROM passages WHERE path=?').run(path);
            db.prepare('INSERT OR REPLACE INTO documents VALUES(?,?,?,?)').run(path, scope, null, file.version.observedAt);
            const lines = file.text.split('\n');
            const boundaries = [{ line: 1, text: outline.title }, ...outline.headings.filter(h => h.line > 1)];
            const insert = db.prepare('INSERT INTO passages(path,scope,heading,text,start,end) VALUES(?,?,?,?,?,?)');
            for (let j = 0; j < boundaries.length; j++) { const h = boundaries[j]!; const end = (boundaries[j + 1]?.line ?? lines.length + 1) - 1; insert.run(path, scope, h.text, lines.slice(h.line - 1, end).join('\n'), h.line, end); }
            db.exec('COMMIT');
          } catch (e) { db.exec('ROLLBACK'); throw e; }
        });
      }
      withDb(db => {
        db.exec('BEGIN');
        try {
          for (const row of db.prepare('SELECT path FROM documents').all()) if (!seen.has(String(row.path))) { db.prepare('DELETE FROM documents WHERE path=?').run(row.path!); db.prepare('DELETE FROM passages WHERE path=?').run(row.path!); }
          db.prepare('INSERT OR REPLACE INTO metadata VALUES(?,?)').run('builtAt', clock.now().toISOString());
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
      });
    },
    async status() { return withDb(db => { const builtAt = db.prepare("SELECT value FROM metadata WHERE key='builtAt'").get()?.value; return { ...(builtAt ? { builtAt: String(builtAt) } : {}), documents: Number(db.prepare('SELECT count(*) AS n FROM documents').get()!.n) }; }); },
    async search(query, options) {
      const terms = query.match(/[\p{L}\p{N}_-]+/gu) ?? [];
      if (!terms.length) return [];
      const expression = terms.map(t => `"${t.replaceAll('"', '""')}"`).join(' AND ');
      const limit = Math.max(0, Math.floor(Math.min(200, options?.limit ?? 20)));
      return withDb(db => {
        const rows = db.prepare(`SELECT p.path,p.heading,p.start,p.end,snippet(passages,3,'','', ' … ',40) AS snippet,bm25(passages) AS score,d.observed FROM passages p JOIN documents d ON d.path=p.path WHERE passages MATCH ? AND (?='all' OR p.scope=?) ORDER BY score LIMIT ?`).all(expression, options?.scope ?? 'all', options?.scope ?? 'all', limit);
        return rows.map(row => ({ ref: { ...sourceRef(String(row.path), { observedAt: String(row.observed) }, { startLine: Number(row.start), endLine: Number(row.end) }), kind: knowledge && String(row.path).startsWith(knowledge + '/') ? 'knowledge' : 'note' }, heading: String(row.heading), snippet: String(row.snippet), score: Number(row.score) })) as SearchHit[];
      });
    },
    cache(namespace) { return {
      async get(key) { return withDb(db => { const row = db.prepare('SELECT value FROM cache WHERE namespace=? AND key=?').get(namespace, key); return row ? JSON.parse(String(row.value)) : undefined; }); },
      async put(key, value) { withDb(db => db.prepare('INSERT OR REPLACE INTO cache VALUES(?,?,?)').run(namespace, key, JSON.stringify(value))); },
      async clear() { withDb(db => db.prepare('DELETE FROM cache WHERE namespace=?').run(namespace)); },
    }; },
  };
  return index;
};
