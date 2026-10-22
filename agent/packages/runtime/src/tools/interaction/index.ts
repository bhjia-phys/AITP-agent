import { createHash } from "node:crypto";
import { join } from "node:path";
import { Card, CloseReportPayload, PlanProposal, SessionMeta } from "@aitp/protocol";
import type { JsonObject } from "@aitp/protocol";
import type { CreateTools, ToolContext, ToolResult, ToolDefinition } from "../../contracts.ts";
import { toolCatalog } from "./catalog.ts";
import { all } from "../../sessions/state.ts";

const CORE_SKILLS = new Set(["aitp-memory", "aitp-human-learning", "aitp-human-brainstorming", "aitp-research", "aitp-verify", "aitp-writing", "aitp-distill"]);
export const createInteractionTools: CreateTools = services => {
  const session = async (context: ToolContext) => {
    const meta = (await all(context.read, "session")).map(s => SessionMeta.parse(s)).find(s => s.conversation === context.conversation);
    if (!meta) throw new Error("Tool is not attached to a session");
    await services.sessions.get(meta.id); return meta;
  };
  const post = async (type: "choice" | "plan" | "close", payload: unknown, context: ToolContext): Promise<ToolResult> => {
    const meta = await session(context);
    const id = `card:${createHash("sha256").update(`${context.conversation}:${context.toolCallId}`).digest("hex")}`;
    const existing = (await services.cards.list(meta.id)).find(c => c.id === id);
    const card = existing ?? await services.cards.post(Card.parse({ id, session: meta.id, type, kind: type === "close" ? "informational" : "required", status: "open", createdAt: new Date().toISOString(), payload }));
    return { content: [{ type: "text", text: JSON.stringify(card) }], details: card, ...(card.kind === "required" ? { control: { terminateRun: true as const } } : {}) };
  };
  const definitions: ToolDefinition[] = [
    { tool: { name: "ask_researcher", description: "Ask the researcher to choose between consequential options. Posts a required card and ends this run.", replay: "safe",
      parameters: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, consequence: { type: "string" } }, required: ["id", "label", "consequence"] } } }, required: ["question", "options"] },
      execute: (args, context) => post("choice", args, context) } },
    { tool: { name: "propose_plan", description: "Propose bounded steps, stopping conditions, methods, cost and grants for researcher review; ends this run.", replay: "safe",
      parameters: PlanProposal.toJSONSchema() as JsonObject,
      execute: (args, context) => post("plan", { plan: PlanProposal.parse(args) }, context) } },
    { tool: { name: "close_report", description: "Record the supported answer, retained references and warranted next move.", replay: "safe",
      parameters: CloseReportPayload.toJSONSchema() as JsonObject,
      execute: (args, context) => post("close", args, context) } },
    { tool: { name: "read_skill", description: "Read one named core Skill or a Skill in the method index.", replay: "safe",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      async execute(args) {
        const name = String(args.name);
        if (CORE_SKILLS.has(name)) {
          const path = join(services.core.config.aitp.checkout, "plugins/aitp/skills", name, "SKILL.md");
          const result = await services.core.fs.readText({ kind: "absolute", path });
          return { content: [{ type: "text", text: result.text }] };
        }
        const method = (await services.core.methods.list()).find(m => m.name === name);
        if (!method) throw new Error("Unknown Skill");
        const result = await services.core.methods.read(method.address);
        return { content: [{ type: "text", text: result.text }] };
      } } },
    // Runtime owns discovery; the adapter installs no native tool_search extension.
    { tool: { name: "tool_search", description: "Find specialist tools by group or name, and load them for subsequent turns.", replay: "safe",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      async execute(args) {
        const query = String(args.query).toLowerCase();
        const tools = toolCatalog(services).map(d => d.tool).filter(tool => tool.deferred &&
          (tool.name.toLowerCase().includes(query) || tool.group?.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)));
        const names = tools.map(tool => tool.name);
        return { content: [{ type: "text", text: names.join("\n") || "No specialist tools match." }], control: { loadTools: names } };
      } } },
  ];
  return definitions;
};
