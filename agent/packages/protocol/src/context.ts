// Context manifests and data delivery (04 §2–3).
import { z } from "zod";
import { ContextRole, DataBlock } from "./content.ts";
import { Hash, Id, IsoTime, RequestId } from "./primitives.ts";
import { ResourceRef } from "./refs.ts";

export const ContextChannel = z.enum(["instruction", "data"]);
export type ContextChannel = z.infer<typeof ContextChannel>;

/**
 * `admitted`: queued for placement. `placed`: in the transcript (data) or rendered into a section
 * (instruction). `superseded`: hidden from the model by a later context edit. `pointer`: replaced by a
 * one-line pointer for budget. `omitted`: never delivered.
 */
export const ContextItemStatus = z.enum(["admitted", "placed", "superseded", "pointer", "omitted"]);
export type ContextItemStatus = z.infer<typeof ContextItemStatus>;

export const ContextItem = z
  .object({
    id: Id,
    channel: ContextChannel,
    role: ContextRole,
    ref: ResourceRef,
    reason: z.string(),
    tokens: z.number().int().nonnegative(),
    status: ContextItemStatus,
    /** Data items: the deterministic request id of the delivery, and where it was placed. */
    delivery: z
      .object({
        requestId: RequestId,
        submission: Id.optional(),
        entry: Id.optional(),
        /** Set when the item travels inside a queued input, so it is placed with that input. */
        withInput: Id.optional(),
      })
      .optional(),
    /** Instruction items: the system section and the hash of its rendering. */
    section: z.object({ key: z.string(), hash: Hash.optional() }).optional(),
    supersedes: Id.optional(),
    supersededBy: Id.optional(),
  })
  .refine((i) => (i.channel === "data") === (i.delivery !== undefined), {
    message: "data items have a delivery; instruction items do not",
  })
  .refine((i) => i.channel === "data" || i.section !== undefined, {
    message: "instruction items name their section",
  });
export type ContextItem = z.infer<typeof ContextItem>;

export const ContextManifest = z.object({
  id: Id,
  session: Id,
  conversation: Id,
  policy: z.literal("aitp-memory@1"),
  assembledAt: IsoTime,
  items: z.array(ContextItem),
  omitted: z.array(z.object({ ref: ResourceRef, reason: z.string() })),
  /** The whole request is budgeted: instructions, tool declarations, history, data and the output reserve. */
  budget: z.object({
    limit: z.number().int().positive(),
    instructions: z.number().int().nonnegative(),
    tools: z.number().int().nonnegative(),
    history: z.number().int().nonnegative(),
    data: z.number().int().nonnegative(),
    reserve: z.number().int().nonnegative(),
  }),
  /** Set when this manifest re-delivered current items after an applied compaction. */
  afterCompaction: Id.optional(),
});
export type ContextManifest = z.infer<typeof ContextManifest>;

/**
 * One passive delivery: data blocks plus the context edits that hide their predecessors, in a single entry.
 * Pi places it at once when idle, otherwise at the next boundary; the receipt reports admission, then placement.
 *
 * An edit targets a context item. Pi edits whole entry contributions, so the adapter groups the edits by
 * containing entry and reconstructs that entry's model contribution, preserving the researcher's request,
 * images and unaffected items; it omits an entire entry only when nothing remains.
 */
export const DataDelivery = z.object({
  requestId: RequestId,
  blocks: z.array(DataBlock).min(1),
  edits: z.array(
    z
      .object({ item: Id, action: z.enum(["omit", "replace"]), pointer: z.string().optional() })
      .refine((e) => e.action === "omit" || e.pointer !== undefined, { message: "replace needs a pointer text" }),
  ),
});
export type DataDelivery = z.infer<typeof DataDelivery>;

export const DeliveryReceipt = z.object({
  requestId: RequestId,
  submission: Id,
  status: z.enum(["admitted", "placed", "unanswered"]),
  entry: Id.optional(),
  reason: z.string().optional(),
  at: IsoTime,
});
export type DeliveryReceipt = z.infer<typeof DeliveryReceipt>;
