/**
 * ScamLens Risk Badge for Block Explorers
 *
 * Injects a risk score badge next to wallet addresses on:
 * - Etherscan (etherscan.io + all chain variants)
 * - Tronscan (tronscan.org)
 * - BscScan, Polygonscan, Arbiscan, etc.
 *
 * Shows ScamLens risk level (Clean/Low/Medium/High/Critical) directly
 * on the explorer page so users can assess risk without leaving the site.
 */

const API_BASE = 'https://api.scamlens.org';

// ─── Explorer Detection ─────────────────────────────

interface ExplorerConfig {
  chain: string;
  addressSelector: string; // CSS selector for address elements
  titleSelector: string;   // Where to inject the main badge
}

function detectExplorer(): ExplorerConfig | null {
  const host = window.location.hostname;

  // Etherscan and forks
  if (host.includes('etherscan.io')) return { chain: '1', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('bscscan.com')) return { chain: '56', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('polygonscan.com')) return { chain: '137', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('arbiscan.io')) return { chain: '42161', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('optimistic.etherscan.io')) return { chain: '10', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('basescan.org')) return { chain: '8453', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('snowscan.xyz') || host.includes('snowtrace.io')) return { chain: '43114', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };
  if (host.includes('ftmscan.com')) return { chain: '250', addressSelector: '[data-highlight-target]', titleSelector: '#mainaddress, .hash-tag' };

  // Tronscan
  if (host.includes('tronscan.org')) return { chain: 'tron', addressSelector: '.address-text, .copy-address', titleSelector: '.address-wrap h1, .address-header' };

  return null;
}

// ─── Address Extraction ─────────────────────────────

function extractAddressFromUrl(): string | null {
  const path = window.location.pathname;

  // Etherscan: /address/0x...
  const ethMatch = path.match(/\/address\/(0x[0-9a-fA-F]{40})/);
  if (ethMatch) return ethMatch[1].toLowerCase();

  // Tronscan: /#/address/T...
  const tronMatch = (window.location.hash || path).match(/address\/(T[1-9A-HJ-NP-Za-km-z]{33})/);
  if (tronMatch) return tronMatch[1];

  return null;
}

// ─── Risk Score API ─────────────────────────────────

interface RiskResponse {
  success: boolean;
  riskScore: number;
  riskLevel: string;
  walletType: string;
  labels: string[];
}

const riskCache = new Map<string, RiskResponse>();

async function fetchRiskScore(address: string, chain: string): Promise<RiskResponse | null> {
  const cacheKey = `${chain}:${address}`;
  if (riskCache.has(cacheKey)) return riskCache.get(cacheKey)!;

  try {
    const res = await fetch(`${API_BASE}/v1/public/wallet/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json() as RiskResponse;
    if (data.success) {
      riskCache.set(cacheKey, data);
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Badge Rendering ────────────────────────────────

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  clean: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  low: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  high: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
};

const RISK_LABELS: Record<string, string> = {
  clean: 'Clean',
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

function createBadge(data: RiskResponse): HTMLElement {
  const colors = RISK_COLORS[data.riskLevel] || RISK_COLORS.medium;

  const badge = document.createElement('div');
  badge.id = 'scamlens-risk-badge';
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    margin-left: 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${colors.bg};
    color: ${colors.text};
    border: 1px solid ${colors.border};
    cursor: pointer;
    vertical-align: middle;
    line-height: 1.4;
    transition: opacity 0.2s;
  `;

  // Score circle
  const scoreEl = document.createElement('span');
  scoreEl.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    background: ${colors.text};
    color: white;
  `;
  scoreEl.textContent = String(data.riskScore);

  // Label
  const labelEl = document.createElement('span');
  labelEl.textContent = `${RISK_LABELS[data.riskLevel] || data.riskLevel}`;

  // Type
  const typeEl = document.createElement('span');
  typeEl.style.cssText = `font-weight: 400; opacity: 0.7; font-size: 11px;`;
  if (data.walletType && data.walletType !== 'unknown') {
    typeEl.textContent = `· ${data.walletType}`;
  }

  // ScamLens brand
  const brandEl = document.createElement('span');
  brandEl.style.cssText = `font-size: 10px; opacity: 0.5; margin-left: 4px;`;
  brandEl.textContent = 'ScamLens';

  badge.appendChild(scoreEl);
  badge.appendChild(labelEl);
  if (typeEl.textContent) badge.appendChild(typeEl);
  badge.appendChild(brandEl);

  // Click → open ScamLens report
  badge.addEventListener('click', () => {
    window.open(`https://scamlens.org/en/report/crypto/${encodeURIComponent(data.riskScore > 0 ? extractAddressFromUrl() || '' : '')}`, '_blank');
  });

  badge.addEventListener('mouseenter', () => { badge.style.opacity = '0.85'; });
  badge.addEventListener('mouseleave', () => { badge.style.opacity = '1'; });

  return badge;
}

function createLoadingBadge(): HTMLElement {
  const badge = document.createElement('span');
  badge.id = 'scamlens-risk-badge';
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    margin-left: 8px;
    border-radius: 6px;
    font-size: 11px;
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    vertical-align: middle;
  `;
  badge.innerHTML = `<span style="animation: pulse 1.5s infinite; opacity: 0.6;">⏳</span> ScamLens checking...`;
  return badge;
}

// ─── Injection Logic ────────────────────────────────

async function injectRiskBadge(): Promise<void> {
  const config = detectExplorer();
  if (!config) return;

  const address = extractAddressFromUrl();
  if (!address) return;

  // Don't inject twice
  if (document.getElementById('scamlens-risk-badge')) return;

  // Find injection target
  const target = document.querySelector(config.titleSelector);
  if (!target) return;

  // Show loading state
  const loadingBadge = createLoadingBadge();
  target.appendChild(loadingBadge);

  // Fetch risk score
  const data = await fetchRiskScore(address, config.chain);

  // Replace loading with result
  loadingBadge.remove();
  if (data) {
    const badge = createBadge(data);
    target.appendChild(badge);
  }
}

// ─── Initialization ─────────────────────────────────

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => injectRiskBadge());
} else {
  injectRiskBadge();
}

// Also watch for SPA navigation (Tronscan is a SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Remove old badge and re-inject
    document.getElementById('scamlens-risk-badge')?.remove();
    setTimeout(() => injectRiskBadge(), 1000); // Wait for SPA render
  }
});
observer.observe(document.body, { childList: true, subtree: true });
