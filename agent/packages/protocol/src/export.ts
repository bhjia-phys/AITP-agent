// The reviewer export `aitp.workbench-log@1` (09 §11): JSON Lines, a header, then records in cursor order.
import { z } from "zod";
import { AuditEvent } from "./audit.ts";
import { ContentBlock } from "./content.ts";
import { ModelUsage } from "./models.ts";
import { Id, IsoTime, JsonValue } from "./primitives.ts";
import { ResourceRef, WorkspacePath } from "./refs.ts";
import { Cursor } from "./reviews.ts";
import { Delivery, MessagePurpose } from "./sessions.ts";

export const LogHeader = z.object({
  schema: z.literal("aitp.workbench-log@1"),
  session: Id,
  location: WorkspacePath,
  conversations: z
    .array(
      z.object({
        id: Id,
        role: z.enum(["main", "worker", "review"]),
        parent: Id.optional(),
        /** The last record exported for this conversation. */
        cutoff: Cursor,
      }),
    )
    .min(1),
  exportedAt: IsoTime,
  /** What the export cannot show (encrypted provider reasoning, omitted large outputs); reported as coverage gaps. */
  limitations: z.array(z.string()),
});
export type LogHeader = z.infer<typeof LogHeader>;

/** `at` is present when the source records a time; Pi entries themselves carry none. */
const common = { cursor: Cursor, at: IsoTime.optional() };

export const LogRecord = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("message"),
    role: z.enum(["user", "assistant"]),
    usage: ModelUsage.optional(),
    purpose: MessagePurpose.optional(),
    delivery: Delivery.optional(),
    content: z.array(ContentBlock),
  }),
  z.object({ ...common, type: z.literal("tool-call"), id: z.string(), name: z.string(), args: JsonValue }),
  z.object({
    ...common,
    type: z.literal("tool-result"),
    id: z.string(),
    isError: z.boolean(),
    content: z.array(ContentBlock),
    fullOutput: ResourceRef.optional(),
  }),
  z.object({ ...common, type: z.literal("compaction-summary"), summary: z.string() }),
  z.object({ ...common, type: z.literal("audit"), event: AuditEvent }),
]);
export type LogRecord = z.infer<typeof LogRecord>;

/** One line of the export file: the header first, then records. */
export const ExportLine = z.union([LogHeader, LogRecord]);
export type ExportLine = z.infer<typeof ExportLine>;
