export interface ThreatCheckResult {
  source: string;
  safe: boolean;
  threats: string[];
  confidence: number;
  details?: Record<string, unknown>;
}

export interface HomographResult {
  isHomograph: boolean;
  isPunycode: boolean;
  mixedScripts: boolean;
  confusableWith?: string;
}

export interface BrandImpersonationResult {
  isSuspicious: boolean;
  matchedBrand?: string;
  reason?: 'levenshtein' | 'subdomain_spoof';
  similarity?: number;
}
