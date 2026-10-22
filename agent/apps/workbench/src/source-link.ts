/** Notes use file-relative links; model citations may use workspace-root paths. */
export function sourceLink(href: string, path: string): { path: string; anchor: string } {
  const head = path.replace(/^\//, '').split('/')[0];
  const workspaceRooted = [head, 'topics', 'knowledge'].some(root => root && href.startsWith(root + '/'));
  const target = new URL(href, 'http://workspace/' + (workspaceRooted ? '' : path));
  const isAbsolute = href.startsWith('/') && !['topics', 'knowledge', head].some(root => root && href.startsWith('/' + root + '/'));
  return { path: decodeURIComponent(target.pathname.slice(isAbsolute ? 0 : 1)), anchor: decodeURIComponent(target.hash.slice(1)) };
}
