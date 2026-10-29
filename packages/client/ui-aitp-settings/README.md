---
description: "Research suite preferences and observed capabilities in native Settings."
kind: "package-reference"
---

# AITP Research Settings

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-client-ui-aitp-settings` contributes the Research page to the native Settings shell. It remains available in Skills, Browse research and Full research workbench compositions. The page separates observed running capabilities from the choices saved for the next AITP start.

## Usage

The AITP launcher enables this plugin in its Web overlays. Select a composition and optional literature, knowledge and code libraries, then save. Restart `aitp-agent` to apply the saved choice. Explicit `--research-suite` and `--research-libraries` arguments take priority over their corresponding saved values. The Session's Research choice and tool preset remain separate.

The existing Settings form and ConfigEditor validate and atomically save the four preference fields in the active profile's `cordis.patch.yml`. The fields are volatile so the form can accept a saved preference without reloading research plugins. No setting in this plugin directly changes the running composition. The launcher reads the same profile row on the next start and creates the existing capability overlays. An absent preference row preserves the previous launcher behavior.

## Architecture

The Host half declares the preference schema and publishes a public page-load snapshot of the resolved automatic Research flag. The Client half uses the shared ConfigForm, native plugin inventory and `settings.section` slot. Its draft and error display are UI state; the profile remains the only preference owner. Saving does not access scientific records or historical Sessions. Skills mode retains this settings page so the researcher can restore the workbench.

## Model Experience

None, as this package saves profile preferences and displays capabilities without contributing to model requests. On the next launch, the selected research plugins determine their own context and tool behavior.

#### KV Cache effect

None; this package does not assemble model requests.

## Known Limitations and Deferred Work

- Capability selection is restart-only. The running plugin inventory can be checked again; the automatic Research flag describes when the page was loaded and requires a page reload after restarting the Host. Home patches or explicit overlays that replace this preference row can make native profile saving refuse the edit. Startup preferences use literal values; deferred YAML expressions remain supported in the underlying research plugin configuration. This setting applies to the AITP Web launcher, not arbitrary native DSH profiles.
