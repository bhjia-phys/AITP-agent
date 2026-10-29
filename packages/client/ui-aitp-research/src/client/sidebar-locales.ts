/** Copy for the research tree in the host's contextual sidebar. */
export const sidebarEn = {
  'chooseProject': 'Choose project or workspace',
  'navigation': 'Research navigation',
  'topics': 'Topics',
  'topicsAndDiscussions': 'Topics and conversations',
  'allConversations': 'All conversations',
  'newDiscussion': 'New conversation under {title}',
  'conversations': 'Conversations',
  'overview': 'Research map',
  'expand': 'Open topic navigation',
  'showBranches': 'Show branches of {title}',
  'hideBranches': 'Hide branches of {title}',
  'loading': 'Loading topics',
  'noWorkspace': 'Choose or add a Workspace in Conversations',
  'setupRequired': 'Enable this workspace in Research to view its topics.',
  'disconnected': 'Research data is not connected',
  'failed': 'Topics could not be loaded',
  'stale': 'Showing the last topics read',
  'fixture': 'Example project',
  'empty': 'No topics yet',
  'partial': 'Only part of the topic list is available',
  'otherTopics': 'Other loaded topics',
  'more': 'Load more topics',
  'moreFailed': 'More topics could not be loaded; the previous topics remain available',
  'expired': 'The topic list changed; read it again to continue',
  'retry': 'Read topics again',
} as const

/** Typed dictionary keys for the contextual research sidebar. */
export type WorkspaceSidebarKey = keyof typeof sidebarEn

/** Chinese counterpart of the contextual sidebar copy. */
export const sidebarZh: Record<WorkspaceSidebarKey, string> = {
  'chooseProject': '选择项目或工作区',
  'navigation': '科研导航',
  'topics': '课题',
  'topicsAndDiscussions': '课题与会话',
  'allConversations': '所有会话',
  'newDiscussion': '在“{title}”下新建会话',
  'conversations': '对话',
  'overview': '研究地图',
  'expand': '展开课题导航',
  'showBranches': '展开“{title}”的分支',
  'hideBranches': '收起“{title}”的分支',
  'loading': '正在读取课题',
  'noWorkspace': '请在对话侧栏选择或添加工作区',
  'setupRequired': '在研究面板启用此工作区后，即可查看课题',
  'disconnected': '尚未连接科研数据',
  'failed': '无法读取课题',
  'stale': '正在显示上次读取的课题',
  'fixture': '示例项目',
  'empty': '暂无课题',
  'partial': '目前仅能显示部分课题',
  'otherTopics': '其他已读取课题',
  'more': '加载更多课题',
  'moreFailed': '无法继续读取课题，已读取的课题仍可查看',
  'expired': '课题列表已变化，请重新读取后继续',
  'retry': '重新读取课题',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tree navigation in the sidebar's selected-panel browser. */
    'aitp.research.sidebar': WorkspaceSidebarKey
  }
}
