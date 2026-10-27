/** Saved-operation feedback distinguishes a confirmed publication from a proposal or uncertain result. */
export const changeEn = {
  applied: 'Research record updated', partial: 'Only part of the change was saved', unknown: 'The save result is uncertain',
  'not-applied': 'The change was not saved', prepared: 'Change prepared; not saved', pending: 'Change awaiting a decision',
  applying: 'The save is not yet confirmed', 'no-change': 'No source change was needed',
  inspect: 'View changes', close: 'Hide changes', loading: 'Reading the saved operation…',
  unavailable: 'The operation details are unavailable. The earlier result is shown above.',
  stale: 'The latest receipt could not be read. The previously read receipt is shown below.',
  planned: 'Planned changes; publication is not confirmed', saved: 'Confirmed saved change',
  different: 'The file has changed since this operation. This is the recorded change, not a diff against the current file.',
  currentUnavailable: 'The current file could not be read. The recorded operation remains available.',
  omittedDiff: 'The complete before and after texts exceed the preview limit and were not loaded.',
  limited: 'Preview is incomplete: {files} files, {diffs} file diffs, and {uses} follow-up items were omitted.',
  followUp: 'Still to follow up', copy: 'Copy', copied: 'Copied', code: 'File changes',
  wrap: 'Wrap lines', unwrap: 'Do not wrap lines', collapse: 'Collapse', expand: 'Show {count} more lines',
} as const

/** Chinese copy for research change receipts and their bounded file previews. */
export const changeZh: Record<keyof typeof changeEn, string> = {
  applied: '课题记录已更新', partial: '仅部分修改已保存', unknown: '保存结果尚不确定',
  'not-applied': '修改未保存', prepared: '已拟定修改，尚未保存', pending: '修改有待决策',
  applying: '保存尚未确认完成', 'no-change': '本次无需修改资料',
  inspect: '查看改动', close: '收起改动', loading: '正在读取保存记录…',
  unavailable: '暂时无法读取改动详情，上方显示此前记录的结果。',
  stale: '未能读取最新的操作记录，下面展示此前读取的内容。',
  planned: '计划中的改动，尚未确认写入', saved: '已确认保存的改动',
  different: '文件在这次操作后发生了变化。这里展示当时记录的改动，不是与当前文件的比较。',
  currentUnavailable: '当前文件暂时无法读取，仍可查看当时的操作记录。',
  omittedDiff: '完整的修改前后内容超过预览上限，尚未加载。',
  limited: '预览不完整：省略了 {files} 个文件、{diffs} 份文件差异和 {uses} 项后续事项。',
  followUp: '仍需跟进', copy: '复制', copied: '已复制', code: '文件改动',
  wrap: '自动换行', unwrap: '取消自动换行', collapse: '收起', expand: '展开其余 {count} 行',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'aitp.research.change': keyof typeof changeEn }
}
