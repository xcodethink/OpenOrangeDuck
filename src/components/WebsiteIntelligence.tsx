import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Bookmark,
  WebsiteIntelligence as WebsiteIntelligenceType,
  TrustScore,
  DomainInfo,
  SafeBrowsingResult,
  CloudflareRadarResult,
  ThreatSource,
  HomographResult,
  BrandImpersonationResult,
} from '../types';
import { bookmarkService } from '../services/database';
import { domainIntelligenceService } from '../services/domainIntelligence';
import { storageService } from '../services/storage';
import { detectHomographAttack } from '../utils/homographDetection';
import { detectBrandImpersonation, isKnownBrandRegionalDomain } from '../utils/brandImpersonation';
import TranslatableText from './TranslatableText';
import {
  Globe,
  Building2,
  Calendar,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Tag,
  FileText,
  Bot,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Lock,
  Server,
  Clock,
  RefreshCw,
  WandSparkles,
} from 'lucide-react';

interface WebsiteIntelligenceProps {
  bookmark: Bookmark;
  isPremium?: boolean;
}

// Extract domain info from URL
function extractDomainInfo(url: string): { domain: string; protocol: string; hostname: string } {
  try {
    const parsed = new URL(url);
    return {
      domain: parsed.hostname.replace(/^www\./, ''),
      protocol: parsed.protocol,
      hostname: parsed.hostname,
    };
  } catch {
    return { domain: '', protocol: '', hostname: '' };
  }
}

// Format domain age from registration date
function formatDomainAge(createdDate: string): string {
  const created = new Date(createdDate);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(
    (diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)
  );

  if (years > 0) {
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }
  return months > 0 ? `${months}m` : '< 1m';
}

