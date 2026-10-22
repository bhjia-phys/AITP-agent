import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { afterEach, expect, it } from 'vitest';
import { createFixtureWorkspace } from '@aitp/test-support';
import { Envelope, EVENTS, ROUTES } from '@aitp/protocol';
import { startAgent } from '../src/compose.ts';
import type { RunningAgent } from '../src/compose.ts';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function fixture() {
  const f = await createFixtureWorkspace(); cleanups.push(f.cleanup);
  f.config.server.port = 0;
  f.config.workspace.writeMode = 'off';
  await mkdir(f.dataDir, { recursive: true });
  const configPath = join(f.dataDir, 'app-config.json');
  await writeFile(configPath, JSON.stringify(f.config));
  const env = { ...process.env, AITP_AGENT_CONFIG: configPath, AITP_AGENT_HOME: f.dataDir };
  let running: RunningAgent | undefined = await startAgent({ env, profile: 'read-only', faux: true, version: 'test' });
  cleanups.push(async () => { await running?.stop(); });
  const url = new URL(running.url), token = new URLSearchParams(url.hash.slice(1)).get('token')!, base = url.origin;
  const request = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { ...f, running, env, base, token, request, async restart() { await running!.stop(); running = await startAgent({ env, profile: 'read-only', faux: true, version: 'test' }); return running; } };
}

it('enforces local Host, Origin and authentication, including WebSocket upgrades', async () => {
  const f = await fixture();
  expect((await fetch(f.base + '/api/health')).status).toBe(200);
  expect((await fetch(f.base + '/api/locations')).status).toBe(401);
  expect((await f.request('/api/locations', 'GET', undefined, { Origin: 'https://example.invalid' })).status).toBe(403);
  const wrongHost = await new Promise<number | undefined>((resolve, reject) => {
    const req = httpRequest(f.base + '/api/locations', { headers: { Host: 'example.invalid', Authorization: `Bearer ${f.token}` } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end();
  });
  expect(wrongHost).toBe(403);
  expect((await f.request('/api/locations', 'GET', undefined, { Authorization: 'Bearer wrong' })).status).toBe(401);
  expect((await f.request('/api/auth/exchange', 'POST', { token: '界'.repeat(64) })).status).toBe(401);
  const bad = new WebSocket(f.base.replace('http:', 'ws:') + '/api/ws');
  await new Promise<void>(resolve => { bad.once('unexpected-response', (_req, res) => { expect(res.statusCode).toBe(401); bad.terminate(); resolve(); }); bad.on('error', () => {}); });
  const exchange = await fetch(f.base + '/api/auth/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: f.token }) });
  expect(exchange.status).toBe(200); expect(exchange.headers.get('set-cookie')).toContain('HttpOnly');
  expect(exchange.headers.get('set-cookie')).toContain('SameSite=Strict');
});

it('connects the real core and runtime, preserves research files, and resumes the same read-only store', async () => {
  const f = await fixture();
  const path = 'topics/spectra/selfconsistent/stability/research.md';
  const before = await readFile(join(f.root, path), 'utf8');
  for (const [name, url] of [['locations', '/api/locations'], ['graph', '/api/graph'], ['groupings', '/api/groupings'], ['board', '/api/board'], ['note', '/api/notes?path=' + encodeURIComponent(path)]] as const) {
    const response = await f.request(url); expect(response.status, name).toBe(200); ROUTES[name].response.parse(await response.json());
  }
  const created = await f.request('/api/sessions', 'POST', { location: path, kind: 'research', mode: 'status', requestId: 'server-create-session' });
  expect(created.status).toBe(200); const meta = ROUTES.createSession.response.parse(await created.json());
  const sent = await f.request(`/api/sessions/${meta.id}/messages`, 'POST', { purpose: 'task', delivery: 'follow-up', content: [{ type: 'text', text: 'Report the current state.' }], requestId: 'server-status-input' });
  expect(sent.status).toBe(200);
  await f.running.services.port.waitIdle(meta.conversation);
  const context = await f.request(`/api/sessions/${meta.id}/context`);
  const view = ROUTES.contextAt.response.parse(await context.json());
  expect(view.messages.some((m: { role: string }) => m.role === 'system')).toBe(true);
  expect(view.manifest?.items.some(i => i.role === 'location')).toBe(true);
  expect(await readFile(join(f.root, path), 'utf8')).toBe(before);
  const restarted = await f.restart();
  const stored = await restarted.services.sessions.get(meta.id);
  expect(stored?.activeTask?.request).toBe('Report the current state.');
  expect(await readFile(join(f.root, path), 'utf8')).toBe(before);
});

it('emits schema-valid snapshots with fresh epochs on reconnect', async () => {
  const f = await fixture();
  const meta = await f.running.services.sessions.create({ location: 'topics/dynamics/research.md', kind: 'research', mode: 'status', requestId: 'ws-create-session' });
  const snapshot = async () => {
    const ws = new WebSocket(f.base.replace('http:', 'ws:') + '/api/ws', { headers: { Authorization: `Bearer ${f.token}` } });
    cleanups.push(async () => { ws.terminate(); });
    await once(ws, 'open');
    const events: Envelope[] = [];
    const done = new Promise<Envelope>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('snapshot timeout')), 5000);
      ws.on('message', raw => {
        const envelope = Envelope.parse(JSON.parse(raw.toString()));
        EVENTS[envelope.type as keyof typeof EVENTS].parse(envelope.payload); events.push(envelope);
        if (envelope.type === 'session.snapshot') { clearTimeout(timer); resolve(envelope); }
      });
    });
    ws.send(JSON.stringify({ type: 'subscribe', topics: [`session:${meta.id}`] }));
    const result = await done;
    expect(events[0]?.type).toBe('reset'); expect(events.map(e => e.seq)).toEqual(events.map((_e, i) => i));
    ws.close(); return result;
  };
  expect((await snapshot()).epoch).not.toBe((await snapshot()).epoch);
});

