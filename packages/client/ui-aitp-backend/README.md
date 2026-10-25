---
description: "Authenticated browser transport for configured Harness research-memory sources."
kind: "package-reference"
---

# AITP research backend client

## Summary

Connects the [Research views](../ui-aitp-research/README.md) to the host's [research-memory service](../../research/research-memory/README.md). It registers one workspace-adapter factory through `researchWorkspaces`. Components continue to use the existing resource protocols; source envelopes keep their runtime origin, observation time and completeness.

## Configuration and behavior

Enable `research-memory`, `ui-aitp-research` and `ui-aitp-backend` in the Harness composition. The browser plugin has no filesystem configuration. Configure explicit roots on the host; the default host configuration grants no roots. The [scratch overlay](../../../apps/cli/config/aitp-memory.cordis.patch.yml) reads `AITP_RESEARCH_ROOT`, with optional `AITP_RESEARCH_STATE` and `AITP_RESEARCH_WRITE=1` for scratch writing. Use it with a disposable copy. The synthetic fixture is a separate provider and must remain disabled in this composition.

The plugin mounts the generated `research-memory/remote` contribution through `remote.$mount` before binding its workspace provider. A type import alone does not register the browser's `remote.researchMemory` service. The plugin owns that namespace and withdraws it after its adapters stop.

Each adapter is bound to the requested Harness Workspace and the authenticated Remote service. `provider` supplies the actual host capabilities; the browser does not infer write permission from a visible edit control. Reads carry both the resource caller's cancellation signal and the plugin's lifetime signal. Expected host errors remain structured, including unsupported operations and absent configured roots. An invocation failure after a save may mean its acknowledgement was lost; the adapter preserves an unknown outcome and its operation identity without retrying the write.

`remote.$stream` owns notification reconnection. Each physical connection fetches current capabilities and requires the host's resync baseline before publishing connected state. Source notifications cause the resource bridge to reread authoritative values. They do not call the host's refresh method, which would itself emit another invalidation. A disconnected reading retains its previous observation and displays the connection failure. Subscriptions share one stream per workspace adapter.

The plugin effect owns the factory and all adapters it creates. Unloading first withdraws the factory, then aborts outstanding reads and awaits stream teardown. The localized messages are removed with their own effect. Adapter tests exercise carrier reconnect, cancellation, lost save acknowledgement and Cordis disposal. The Web-roster test boots before registering endpoint substitutes, so a test-created namespace cannot mask a missing production mount. It checks generated named arguments, resource rereads and namespace withdrawal; its source values are test data, not a filesystem integration claim.

The plugin also provides `aitp-session` from the owner-scoped `getSessionMemory` endpoint and `aitp-note` from current source reads. Existing accepted Session events and registered message projections supply researcher originals, provisional items, compaction state and exact request-context snapshots; viewing memory starts no Agent. Every committed event invalidates the observation. Unbound Sessions explicitly clear the resource while retaining event subscriptions, so a queued research input can populate it later. Disposal releases the Session lease. Opening a note shows current text separately from recorded context. Per-file links do not prove delivery, and rule adoption is not inferred.

## Model Experience

Indirectly, through the research-memory service: explicit user questions carry their displayed topic, material and selected text to the host's normal conversation path.

#### KV Cache effect

This browser transport adds no model request tokens itself. The research-memory service owns context assembly and its cache effects.

## Known Limitations and Deferred Work

- Notification history is not replayed. A supplied event cursor requests a fresh resync; durable operation recovery belongs to the host.
- The host currently restricts question creation, source mutation and Session memory views to the authenticated owner. Read-only capability observations remain visible as read-only.
- Question creation has no durable request deduplication. After an uncertain response, inspect the normal Session list before resubmitting. Source write receipts use operation identities.
- This plugin provides transport only. Markdown ownership ambiguities, supported material formats, source bounds and write semantics are reported by the host service.
