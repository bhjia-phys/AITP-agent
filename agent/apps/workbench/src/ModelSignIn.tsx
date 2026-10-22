import { useEffect, useState } from 'react';
import type { LoginChallenge, LoginResult } from '@aitp/protocol';
import { api, requestId } from './api.ts';

export type LoginFlow = { login: string; provider: string; challenges: Partial<Record<LoginChallenge['kind'], LoginChallenge>>; result?: LoginResult };

export function ModelSignIn({ flows, started, error }: {
  flows: LoginFlow[];
  started(login: string, provider: string): void;
  error(message: string): void;
}) {
  const [provider, setProvider] = useState('openai');
  const [busy, setBusy] = useState(false), [credential, setCredential] = useState('');
  const flow = flows.filter(flow => flow.provider === provider).at(-1);
  const active = flow && !flow.result ? flow : undefined;
  const link = active?.challenges['auth-url'] ?? active?.challenges['device-code'];
  const prompt = active?.challenges.prompt, info = active?.challenges.info;
  useEffect(() => setCredential(''), [flow?.login, flow?.result]);
  const begin = async (method: 'oauth' | 'api-key') => {
    setBusy(true);
    try { const result = await api('login', { body: { provider, method, requestId: requestId() } }); started(result.login, provider); }
    catch (e) { error(e instanceof Error ? e.message : 'Could not start sign-in'); }
    finally { setBusy(false); }
  };
  const respond = async () => {
    if (prompt?.kind !== 'prompt' || !credential.trim()) return;
    setBusy(true);
    try {
      await api('loginRespond', { params: { id: prompt.login }, body: { login: prompt.login, prompt: prompt.prompt, value: credential, requestId: requestId() } });
      setCredential('');
    } catch (e) { error(e instanceof Error ? e.message : 'Could not submit sign-in input'); }
    finally { setBusy(false); }
  };
  const form = prompt?.kind === 'prompt' && <form onSubmit={e => { e.preventDefault(); void respond(); }}>
    <label>{prompt.label}<input autoComplete="off" type={prompt.secret ? 'password' : 'text'} value={credential} onChange={e => setCredential(e.target.value)} /></label>
    <button className="primary-button" type="submit" disabled={busy || !credential.trim()}>Submit</button>
  </form>;
  return <>
    <label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}>{['openai', 'anthropic', 'deepseek', 'moonshotai'].map(p => <option key={p} value={p}>{p === 'openai' ? 'OpenAI / ChatGPT' : p}</option>)}</select></label>
    <div className="settings-actions">
      {provider === 'openai' && <button className="primary-button" disabled={busy || !!active} onClick={() => void begin('oauth')}>Sign in with ChatGPT</button>}
      <button className="secondary-button" disabled={busy || !!active} onClick={() => void begin('api-key')}>Use API key</button>
      {active && <button className="quiet" disabled={busy} onClick={() => {
        setBusy(true);
        void api('loginCancel', { params: { id: active.login }, body: { requestId: requestId() } }).catch(e => error(e.message)).finally(() => setBusy(false));
      }}>Cancel sign-in</button>}
    </div>
    {active && <div className="login-challenge">
      {link && (link.kind === 'auth-url' || link.kind === 'device-code') && <>
        <p role="status">Waiting for browser authorization. Open this link to continue:</p>
        <a href={link.url} target="_blank" rel="noreferrer">Continue sign-in in your browser ↗</a>
        {link.kind === 'device-code' && <p>Enter this code: <code>{link.code}</code></p>}
        {link.kind === 'auth-url' && link.message && <p className="muted">{link.message}</p>}
      </>}
      {info?.kind === 'info' && <p role="status">{info.message}</p>}
      {link && form ? <details><summary>Callback did not complete? Paste the final redirect URL</summary>{form}</details> : form}
      {!link && !form && !info && <p role="status">Starting sign-in…</p>}
    </div>}
    {flow?.result && <p role="status">{flow.result.ok ? 'Signed in.' : flow.result.message}</p>}
  </>;
}
