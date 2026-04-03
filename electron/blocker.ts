import type { Session } from 'electron';

/** Curated tracker / ad hosts (always merged with remote list). */
const STATIC_HOSTS: readonly string[] = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'scorecardresearch.com',
  'facebook.net',
  'connect.facebook.net',
  'adservice.google.com',
  'adsafeprotected.com',
  'advertising.com',
  'adnxs.com',
  'amazon-adsystem.com',
  'adsystem.amazon.com',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
  'moatads.com',
  'quantserve.com',
  'quantcast.com',
  'hotjar.com',
  'segment.io',
  'segment.com',
  'optimizely.com',
  'newrelic.com',
  'nr-data.net',
  'clarity.ms',
  'ads-twitter.com',
  'analytics.twitter.com',
  'ads.linkedin.com',
  'px.ads.linkedin.com',
  'snap.licdn.com',
];

const staticSet = new Set(STATIC_HOSTS.map((h) => h.toLowerCase()));
let remoteSet = new Set<string>();
let userBlockSet = new Set<string>();
let allowlistEntries: string[] = [];

/** User / automation extra blocklist (hostnames only, lowercase). */
export function setUserBlockHosts(hosts: string[]): void {
  userBlockSet = new Set(
    Array.from(hosts, (h) => h.toLowerCase().trim()).filter((h) => h.length > 0),
  );
}

export function setTrackerAllowlist(hosts: string[]): void {
  allowlistEntries = hosts.map((h) => h.toLowerCase().trim()).filter(Boolean);
}

export function replaceRemoteBlockHosts(hosts: Iterable<string>): void {
  remoteSet = new Set(Array.from(hosts, (h) => h.toLowerCase().trim()).filter((h) => h.length > 0));
}

function matchesAllowlist(host: string): boolean {
  for (const entry of allowlistEntries) {
    if (host === entry || host.endsWith('.' + entry)) return true;
  }
  return false;
}

/** True if `host` equals a blocked domain or is a subdomain of one in `set`. */
function matchesBlockSet(host: string, set: Set<string>): boolean {
  const h = host.toLowerCase();
  const base = h.startsWith('www.') ? h.slice(4) : h;
  if (set.has(h) || set.has(base)) return true;
  const parts = h.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (set.has(parent)) return true;
  }
  return false;
}

export function isHostBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (matchesAllowlist(host)) return false;
  return (
    matchesBlockSet(host, staticSet) ||
    matchesBlockSet(host, remoteSet) ||
    matchesBlockSet(host, userBlockSet)
  );
}

export type BlockerStats = { blockedSession: number };

export function attachRequestBlocker(
  session: Session,
  isEnabled: () => boolean,
  onBlocked: () => void,
): void {
  session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      if (!isEnabled()) {
        callback({});
        return;
      }
      try {
        const host = new URL(details.url).hostname.toLowerCase();
        if (isHostBlocked(host)) {
          onBlocked();
          callback({ cancel: true });
          return;
        }
      } catch {
        /* ignore bad URLs */
      }
      callback({});
    },
  );
}
