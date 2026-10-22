import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import GithubSlugger from 'github-slugger';
import { sourceLink } from './source-link.ts';
import 'katex/dist/katex.min.css';

export default function ResearchMarkdown({ text, path, open }: { text: string; path: string; open(path: string): void }) {
  const slugger = new GithubSlugger();
  return <div className="markdown"><Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml components={{
    a({ href, children }) {
      if (!href) return <span>{children}</span>;
      if (/^https?:\/\//i.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children} ↗</a>;
      if (/^[a-z][a-z\d+.-]*:/i.test(href)) return <span>{children}</span>;
      const target = sourceLink(href, path);
      const file = target.path;
      if (/\.(pdf|png|jpe?g|svg|webp|csv|json)$/i.test(file)) return <a href={'/api/files/raw?path=' + encodeURIComponent(file)} target="_blank" rel="noreferrer">{children}</a>;
      return <a href={'#' + target.anchor} onClick={event => {
        event.preventDefault();
        const anchor = target.anchor ? document.getElementById(target.anchor) : null;
        if (file !== path || !anchor) open(file); else anchor.scrollIntoView();
      }}>{children}</a>;
    },
    h1({ children }) { return <h1 id={slugger.slug(String(children))}>{children}</h1>; },
    h2({ children }) { return <h2 id={slugger.slug(String(children))}>{children}</h2>; },
    h3({ children }) { return <h3 id={slugger.slug(String(children))}>{children}</h3>; },
  }}>{text}</Markdown></div>;
}
