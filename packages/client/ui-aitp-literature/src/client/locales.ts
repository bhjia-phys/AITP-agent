/** Locale-owned literature library navigation and source field labels. */
export const en = {
  'title': 'Literature library',
  'description': 'Browse connected papers, exact editions and source reading notes. Open the source or select it for a question.',
  'authors': 'Authors',
  'year': 'Year',
  'edition': 'Edition',
  'format': 'Format',
  'depth': 'Reading coverage',
  'collection': 'Literature collection',
  'selection': 'Select for a question',
  'paper': 'Paper',
  'readingNote': 'Reading note',
  'select': 'Use “{title}” for this question',
  'notRecorded': 'Not recorded',
  'bibliographyMissing': 'Author and publication year are not recorded',
  'doi': 'DOI',
  'arxiv': 'arXiv',
} as const

/** Domain dictionary keys supplied to the shared library view. */
export type LibraryKey = keyof typeof en

/** Chinese copy, checked against the English dictionary keys. */
export const zh: Record<LibraryKey, string> = {
  'title': '文献库',
  'description': '总览已连接的论文、具体版本与精读笔记，打开原文，或选为本次提问的来源。',
  'authors': '作者',
  'year': '年份',
  'edition': '版本',
  'format': '格式',
  'depth': '阅读覆盖',
  'collection': '文献馆藏',
  'selection': '选为提问来源',
  'paper': '文献',
  'readingNote': '阅读笔记',
  'select': '将“{title}”用于本次提问',
  'notRecorded': '未记录',
  'bibliographyMissing': '尚未记录作者和发表年份',
  'doi': 'DOI',
  'arxiv': 'arXiv',
}
