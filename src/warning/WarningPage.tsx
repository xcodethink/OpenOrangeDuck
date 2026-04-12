import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ThreatInfo {
  domain: string;
  url: string;
  score: number;
  riskLevel: 'high' | 'medium';
  threats: string[];
  summary: string;
}

const THREAT_LABELS: Record<string, string> = {
  SOCIAL_ENGINEERING: 'Social Engineering',
  MALWARE: 'Malware',
  UNWANTED_SOFTWARE: 'Unwanted Software',
  PHISHING: 'Phishing',
  SPAM: 'Spam',
  POTENTIALLY_HARMFUL_APPLICATION: 'Harmful Application',
  BLACKLISTED: 'Blacklisted Domain',
  DNS_BLOCKED_MALWARE: 'DNS-Blocked Malware',
  DNSBL_SPAM: 'Spam Domain',
  DNSBL_PHISH: 'Phishing Domain',
  DNSBL_MALWARE: 'Malware Domain',
  DNSBL_BOTNET: 'Botnet Infrastructure',
  PHISHING_DETECTED: 'Phishing Detected',
  MALWARE_DETECTED: 'Malware Detected',
  THREAT_DETECTED: 'Threat Detected',
  suspicious_domain: 'Suspicious Domain',
  malicious: 'Malicious',
  phishing: 'Phishing',
  malware: 'Malware',
  spam: 'Spam',
};

