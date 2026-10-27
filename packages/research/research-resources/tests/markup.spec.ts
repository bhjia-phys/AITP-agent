import { describe, expect, it } from 'vitest'
import { markupAttribute, parseSourceFrontmatter, parseSourceMarkup } from '../src/markup.ts'

describe('located source facts for library projections', () => {
  it('records inline and reference images separately from actual knowledge-owner links', () => {
    const text = '# Illustrated note\n\n![中文图](<../figures/图 1.png>)\n\n![Other image][img]\n\n'
      + '| Question | Owner |\n|---|---|\n| ![Icon](icon.svg) Which bound? | [Derivation](note.md) |\n\n'
      + '[img]: ../figures/%E5%9B%BE%201.png\n'
    const document = parseSourceMarkup(text)
    expect(document.links.map(link => [link.label, link.href])).toEqual([['Derivation', 'note.md']])
    expect(document.images.map(link => [link.label, link.href])).toEqual([
      ['中文图', '../figures/图 1.png'], ['Other image', '../figures/%E5%9B%BE%201.png'], ['Icon', 'icon.svg'],
    ])
    expect(document.tables[0]?.rows[0]?.links.map(link => link.href)).toEqual(['note.md'])
    expect(document.tables[0]?.rows[0]?.cells[0]).toBe('Icon Which bound?')
    for (const image of document.images) expect(text.slice(image.start, image.end)).toMatch(/^!\[/u)
  })
  it('separates closed metadata from the original UTF-16 body without hiding invalid or unclosed YAML', () => {
    const text = '\uFEFF---\r\ntitle: 原文\r\ncustom: [一, 二]\r\n...\r\n# Body\r\n'
    const metadata = parseSourceFrontmatter(text)
    expect(metadata?.attributes).toEqual({ title: '原文', custom: ['一', '二'] })
    expect(metadata?.source).toBe('title: 原文\r\ncustom: [一, 二]')
    expect(text.slice(metadata?.bodyOffset)).toBe('# Body\r\n')
    expect(parseSourceFrontmatter('---\n---\n# Body')?.bodyOffset).toBe(8)
    expect(parseSourceFrontmatter('---\ntitle: [broken\n---\n# Body')?.issues).toHaveLength(1)
    expect(parseSourceFrontmatter('---\n- not a mapping\n---\n# Body')?.issues).toHaveLength(1)
    expect(parseSourceFrontmatter('---\ntitle: unclosed\n# Body')).toBeUndefined()
    expect(parseSourceFrontmatter('# Body\n\n---\ntitle: later\n---')).toBeUndefined()
  })

  it('preserves authored metadata and index-row spans without interpreting scientific support', () => {
    const text = '---\r\ntitle: 原有索引\r\naliases: [Geometry, 几何]\r\n---\r\n\r\n# Index\r\n\r\n## Questions\r\n\r\n| Entry | Note | Support |\r\n|---|---|---|\r\n| Which limit applies? | [Owner](../topic/research.md#limit) | provisional; awaiting review |\r\n'
    const document = parseSourceMarkup(text)
    expect(document.title).toBe('原有索引')
    expect(markupAttribute(document, 'aliases')).toBe('Geometry; 几何')
    const row = document.tables[0]?.rows[0]
    expect(row?.cells).toEqual(['Which limit applies?', 'Owner', 'provisional; awaiting review'])
    expect(row?.text).toBe(text.slice(row?.start, row?.end))
    expect(row?.links[0]?.href).toBe('../topic/research.md#limit')
    expect(row?.links[0]?.section).toBe('Questions')
    expect(document.attributes).not.toHaveProperty('support')
  })

  it('keeps reference links and malformed metadata visible without creating facts', () => {
    const document = parseSourceMarkup('---\ntitle: [broken\n---\n# Source\n\n[Exact source][s]\n\n[s]: ./paper.pdf#page=2\n')
    expect(document.title).toBe('Source')
    expect(document.issues).toHaveLength(1)
    expect(document.links[0]?.href).toBe('./paper.pdf#page=2')
    expect(markupAttribute(document, 'title')).toBeUndefined()
  })

  it('retains duplicate and explicit anchors as source locations rather than picking an occurrence', () => {
    const text = '# Root\n\n<a id="legacy"></a>\n<a id="answer"></a>\n## Answer\n\nFirst condition.\n\n## Answer\n\nSecond condition.\n'
    const document = parseSourceMarkup(text)
    expect(document.anchors.filter(anchor => anchor.anchor === 'answer')).toHaveLength(2)
    const explicit = document.anchors.find(anchor => anchor.anchor === 'legacy')
    expect(explicit === undefined ? undefined : text.slice(explicit.start, explicit.end)).toContain('First condition.')
    expect(explicit === undefined ? undefined : text.slice(explicit.start, explicit.end)).not.toContain('Second condition.')
  })
})