// Calculate trust score with real data
function calculateTrustScore(
  bookmark: Bookmark,
  domainInfo?: DomainInfo,
  safeBrowsing?: SafeBrowsingResult,
  cloudflare?: CloudflareRadarResult,
  threatSources?: ThreatSource[],
  homograph?: HomographResult,
  brandImpersonation?: BrandImpersonationResult,
): TrustScore {
  const factors: TrustScore['factors'] = [];
  let score = 50;
  let dataPointCount = 0; // Track real data points for sufficiency check

  const { domain, protocol } = extractDomainInfo(bookmark.url);

  // 1. Safe Browsing result (highest impact)
  if (safeBrowsing) {
    dataPointCount++;
    if (safeBrowsing.safe) {
      score += 20;
      factors.push({
        name: 'Safe Browsing',
        value: 'Clean',
        impact: 'positive',
        description: 'Google Safe Browsing: no threats',
      });
    } else {
      score -= 40;
      factors.push({
        name: 'Safe Browsing',
        value: safeBrowsing.threats.map((t) => t.replace(/_/g, ' ')).join(', '),
        impact: 'negative',
        description: 'Flagged by Google Safe Browsing',
      });
    }
  }

  // 2. HTTPS check
  dataPointCount++;
  if (protocol === 'https:') {
    score += 10;
    factors.push({ name: 'HTTPS', value: 'Enabled', impact: 'positive' });
  } else {
    score -= 20;
    factors.push({
      name: 'HTTPS',
      value: 'Disabled',
      impact: 'negative',
      description: 'Connection is not encrypted',
    });
  }

  // 3. Domain age (from real RDAP data)
  if (domainInfo?.createdDate) {
    dataPointCount++;
    const created = new Date(domainInfo.createdDate);
    const ageYears =
      (Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (ageYears >= 5) {
      score += 15;
      factors.push({
        name: 'Domain Age',
        value: formatDomainAge(domainInfo.createdDate),
        impact: 'positive',
        description: 'Well-established domain',
      });
    } else if (ageYears >= 1) {
      score += 5;
      factors.push({
        name: 'Domain Age',
        value: formatDomainAge(domainInfo.createdDate),
        impact: 'neutral',
      });
    } else {
      score -= 15;
      factors.push({
        name: 'Domain Age',
        value: formatDomainAge(domainInfo.createdDate),
        impact: 'negative',
        description: 'Newly registered domain - higher risk',
      });
    }
  }

  // 4. TLD check
  const suspiciousTLDs = [
    '.xyz', '.top', '.club', '.work', '.click', '.link',
    '.info', '.buzz', '.gq', '.ml', '.tk', '.cf', '.ga',
  ];
  const tld = '.' + (domain.split('.').pop() || '');
  if (suspiciousTLDs.includes(tld)) {
    dataPointCount++;
    score -= 10;
    factors.push({
      name: 'TLD',
      value: tld,
      impact: 'negative',
      description: 'Commonly associated with spam',
    });
  } else {
    factors.push({ name: 'TLD', value: tld, impact: 'neutral' });
  }

  // 5. DNSSEC
  if (domainInfo?.dnssec !== undefined) {
    dataPointCount++;
    if (domainInfo.dnssec) {
      score += 5;
      factors.push({ name: 'DNSSEC', value: 'Enabled', impact: 'positive' });
    } else {
      factors.push({ name: 'DNSSEC', value: 'Disabled', impact: 'neutral' });
    }
  }

  // 6. Domain lock status
  if (domainInfo?.domainStatus && domainInfo.domainStatus.length > 0) {
    dataPointCount++;
    if (domainInfo.domainStatus.some((s) => s.includes('Prohibited'))) {
      score += 5;
      factors.push({
        name: 'Domain Lock',
        value: 'Active',
        impact: 'positive',
        description: 'Transfer/update protections active',
      });
    }
  }

  // 7. Cloudflare Radar signals
  if (cloudflare) {
    dataPointCount++;
    if (cloudflare.malicious) {
      score -= 30;
      factors.push({
        name: 'Cloudflare Radar',
        value: 'Malicious',
        impact: 'negative',
        description: 'Flagged as malware/botnet by Cloudflare',
      });
    } else if (cloudflare.phishing) {
      score -= 30;
      factors.push({
        name: 'Cloudflare Radar',
        value: 'Phishing',
        impact: 'negative',
        description: 'Flagged as phishing by Cloudflare',
      });
    } else {
      score += 5;
      factors.push({
        name: 'Cloudflare Radar',
        value: 'Clean',
        impact: 'positive',
        description: 'No risks flagged by Cloudflare',
      });
    }

    // Domain rank bonus (well-known sites)
    if (cloudflare.domainRank !== null && cloudflare.domainRank <= 10000) {
      score += 10;
      factors.push({
        name: 'Global Rank',
        value: `#${cloudflare.domainRank.toLocaleString()}`,
        impact: 'positive',
        description: 'Well-known popular domain',
      });
    }
  }

  // 8. Backend threat sources (PhishTank, URLhaus, Certificate Transparency)
  if (threatSources && threatSources.length > 0) {
    for (const ts of threatSources) {
      if (ts.confidence === 0) continue; // Provider failed, skip
      if (ts.source === 'safe_browsing' || ts.source === 'cloudflare_radar') continue; // Already scored above
      dataPointCount++;
      if (!ts.safe) {
        if (ts.source === 'phishtank') {
          score -= 35;
          factors.push({ name: 'PhishTank', value: ts.threats.join(', ') || 'Listed', impact: 'negative', description: 'Known phishing URL' });
        } else if (ts.source === 'urlhaus') {
          score -= 35;
          factors.push({ name: 'URLhaus', value: ts.threats.join(', ') || 'Listed', impact: 'negative', description: 'Malware distribution' });
        } else if (ts.source === 'cert_transparency') {
          score -= 10;
          factors.push({ name: 'Cert Transparency', value: 'Suspicious', impact: 'negative', description: 'Mass certificate issuance' });
        }
      } else {
        if (ts.source === 'phishtank') {
          score += 5;
          factors.push({ name: 'PhishTank', value: 'Not Listed', impact: 'positive' });
        } else if (ts.source === 'urlhaus') {
          factors.push({ name: 'URLhaus', value: 'Not Listed', impact: 'positive' });
        } else if (ts.source === 'cert_transparency') {
          factors.push({ name: 'Cert Transparency', value: 'Normal', impact: 'neutral' });
        }
      }
    }
  }

  // 9. Homograph attack detection (local)
  if (homograph?.isHomograph) {
    dataPointCount++;
    score -= 25;
    factors.push({
      name: 'Homograph',
      value: homograph.confusableWith || 'Mixed Scripts',
      impact: 'negative',
      description: homograph.mixedScripts ? 'Mixed Unicode scripts' : 'Punycode with confusable chars',
    });
  }

  // 10. Brand impersonation detection (local)
  if (brandImpersonation?.isSuspicious) {
    dataPointCount++;
    score -= 20;
    factors.push({
      name: 'Brand Impersonation',
      value: brandImpersonation.matchedBrand || 'Suspicious',
      impact: 'negative',
      description: brandImpersonation.reason === 'subdomain_spoof' ? 'Subdomain spoofing' : 'Lookalike domain',
    });
  }

  // 11. Known brand regional domain bonus (e.g., hsbc.com.vn is official HSBC Vietnam)
  if (!brandImpersonation?.isSuspicious) {
    const brandRegional = isKnownBrandRegionalDomain(domain);
    if (brandRegional.isBrandRegional) {
      dataPointCount++;
      score += 15;
      factors.push({
        name: 'Brand Regional',
        value: brandRegional.matchedBrand || domain,
        impact: 'positive',
        description: 'Official regional site of a known brand',
      });
    }
  }

  score = Math.max(0, Math.min(100, score));

  // Data sufficiency: need at least 3 real data points to show a meaningful score
  if (dataPointCount < 3) {
    return { score, level: 'unknown', factors, insufficientData: true };
  }

  let level: TrustScore['level'] = 'unknown';
  if (score >= 70) level = 'safe';
  else if (score >= 40) level = 'caution';
  else level = 'danger';

  return { score, level, factors };
}

function TrustScoreBadge({ trustScore }: { trustScore: TrustScore }) {
  const { t } = useTranslation();

  if (trustScore.insufficientData) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-500/20">
        <ShieldQuestion className="w-5 h-5 sb-muted" />
        <div>
          <div className="text-sm font-bold sb-muted">{t('intelligence.insufficientData')}</div>
          <div className="text-xs sb-muted">{t('intelligence.needMoreData')}</div>
        </div>
      </div>
    );
  }

  const config = {
    safe: { icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-500/20', label: t('intelligence.safe') },
    caution: { icon: ShieldAlert, color: 'text-orange-400', bg: 'bg-orange-500/20', label: t('intelligence.caution') },
    danger: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20', label: t('intelligence.danger') },
    unknown: { icon: ShieldQuestion, color: 'sb-muted', bg: 'bg-slate-500/20', label: t('intelligence.unknown') },
  };

  const { icon: Icon, color, bg, label } = config[trustScore.level];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <Icon className={`w-5 h-5 ${color}`} />
      <div>
        <div className={`text-sm font-bold ${color}`}>{trustScore.score}/100</div>
        <div className="text-xs sb-muted">{label}</div>
      </div>
    </div>
  );
}

