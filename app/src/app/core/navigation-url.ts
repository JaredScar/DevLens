export function buildSearchUrl(engine: 'google' | 'ddg', query: string): string {
  const q = encodeURIComponent(query.trim());
  if (engine === 'google') return `https://www.google.com/search?q=${q}`;
  return `https://duckduckgo.com/?q=${q}`;
}

/** Turn omnibox input into a navigable URL (https) or search URL. */
export function resolveNavigationInput(raw: string, engine: 'google' | 'ddg'): string {
  const t = raw.trim();
  if (!t) return 'about:blank';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^file:\/\//i.test(t)) return t;
  const asUrl = tryHttpsUrl(t);
  if (asUrl) return asUrl;
  return buildSearchUrl(engine, t);
}

function tryHttpsUrl(hostish: string): string | null {
  const candidate = hostish.includes('://') ? hostish : `https://${hostish}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname || u.hostname.indexOf('.') < 0) return null;
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    return null;
  }
  return null;
}
