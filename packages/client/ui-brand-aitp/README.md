---
description: "aitp-agent browser identity through the existing sidebar brand slot."
kind: "package-reference"
---

# aitp-agent browser identity

## Summary

Show `aitp-agent` in the sidebar of the fork's Web application. Use this package with the AITP Web overlay to replace the upstream brand name while keeping the existing UI and model-provider identities. The browser title is set separately at build time.

## Use and behavior

This private fork package supplies the `aitp-agent` name through
`sidebar.brand.name`. It uses locale-owned text and removes its registration
when its plugin or the declaring slot unloads. The AITP Web overlay enables this plugin and disables the
upstream official-brand row; no model-provider names change.

Browser document titles use the existing `DSH_CLIENT_TITLE` build setting.
Build and launch with `pnpm aitp-agent build` and `pnpm aitp-agent` so the
same title and the separate default `~/.aitp-agent` home are selected.
`DSH_HOME` explicitly overrides the home. Existing DeepSeek Harness data is
neither copied nor migrated.

## Further Exploration

- [Sidebar slots](../ui-sidebar/README.md)
- [Application architecture](../../../docs/agent/10-project-workspace.md)

## Model Experience

None, as this package changes browser presentation without contributing model requests.

#### KV Cache effect

None; this package does not assemble model requests. The separate launcher identity patch owns the agent name in the system prompt.

## Known Limitations and Deferred Work

- The inherited neutral mark, provider-specific onboarding copy and native desktop packaging remain separate surfaces. This package does not implement AITP memory, review or research-writeback services.
