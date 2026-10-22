// Model choices, the catalog and sign-in challenges (04 §13; 07, models).
import { z } from "zod";
import { Id, IsoTime } from "./primitives.ts";

export const ThinkingLevel = z.enum(["low", "medium", "high"]);
export type ThinkingLevel = z.infer<typeof ThinkingLevel>;

export const ModelChoice = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  thinkingLevel: ThinkingLevel.optional(),
});
export type ModelChoice = z.infer<typeof ModelChoice>;

export const AuthState = z.enum(["signed-in", "signed-out", "api-key", "not-required", "expired"]);
export type AuthState = z.infer<typeof AuthState>;

export const ModelCatalogEntry = z.object({
  provider: z.string(),
  modelId: z.string(),
  name: z.string(),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  reasoning: z.boolean(),
  images: z.boolean(),
  auth: z.enum(["api-key", "oauth", "none"]),
  authState: AuthState,
});
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntry>;

/** Counts reported by the provider, kept separate from context-budget estimates. */
export const ModelUsage = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type ModelUsage = z.infer<typeof ModelUsage>;

/** One step of a sign-in flow, shown in the workbench (pi-ai interaction events and prompts). */
export const LoginChallenge = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auth-url"), login: Id, provider: z.string(), url: z.url(), message: z.string().optional() }),
  z.object({
    kind: z.literal("device-code"),
    login: Id,
    provider: z.string(),
    url: z.url(),
    code: z.string(),
    expiresAt: IsoTime.optional(),
  }),
  z.object({
    kind: z.literal("prompt"),
    login: Id,
    provider: z.string(),
    prompt: Id,
    label: z.string(),
    secret: z.boolean(),
  }),
  z.object({ kind: z.literal("info"), login: Id, provider: z.string(), message: z.string() }),
]);
export type LoginChallenge = z.infer<typeof LoginChallenge>;

export const LoginResponse = z.object({ login: Id, prompt: Id, value: z.string() });
export type LoginResponse = z.infer<typeof LoginResponse>;

export const LoginResult = z.object({ login: Id, provider: z.string(), ok: z.boolean(), message: z.string().optional() });
export type LoginResult = z.infer<typeof LoginResult>;
