import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LoginChallenge, LoginResult } from "@aitp/protocol";
import type { ModelsPort } from "@aitp/runtime/contracts";
import type { Credential, CredentialStore, Models } from "@earendil-works/pi-ai";
import { toContent } from "./content.ts";
import type { ResolveImage } from "./content.ts";

/** One serialized mutation line, also shared by providers refreshing rotated credentials. */
export async function fileCredentialStore(dataDir: string, remember: (credential: Credential) => void = () => {}): Promise<CredentialStore> {
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, "credentials.json");
  try { await writeFile(file, "{}\n", { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("Credential storage unavailable"); }
  await chmod(file, 0o600);
  let line: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = line.then(fn); line = next.catch(() => {}); return next;
  };
  const load = async () => {
    try { const all = JSON.parse(await readFile(file, "utf8")) as Record<string, Credential>; for (const credential of Object.values(all)) remember(credential); return all; }
    catch { throw new Error("Credential storage unavailable"); }
  };
  const save = async (value: Record<string, Credential>) => {
    const temp = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(temp, JSON.stringify(value), { flag: "wx", mode: 0o600 }); await rename(temp, file); }
    catch { await rm(temp, { force: true }).catch(() => {}); throw new Error("Credential storage unavailable"); }
  };
  return {
    read: provider => serial(async () => (await load())[provider]),
    list: () => serial(async () => Object.entries(await load()).map(([providerId, c]) => ({ providerId, type: c.type }))),
    modify: (provider, fn) => serial(async () => {
      const all = await load(); const next = await fn(all[provider]);
      if (next !== undefined) { remember(next); all[provider] = next; await save(all); }
      return next ?? all[provider];
    }),
    delete: provider => serial(async () => { const all = await load(); delete all[provider]; await save(all); }),
  };
}

