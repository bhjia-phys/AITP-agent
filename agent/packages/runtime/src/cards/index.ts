import { Card, CardResponse, SessionMeta } from "@aitp/protocol";
import type { CreateCardService } from "../contracts.ts";
import { all, fingerprint, object, requestReused, sameRequest } from "../sessions/state.ts";

export const createCardService: CreateCardService = (deps, services) => ({
  async post(input) {
    const card = Card.parse(input);
    return deps.port.transact(async tx => {
      const address = { family: "card" as const, key: card.id };
      const old = await tx.get(address);
      if (old) {
        const stored = Card.parse(old);
        if (fingerprint({ ...stored, status: card.status }) !== fingerprint(card)) requestReused();
        return stored;
      }
      const session = SessionMeta.parse(await tx.get({ family: "session", key: card.session }));
      await tx.put(address, object(card));
      await tx.appendAudit(session.conversation, { type: "card", at: deps.clock.now().toISOString(), card });
      return card;
    });
  },
  async respond(id, input, requestId) {
    const response = CardResponse.parse(input); const body = fingerprint({ id, response });
    const card = await deps.port.transact(async tx => {
      const key = `card-response:${requestId}`; const old = await tx.get({ family: "request", key });
      if (old) { if (!sameRequest(old.fingerprint, body)) requestReused(); return Card.parse(old.card); }
      const card = Card.parse(await tx.get({ family: "card", key: id }));
      if (card.kind === "informational" || card.status !== "open" || response.type !== card.type) throw new Error("Card does not accept this response");
      if (card.type === "choice" && response.type === "choice" && !card.payload.options.some(o => o.id === response.option)) throw new Error("Unknown choice option");
      const session = SessionMeta.parse(await tx.get({ family: "session", key: card.session }));
      const answered = Card.parse({ ...card, status: "answered" });
      await tx.put({ family: "card", key: id }, object(answered));
      await tx.put({ family: "request", key }, { fingerprint: body, card: object(answered) });
      await tx.appendAudit(session.conversation, { type: "card-response", at: deps.clock.now().toISOString(), card: id, response });
      return answered;
    });
    // The answer is a durable, deduplicated next input. A repeat repairs a crash between response and admission.
    await services().sessions.submit(card.session, { purpose: "interjection", delivery: "follow-up", requestId: `card-answer:${requestId}`,
      content: [{ type: "text", text: `Researcher response to ${card.type} card ${card.id}: ${JSON.stringify(response)}` }] });
    return card;
  },
  async list(session, options) { return (await all(deps.port.read, "card")).map(c => Card.parse(c)).filter(c => c.session === session && (!options?.open || c.status === "open")); },
});
