---
description: "aitp-agent browser identity: the sidebar brand name and the presentation palette."
kind: "package-reference"
---

# aitp-agent browser identity

## Summary

Show `aitp-agent` in the sidebar of the fork's Web application and give the application its reading-oriented palette. Use this package with the AITP Web overlay to replace the upstream brand name and colors while keeping the existing UI and model-provider identities. The browser title is set separately at build time.

## Use and behavior

This private fork package supplies the `aitp-agent` name through
`sidebar.brand.name`. It uses locale-owned text and removes its registration
when its plugin or the declaring slot unloads. The AITP Web overlay enables this plugin and disables the
upstream official-brand row; no model-provider names change.

The plugin also stacks one theme override layer over the active theme for its lifetime: warm neutral surfaces and borders, a forest brand, link and business accent, and label colors, each with light and dark values. It adds two AITP tokens: `--aitp-font-reading`, the serif stack that research views use for scientific prose, and `--aitp-provenance-agent`, the rule color of provisional agent items. Unloading the plugin removes the layer and restores the upstream palette.

Browser document titles use the existing `DSH_CLIENT_TITLE` build setting.
Build and launch with `pnpm aitp-agent build` and `pnpm aitp-agent` so the
same title and the separate default `~/.aitp-agent` home are selected.
`DSH_HOME` explicitly overrides the home. Existing DeepSeek Harness data is
neither copied nor migrated.

## Further Exploration

- [Sidebar slots](../ui-sidebar/README.md)
- [Theme tokens and override layers](../ui-theme/README.md)
- [Research views](../ui-aitp-research/README.md)
- [Application architecture](../../../docs/agent/10-project-workspace.md)

## Model Experience

None, as this package changes browser presentation without contributing model requests.

#### KV Cache effect

None; this package does not assemble model requests. The separate launcher identity patch owns the agent name in the system prompt.

## Known Limitations and Deferred Work

- The inherited neutral mark, provider-specific onboarding copy and native desktop packaging remain separate surfaces. This package does not implement AITP memory, review or research-writeback services.
- The reading font stack names Source Serif 4 and common serif fallbacks but bundles no font file, so the face depends on what the system has installed.
