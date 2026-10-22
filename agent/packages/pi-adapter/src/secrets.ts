import type { AssistantMessage, AssistantMessageEvent, Credential, Models } from "@earendil-works/pi-ai";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";

/** Credentials never enter the transcript, including when a provider echoes one in a failure. */
export function secretRedactor() {
  const secrets = new Set<string>();
  const redact = (text: string) => { let result = text; for (const secret of secrets) result = result.replaceAll(secret, "[redacted]"); return result; };
  return {
    remember(credential: Credential) {
      if (credential.type === "api_key") { if (credential.key) secrets.add(credential.key); }
      else { if (credential.access) secrets.add(credential.access); if (credential.refresh) secrets.add(credential.refresh); }
    },
    redact,
    redactPartial(text: string) {
      let result = redact(text);
      // Hold a possible credential prefix until a later chunk disambiguates it. Emitted text stays append-only.
      for (const secret of secrets) for (let n = Math.min(secret.length - 1, result.length); n > 0; n--) {
        if (result.endsWith(secret.slice(0, n))) { result = result.slice(0, -n); break; }
      }
      return result;
    },
  };
}

export function safeModels(models: Models, redact: (text: string) => string, partialText = redact): Models {
  const clean = <T>(value: T, partial = false): T => {
    if (typeof value === "string") return (partial ? partialText(value) : redact(value)) as T;
    if (Array.isArray(value)) return value.map(v => clean(v, partial)) as T;
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, clean(v, partial)])) as T;
    return value;
  };
  const message = (value: AssistantMessage, partial = false): AssistantMessage => ({ ...value,
    ...(value.errorMessage ? { errorMessage: redact(value.errorMessage) } : {}),
    ...(value.diagnostics ? { diagnostics: clean(value.diagnostics) } : {}),
    content: value.content.map(block => block.type === "text" ? { ...block, text: (partial ? partialText : redact)(block.text) }
      : block.type === "thinking" ? { ...block, thinking: (partial ? partialText : redact)(block.thinking) } : { ...block, arguments: clean(block.arguments, partial) }),
  });
  const stream = (source: AssistantMessageEventStream) => {
    const out = new AssistantMessageEventStream();
    const visible = new Map<number, string>();
    void (async () => {
      try {
        for await (const event of source) {
          let clean: AssistantMessageEvent = event;
          if (event.type === "error") clean = { ...event, error: message(event.error) };
          else if (event.type === "done") clean = { ...event, message: message(event.message) };
          else if ("partial" in event) {
            const partial = message(event.partial, !event.type.endsWith("_end"));
            clean = { ...event, partial };
            if ("content" in event && typeof event.content === "string") clean = { ...clean, content: redact(event.content) } as AssistantMessageEvent;
            if (event.type === "toolcall_end") clean = { ...event, partial, toolCall: { ...event.toolCall, arguments: cleanArguments(event.toolCall.arguments) } };
            if ("delta" in event && "contentIndex" in event) {
              const block = partial.content[event.contentIndex];
              const text = block?.type === "text" ? block.text : block?.type === "thinking" ? block.thinking : "";
              const prior = visible.get(event.contentIndex) ?? "";
              clean = { ...clean, delta: text.startsWith(prior) ? text.slice(prior.length) : "" } as AssistantMessageEvent;
              visible.set(event.contentIndex, text);
            }
          }
          out.push(clean);
        }
        out.end(message(await source.result()));
      } catch {
        // pi-ai streams normally terminate with an error message; a broken stream is still a bounded failure.
        const failed: AssistantMessage = { role: "assistant", api: "unknown", provider: "unknown", model: "unknown", timestamp: Date.now(), content: [], stopReason: "error", errorMessage: "Model request failed",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        out.push({ type: "error", reason: "error", error: failed }); out.end(failed);
      }
    })();
    return out;
  };
  const cleanArguments = <T>(value: T): T => clean(value);
  return new Proxy(models, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      if (key === "stream" || key === "streamSimple" || key === "streamDeferred") return (...args: unknown[]) => {
        try { return stream(value.apply(target, args)); } catch { throw new Error("Model request failed"); }
      };
      if (key === "complete" || key === "completeSimple" || key === "fetchDeferred") return async (...args: unknown[]) => {
        try { return message(await value.apply(target, args)); } catch { throw new Error("Model request failed"); }
      };
      return value.bind(target);
    },
  });
}
