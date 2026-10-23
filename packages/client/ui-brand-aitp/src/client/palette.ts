/**
 * aitp-agent presentation tokens: warm neutral surfaces, a restrained forest
 * accent and the reading face used for scientific prose. They form one theme
 * override layer, so the user's light/dark/system preference still decides
 * which value of each pair applies.
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Serif reading stack for notes and source passages; installed faces win in order, ending in the generic family. */
export const READING_FONT_STACK = '"Source Serif 4", "Source Serif Pro", Charter, "Bitstream Charter", "Iowan Old Style", '
  + '"Palatino Linotype", "TeX Gyre Pagella", Georgia, "Noto Serif CJK SC", serif'

/**
 * Alias overrides for both color schemes. Text pairs keep at least 4.5:1
 * against the surfaces they sit on; the accent keeps 4.5:1 on the base
 * surface so it can carry links and primary-button fills.
 */
export const AITP_PALETTE: ThemeTokenOverrides = {
  '--dsw-alias-bg-base': { light: '#fbfaf6', dark: '#1e2421' },
  '--dsw-specific-sidebar-fill': { light: '#f3f2ec', dark: '#1a1f1c' },
  '--dsw-alias-bg-layer-1': { light: '#fffefb', dark: '#242b27' },
  '--dsw-alias-bg-layer-2': { light: '#f5f4ee', dark: '#2a322d' },
  '--dsw-alias-button-elevated-fill': { light: '#fffefb', dark: '#2c3530' },
  '--dsw-alias-border-l1': { light: '#e7e5dc', dark: '#323b36' },
  '--dsw-alias-border-l2': { light: '#dcd9cf', dark: '#3f4a43' },
  '--dsw-alias-brand-primary': { light: '#346b59', dark: '#a4c799' },
  '--dsw-alias-link': { light: '#2e6352', dark: '#b3d2a8' },
  '--dsw-alias-state-business-primary': { light: '#346b59', dark: '#a4c799' },
  '--dsw-alias-state-business-tertiary': { light: '#e3eee9', dark: '#2c3a31' },
  '--dsw-alias-label-primary': { light: '#1f2421', dark: '#e4e9e5' },
  '--dsw-alias-label-secondary': { light: '#4b524d', dark: '#bcc5bf' },
  '--aitp-font-reading': { light: READING_FONT_STACK, dark: READING_FONT_STACK },
  /** Rule color of provisional agent items, distinct from the researcher accent. */
  '--aitp-agent-attribution': { light: '#6a4f9a', dark: '#b9a8ec' },
}
