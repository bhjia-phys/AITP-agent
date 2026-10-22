// A test-only seam. Other packages exercise the port without importing any Pi types or packages.
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import type { ContentBlock, ModelMessage } from "@aitp/protocol";
import type { CreatePiExecutionPort } from "@aitp/runtime/contracts";
import { modelMessages } from "../src/content.ts";
import { createAdapter } from "../src/port.ts";

type ScriptTool = { tool: string; args: Record<string, unknown> };
type ScriptReply = string | ScriptTool | { tools: ScriptTool[] };
export function scriptedPort(options: Parameters<CreatePiExecutionPort>[0], response: (messages: ModelMessage[], call: number) => Promise<ScriptReply> | ScriptReply) {
  const faux = fauxProvider({ models: [{ id: options.models.main.modelId, reasoning: true, input: ["text", "image"] }], tokensPerSecond: Infinity });
  faux.setResponses(Array.from({ length: 1000 }, () => async (context, _options, state) => {
    const result = await response(modelMessages(context.messages), state.callCount);
    return typeof result === "string" ? fauxAssistantMessage(result) : fauxAssistantMessage(("tools" in result ? result.tools : [result]).map(call => fauxToolCall(call.tool, call.args as never)), { stopReason: "toolUse" });
  }));
  return createAdapter(options, { faux });
}
