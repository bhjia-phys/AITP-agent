/** User-facing diagnostics owned by the research transport adapter. */
export const en = {
  cancelled: 'The research read was cancelled.',
  invalidAddress: 'The research resource address is invalid.',
  disconnected: 'Research data is not connected.',
  unsupported: 'This research operation is not available from the connected provider.',
  readOnly: 'Writing is not enabled for this research root.',
  unknownWrite: 'The connection ended before the save result arrived. Check this operation before retrying.',
  closed: 'The research connection has been closed.',
  updatesEnded: 'Research updates stopped before the connection was released.',
  missingBaseline: 'Research updates arrived without the required fresh-read notification.',
} as const

/** Keys owned by the backend adapter's diagnostics dictionary. */
export type BackendKey = keyof typeof en
/** Locale-bound lookup for adapter messages, without translating host-authored domain diagnostics. */
export type BackendText = (key: BackendKey) => string

/** Chinese diagnostics with the same cancellation, unavailable-source and uncertain-save distinctions as English. */
export const zh: Record<BackendKey, string> = {
  cancelled: '已取消这次科研资料读取。',
  invalidAddress: '科研资料地址无效。',
  disconnected: '尚未连接科研数据。',
  unsupported: '当前数据服务尚不支持此操作。',
  readOnly: '此科研目录尚未启用写入。',
  unknownWrite: '保存结果返回前连接已断开。请先核对这次操作的结果，再决定是否重试。',
  closed: '科研数据连接已关闭。',
  updatesEnded: '科研数据更新连接意外结束。',
  missingBaseline: '数据更新缺少重新读取通知，暂时无法确认当前状态。',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'aitp.backend': BackendKey }
}
