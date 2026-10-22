import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createModels } from "@earendil-works/pi-ai/models";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { deviceId, fileCredentialStore, modelsPort } from "../../src/models.ts";
import type { LoginChallenge } from "@aitp/protocol";

it("file credentials serialize updates, stay 0600, and login interaction events map without exposing secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aitp-credentials-"));
  try {
    const store = await fileCredentialStore(dir); const installation = await deviceId(dir); expect(await deviceId(dir)).toBe(installation);
    await Promise.all([1, 2, 3].map(() => store.modify("counter", async old => ({ type: "api_key", key: String(Number(old?.type === "api_key" ? old.key : 0) + 1) }))));
    expect((await store.read("counter"))).toEqual({ type: "api_key", key: "3" });
    expect((await stat(join(dir, "credentials.json"))).mode & 0o777).toBe(0o600);
    const faux = fauxProvider();
    let supplied = "";
    const models = createModels({ credentials: store });
    models.setProvider({ ...faux.provider, id: "stub", auth: { oauth: {
      name: "Stub OAuth",
      async login(interaction, options) {
        expect(options?.getDeviceId?.()).toBe(installation);
        interaction.notify({ type: "auth_url", url: "https://auth.example.invalid/authorize", instructions: "Open this address" });
        interaction.notify({ type: "device_code", verificationUri: "https://auth.example.invalid/device", userCode: "HUMAN-CODE", expiresInSeconds: 60 });
        interaction.notify({ type: "info", message: "Awaiting sign-in" });
        supplied = await interaction.prompt({ type: "secret", message: "Enter API key" });
        if (supplied === "FAIL-SECRET") throw new Error(`Provider rejected ${supplied}`);
        return { type: "oauth", access: "ACCESS-SECRET", refresh: "REFRESH-SECRET", expires: Date.now() + 3600000 };
      }, refresh: async credential => credential, toAuth: async credential => ({ apiKey: credential.access }),
    } } });
    const port = modelsPort(models, installation, async () => { throw new Error("Unused image resolver"); });
    const challenges: LoginChallenge[] = [];
    const login = await port.startLogin("stub", "device", challenge => challenges.push(challenge));
    const prompt = challenges.find(c => c.kind === "prompt"); expect(prompt?.kind).toBe("prompt"); if (prompt?.kind !== "prompt") throw new Error("No prompt");
    expect(challenges.map(c => c.kind)).toEqual(["auth-url", "device-code", "info", "prompt"]);
    await port.respond({ login: login.login, prompt: prompt.prompt, value: "INPUT-SECRET" }); expect(await login.done).toEqual({ login: login.login, provider: "stub", ok: true });
    expect(supplied).toBe("INPUT-SECRET"); expect(await store.list()).toContainEqual({ providerId: "stub", type: "oauth" });
    const failing: LoginChallenge[] = []; const failure = await port.startLogin("stub", "oauth", c => failing.push(c)); const fp = failing.find(c => c.kind === "prompt")!;
    if (fp.kind !== "prompt") throw new Error("No prompt"); await port.respond({ login: failure.login, prompt: fp.prompt, value: "FAIL-SECRET" });
    const result = await failure.done; expect(result.ok).toBe(false); expect(JSON.stringify({ challenges, failing, result })).not.toMatch(/ACCESS-SECRET|REFRESH-SECRET|INPUT-SECRET|FAIL-SECRET/);
    const disk = await readFile(join(dir, "credentials.json"), "utf8"); expect(disk).toContain("ACCESS-SECRET");
    await port.logout("stub"); expect(await store.read("stub")).toBeUndefined(); port.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("provider errors and echoed credential text are redacted before they enter durable streaming state", async () => {
  const { safeModels, secretRedactor } = await import("../../src/secrets.ts");
  const { fauxAssistantMessage } = await import("@earendil-works/pi-ai/providers/faux");
  const redactor = secretRedactor(); redactor.remember({ type: "api_key", key: "API-KEY-SECRET" }); redactor.remember({ type: "oauth", access: "ACCESS-TOKEN-SECRET", refresh: "REFRESH-TOKEN-SECRET", expires: 0 });
  const faux = fauxProvider({ models: [{ id: "m" }], tokensPerSecond: Infinity });
  faux.setResponses(Array.from({ length: 2 }, () => fauxAssistantMessage("Echo API-KEY-SECRET ACCESS-TOKEN-SECRET", { stopReason: "error", errorMessage: "Provider rejected REFRESH-TOKEN-SECRET" })));
  const raw = createModels(); raw.setProvider(faux.provider); const protectedModels = safeModels(raw, redactor.redact, redactor.redactPartial);
  const model = protectedModels.getModel("faux", "m")!;
  const completed = await protectedModels.completeSimple(model, { messages: [] }); expect(JSON.stringify(completed)).not.toMatch(/API-KEY-SECRET|ACCESS-TOKEN-SECRET|REFRESH-TOKEN-SECRET/); expect(completed.errorMessage).toContain("[redacted]");
  const stream = protectedModels.streamSimple(model, { messages: [] }); const events = [];
  for await (const event of stream) events.push(event);
  expect(JSON.stringify(events)).not.toMatch(/API-KEY-SECRET|ACCESS-TOKEN-SECRET|REFRESH-TOKEN-SECRET/);
  expect((await stream.result()).errorMessage).toContain("[redacted]");
});

it("reuses a pending provider login, replays both browser and manual challenges, and cancels without removing earlier credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aitp-login-retry-"));
  try {
    const store = await fileCredentialStore(dir);
    await store.modify("stub", async () => ({ type: "api_key", key: "EARLIER-SECRET" }));
    const models = createModels({ credentials: store });
    let calls = 0;
    models.setProvider({ ...fauxProvider().provider, id: "stub", auth: { oauth: {
      name: "Retry fixture",
      async login(interaction) {
        calls++;
        interaction.notify({ type: "auth_url", url: "https://auth.example.invalid/authorize" });
        await interaction.prompt({ type: "manual_code", message: "Optional callback" });
        return { type: "oauth", access: "ACCESS-SECRET", refresh: "REFRESH-SECRET", expires: Date.now() + 3600000 };
      }, refresh: async credential => credential, toAuth: async credential => ({ apiKey: credential.access }),
    } } });
    const port = modelsPort(models, await deviceId(dir), async () => { throw new Error("Unused"); });
    try {
      const first = await port.startLogin("stub", "oauth", () => {});
      const replay: LoginChallenge[] = [];
      const duplicate = await port.startLogin("stub", "oauth", c => replay.push(c));
      expect(duplicate.login).toBe(first.login); expect(calls).toBe(1);
      expect(replay.map(c => c.kind)).toEqual(["auth-url", "prompt"]);
      await port.cancelLogin(first.login);
      expect((await first.done).message).toContain("cancelled");
      expect(await store.read("stub")).toEqual({ type: "api_key", key: "EARLIER-SECRET" });
      await port.cancelLogin(first.login); // Safe retry of cancellation.
      const retry = await port.startLogin("stub", "oauth", () => {});
      expect(retry.login).not.toBe(first.login); expect(calls).toBe(2);
      await port.cancelLogin(retry.login);
    } finally { port.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it.each([
  ["Port 1455 is in use, FAIL-SECRET", "callback port 1455"],
  ["OpenAI OAuth token request failed (403): FAIL-SECRET", "HTTP 403"],
  ["OAuth state mismatch FAIL-SECRET", "callback was invalid"],
  ["fetch failed FAIL-SECRET", "Network connection failed"],
  ["Provider echoed FAIL-SECRET", "starting the authorization flow"],
])("reports an allowlisted login stage without provider response text: %s", async (failure, expected) => {
  const models = createModels();
  models.setProvider({ ...fauxProvider().provider, id: "stub", auth: { oauth: {
    name: "Failure fixture", async login() { throw new Error(failure); },
    refresh: async credential => credential, toAuth: async credential => ({ apiKey: credential.access }),
  } } });
  const port = modelsPort(models, "fixture", async () => { throw new Error("Unused"); });
  try {
    const flow = await port.startLogin("stub", "oauth", () => {});
    const result = await flow.done;
    expect(result.ok).toBe(false); expect(result.message).toContain(expected);
    expect(JSON.stringify(result)).not.toContain("FAIL-SECRET");
  } finally { port.close(); }
});
