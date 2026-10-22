import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as protocol from "../src/index.ts";

type Schema = { safeParse(value: unknown): { success: boolean; data?: unknown; error?: unknown } };

const dir = fileURLToPath(new URL("../fixtures/", import.meta.url));
const groups = new Map<string, unknown[]>();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const content = JSON.parse(readFileSync(dir + file, "utf8")) as Record<string, unknown[]>;
  for (const [name, examples] of Object.entries(content)) groups.set(name, [...(groups.get(name) ?? []), ...examples]);
}

/** Contracts that two streams must agree on; each needs at least one example. */
const REQUIRED = [
  "Address", "Locator", "ResourceRef", "FrozenRef", "ThreadRef",
  "ResearchLocation", "ScopeFlag", "ThreadEntry", "ThreadRow", "Outline", "Graph", "Grouping", "InstructionSource",
  "PlanRef", "SearchHit", "Use", "InboxItem",
  "KnowledgeEntry", "KnowledgeArea", "Work", "Edition", "LibraryArtifact", "LocatorCandidate",
  "FileVersion", "CheckoutRecord", "SymbolRecord", "Receipt", "RunRecord", "CampaignCoverage", "ClusterObservation",
  "Provenance", "ArtifactRecord",
  "Anchor", "DocumentOp", "ChangeSet", "FileOutcome", "ApplyResult", "RecoverySummary", "SnapshotRecord",
  "SessionMeta", "ActiveTask", "ContentBlock", "ModelMessage", "InputSubmission", "SubmissionReceipt", "TranscriptEntryView",
  "ContextItem", "ContextManifest", "DataDelivery", "DeliveryReceipt",
  "Grant", "ActionRecord", "GrantRequest",
  "WorkerPlan", "PlanProposal", "WorkerRecord", "IntegrationRecord", "TaskView",
  "Cursor", "CoverageRange", "ReviewRequest", "ReviewFinding", "ReviewReport", "ReviewAssessment",
  "Card", "CardResponse",
  "MethodRecord", "MethodUse", "DistillationProposal", "Episode", "ManuscriptProject", "ReviewThread",
  "ModelChoice", "ModelCatalogEntry", "LoginChallenge", "LoginResponse", "LoginResult", "Config",
  "AuditEvent", "LogHeader", "LogRecord", "Envelope", "ClientMessage", "ErrorBody",
];

describe("contract fixtures", () => {
  it("cover every required contract", () => {
    expect(REQUIRED.filter((name) => !groups.has(name))).toEqual([]);
  });

  for (const [name, examples] of groups) {
    it(`${name}: every example is valid and keeps every key`, () => {
      const schema = (protocol as unknown as Record<string, Schema | undefined>)[name];
      expect(schema, `no exported schema named ${name}`).toBeDefined();
      for (const example of examples) {
        const result = schema!.safeParse(example);
        expect(result.success, JSON.stringify(result.error)).toBe(true);
        expect(result.data).toEqual(example);
      }
    });
  }

  it("cover every card type and every card response type", () => {
    const cards = new Set((groups.get("Card") as { type: string }[]).map((c) => c.type));
    const responses = new Set((groups.get("CardResponse") as { type: string }[]).map((c) => c.type));
    expect([...cards].sort()).toEqual(
      ["approval", "artifact", "artifact-placement", "change-set", "choice", "close", "conflict", "distillation",
        "exercise", "plan", "review-report", "run", "uncertain-effect"],
    );
    for (const card of groups.get("Card") as { kind: string; type: string }[]) {
      if (card.kind !== "informational") expect(responses.has(card.type), card.type).toBe(true);
    }
  });
});
