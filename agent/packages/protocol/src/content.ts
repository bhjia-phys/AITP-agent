// Model-facing content: text, images and framed research data (04 §2). Pi types never appear here.
import { z } from "zod";
import { Id } from "./primitives.ts";
import { ResourceRef } from "./refs.ts";

export const ContextRole = z.enum([
  "kernel",
  "skill",
  "agreement",
  "tool-guide",
  "instruction-source",
  "location",
  "parent-use",
  "plan",
  "root",
  "knowledge",
  "edition",
  "checkout",
  "material",
  "episode",
]);
export type ContextRole = z.infer<typeof ContextRole>;

export const TextBlock = z.object({ type: z.literal("text"), text: z.string() });
export type TextBlock = z.infer<typeof TextBlock>;

/** An image held in the artifact store; the adapter resolves it for the provider. */
export const ImageBlock = z.object({
  type: z.literal("image"),
  artifact: Id,
  file: z.string().min(1),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
});
export type ImageBlock = z.infer<typeof ImageBlock>;

/**
 * Research material for the model to reason about, never to obey. The adapter renders it inside a
 * `<research-data …>` frame with its source, version and span (09 §4).
 */
export const DataBlock = z.object({
  type: z.literal("data"),
  item: Id,
  ref: ResourceRef,
  role: ContextRole,
  text: z.string(),
});
export type DataBlock = z.infer<typeof DataBlock>;

export const ContentBlock = z.discriminatedUnion("type", [TextBlock, ImageBlock, DataBlock]);
export type ContentBlock = z.infer<typeof ContentBlock>;

/**
 * Model context as the model sees it after context edits: what compaction summarizes and `contextAt` returns.
 * Provider-private metadata (reasoning signatures, cache keys) stays inside the adapter.
 */
export const ModelMessage = z.discriminatedUnion("role", [
  z.object({ role: z.literal("system"), text: z.string() }),
  z.object({ role: z.literal("user"), content: z.array(ContentBlock) }),
  z.object({
    role: z.literal("assistant"),
    content: z.array(ContentBlock),
    thinking: z.string().optional(),
    calls: z.array(z.object({ id: z.string(), name: z.string(), args: z.record(z.string(), z.json()) })),
  }),
  z.object({
    role: z.literal("tool"),
    callId: z.string(),
    name: z.string(),
    content: z.array(ContentBlock),
    isError: z.boolean(),
  }),
]);
export type ModelMessage = z.infer<typeof ModelMessage>;
