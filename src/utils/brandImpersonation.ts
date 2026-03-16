import type { BrandImpersonationResult } from '../types/threatTypes';

// Top brand domains for impersonation detection
const BRAND_DOMAINS: string[] = [
  // Tech
  'google.com', 'facebook.com', 'apple.com', 'amazon.com', 'microsoft.com',
  'netflix.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'github.com',
  'dropbox.com', 'zoom.us', 'slack.com', 'adobe.com', 'salesforce.com',
  'telegram.org', 'whatsapp.com', 'tiktok.com', 'youtube.com', 'reddit.com',
  'pinterest.com', 'snapchat.com', 'spotify.com', 'discord.com', 'twitch.tv',
  'wordpress.com', 'shopify.com', 'cloudflare.com', 'digitalocean.com',
  // Finance
  'paypal.com', 'stripe.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com',
  'citibank.com', 'hsbc.com', 'barclays.com', 'goldmansachs.com', 'jpmorgan.com',
  'visa.com', 'mastercard.com', 'americanexpress.com', 'capitalone.com',
  'schwab.com', 'fidelity.com', 'vanguard.com', 'robinhood.com', 'coinbase.com',
  'binance.com', 'kraken.com',
  // E-commerce
  'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'aliexpress.com',
  'alibaba.com', 'etsy.com', 'wish.com',
  // Email / Productivity
  'outlook.com', 'icloud.com', 'protonmail.com', 'office.com',
  // Crypto
  'blockchain.com', 'metamask.io', 'opensea.io', 'uniswap.org',
  // Government / Services
  'irs.gov', 'usps.com', 'fedex.com', 'ups.com', 'dhl.com',
  // Asia-Pacific
  'ocbc.com', 'dbs.com', 'uob.com', 'grab.com', 'shopee.com',
  'lazada.com', 'gojek.com', 'tokopedia.com', 'traveloka.com',
  'samsung.com', 'sony.com', 'nintendo.com',
  // Vietnam specific
  'vietcombank.com.vn', 'techcombank.com.vn', 'mbbank.com.vn',
  'tpbank.com.vn', 'vpbank.com.vn', 'bidv.com.vn',
  'momo.vn', 'zalopay.vn', 'vnpay.vn',
];

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

// Common second-level domain patterns used with country-code TLDs
const CC_SLD_PATTERNS = ['com', 'co', 'org', 'net', 'gov', 'edu', 'ac', 'go', 'or', 'ne', 'biz'];

/**
 * Check if domain is a legitimate regional variant of a brand.
 * E.g., hsbc.com.vn, amazon.co.uk, google.de are all legitimate.
 */
function isRegionalBrandDomain(domain: string, brand: string): boolean {
  const brandName = brand.split('.')[0]; // e.g., 'hsbc' from 'hsbc.com'
  const parts = domain.split('.');

  // Domain must start with the exact brand name
  if (parts[0] !== brandName) return false;

  const rest = parts.slice(1); // everything after the brand name

  // Pattern: brand.{ccTLD} (e.g., hsbc.vn, google.de)
  if (rest.length === 1 && rest[0].length === 2) return true;

  // Pattern: brand.{sld}.{ccTLD} (e.g., hsbc.com.vn, amazon.co.uk, google.com.br)
  if (rest.length === 2 && CC_SLD_PATTERNS.includes(rest[0]) && rest[1].length <= 3) return true;

  return false;
}

/**
 * Check if domain is a legitimate regional variant of a known brand.
 * E.g., hsbc.com.vn → true (regional HSBC), paypal-login.com → false
 */
export function isKnownBrandRegionalDomain(domain: string): { isBrandRegional: boolean; matchedBrand?: string } {
  for (const brand of BRAND_DOMAINS) {
    if (isRegionalBrandDomain(domain, brand)) {
      return { isBrandRegional: true, matchedBrand: brand };
    }
  }
  return { isBrandRegional: false };
}

export function detectBrandImpersonation(domain: string): BrandImpersonationResult {
  // Extract base domain (remove TLD)
  const parts = domain.split('.');
  const domainBase = parts.length >= 2 ? parts.slice(0, -1).join('.') : domain;

  // 1. Subdomain spoofing: "paypal.com.evil.xyz" pattern
  for (const brand of BRAND_DOMAINS) {
    const brandName = brand.split('.')[0];
    // Check if the domain contains the brand name but is NOT the actual brand
    if (domain.includes(brandName + '.') && !domain.endsWith(brand)) {
      // Skip if this is a legitimate regional variant (e.g., hsbc.com.vn for hsbc.com)
      if (isRegionalBrandDomain(domain, brand)) continue;
      return {
        isSuspicious: true,
        matchedBrand: brand,
        reason: 'subdomain_spoof',
        similarity: 0.8,
      };
    }
  }

  // 2. Levenshtein distance check (domain name similarity)
  for (const brand of BRAND_DOMAINS) {
    const brandBase = brand.split('.')[0];
    // Only compare if lengths are similar (avoid false positives on very short names)
    if (Math.abs(domainBase.length - brandBase.length) > 3) continue;
    if (domainBase.length < 4) continue;

    const dist = levenshteinDistance(domainBase, brandBase);
    const maxLen = Math.max(domainBase.length, brandBase.length);
    const similarity = 1 - (dist / maxLen);

    // High similarity but not exact match → suspicious
    if (similarity >= 0.8 && domainBase !== brandBase) {
      return {
        isSuspicious: true,
        matchedBrand: brand,
        reason: 'levenshtein',
        similarity,
      };
    }
  }

  return { isSuspicious: false };
}