export async function deviceId(dataDir: string): Promise<string> {
  const file = join(dataDir, "device-id");
  try { await writeFile(file, randomUUID(), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("Device identity unavailable"); }
  return (await readFile(file, "utf8")).trim();
}

export function modelsPort(models: Models, installation: string, readImage: ResolveImage, faux = false): ModelsPort & { close(): void } {
  const pending = new Map<string, { login: string; resolve(value: string): void; reject(error: Error): void }>();
  const controllers = new Set<AbortController>();
  const active = new Map<string, { login: string; controller: AbortController; done: Promise<LoginResult>; challenges: LoginChallenge[]; listeners: Set<(challenge: LoginChallenge) => void> }>();
  return {
    async catalog() {
      const providers = models.getProviders();
      const states = new Map(await Promise.all(providers.map(async p => [p.id, await models.checkAuth(p.id).catch(() => undefined)] as const)));
      return models.getModels().map(m => {
        const p = models.getProvider(m.provider)!;
        return { provider: m.provider, modelId: m.id, name: m.name, contextWindow: m.contextWindow,
          maxOutputTokens: m.maxTokens, reasoning: m.reasoning, images: m.input.includes("image"),
          auth: m.provider === "faux" ? "none" as const : p.auth.oauth ? "oauth" as const : "api-key" as const,
          authState: m.provider === "faux" ? "not-required" as const : states.get(p.id) ? states.get(p.id)?.type === "oauth" ? "signed-in" as const : "api-key" as const : "signed-out" as const };
      });
    },
    async startLogin(provider, method, onChallenge) {
      const previous = active.get(provider);
      if (previous) {
        previous.listeners.add(onChallenge);
        for (const challenge of previous.challenges) onChallenge(challenge);
        return { login: previous.login, done: previous.done };
      }
      const login = randomUUID(); const controller = new AbortController(); controllers.add(controller);
      const challenges: LoginChallenge[] = [], listeners = new Set([onChallenge]);
      let stage = "starting the authorization flow";
      const challenge = (c: LoginChallenge) => {
        challenges.push(c);
        if (c.kind === "auth-url" || c.kind === "device-code") stage = "waiting for browser authorization";
        else if (c.kind === "prompt" && !challenges.some(c => c.kind === "auth-url" || c.kind === "device-code")) stage = "waiting for sign-in input";
        else if (c.kind === "info" && /exchanging authorization code/i.test(c.message)) stage = "exchanging the authorization code";
        for (const listener of listeners) listener(c);
      };
      const done: Promise<LoginResult> = models.login(provider, method === "api-key" ? "api_key" : "oauth", {
        signal: controller.signal,
        notify(event) {
          if (event.type === "auth_url") challenge({ kind: "auth-url", login, provider, url: event.url, message: event.instructions });
          else if (event.type === "device_code") challenge({ kind: "device-code", login, provider, url: event.verificationUri, code: event.userCode,
            ...(event.expiresInSeconds ? { expiresAt: new Date(Date.now() + event.expiresInSeconds * 1000).toISOString() } : {}) });
          else challenge({ kind: "info", login, provider, message: event.message });
        },
        prompt(prompt) {
          const id = randomUUID();
          return new Promise<string>((resolve, reject) => {
            const cleanup = () => { pending.delete(id); prompt.signal?.removeEventListener("abort", cancel); controller.signal.removeEventListener("abort", cancel); };
            const cancel = () => { cleanup(); reject(new Error("Login cancelled")); };
            if (prompt.signal?.aborted || controller.signal.aborted) return cancel();
            prompt.signal?.addEventListener("abort", cancel, { once: true });
            controller.signal.addEventListener("abort", cancel, { once: true });
            pending.set(id, { login, resolve: value => { cleanup(); resolve(value); }, reject: error => { cleanup(); reject(error); } });
            challenge({ kind: "prompt", login, provider, prompt: id, label: prompt.type === "select" ? `${prompt.message}\n${prompt.options.map(o => `${o.id}: ${o.label}${o.description ? ` — ${o.description}` : ""}`).join("\n")}` : prompt.message, secret: prompt.type === "secret" || prompt.type === "manual_code" });
          });
        },
      }, { getDeviceId: () => installation, agentName: "aitp-agent" })
        .then(() => ({ login, provider, ok: true }), error => ({ login, provider, ok: false, message: loginFailure(error, controller.signal.aborted, stage) }))
        .finally(() => { active.delete(provider); controllers.delete(controller); for (const p of pending.values()) if (p.login === login) p.reject(new Error("Login ended")); });
      active.set(provider, { login, controller, done, challenges, listeners });
      return { login, done };
    },
    async respond(response) {
      const prompt = pending.get(response.prompt);
      if (!prompt || prompt.login !== response.login) throw new Error("Unknown login prompt");
      pending.delete(response.prompt); prompt.resolve(response.value);
    },
    async cancelLogin(login) {
      const flow = [...active.values()].find(flow => flow.login === login);
      if (flow) { flow.controller.abort(); await flow.done; }
    },
    async logout(provider) {
      const flow = active.get(provider);
      if (flow) { flow.controller.abort(); await flow.done; }
      try { await models.logout(provider); } catch { throw new Error("Sign-out failed"); }
    },
    async complete(input) {
      const model = models.getModel(faux ? "faux" : input.model.provider, input.model.modelId);
      if (!model) throw new Error("Unknown model");
      try {
        const reply = await models.completeSimple(model, { messages: [
          { role: "system", content: input.system, timestamp: 0 },
          { role: "user", content: await toContent(input.content, readImage), timestamp: 0 },
        ] }, { maxTokens: input.maxOutputTokens, reasoning: input.model.thinkingLevel, signal: input.signal });
        if (reply.stopReason === "error" || reply.stopReason === "aborted") throw new Error("Completion failed");
        return { text: reply.content.flatMap(b => b.type === "text" ? [b.text] : []).join(""), usage: { input: reply.usage.input, output: reply.usage.output } };
      } catch { throw new Error("Completion failed"); }
    },
    close() { for (const c of controllers) c.abort(); },
  };
}

/** Allowlisted diagnostics only: provider errors can contain credentials and callback codes. */
function loginFailure(error: unknown, cancelled: boolean, stage: string): string {
  const message = error instanceof Error ? error.message : "";
  if (cancelled) return "Sign-in cancelled. You can start a new sign-in.";
  if (/^Port 1455 is in use|EADDRINUSE/.test(message)) return "Sign-in could not start: callback port 1455 is in use. Cancel the other pending ChatGPT login, then retry.";
  if (/^Paste the full callback URL|^The pasted callback URL|^Missing (authorization code|OAuth state)|^OAuth state mismatch|^OpenAI OAuth registration callback/.test(message)) return "Sign-in callback was invalid or belonged to an earlier attempt. Start a new sign-in and use its browser link.";
  if (/^ChatGPT authorization failed:/.test(message)) return "Browser authorization was declined or failed. Start a new sign-in to retry.";
  const status = /^OpenAI OAuth token request failed \((\d{3})\):/.exec(message)?.[1];
  if (status) return `Authorization code exchange was rejected (HTTP ${status}). Start a new sign-in; if it persists, check account access.`;
  if (/^OpenAI OAuth (token response|grant did not)/.test(message)) return "ChatGPT returned an unsupported authorization grant. Check account access before retrying.";
  if (/Credential stor(e|age)/i.test(message)) return "Authorization could not be saved to the local credential store. Check the data directory, then retry.";
  if (/fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT/.test(message)) return `Network connection failed while ${stage}. Check the server proxy or network, then start a new sign-in.`;
  return `Sign-in failed while ${stage}. Start a new sign-in to retry.`;
}