function FactorItem({ factor }: { factor: TrustScore['factors'][0] }) {
  const impactConfig = {
    positive: { icon: CheckCircle, color: 'text-green-400' },
    negative: { icon: XCircle, color: 'text-red-400' },
    neutral: { icon: Info, color: 'sb-muted' },
  };

  const { icon: Icon, color } = impactConfig[factor.impact];

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 min-w-0">
        <span className="text-sm sb-muted">{factor.name}</span>
        {factor.description && (
          <p className="text-xs sb-muted opacity-60 truncate">{factor.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 ml-2">
        <span className="text-sm sb-secondary">{factor.value}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
      <Icon className="w-5 h-5 sb-muted" />
      <div>
        <p className="text-xs sb-muted">{label}</p>
        <p className="text-sm sb-secondary font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function WebsiteIntelligence({ bookmark }: WebsiteIntelligenceProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [intelligence, setIntelligence] = useState<WebsiteIntelligenceType | null>(null);

  const fetchIntelligence = async (forceRefresh = false) => {
    const { domain } = extractDomainInfo(bookmark.url);

    const metadata = {
      logo: bookmark.favicon,
      title: bookmark.title,
      description: bookmark.summary,
      keywords: bookmark.tags,
    };

    // Clear RDAP cache on force refresh
    if (forceRefresh) {
      try {
        const cacheKey = 'rdap_cache_' + domain;
        await chrome.storage.local.remove(cacheKey);
        domainIntelligenceService.clearCache();
      } catch { /* ok */ }
    }

    // Fetch intelligence data: backend API (Safe Browsing + RDAP + Cloudflare Radar)
    // Falls back to local RDAP if backend is unavailable
    try {
      // Start local RDAP lookup as fallback (always free)
      const rdapPromise = chrome.runtime.sendMessage({
        type: 'LOOKUP_DOMAIN_INTELLIGENCE',
        domain,
      }).catch(() => null);

      // Try backend public endpoint (no auth needed, has D1 cache + Safe Browsing + Cloudflare)
      let safeBrowsingResult: SafeBrowsingResult | undefined;
      let backendDomainInfo: DomainInfo | undefined;
      let cloudflareResult: CloudflareRadarResult | undefined;
      let threatSourcesResult: ThreatSource[] | undefined;

      try {
        const settings = await storageService.getSettings();
        const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/public/domain/intelligence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: bookmark.url }),
        });
        if (response.ok) {
          const result = await response.json() as {
            success: boolean;
            data?: {
              domain: string;
              registrar: string | null;
              createdDate: string | null;
              expiresDate: string | null;
              updatedDate: string | null;
              nameservers: string[];
              domainStatus: string[];
              dnssec: boolean;
              safeBrowsing: { safe: boolean; threats: string[] };
              cloudflare: CloudflareRadarResult | null;
              threatSources?: ThreatSource[];
              cachedAt: string;
            };
          };
          if (result.success && result.data) {
            safeBrowsingResult = result.data.safeBrowsing;
            backendDomainInfo = {
              domain: result.data.domain,
              registrar: result.data.registrar ?? undefined,
              createdDate: result.data.createdDate ?? undefined,
              expiresDate: result.data.expiresDate ?? undefined,
              updatedDate: result.data.updatedDate ?? undefined,
              nameservers: result.data.nameservers,
              domainStatus: result.data.domainStatus,
              dnssec: result.data.dnssec,
            };
            if (result.data.cloudflare) {
              cloudflareResult = result.data.cloudflare;
            }
            if (result.data.threatSources) {
              threatSourcesResult = result.data.threatSources;
            }
          }
        }
      } catch (backendErr) {
        console.debug('Backend intelligence unavailable:', backendErr);
      }

      // Get local RDAP result as fallback
      const rdapResponse = await rdapPromise;
      let domainInfo: DomainInfo = { domain };

      // Prefer backend data (includes Safe Browsing + Cloudflare enrichment), else local RDAP
      if (backendDomainInfo?.registrar || backendDomainInfo?.createdDate) {
        domainInfo = backendDomainInfo;
      } else if (rdapResponse?.success && rdapResponse.data) {
        domainInfo = rdapResponse.data;
      }

      // Run local detections (zero API cost)
      const homographResult = detectHomographAttack(domain);
      const brandResult = detectBrandImpersonation(domain);

      const trustScore = calculateTrustScore(
        bookmark, domainInfo, safeBrowsingResult, cloudflareResult,
        threatSourcesResult, homographResult, brandResult,
      );

      // Write riskLevel back to bookmark for stats filtering
      const riskLevel = trustScore.level === 'danger' ? 'danger' as const
        : trustScore.level === 'caution' ? 'caution' as const
        : 'safe' as const;
      bookmarkService.update(bookmark.id, { riskLevel }).catch(() => {});

      setIntelligence({
        metadata,
        domainInfo,
        trustScore,
        safeBrowsing: safeBrowsingResult,
        cloudflare: cloudflareResult,
        threatSources: threatSourcesResult,
        homograph: homographResult.isHomograph ? homographResult : undefined,
        brandImpersonation: brandResult.isSuspicious ? brandResult : undefined,
        aiSummary: bookmark.summary,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Domain intelligence error:', err);

      // Fallback to local-only analysis on error
      const trustScore = calculateTrustScore(bookmark);
      setIntelligence({
        metadata,
        domainInfo: { domain },
        trustScore,
        aiSummary: bookmark.summary,
        fetchedAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIntelligence().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bookmark.url]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIntelligence(true);
    setRefreshing(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REGENERATE_SUMMARY',
        bookmarkId: bookmark.id,
      });
      if (response?.success) {
        setIntelligence(prev => prev ? {
          ...prev,
          aiSummary: response.summary,
        } : prev);
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <span className="ml-3 sb-muted">{t('intelligence.loading')}</span>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="flex items-center justify-center py-12 sb-muted">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {t('intelligence.loadError')}
      </div>
    );
  }

  const { hostname } = extractDomainInfo(bookmark.url);
  const mainSiteUrl = `https://${hostname}/`;
  const domainInfo = intelligence.domainInfo;

  return (
    <div className="space-y-4">
      {/* Danger Banner - shown when Safe Browsing detects threats */}
      {intelligence.safeBrowsing && !intelligence.safeBrowsing.safe && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">
              {t('intelligence.threatDetected')}
            </p>
            <p className="text-xs text-red-300 mt-1">
              {intelligence.safeBrowsing.threats
                .map((threat) => threat.replace(/_/g, ' ').toLowerCase())
                .join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Site Header */}
      <div className="sb-card rounded-xl p-4">
        <div className="flex items-start gap-4">
          <img
            src={bookmark.favicon}
            alt=""
            className="w-14 h-14 rounded-xl sb-surface"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
            }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold mb-1 truncate">{bookmark.title}</h2>
            <a
              href={mainSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-violet-500 hover:text-violet-400 flex items-center gap-1 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {hostname}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {intelligence.trustScore && (
            <TrustScoreBadge trustScore={intelligence.trustScore} />
          )}
        </div>
      </div>

      {/* Domain Info */}
      <div className="sb-card rounded-xl p-4">
        <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-400" />
          {t('intelligence.domainInfo')}
        </h3>
        <div className="space-y-2">
          <InfoRow icon={Globe} label={t('intelligence.mainDomain')} value={domainInfo?.domain || ''} />
        </div>
      </div>

      {/* Comprehensive Domain Analysis — free for all users (RDAP is public) */}
      <div className="sb-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold sb-secondary flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            {t('intelligence.comprehensiveAnalysis')}
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg sb-surface hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
            title={t('intelligence.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 sb-muted ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="space-y-2">
          {domainInfo?.registrar && (
            <InfoRow icon={Building2} label={t('intelligence.registrar')} value={domainInfo.registrar} />
          )}
          {domainInfo?.createdDate && (
            <InfoRow
              icon={Calendar}
              label={t('intelligence.domainAge')}
              value={`${formatDomainAge(domainInfo.createdDate)} (${new Date(domainInfo.createdDate).toLocaleDateString()})`}
            />
          )}
          {domainInfo?.expiresDate && (
            <InfoRow
              icon={Clock}
              label={t('intelligence.domainExpiry')}
              value={new Date(domainInfo.expiresDate).toLocaleDateString()}
            />
          )}
          {domainInfo?.nameservers && domainInfo.nameservers.length > 0 && (
            <InfoRow
              icon={Server}
              label={t('intelligence.nameservers')}
              value={domainInfo.nameservers.slice(0, 3).join(', ')}
            />
          )}
          {domainInfo?.dnssec !== undefined && (
            <InfoRow
              icon={ShieldCheck}
              label={t('intelligence.dnssec')}
              value={domainInfo.dnssec ? t('intelligence.enabled') : t('intelligence.disabled')}
            />
          )}
          {domainInfo?.domainStatus && domainInfo.domainStatus.length > 0 && (
            <InfoRow
              icon={Lock}
              label={t('intelligence.domainStatus')}
              value={domainInfo.domainStatus.some((s) => s.includes('Prohibited'))
                ? t('intelligence.domainLocked')
                : t('intelligence.domainUnlocked')}
            />
          )}
          {/* Show hint when no RDAP data available */}
          {!domainInfo?.registrar && !domainInfo?.createdDate && (
            <p className="text-xs sb-muted text-center py-2">{t('intelligence.rdapUnavailable')}</p>
          )}
        </div>
      </div>

      {/* Trust Score Analysis — free for all users */}
      {intelligence.trustScore && (
        <div className="sb-card rounded-xl p-4">
          <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            {t('intelligence.trustAnalysis')}
          </h3>
          <div className="divide-y divide-[color:var(--border-secondary)]">
            {intelligence.trustScore.factors.map((factor, idx) => (
              <FactorItem key={idx} factor={factor} />
            ))}
          </div>
        </div>
      )}

      {/* Danger Banners for local detections */}
      {intelligence.homograph && (
        <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-400">{t('intelligence.homographWarning')}</p>
            <p className="text-xs text-orange-300 mt-1">
              {intelligence.homograph.mixedScripts ? t('intelligence.mixedScripts') : t('intelligence.homographWarning')}
              {intelligence.homograph.confusableWith && (
                <> &rarr; {intelligence.homograph.confusableWith}</>
              )}
            </p>
          </div>
        </div>
      )}

      {intelligence.brandImpersonation && (
        <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-400">{t('intelligence.brandImpersonation')}</p>
            <p className="text-xs text-orange-300 mt-1">
              {intelligence.brandImpersonation.reason === 'subdomain_spoof'
                ? t('intelligence.subdomainSpoof')
                : t('intelligence.lookalikeDomain')}
              {intelligence.brandImpersonation.matchedBrand && (
                <> &rarr; {intelligence.brandImpersonation.matchedBrand}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Security Sources — Google Safe Browsing + Cloudflare Radar + New Sources */}
      {(intelligence.safeBrowsing || intelligence.cloudflare || (intelligence.threatSources && intelligence.threatSources.length > 0) || intelligence.homograph || intelligence.brandImpersonation) && (
        <div className="sb-card rounded-xl p-4">
          <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            {t('intelligence.securitySources')}
          </h3>
          <div className="space-y-3">
            {/* Google Safe Browsing */}
            {intelligence.safeBrowsing && (
              <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${intelligence.safeBrowsing.safe ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sb-secondary font-medium">{t('intelligence.googleSafeBrowsing')}</p>
                  <p className={`text-xs ${intelligence.safeBrowsing.safe ? 'text-green-400' : 'text-red-400'}`}>
                    {intelligence.safeBrowsing.safe
                      ? t('intelligence.noThreats')
                      : intelligence.safeBrowsing.threats.map(th => th.replace(/_/g, ' ').toLowerCase()).join(', ')}
                  </p>
                </div>
                {intelligence.safeBrowsing.safe
                  ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              </div>
            )}

            {/* Cloudflare Radar */}
            {intelligence.cloudflare && (
              <div className="space-y-2">
                {/* Risk status */}
                <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    intelligence.cloudflare.malicious || intelligence.cloudflare.phishing ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sb-secondary font-medium">{t('intelligence.cloudflareRadar')}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span className={intelligence.cloudflare.malicious ? 'text-red-400' : 'text-green-400'}>
                        {t('intelligence.cfMalicious')}: {intelligence.cloudflare.malicious ? t('intelligence.flagged') : t('intelligence.notFlagged')}
                      </span>
                      <span className={intelligence.cloudflare.phishing ? 'text-red-400' : 'text-green-400'}>
                        {t('intelligence.cfPhishing')}: {intelligence.cloudflare.phishing ? t('intelligence.flagged') : t('intelligence.notFlagged')}
                      </span>
                    </div>
                  </div>
                  {intelligence.cloudflare.malicious || intelligence.cloudflare.phishing
                    ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    : <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
                </div>

                {/* Domain rank */}
                {intelligence.cloudflare.domainRank !== null && (
                  <InfoRow
                    icon={Globe}
                    label={t('intelligence.domainRank')}
                    value={`#${intelligence.cloudflare.domainRank.toLocaleString()}`}
                  />
                )}

                {/* Categories */}
                {(intelligence.cloudflare.categories.length > 0 || intelligence.cloudflare.contentCategories.length > 0) && (
                  <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                    <Tag className="w-5 h-5 sb-muted" />
                    <div>
                      <p className="text-xs sb-muted">{t('intelligence.domainCategories')}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[...new Set([...intelligence.cloudflare.categories, ...intelligence.cloudflare.contentCategories])].map((cat, idx) => (
                          <span key={idx} className="px-2 py-0.5 sb-pill rounded-full text-xs">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PhishTank */}
            {intelligence.threatSources?.find(ts => ts.source === 'phishtank' && ts.confidence > 0) && (() => {
              const ts = intelligence.threatSources!.find(s => s.source === 'phishtank')!;
              return (
                <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ts.safe ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sb-secondary font-medium">{t('intelligence.phishtank')}</p>
                    <p className={`text-xs ${ts.safe ? 'text-green-400' : 'text-red-400'}`}>
                      {ts.safe ? t('intelligence.noThreats') : t('intelligence.knownPhishing')}
                    </p>
                  </div>
                  {ts.safe
                    ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>
              );
            })()}

            {/* URLhaus */}
            {intelligence.threatSources?.find(ts => ts.source === 'urlhaus' && ts.confidence > 0) && (() => {
              const ts = intelligence.threatSources!.find(s => s.source === 'urlhaus')!;
              return (
                <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ts.safe ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sb-secondary font-medium">{t('intelligence.urlhaus')}</p>
                    <p className={`text-xs ${ts.safe ? 'text-green-400' : 'text-red-400'}`}>
                      {ts.safe ? t('intelligence.noThreats') : t('intelligence.malwareDistribution')}
                    </p>
                  </div>
                  {ts.safe
                    ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>
              );
            })()}

            {/* Certificate Transparency */}
            {intelligence.threatSources?.find(ts => ts.source === 'cert_transparency' && ts.confidence > 0) && (() => {
              const ts = intelligence.threatSources!.find(s => s.source === 'cert_transparency')!;
              return (
                <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ts.safe ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sb-secondary font-medium">{t('intelligence.certTransparency')}</p>
                    <p className={`text-xs ${ts.safe ? 'text-green-400' : 'text-yellow-400'}`}>
                      {ts.safe ? t('intelligence.noThreats') : t('intelligence.massIssuance')}
                    </p>
                  </div>
                  {ts.safe
                    ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                </div>
              );
            })()}

            {/* Homograph Detection (local) */}
            {intelligence.homograph && (
              <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sb-secondary font-medium">{t('intelligence.homographWarning')}</p>
                  <p className="text-xs text-orange-400">
                    {intelligence.homograph.mixedScripts ? t('intelligence.mixedScripts') : t('intelligence.homographWarning')}
                    {intelligence.homograph.confusableWith && <> &rarr; {intelligence.homograph.confusableWith}</>}
                  </p>
                </div>
                <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
              </div>
            )}

            {/* Brand Impersonation (local) */}
            {intelligence.brandImpersonation && (
              <div className="flex items-center gap-3 p-3 sb-surface rounded-lg">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sb-secondary font-medium">{t('intelligence.brandImpersonation')}</p>
                  <p className="text-xs text-orange-400">
                    {intelligence.brandImpersonation.reason === 'subdomain_spoof'
                      ? t('intelligence.subdomainSpoof')
                      : t('intelligence.lookalikeDomain')}
                    {intelligence.brandImpersonation.matchedBrand && <> &rarr; {intelligence.brandImpersonation.matchedBrand}</>}
                  </p>
                </div>
                <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keywords / Tags */}
      {intelligence.metadata.keywords && intelligence.metadata.keywords.length > 0 && (
        <div className="sb-card rounded-xl p-4">
          <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-400" />
            {t('intelligence.keywords')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {intelligence.metadata.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 sb-pill rounded-full text-xs font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div className="sb-card rounded-xl p-4">
        <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          {t('intelligence.aiAnalysis')}
        </h3>
        {(intelligence.aiSummary || bookmark.summary) ? (
          <TranslatableText
            text={intelligence.aiSummary || bookmark.summary}
            bookmarkId={bookmark.id}
            field="summary"
            cachedTranslation={bookmark.translations?.summary?.[i18n.language.split('-')[0]]}
            className="text-sm sb-secondary leading-relaxed"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-sm sb-muted">{t('intelligence.noAiSummary')}</p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 rounded-lg hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            >
              {regenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <WandSparkles className="w-3.5 h-3.5" />
              )}
              {regenerating ? t('intelligence.generating') : t('intelligence.generateSummary')}
            </button>
          </div>
        )}
      </div>

      {/* Content Preview */}
      <div className="sb-card rounded-xl p-4">
        <h3 className="text-sm font-semibold sb-secondary mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          {t('intelligence.contentPreview')}
        </h3>
        {bookmark.content.text ? (
          <TranslatableText
            text={bookmark.content.text}
            bookmarkId={bookmark.id}
            field="content"
            cachedTranslation={bookmark.translations?.content?.[i18n.language.split('-')[0]]}
            className="text-sm sb-muted leading-relaxed"
            maxLength={500}
          />
        ) : (
          <p className="text-sm sb-muted">{t('snapshot.noContent')}</p>
        )}
      </div>
    </div>
  );
}
