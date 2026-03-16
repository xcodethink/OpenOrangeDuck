import { apiClient } from './apiClient';
import type { DomainInfo, SafeBrowsingResult, CloudflareRadarResult } from '../types';

interface DomainIntelligenceData {
  domain: string;
  registrar: string | null;
  createdDate: string | null;
  expiresDate: string | null;
  updatedDate: string | null;
  nameservers: string[];
  domainStatus: string[];
  dnssec: boolean;
  safeBrowsing: {
    safe: boolean;
    threats: string[];
  };
  cloudflare: CloudflareRadarResult | null;
  cachedAt: string;
}

interface DomainIntelligenceResponse {
  success: boolean;
  data?: DomainIntelligenceData;
  cached?: boolean;
  error?: string;
}

// In-memory session cache to avoid re-fetching within same browser session
const sessionCache = new Map<
  string,
  { data: DomainIntelligenceData; fetchedAt: number }
>();

const SESSION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const domainIntelligenceService = {
  async lookup(url: string): Promise<{
    domainInfo: DomainInfo;
    safeBrowsing: SafeBrowsingResult;
    cloudflare: CloudflareRadarResult | null;
    cachedAt: string;
  }> {
    const domain = extractDomain(url);
    if (!domain) throw new Error('Invalid URL');

    // Check session cache
    const cached = sessionCache.get(domain);
    if (cached && Date.now() - cached.fetchedAt < SESSION_CACHE_TTL) {
      return this.transformResponse(cached.data);
    }

    // Call backend
    const response = await apiClient.post<DomainIntelligenceResponse>(
      '/domain/intelligence',
      { url }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch domain intelligence');
    }

    // Store in session cache
    sessionCache.set(domain, {
      data: response.data,
      fetchedAt: Date.now(),
    });

    return this.transformResponse(response.data);
  },

  transformResponse(data: DomainIntelligenceData) {
    const domainInfo: DomainInfo = {
      domain: data.domain,
      registrar: data.registrar ?? undefined,
      createdDate: data.createdDate ?? undefined,
      expiresDate: data.expiresDate ?? undefined,
      updatedDate: data.updatedDate ?? undefined,
      nameservers: data.nameservers,
      domainStatus: data.domainStatus,
      dnssec: data.dnssec,
    };

    const safeBrowsing: SafeBrowsingResult = {
      safe: data.safeBrowsing.safe,
      threats: data.safeBrowsing.threats,
    };

    return { domainInfo, safeBrowsing, cloudflare: data.cloudflare, cachedAt: data.cachedAt };
  },

  clearCache(): void {
    sessionCache.clear();
  },
};
