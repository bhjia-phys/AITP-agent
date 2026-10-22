// API error codes and bodies (07, errors).
import { z } from "zod";
import { JsonValue } from "../primitives.ts";

export const ErrorCode = z.enum([
  "unauthorized",
  "forbidden_path",
  "denied",
  "not_found",
  "conflict",
  "stale_version",
  "ambiguous_anchor",
  "review_required",
  "uncertain_effect",
  "busy",
  "request_reused",
  "invalid",
  "unavailable",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  unauthorized: 401,
  forbidden_path: 403,
  denied: 403,
  not_found: 404,
  conflict: 409,
  stale_version: 409,
  ambiguous_anchor: 409,
  review_required: 409,
  uncertain_effect: 409,
  busy: 409,
  request_reused: 409,
  invalid: 422,
  unavailable: 503,
  internal: 500,
};

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: JsonValue.optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
