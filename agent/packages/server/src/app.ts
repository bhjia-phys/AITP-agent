import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { chmod, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CardResponse, ClientMessage, Config, EVENTS, ErrorBody, HTTP_STATUS, InputSubmission,
  JSON_LIMITS, LoginResponse, ROUTES, SessionMeta, ThreadState, canonicalJson, checkJsonLimits,
} from '@aitp/protocol';
import type { ErrorCode, EventType, JsonValue, LoginChallenge, LoginResult, RouteName, RouteSpec } from '@aitp/protocol';
import type { Watch } from '@aitp/runtime/contracts';
import type { CreateHttpServer } from './contracts.ts';

function fail(code: ErrorCode, message: string): never { throw Object.assign(new Error(message), { code }); }
const fileAddress = (path: string) => ({ kind: path.startsWith('/') ? 'absolute' as const : 'workspace' as const, path });
const safeEqual = (a: string, b: string) => { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export const createHttpServer: CreateHttpServer = (services, options) => {
  const started = Date.now();
  let port = options.port;
  let token = '';
  let listening = false;
  let refreshLine: Promise<void> = Promise.resolve();
  const sockets = new Set<WebSocket>();
  const loginEvents = new Map<string, Map<string, LoginChallenge> | LoginResult>();
  const publishLogin = new Set<(type: 'login.challenge' | 'login.result', value: LoginChallenge | LoginResult) => void>();
  const loginRequests = new Map<string, { fingerprint: string; login: string }>();
  const sameOrigin = (req: IncomingMessage) => {
    const host = req.headers.host;
    return host === `127.0.0.1:${port}` && (!req.headers.origin || req.headers.origin === `http://${host}`) && req.headers['sec-fetch-site'] !== 'cross-site';
  };
  const authorized = (req: IncomingMessage) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ') && safeEqual(header.slice(7), token)) return true;
    const cookies = (req.headers.cookie ?? '').split(';').map(c => c.trim());
    return cookies.some(c => c.startsWith('aitp_session=') && safeEqual(c.slice('aitp_session='.length), token));
  };
  const refresh = async () => {
    const next = refreshLine.then(() => services.core.workspace.refresh());
    refreshLine = next.catch(() => {});
    return next;
  };
  const session = async (id: string) => (await services.sessions.get(id)) ?? fail('not_found', 'Session not found');
  const note = async (path: string) => {
    const source = await services.core.fs.readText(fileAddress(path));
    return { ...source, format: path.endsWith('.md') ? 'markdown' : path.endsWith('.tex') ? 'tex' : 'text' };
  };
  const jsonBody = async (req: IncomingMessage): Promise<unknown> => {
    const chunks: Buffer[] = []; let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > JSON_LIMITS.maxBytes) fail('invalid', 'Request body is too large');
      chunks.push(Buffer.from(chunk));
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { fail('invalid', 'Invalid JSON'); }
    const problem = checkJsonLimits(value);
    if (problem) fail('invalid', problem);
    return value;
  };
  const json = (res: ServerResponse, value: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  const routeRows = Object.entries(ROUTES).map(([name, spec]) => {
    const keys: string[] = [];
    const pattern = spec.path.split('/').map(part => part.startsWith(':') ? (keys.push(part.slice(1)), '([^/]+)') : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/');
    return { name: name as RouteName, spec: spec as RouteSpec, keys, pattern: new RegExp(`^${pattern}$`) };
  });
  const handler = async (name: RouteName, p: Record<string, string>, q: Record<string, unknown>, b: Record<string, unknown>): Promise<unknown> => {
    const core = services.core;
    switch (name) {
      case 'health': return { ok: true, version: options.version, faux: options.faux, uptimeSec: (Date.now() - started) / 1000 };
      case 'getConfig': return core.config;
      case 'locations': await refresh(); return core.workspace.locations();
      case 'graph': return core.workspace.graph();
      case 'groupings': return core.workspace.groupings();
      case 'outline': await refresh(); return core.workspace.outline(String(q.path));
      case 'instructions': return core.workspace.instructions({ location: String(q.path) });
      case 'board': return core.workspace.board({ state: q.state === undefined ? undefined : ThreadState.parse(q.state), grouping: q.grouping as string | undefined, owner: q.owner as string | undefined });
      case 'search':
        if (!(await core.index.status()).builtAt) await core.index.rebuild();
        return core.index.search(String(q.q), { scope: q.scope as 'notes' | 'knowledge' | 'all' | undefined, limit: q.limit as number | undefined });
      case 'whereUsed': return { uses: await core.workspace.whereUsed(String(q.path), q.anchor as string | undefined) };
      case 'fileList': {
        const listing = await core.fs.list(fileAddress(String(q.path)));
        if (listing.truncated && q.force !== '1') fail('invalid', 'Directory exceeds the bounded listing limit');
        return listing;
      }
      case 'note': return note(String(q.path));
      case 'sessions': return services.sessions.list({ location: q.location as string | undefined, kind: q.kind as SessionMeta['kind'] | undefined, archived: q.archived === undefined ? undefined : q.archived === '1' });
      case 'createSession': {
        if (!(await core.workspace.locations()).some(l => l.id === b.location)) fail('not_found', 'Research location not found');
        if (b.kind === 'worker' || b.kind === 'review') fail('denied', 'Worker and review sessions are created by their owning services');
        return services.sessions.create(b as Parameters<typeof services.sessions.create>[0]);
      }
      case 'session': {
        const current = await session(p.id!); const manifest = await services.context.manifest(p.id!);
        return { ...current, ...(manifest ? { manifest } : {}), changedSinceSeen: [] };
      }
      case 'updateSession': return services.sessions.update(p.id!, b as Parameters<typeof services.sessions.update>[1]);
      case 'submit': await session(p.id!); await refresh(); return services.sessions.submit(p.id!, InputSubmission.parse(b));
      case 'continueTask': await session(p.id!); await refresh(); return services.sessions.continue(p.id!, b.delivery as 'steer' | 'follow-up' | 'reject', String(b.requestId));
      case 'abortSession': await services.sessions.abort(p.id!); return { ok: true };
      case 'compact': return services.sessions.compact(p.id!, b as { requestId: string; instructions?: string });
      case 'contextAt': {
        const current = await session(p.id!);
        const match = q.at === undefined ? undefined : /^(\d+)(?::(\d+))?$/.exec(String(q.at));
        if (q.at !== undefined && !match) fail('invalid', 'Context cursor must be entry[:ordinal]');
        const at = match ? { conversation: current.session.conversation, entry: match[1]!, ordinal: match[2] ? Number(match[2]) : Number.MAX_SAFE_INTEGER } : undefined;
        const context = await services.port.contextAt(current.session.conversation, at);
        const manifest = at ? undefined : await services.context.manifest(p.id!);
        return { ...context, ...(manifest ? { manifest } : {}) };
      }
      case 'respondToCard': {
        const card = (await services.cards.list(p.id!)).find(c => c.id === p.card);
        if (!card) fail('not_found', 'Card not found in this session');
        // Authority-bearing responses must pass through their domain services, introduced in S4/S5.
        if (!['choice', 'exercise'].includes(card.type)) fail('unavailable', 'This card requires a domain service that is not available yet');
        return { card: await services.cards.respond(p.card!, CardResponse.parse(b.response), String(b.requestId)) };
      }
      case 'models': return { catalog: await services.port.models().catalog(), roles: core.config.models };
      case 'reviews': return services.reviews.list(q.session as string | undefined);
      case 'login': {
        const key = String(b.requestId), fingerprint = canonicalJson(b as JsonValue); const prior = loginRequests.get(key);
        if (prior) { if (prior.fingerprint !== fingerprint) fail('request_reused', 'Request id was reused'); return { login: prior.login }; }
        const flow = await services.port.models().startLogin(String(b.provider), b.method as 'oauth' | 'api-key' | 'device', challenge => {
          const prior = loginEvents.get(challenge.login);
          const events = prior instanceof Map ? prior : new Map<string, LoginChallenge>();
          events.set(challenge.kind, challenge); loginEvents.set(challenge.login, events);
          for (const publish of publishLogin) publish('login.challenge', challenge);
        });
        loginRequests.set(key, { fingerprint, login: flow.login });
        void flow.done.then(value => {
          loginEvents.set(value.login, value);
          // Retain a bounded recent result history; pending flows must remain replayable.
          const finished = [...loginEvents].filter(([, value]) => !(value instanceof Map));
          for (const [id] of finished.slice(0, -16)) loginEvents.delete(id);
          for (const publish of publishLogin) publish('login.result', value);
        });
        return { login: flow.login };
      }
      case 'loginRespond': {
        const response = LoginResponse.parse(b); if (response.login !== p.id) fail('invalid', 'Login id mismatch');
        await services.port.models().respond(response); return { ok: true };
      }
      case 'loginCancel': await services.port.models().cancelLogin(p.id!); return { ok: true };
      case 'logout': await services.port.models().logout(String(b.provider)); return { ok: true };
      case 'inbox': {
        const items = [];
        for (const meta of await services.sessions.list()) for (const card of await services.cards.list(meta.id, { open: true })) if (card.kind === 'required') items.push({ id: card.id, kind: 'decision', title: card.type === 'choice' ? card.payload.question : card.type,
          source: { kind: 'note', address: { kind: 'workspace', path: meta.location } }, createdAt: card.createdAt, card: card.id });
        return items;
      }
      case 'tasks': {
        const watch = await services.port.watchTasks();
        try { for await (const frame of watch) if (frame.kind === 'snapshot') return frame.tasks; } finally { watch.close(); }
        return [];
      }
      case 'doctor': return { at: new Date().toISOString(), checks: [
        { name: 'workspace', ok: true, detail: core.config.workspace.root },
        { name: 'execution', ok: options.profile === 'read-only', detail: options.profile === 'read-only' ? 'Read-only profile; command execution is unavailable.' : 'Full execution services are still being implemented.' },
        { name: 'model', ok: (await services.port.models().catalog()).some(m => ['signed-in', 'api-key', 'not-required'].includes(m.authState) && m.modelId === core.config.models.main.modelId), detail: 'Configured model authentication' },
      ] };
      default: fail('unavailable', `Capability ${name} is not implemented in this milestone`);
    }
  };
  const server = createServer(async (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (!sameOrigin(req)) fail('denied', 'Host or Origin is not allowed');
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail('not_found', 'Not found');
        if (!options.staticDir) fail('unavailable', 'Build the workbench before opening it');
        const root = await realpath(options.staticDir);
        const requested = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (requested !== root && !requested.startsWith(root + sep)) fail('forbidden_path', 'Outside static root');
        let path: string;
        try { path = await realpath(requested === root ? join(root, 'index.html') : requested); }
        catch { if (extname(requested)) fail('not_found', 'Asset not found'); path = await realpath(join(root, 'index.html')); }
        if (!path.startsWith(root + sep)) fail('forbidden_path', 'Outside static root');
        const bytes = await readFile(path);
        res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : bytes); return;
      }
      const found = routeRows.find(r => r.spec.method === req.method && r.pattern.test(url.pathname));
      if (!found) fail('not_found', 'API route not found');
      if (found.spec.auth && !authorized(req)) fail('unauthorized', 'Authentication required');
      const match = found.pattern.exec(url.pathname)!;
      const params = Object.fromEntries(found.keys.map((key, index) => [key, decodeURIComponent(match[index + 1]!)]));
      const query = Object.fromEntries(url.searchParams);
      const parse = (schema: RouteSpec['query'], value: unknown): Record<string, unknown> => {
        if (!schema) return value as Record<string, unknown>;
        const parsed = schema.safeParse(value); if (!parsed.success) fail('invalid', 'Request does not match its schema');
        return parsed.data as Record<string, unknown>;
      };
      parse(found.spec.params, params);
      const q = parse(found.spec.query, query);
      const b = found.spec.body && found.spec.body !== 'multipart' ? parse(found.spec.body, await jsonBody(req)) : {};
      if (found.name === 'authExchange') {
        if (!safeEqual(String(b.token), token)) fail('unauthorized', 'Invalid token');
        res.setHeader('Set-Cookie', `aitp_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
        json(res, { ok: true }); return;
      }
      if (found.name === 'fileRaw') {
        const result = await services.core.fs.readBytes(fileAddress(String(q.path)), { maxBytes: 32 * 1024 * 1024 });
        // Research HTML/SVG must never acquire the authenticated workbench origin.
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const range = req.headers.range;
        if (range) {
          const m = /^bytes=(\d+)-(\d*)$/.exec(range);
          const start = m ? Number(m[1]) : -1, end = m?.[2] ? Math.min(Number(m[2]), result.size - 1) : result.size - 1;
          if (start < 0 || start >= result.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${result.size}` }); res.end(); return; }
          res.writeHead(206, { 'Content-Type': result.mime, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${result.size}`, 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
          res.end(result.bytes.subarray(start, end + 1)); return;
        }
        res.writeHead(200, { 'Content-Type': result.mime, 'Accept-Ranges': 'bytes', 'Content-Length': result.size, 'Cache-Control': 'no-store' }); res.end(result.bytes); return;
      }
      if (found.name === 'exportLog') {
        await session(params.id!); res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
        for await (const line of services.sessions.export(params.id!)) { if (res.destroyed) break; res.write(line); }
        res.end(); return;
      }
      const value = await handler(found.name, params, q, b);
      if (typeof found.spec.response === 'string') fail('unavailable', 'Binary capability is unavailable');
      const parsed = found.spec.response.safeParse(value);
      if (!parsed.success) fail('internal', 'Service returned an invalid response');
      json(res, parsed.data);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const candidate = (error as { code?: string }).code;
      const code: ErrorCode = candidate && Object.hasOwn(HTTP_STATUS, candidate) ? candidate as ErrorCode : candidate === 'ENOENT' ? 'not_found' : candidate === 'not_implemented' ? 'unavailable' : 'internal';
      const message = code === 'internal' ? 'The request failed.' : code === 'unavailable' ? 'This capability is unavailable in the current milestone.' : error instanceof Error ? error.message : 'Request failed';
      json(res, ErrorBody.parse({ error: { code, message } }), HTTP_STATUS[code]);
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/api/ws' || !sameOrigin(req) || !authorized(req)) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', (ws: WebSocket) => {
    sockets.add(ws);
    const epoch = randomUUID(); let seq = 0; let closed = false;
    const subscriptions = new Map<string, { close(): void }>();
    const send = (type: EventType, payload: unknown) => {
      if (closed || ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) { ws.close(1013, 'Reconnect for fresh snapshots'); return; }
      const parsed = EVENTS[type].safeParse(payload);
      if (!parsed.success) { ws.close(1011, 'Invalid event'); return; }
      ws.send(JSON.stringify({ epoch, seq: seq++, at: new Date().toISOString(), type, payload: parsed.data }));
    };
    const subscribe = async (topic: string) => {
      if (subscriptions.has(topic) || closed) return;
      let active = true; let watch: Watch<unknown> | undefined;
      const subscription = { close() { active = false; watch?.close(); } };
      subscriptions.set(topic, subscription);
      try {
        if (topic.startsWith('session:')) {
          const id = topic.slice(8), current = await session(id);
          const stream = await services.port.watchConversation(current.session.conversation); watch = stream;
          if (!active) { watch.close(); return; }
          let live = '';
          for await (const frame of stream) {
            if (!active || closed) break;
            if (frame.kind === 'closed') break;
            if (frame.kind === 'snapshot') {
              const state = await session(id), cards = await services.cards.list(id), manifest = await services.context.manifest(id);
              live = frame.live?.text ?? '';
              send('session.snapshot', { ...state, entries: frame.entries, cards, ...(manifest ? { manifest } : {}), state: cards.some(c => c.kind === 'required' && c.status === 'open') && frame.state === 'idle' ? 'waiting-researcher' : frame.state, compacting: frame.compacting, ...(frame.live ? { live: frame.live } : {}) });
            } else if (frame.kind === 'entry') {
              live = ''; send('session.entry', { session: id, entry: frame.entry });
              for (const card of await services.cards.list(id)) send('session.card', { card });
              const state = await services.sessions.get(id); if (state?.activeTask) send('session.active-task', { task: state.activeTask });
              const manifest = await services.context.manifest(id); if (manifest) send('session.manifest', { manifest });
            } else if (frame.kind === 'partial') {
              const text = frame.text ?? live;
              if (!text.startsWith(live)) {
                // Replacement partials require a new snapshot; the next committed entry remains authoritative.
                live = ''; send('session.partial', { session: id, delta: { text } });
              } else send('session.partial', { session: id, delta: { text: text.slice(live.length) } });
              live = text;
            } else if (frame.kind === 'tool') send('session.tool', { session: id, ...frame });
            else if (frame.kind === 'state') {
              live = '';
              const waiting = frame.state === 'idle' && (await services.cards.list(id, { open: true })).some(card => card.kind === 'required');
              send('session.state', { session: id, state: waiting ? 'waiting-researcher' : frame.state, compacting: frame.compacting });
            }
            else if (frame.kind === 'problem') send('session.error', { session: id, code: 'unavailable', message: frame.reason });
          }
        } else if (topic === 'tasks') {
          const stream = await services.port.watchTasks(); watch = stream;
          if (!active) { watch.close(); return; }
          for await (const frame of stream) { if (!active || closed) break; if (frame.kind === 'snapshot') send('tasks.snapshot', { tasks: frame.tasks }); else if (frame.kind === 'changed') send('tasks.changed', { task: frame.task }); }
        } else if (topic === 'login') {
          const publish = (type: 'login.challenge' | 'login.result', value: LoginChallenge | LoginResult) => send(type, type === 'login.challenge' ? { challenge: value } : value);
          publishLogin.add(publish); subscription.close = () => { active = false; publishLogin.delete(publish); };
          for (const value of loginEvents.values()) {
            if (value instanceof Map) for (const challenge of value.values()) publish('login.challenge', challenge);
            else publish('login.result', value);
          }
        } else if (topic === 'board') send('board.changed', { locations: [] });
        else if (topic === 'inbox') send('inbox.changed', { keys: [] });
        else if (topic === 'server') send('server.notice', { level: 'info', message: `${options.profile ?? 'full'} profile${options.faux ? ' · simulated model' : ''}` });
      } catch { if (active && !closed) send('server.notice', { level: 'error', message: `Subscription ${topic} is unavailable` }); }
    };
    let messages: Promise<void> = Promise.resolve();
    ws.on('message', bytes => {
      messages = messages.then(async () => {
        let raw: unknown; try { raw = JSON.parse(bytes.toString()); } catch { ws.close(1008, 'Invalid message'); return; }
        if (checkJsonLimits(raw)) { ws.close(1008, 'Invalid message'); return; }
        const parsed = ClientMessage.safeParse(raw); if (!parsed.success) { ws.close(1008, 'Invalid subscription'); return; }
        if (parsed.data.type === 'unsubscribe') { for (const topic of parsed.data.topics) { subscriptions.get(topic)?.close(); subscriptions.delete(topic); } return; }
        send('reset', { topics: parsed.data.topics, reason: 'Fresh snapshots for this connection' });
        for (const topic of parsed.data.topics) void subscribe(topic);
      }).catch(() => { ws.close(1011, 'Subscription failed'); });
    });
    ws.on('error', () => {});
    ws.on('close', () => { closed = true; sockets.delete(ws); for (const subscription of subscriptions.values()) subscription.close(); subscriptions.clear(); });
  });
  return {
    async listen() {
      if (listening) throw new Error('Server already listening');
      await mkdir(options.dataDir, { recursive: true });
      const secretPath = join(options.dataDir, 'server.json');
      try { const saved = JSON.parse(await readFile(secretPath, 'utf8')); if (typeof saved.token === 'string' && /^[0-9a-f]{64}$/.test(saved.token)) token = saved.token; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!token) { token = randomBytes(32).toString('hex'); await writeFile(secretPath, JSON.stringify({ token }), { flag: 'wx', mode: 0o600 }); }
      await chmod(secretPath, 0o600);
      await new Promise<void>((resolveListen, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port }, () => { server.off('error', reject); resolveListen(); }); });
      const address = server.address(); if (!address || typeof address === 'string') throw new Error('No listening address');
      port = address.port; listening = true;
      return { port, url: `http://127.0.0.1:${port}/#token=${token}` };
    },
    async close() {
      for (const ws of sockets) ws.terminate();
      await new Promise<void>(resolveClose => wss.close(() => resolveClose()));
      if (listening) await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
      server.closeAllConnections(); listening = false;
    },
  };
};
