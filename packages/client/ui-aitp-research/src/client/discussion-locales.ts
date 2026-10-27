/** Copy for the shared reading-side conversation. */
export const discussionEn = {
  backToLibrary: 'Back to library',
  listFailed: 'Could not load discussions. Refresh the project to try again.',
  sourceNumber: 'Source {number}', page: 'Page {page}', lines: 'Lines {start}–{end}',
  title: 'Discussion', project: 'This project', topic: 'This direction', unnamed: 'New discussion',
  choose: 'Discussions in this direction', new: 'New', expand: 'Expand', restore: 'Restore', close: 'Back to reading',
  actions: 'Discussion actions', rename: 'Rename', renameTitle: 'Rename discussion', name: 'Discussion name',
  cancel: 'Cancel', closeDialog: 'Close dialog',
  loading: 'Opening discussion…', retry: 'Try again', empty: 'No discussions yet',
  sources: 'Sources for the next question', topicOnly: 'Current direction and its research notes',
  material: 'Current material', selected: '{count} selected sources', quote: 'Selected passage',
  clear: 'Use direction only', draft: 'Not sent yet', partial: 'Some older discussions may not be listed.',
  unavailable: 'Could not open this source in the reading area.',
  studyUnavailable: 'The source library is not connected. Your question has not been sent.',
  draftPreserved: 'Your existing draft was kept. Send or clear it before starting the suggested question.',
  changed: 'This discussion belongs to another research direction.',
} as const

export const discussionZh: Record<keyof typeof discussionEn, string> = {
  backToLibrary: '返回资料列表',
  listFailed: '未能读取会话列表，请刷新项目后重试',
  sourceNumber: '资料 {number}', page: '第 {page} 页', lines: '第 {start}–{end} 行',
  title: '讨论', project: '当前项目', topic: '当前方向', unnamed: '新讨论',
  choose: '这个方向的讨论', new: '新建', expand: '展开', restore: '还原', close: '返回阅读',
  actions: '讨论操作', rename: '重命名', renameTitle: '重命名讨论', name: '讨论名称',
  cancel: '取消', closeDialog: '关闭弹窗',
  loading: '正在打开讨论…', retry: '重试', empty: '还没有讨论',
  sources: '下一问使用的资料', topicOnly: '当前方向及其研究记录',
  material: '当前材料', selected: '已选 {count} 份资料', quote: '选中的段落',
  clear: '只使用当前方向', draft: '尚未发送', partial: '部分较早的讨论可能未列出。',
  unavailable: '暂时无法在阅读区打开这份资料。',
  studyUnavailable: '资料库尚未连接，问题还没有发送。',
  draftPreserved: '已保留你正在写的草稿。请先发送或清空草稿，再开始建议的问题。',
  changed: '这段讨论属于另一个研究方向。',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'aitp.research.discussion': keyof typeof discussionEn
  }
}
