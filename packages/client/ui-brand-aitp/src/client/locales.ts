/** Locale-owned product identity. */
export const en = { name: 'aitp-agent' } as const

/** Chinese uses the same product name. */
export const zh: Record<keyof typeof en, string> = { name: 'aitp-agent' }