it('keeps research HTML isolated from authenticated APIs and rejects hidden paths', async () => {
  const f = await fixture();
  await writeFile(join(f.root, 'topics/example.html'), '<script src="/api/files/raw?path=topics/script.js"></script>');
  const response = await f.request('/api/files/raw?path=topics/example.html');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-security-policy')).toContain('sandbox;');
  expect(response.headers.get('content-security-policy')).not.toContain('allow-scripts');
  expect(response.headers.get('content-security-policy')).not.toContain('allow-same-origin');
  expect((await f.request('/api/files/raw?path=' + encodeURIComponent(join(f.dataDir, 'server.json')))).status).toBe(403);
  expect((await f.request('/api/notes?path=../outside.md')).status).toBe(403);
});

it('queues one compaction review and preserves its actual export', async () => {
  const f = await fixture();
  const meta = await f.running.services.sessions.create({ location: 'topics/dynamics/research.md', kind: 'research', mode: 'status', requestId: 'review-create-session' });
  await f.running.services.sessions.submit(meta.id, { purpose: 'task', delivery: 'follow-up', content: [{ type: 'text', text: 'Read the retained state.' }], requestId: 'review-test-message' });
  await f.running.services.port.waitIdle(meta.conversation);
  const compact = await f.running.services.sessions.compact(meta.id, { requestId: 'review-force-compact' });
  for (let i = 0; i < 100; i++) {
    if ((await f.running.services.reviews.list(meta.id)).requests.length) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const queued = (await f.running.services.reviews.list(meta.id)).requests;
  expect(queued).toHaveLength(1); expect(queued[0]?.status).toBe('queued');
  await f.running.services.context.afterCompaction(meta.id, compact.task);
  expect((await f.running.services.reviews.list(meta.id)).requests).toHaveLength(1);
  const record = await f.running.services.port.read.get({ family: 'review', key: queued[0]!.id });
  const exported = await readFile(String(record!.export), 'utf8');
  expect(exported).toContain('aitp.workbench-log@1'); expect(exported).toContain('Read the retained state.');
});