function formatThreat(threat: string): string {
  return THREAT_LABELS[threat] || threat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function WarningPage() {
  const { t } = useTranslation();
  const [threatInfo, setThreatInfo] = useState<ThreatInfo | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [canProceed, setCanProceed] = useState(false);
  const [showWhitelistConfirm, setShowWhitelistConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('domain') || '';
    const url = params.get('url') || '';
    const score = parseInt(params.get('score') || '0', 10);
    const riskLevel = (params.get('risk') || 'high') as 'high' | 'medium';
    const threats = (params.get('threats') || '').split(',').filter(Boolean);
    const summary = params.get('summary') || '';

    setThreatInfo({ domain, url, score, riskLevel, threats, summary });
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanProceed(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleProceed = () => {
    if (!threatInfo?.url || !canProceed) return;
    // Store bypass so we don't warn again for this domain in this session
    chrome.storage.session.get('scamlens_bypassed', (result) => {
      const bypassed: string[] = result.scamlens_bypassed || [];
      if (!bypassed.includes(threatInfo.domain)) {
        bypassed.push(threatInfo.domain);
        chrome.storage.session.set({ scamlens_bypassed: bypassed });
      }
      window.location.href = threatInfo.url;
    });
  };

  const handleReport = () => {
    if (!threatInfo?.domain) return;
    const reportUrl = `https://scamlens.org/en/report?domain=${encodeURIComponent(threatInfo.domain)}`;
    window.open(reportUrl, '_blank', 'noopener,noreferrer');
  };

  const handleViewDetails = () => {
    if (!threatInfo?.domain) return;
    const detailsUrl = `https://scamlens.org/en/report/${encodeURIComponent(threatInfo.domain)}`;
    window.open(detailsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddToWhitelist = () => {
    if (!threatInfo?.domain) return;
    const domain = threatInfo.domain.replace(/^www\./, '');
    chrome.storage.local.get('smartBookmarksSettings', (result) => {
      const settings = result.smartBookmarksSettings || {};
      const whitelist: string[] = settings.whitelistDomains || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.storage.local.set({
          smartBookmarksSettings: { ...settings, whitelistDomains: whitelist },
        }, () => {
          if (threatInfo.url) window.location.href = threatInfo.url;
        });
      } else {
        if (threatInfo.url) window.location.href = threatInfo.url;
      }
    });
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!threatInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent" />
      </div>
    );
  }

  const isHigh = threatInfo.riskLevel === 'high';
  const bgColor = isHigh ? 'from-red-950 to-gray-900' : 'from-amber-950 to-gray-900';
  const accentColor = isHigh ? 'red' : 'amber';
  const iconColor = isHigh ? 'text-red-400' : 'text-amber-400';
  const borderColor = isHigh ? 'border-red-500/30' : 'border-amber-500/30';
  const badgeBg = isHigh ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300';

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgColor} text-white flex items-center justify-center p-6`}>
      <div className="max-w-lg w-full space-y-6">
        {/* Warning Icon */}
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-${accentColor}-500/20 mb-4`}>
            <svg className={`w-12 h-12 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">
            {isHigh
              ? (t('warning.dangerousTitle', 'Dangerous Website Detected'))
              : (t('warning.suspiciousTitle', 'Suspicious Website Detected'))}
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            {t('warning.poweredBy', 'Protected by ScamLens — AI-powered threat intelligence')}
          </p>
        </div>

        {/* Domain Card */}
        <div className={`bg-gray-800/80 rounded-xl border ${borderColor} p-5 space-y-4`}>
          {/* Domain */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">{t('warning.domain', 'Domain')}</label>
            <p className="text-lg font-mono text-white break-all mt-1">{threatInfo.domain}</p>
          </div>

          {/* Trust Score */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 uppercase tracking-wide">{t('warning.trustScore', 'Trust Score')}</label>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isHigh ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${threatInfo.score}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${iconColor}`}>{threatInfo.score}/100</span>
            </div>
          </div>

          {/* Threats */}
          {threatInfo.threats.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{t('warning.threatsDetected', 'Threats Detected')}</label>
              <div className="flex flex-wrap gap-2">
                {threatInfo.threats.map((threat, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${badgeBg} font-medium`}>
                    {formatThreat(threat)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {threatInfo.summary && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">{t('warning.aiAnalysis', 'AI Analysis')}</label>
              <p className="text-sm text-gray-300 leading-relaxed">{threatInfo.summary}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleGoBack}
            className={`w-full py-3 rounded-xl font-semibold text-white ${
              isHigh ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            } transition-colors`}
          >
            {t('warning.goBack', 'Go Back to Safety')}
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleViewDetails}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors"
            >
              {t('warning.viewDetails', 'View Full Report')}
            </button>
            <button
              onClick={handleReport}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors"
            >
              {t('warning.report', 'Report This Site')}
            </button>
          </div>

          {/* Add to whitelist */}
          {!showWhitelistConfirm ? (
            <button
              onClick={() => setShowWhitelistConfirm(true)}
              className="w-full py-2 rounded-xl text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              {t('warning.addToWhitelist', 'Trust This Website')}
            </button>
          ) : (
            <div className="bg-gray-800/80 rounded-xl border border-gray-600 p-4 space-y-3">
              <p className="text-sm text-gray-300">
                {t('warning.addToWhitelistConfirm', 'Are you sure you want to trust {domain}? It will no longer trigger security warnings.').replace('{domain}', threatInfo.domain)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAddToWhitelist}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  {t('warning.confirmWhitelist', 'Yes, Trust It')}
                </button>
                <button
                  onClick={() => setShowWhitelistConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  {t('warning.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleProceed}
            disabled={!canProceed}
            className="w-full py-2 rounded-xl text-xs text-gray-500 hover:text-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {canProceed
              ? t('warning.proceedAnyway', 'I understand the risks — continue to site')
              : t('warning.proceedCountdown', `Continue anyway (${countdown}s)`)}
          </button>
        </div>

        {/* Footer with disable tip */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-600">
            {t('warning.footer', 'ScamLens uses 90+ threat intelligence sources to protect you from phishing, scams, and malware.')}
          </p>
          <p className="text-xs text-gray-600">
            {t('warning.disableTip', 'You can disable real-time protection in')}{' '}
            <button onClick={handleOpenSettings} className="text-violet-400 hover:text-violet-300 underline">
              {t('warning.openSettings', 'extension settings')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
