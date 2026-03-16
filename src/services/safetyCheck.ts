/**
 * Real-time domain safety checking service.
 *
 * Uses the OrangeDuck public quick-check API to evaluate domains
 * during navigation. Results are cached locally to minimize API calls.
 */

// TODO: Replace with your own safety check API endpoint
const API_BASE = 'https://your-api.example.com';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_TIMEOUT_MS = 5000;

// Skip checking for known-safe domains (browser internals, major sites)
const SKIP_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'youtube.com', 'www.youtube.com',
  'facebook.com', 'www.facebook.com',
  'twitter.com', 'www.twitter.com', 'x.com',
  'github.com', 'www.github.com',
  'stackoverflow.com',
  'wikipedia.org', 'en.wikipedia.org',
  'amazon.com', 'www.amazon.com',
  'apple.com', 'www.apple.com',
  'microsoft.com', 'www.microsoft.com',
  'linkedin.com', 'www.linkedin.com',
  'reddit.com', 'www.reddit.com',
  'instagram.com', 'www.instagram.com',
  'netflix.com', 'www.netflix.com',
  // Add your own domain here
  // 'your-site.example.com', 'api.your-site.example.com',
  'localhost',
]);

// Skip internal Chrome URLs and extension pages
const SKIP_PROTOCOLS = new Set(['chrome:', 'chrome-extension:', 'about:', 'data:', 'blob:', 'javascript:', 'file:', 'devtools:']);

export interface SafetyResult {
  domain: string;
  score: number | null;
  riskLevel: 'safe' | 'medium' | 'high' | 'unknown';
  threats: string[];
  summary: string | null;
  cached: boolean;
}

interface CacheEntry {
  result: SafetyResult;
  expiresAt: number;
}

// In-memory cache for the current service worker lifecycle
const cache = new Map<string, CacheEntry>();

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (SKIP_PROTOCOLS.has(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!hostname || hostname === 'newtab' || hostname === 'extensions') return null;
    return hostname;
  } catch {
    return null;
  }
}

function shouldSkip(domain: string): boolean {
  if (SKIP_DOMAINS.has(domain)) return true;
  // Skip IP addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) return true;
  // Skip single-label domains (e.g. "localhost")
  if (!domain.includes('.')) return true;
  return false;
}

function getCached(domain: string): SafetyResult | null {
  const entry = cache.get(domain);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(domain);
    return null;
  }
  return entry.result;
}

function setCache(domain: string, result: SafetyResult): void {
  cache.set(domain, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  // Limit cache size to prevent memory leaks
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/**
 * Check a URL's safety using the OrangeDuck API.
 * Returns null if the URL should be skipped (internal, known-safe, etc.)
 */
export async function checkUrlSafety(url: string): Promise<SafetyResult | null> {
  const domain = extractDomain(url);
  if (!domain || shouldSkip(domain)) return null;

  // Check local cache
  const cached = getCached(domain);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(`${API_BASE}/v1/public/check?domain=${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const json = await response.json() as {
      success: boolean;
      data?: {
        domain: string;
        score: number | null;
        risk_level: 'safe' | 'medium' | 'high' | 'unknown';
        summary: string | null;
        cached: boolean;
        threats?: string[];
      };
    };

    if (!json.success || !json.data) return null;

    const result: SafetyResult = {
      domain: json.data.domain || domain,
      score: json.data.score,
      riskLevel: json.data.risk_level,
      threats: json.data.threats || [],
      summary: json.data.summary,
      cached: json.data.cached,
    };

    setCache(domain, result);
    return result;
  } catch {
    // Network error or timeout — fail open (don't block the user)
    return null;
  }
}

/**
 * Check if a domain is in the user's persistent whitelist.
 * Supports subdomain matching: whitelisting "example.com" also matches "sub.example.com".
 */
export async function isDomainWhitelisted(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get('smartBookmarksSettings', (result) => {
      const settings = result.smartBookmarksSettings || {};
      const whitelist: string[] = settings.whitelistDomains || [];
      const bare = domain.replace(/^www\./, '');
      resolve(whitelist.some(d => {
        const w = d.replace(/^www\./, '');
        return bare === w || bare.endsWith('.' + w);
      }));
    });
  });
}

/**
 * Check if a domain has been bypassed by the user in this session.
 */
export async function isDomainBypassed(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.session.get('orangeduck_bypassed', (result) => {
      const bypassed: string[] = result.orangeduck_bypassed || [];
      resolve(bypassed.includes(domain));
    });
  });
}

/**
 * Determine if a safety result warrants showing a warning.
 */
export function shouldWarn(result: SafetyResult): boolean {
  // Warn on high risk or medium risk with threats
  if (result.riskLevel === 'high') return true;
  if (result.riskLevel === 'medium' && result.threats.length > 0) return true;
  if (result.score !== null && result.score < 30) return true;
  return false;
}

/**
 * Build the warning page URL with threat info as query params.
 */
export function buildWarningUrl(url: string, result: SafetyResult): string {
  const warningPage = chrome.runtime.getURL('src/warning/index.html');
  const params = new URLSearchParams({
    domain: result.domain,
    url,
    score: String(result.score ?? 0),
    risk: result.riskLevel,
    threats: result.threats.join(','),
    summary: result.summary || '',
  });
  return `${warningPage}?${params.toString()}`;
}
