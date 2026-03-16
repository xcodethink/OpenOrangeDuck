// URL normalization utilities

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'ref',
  'from',
  'share',
  'source',
  'via',
  '_ga',
  'mc_cid',
  'mc_eid',
];

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => {
      parsed.searchParams.delete(param);
    });

    // Normalize protocol to https
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }

    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';

    // Remove default ports
    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = '';
    }

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove www. prefix for consistency
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    // Sort search params for consistency
    parsed.searchParams.sort();

    // Remove hash
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return url;
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function extractFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely check if a URL is safe to navigate to.
 * Prevents javascript:, data:, and other dangerous protocols.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Safely open a URL in a new tab.
 * Validates the URL before opening to prevent XSS via javascript: protocol.
 */
export function safeOpenUrl(url: string): void {
  if (isSafeUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    console.warn('Blocked attempt to open unsafe URL:', url.substring(0, 50));
  }
}
