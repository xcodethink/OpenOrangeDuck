export type SnapshotLevel = 'L1' | 'L2' | 'L3';
export type BookmarkStatus = 'healthy' | 'dead' | 'checking';

export interface BookmarkContent {
  text: string;           // 纯文本（搜索/AI 用，始终存在）
  html?: string;          // 清理后的文章 HTML（阅读模式，所有级别）
  images?: string[];      // 图片 URL 或 base64 data URI
  screenshot?: string;    // Base64 JPEG 截图（仅 L3）
}

export interface BookmarkSnapshot {
  level: SnapshotLevel;
  size: string;
  createdAt: string;
}

export interface BookmarkSimilarity {
  targetId: string;
  score: number;
  reason?: string;
}

export interface Bookmark {
  id: string;
  url: string;
  normalizedUrl: string;
  canonicalUrl?: string;
  domain: string;              // 主域名 (e.g., "google.com")
  title: string;
  favicon: string;
  summary: string;
  tags: string[];
  content: BookmarkContent;
  snapshot: BookmarkSnapshot;
  status: BookmarkStatus;
  folderId: string;
  similarity?: BookmarkSimilarity;
  createdAt: string;           // 添加时间
  refreshedAt: string;
  lastCheckedAt?: string;      // 系统检测时间
  lastVisitedAt?: string;      // 用户上次访问时间
  riskLevel?: 'safe' | 'caution' | 'danger';  // 域名安全检测结果
  translations?: {
    summary?: Record<string, string>;   // { "zh": "中文摘要", "en": "English summary" }
    content?: Record<string, string>;   // { "zh": "中文内容" }
  };
}

export interface CreateBookmarkInput {
  url: string;
  title: string;
  favicon?: string;
  content: string;
  folderId?: string;
  snapshotLevel?: SnapshotLevel;
}

// Website Intelligence Data
export interface SiteMetadata {
  logo?: string;
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  author?: string;
  language?: string;
}

export interface DomainInfo {
  domain: string;
  registrar?: string;
  createdDate?: string;
  expiresDate?: string;
  updatedDate?: string;
  nameservers?: string[];
  domainStatus?: string[];
  dnssec?: boolean;
  country?: string;
  organization?: string;
}

export interface SafeBrowsingResult {
  safe: boolean;
  threats: string[];
}

export interface CloudflareRadarResult {
  domainRank: number | null;
  categories: string[];
  malicious: boolean;
  phishing: boolean;
  contentCategories: string[];
}

export interface TrustScore {
  score: number;           // 0-100
  level: 'safe' | 'caution' | 'danger' | 'unknown';
  insufficientData?: boolean; // true when fewer than 3 factors have real data
  factors: {
    name: string;
    value: string | number;
    impact: 'positive' | 'negative' | 'neutral';
    description?: string;
  }[];
}

export interface WebsiteIntelligence {
  metadata: SiteMetadata;
  domainInfo?: DomainInfo;
  trustScore?: TrustScore;
  safeBrowsing?: SafeBrowsingResult;
  cloudflare?: CloudflareRadarResult;
  threatSources?: ThreatSource[];
  homograph?: HomographResult;
  brandImpersonation?: BrandImpersonationResult;
  aiSummary?: string;
  fetchedAt: string;
}

// Backend threat source result (from provider registry)
export interface ThreatSource {
  source: string;
  safe: boolean;
  threats: string[];
  confidence: number;
  details?: Record<string, unknown>;
}

// Local homograph detection result
export interface HomographResult {
  isHomograph: boolean;
  isPunycode: boolean;
  mixedScripts: boolean;
  confusableWith?: string;
}

// Local brand impersonation detection result
export interface BrandImpersonationResult {
  isSuspicious: boolean;
  matchedBrand?: string;
  reason?: 'levenshtein' | 'subdomain_spoof';
  similarity?: number;
}
