/** Minimal safe markdown for note previews (escape-first, no raw HTML). */
export function renderSimpleMarkdown(source: string): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let t = esc(source);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(
    /\[([^\]]+)]\((https?:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  t = t.replace(/\n/g, '<br />');
  return t;
}
