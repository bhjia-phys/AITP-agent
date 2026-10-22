import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, CircleStop, FileText, MessageSquare, Plus, X } from 'lucide-react';
import { Envelope, EVENTS, Mode } from '@aitp/protocol';
import type { ActiveTask, Card, ContextManifest, Delivery, EventType, ResearchLocation, SessionMeta, TranscriptEntryView } from '@aitp/protocol';
import { api, requestId } from './api.ts';

const Markdown = lazy(() => import('./Markdown.tsx'));
export function AgentDock({ location, open, close, onLogin, suppliedDraft }: { location: ResearchLocation; open(path: string): void; close(): void; onLogin(type: string, value: unknown): void; suppliedDraft?: string }) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]), [selected, setSelected] = useState<SessionMeta>();
  const [mode, setMode] = useState<Mode>('status'), [draft, setDraft] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('follow-up'), [purpose, setPurpose] = useState<'task' | 'interjection'>('task');
  const [entries, setEntries] = useState<TranscriptEntryView[]>([]), [live, setLive] = useState('');
  const [cards, setCards] = useState<Card[]>([]), [manifest, setManifest] = useState<ContextManifest>(), [task, setTask] = useState<ActiveTask>();
  const [state, setState] = useState('idle'), [tab, setTab] = useState('conversation'), [error, setError] = useState(''), [sending, setSending] = useState(false), [connected, setConnected] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const chooseSession = (meta: SessionMeta | undefined) => {
    setSelected(meta); if (meta) setMode(meta.mode);
    try { if (meta) localStorage.setItem(`aitp-session:${location.id}`, meta.id); else localStorage.removeItem(`aitp-session:${location.id}`); } catch {}
  };
  useEffect(() => { let active = true; setSelected(undefined); setEntries([]); setCards([]); setManifest(undefined); setTask(undefined); setLive(''); setState('idle'); setError('');
    void api('sessions', { query: { location: location.id } }).then(list => {
      if (!active) return;
      setSessions(list);
      let saved: string | null = null; try { saved = localStorage.getItem(`aitp-session:${location.id}`); } catch {}
      const meta = list.find(session => session.id === saved);
      setSelected(meta); if (meta) setMode(meta.mode);
    }).catch(e => { if (active) setError(String(e.message)); });
    return () => { active = false; };
  }, [location.id]);
  useEffect(() => { if (suppliedDraft) setDraft(suppliedDraft); }, [suppliedDraft]);
  useEffect(() => {
    let stopped = false, retry: ReturnType<typeof setTimeout>, ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(locationUrl()); let epoch = '', sequence = -1;
      ws.onopen = () => { setConnected(true); ws.send(JSON.stringify({ type: 'subscribe', topics: [...(selected ? [`session:${selected.id}`] : []), 'login', 'server'] })); };
      ws.onclose = () => { setConnected(false); if (!stopped) retry = setTimeout(connect, 1200); };
      ws.onerror = () => { setError('Connection interrupted. Reconnecting…'); };
      ws.onmessage = event => {
        try {
          const envelope = Envelope.parse(JSON.parse(event.data));
          const type = envelope.type as EventType; const schema = EVENTS[type]; if (!schema) return;
          const value = schema.parse(envelope.payload);
          if (envelope.epoch !== epoch) { epoch = envelope.epoch; sequence = -1; setEntries([]); setLive(''); setCards([]); setManifest(undefined); setTask(undefined); }
          if (envelope.seq <= sequence) return; sequence = envelope.seq;
          if (type === 'session.snapshot') { const v = EVENTS['session.snapshot'].parse(value); setEntries(v.entries); setLive(v.live?.text ?? ''); setCards(v.cards); setManifest(v.manifest); setTask(v.activeTask); setState(v.state); }
          else if (type === 'session.entry') { const v = EVENTS['session.entry'].parse(value); setEntries(old => old.some(e => e.id === v.entry.id && e.ordinal === v.entry.ordinal) ? old : [...old, v.entry]); if (v.entry.kind === 'assistant') setLive(''); }
          else if (type === 'session.partial') setLive(old => old + (EVENTS['session.partial'].parse(value).delta.text ?? ''));
          else if (type === 'session.state') { const v = EVENTS['session.state'].parse(value); setState(v.state); if (v.state !== 'busy') setLive(''); }
          else if (type === 'session.card') { const v = EVENTS['session.card'].parse(value).card; setCards(old => [...old.filter(c => c.id !== v.id), v]); }
          else if (type === 'session.manifest') setManifest(EVENTS['session.manifest'].parse(value).manifest);
          else if (type === 'session.active-task') setTask(EVENTS['session.active-task'].parse(value).task);
          else if (type === 'session.error') setError(EVENTS['session.error'].parse(value).message);
          else if (type.startsWith('login.')) onLogin(type, value);
        } catch { setError('An invalid server event was ignored.'); }
      };
    };
    connect(); return () => { stopped = true; clearTimeout(retry); ws?.close(); };
  }, [selected?.id]);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }); }, [entries.length, live]);
  const send = async (continued = false) => {
    if (sending || !continued && !draft.trim()) return;
    setSending(true); setError('');
    try {
      let meta = selected;
      if (!meta) { meta = await api('createSession', { body: { location: location.id, kind: 'research', mode, requestId: requestId() } }); chooseSession(meta); setSessions(old => [...old, meta!]); }
      if (continued) await api('continueTask', { params: { id: meta.id }, body: { delivery, requestId: requestId() } });
      else {
        const receipt = await api('submit', { params: { id: meta.id }, body: { purpose: mode === 'status' && task ? 'interjection' : purpose, delivery, content: [{ type: 'text', text: draft }], requestId: requestId() } });
        if (receipt.status === 'rejected' || receipt.status === 'aborted') throw new Error(receipt.reason ?? `Input ${receipt.status}`);
        setDraft('');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send the request'); }
    finally { setSending(false); }
  };
  const respond = async (card: Card, response: unknown) => {
    if (!selected) return;
    try { await api('respondToCard', { params: { id: selected.id, card: card.id }, body: { response, requestId: requestId() } }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not answer the card'); }
  };
  return <aside className="agent-dock" aria-label="Research agent">
    <header className="dock-title"><span><MessageSquare size={16} /> Research agent</span><button className="icon-button" aria-label="Close agent" onClick={close}><X size={17} /></button></header>
    <div className="dock-location"><span className={'connection-dot ' + (connected ? 'online' : '')} />{location.title}<small>Read-only workspace</small></div>
    <div className="session-picker"><select aria-label="Session" value={selected?.id ?? ''} onChange={event => chooseSession(sessions.find(s => s.id === event.target.value))}><option value="">New session</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select><button className="icon-button" aria-label="New session" onClick={() => { chooseSession(undefined); setEntries([]); setCards([]); setManifest(undefined); setTask(undefined); setLive(''); setState('idle'); }}><Plus size={16} /></button></div>
    <nav className="dock-tabs"><button className={tab === 'conversation' ? 'selected' : ''} onClick={() => setTab('conversation')}>Conversation</button><button className={tab === 'context' ? 'selected' : ''} onClick={() => setTab('context')}>Context {manifest ? <small>{manifest.items.length}</small> : null}</button></nav>
    {tab === 'context' ? <div className="dock-scroll context-list"><p className="muted">Sources prepared for this session, with their delivery status.</p>{manifest ? <>
      <div className="budget"><strong>{Math.round((manifest.budget.instructions + manifest.budget.tools + manifest.budget.history + manifest.budget.data + manifest.budget.reserve) / manifest.budget.limit * 100)}%</strong> of request budget · estimated</div>
      {manifest.items.map(item => <article key={item.id}><span className="eyebrow">{item.channel} · {item.status}</span><button className="source-link" onClick={() => { if (item.ref.address.kind === 'workspace') open(item.ref.address.path); }}>{item.ref.address.kind === 'workspace' || item.ref.address.kind === 'absolute' ? item.ref.address.path : item.role}</button><p>{item.reason}</p>{item.ref.version && <code>{item.ref.version.observedAt}</code>}</article>)}
      {manifest.omitted.length > 0 && <details><summary>Omitted sources ({manifest.omitted.length})</summary>{manifest.omitted.map((item, i) => <p key={i}>{item.reason}</p>)}</details>}
    </> : <div className="empty-small"><FileText size={24} /><p>Send a request to inspect its context.</p></div>}</div> : <div className="dock-scroll" ref={transcript} aria-live="polite">
      {!selected && <div className="agent-welcome"><span className="agent-mark">a</span><h3>Work from the evidence.</h3><p>Ask where this topic stands, inspect an argument, or resume its current thread.</p><button className="suggestion" onClick={() => setDraft('Where does this topic stand? Cite the owning notes and distinguish open questions from established results.')}>Where does this topic stand? ↗</button></div>}
      <Suspense fallback={<p className="muted">Rendering…</p>}>{entries.filter(e => ['user', 'assistant', 'summary', 'notice', 'tool-call', 'tool-result'].includes(e.kind)).map(entry => <article className={'message ' + entry.kind} key={`${entry.id}:${entry.ordinal}`}>
        <div className="message-role">{entry.kind === 'user' ? 'You' : entry.kind === 'assistant' ? 'AITP' : entry.tool?.name ?? entry.kind}</div>
        <Markdown text={entry.content.flatMap(b => b.type === 'text' ? [b.text] : []).join('\n')} path={location.id} open={open} />
        {entry.usage && <small className="message-usage">Provider tokens · {entry.usage.input.toLocaleString()} input · {entry.usage.output.toLocaleString()} output · {entry.usage.cacheRead.toLocaleString()} cached</small>}
      </article>)}{live && <article className="message assistant"><div className="message-role">AITP <span className="pulse">●</span></div><Markdown text={live} path={location.id} open={open} /></article>}</Suspense>
      {cards.map(card => <article className="interaction-card" key={card.id}><span className="eyebrow">{card.type} · {card.status}</span>{card.type === 'choice' ? <><h4>{card.payload.question}</h4>{card.payload.options.map(option => <button disabled={card.status !== 'open'} key={option.id} onClick={() => void respond(card, { type: 'choice', option: option.id })}><strong>{option.label}</strong><small>{option.consequence}</small></button>)}</> : card.type === 'close' ? <><p>{card.payload.supported}</p><small>{card.payload.next}</small></> : <p>{card.kind === 'required' ? 'This decision requires a capability beyond the read-only milestone.' : 'Recorded in the session log.'}</p>}{card.status === 'answered' && <Check size={14} />}</article>)}
    </div>}
    {error && <div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={13} /></button></div>}
    <div className="composer"><label className="mode-label"><select aria-label="Research mode" value={mode} disabled={!!selected} onChange={e => setMode(Mode.parse(e.target.value))}>{Mode.options.map(m => <option key={m} value={m}>{m[0]!.toUpperCase() + m.slice(1)}</option>)}</select><ChevronDown size={12} /><span>{state === 'busy' ? 'Working…' : state === 'waiting-researcher' ? 'Waiting for your decision' : 'Ready'}</span></label>
      <div className="input-options">
        {task && mode !== 'status' && <select aria-label="Message purpose" value={purpose} onChange={e => setPurpose(e.target.value as 'task' | 'interjection')}><option value="task">New task</option><option value="interjection">Question · keep current task</option></select>}
        {state === 'busy' && <select aria-label="Delivery while busy" value={delivery} onChange={e => setDelivery(e.target.value as Delivery)}><option value="follow-up">Queue after this turn</option><option value="steer">Steer this turn</option><option value="reject">Send only if idle</option></select>}
      </div>
      <textarea aria-label="Message to research agent" placeholder="Ask about this topic…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }} />
      <div className="composer-actions"><small>Ctrl ↵ to send{state === 'busy' ? delivery === 'steer' ? ' · steer this turn' : delivery === 'follow-up' ? ' · queued' : ' · only if idle' : ''}</small><div>{task && <button className="quiet" disabled={sending} onClick={() => void send(true)}>Continue</button>}{state === 'busy' && selected && <button className="icon-button" aria-label="Stop agent" onClick={() => void api('abortSession', { params: { id: selected.id }, body: { requestId: requestId() } }).catch(e => setError(e.message))}><CircleStop size={20} /></button>}<button className="send-button" aria-label="Send message" disabled={sending || !draft.trim()} onClick={() => void send()}><ArrowUp size={18} /></button></div></div>
    </div>
  </aside>;
}
function locationUrl() { return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`; }
