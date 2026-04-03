/** Default remote hosts-format block list (Peter Lowe’s list). */
export const DEFAULT_BLOCKLIST_URL =
  'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext';

export function parseHostsFileContent(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^(?:\d{1,3}\.){3}\d{1,3}\s+(\S+)/);
    if (m) {
      const host = m[1].toLowerCase();
      if (host && host !== 'localhost' && !host.startsWith('#')) out.push(host);
      continue;
    }
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(t)) out.push(t.toLowerCase());
  }
  return out;
}

export async function fetchRemoteBlocklist(url: string): Promise<string[]> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Block list HTTP ${res.status}`);
  const text = await res.text();
  return parseHostsFileContent(text);
}
