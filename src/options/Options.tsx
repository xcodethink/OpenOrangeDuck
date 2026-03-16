import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storageService } from '../services/storage';
import { apiClient } from '../services/apiClient';
import { authService } from '../services/auth';
import { modelService, type ModelInfo } from '../services/models';
import db from '../services/database';
import { applyTheme } from '../utils/theme';
import type { Settings, SnapshotLevel, ApiMode, ApiProvider } from '../types';
import { DEFAULT_SETTINGS, PROVIDER_CONFIGS, SUPPORTED_LANGUAGES } from '../types/settings';
import {
  Rocket,
  Wrench,
  CreditCard,
  Info,
  Key,
  Bot,
  Globe,
  Camera,
  HeartPulse,
  Sparkles,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Shield,
  LogOut,
  User,
  Home,
  Lock,
  Trash2,
} from 'lucide-react';

export default function Options() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Account security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Whitelist state
  const [whitelistInput, setWhitelistInput] = useState('');
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  // API Key verification & model fetching state
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApiKeyVerified, setIsApiKeyVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    (async () => {
      const loaded = await storageService.getSettings();
      setSettings(loaded);
      if (loaded.language) {
        i18n.changeLanguage(loaded.language);
      }
    })();
  }, [i18n]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const handleSave = async () => {
    await storageService.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAllData = async () => {
    const input = window.prompt(t('options.clearAllDataConfirm'));
    if (input !== 'DELETE') return;

    try {
      await db.bookmarks.clear();
      await db.folders.clear();
      await chrome.storage.local.clear();
      window.alert(t('options.clearAllDataSuccess'));
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    if (key === 'language') {
      i18n.changeLanguage(value as string);
    }
  };

  // Whitelist helpers
  const parseDomain = (input: string): string | null => {
    let val = input.trim().toLowerCase();
    // Strip protocol and path
    val = val.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!val || !val.includes('.') || val.includes(' ')) return null;
    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(val)) return null;
    return val;
  };

  const addWhitelistDomain = () => {
    setWhitelistError(null);
    const domain = parseDomain(whitelistInput);
    if (!domain) {
      setWhitelistError(t('options.whitelistInvalid'));
      return;
    }
    if (settings.whitelistDomains.includes(domain)) {
      setWhitelistError(t('options.whitelistExists'));
      return;
    }
    updateSetting('whitelistDomains', [...settings.whitelistDomains, domain]);
    setWhitelistInput('');
  };

  const removeWhitelistDomain = (domain: string) => {
    updateSetting('whitelistDomains', settings.whitelistDomains.filter(d => d !== domain));
  };

  const currentApiKey = settings.apiKeys[settings.apiProvider] || '';
  const currentProviderConfig = PROVIDER_CONFIGS.find(p => p.id === settings.apiProvider);

  // Reset verification state
  const resetVerification = () => {
    setIsApiKeyVerified(false);
    setVerificationError(null);
    setFetchedModels([]);
  };

  const updateApiKey = (value: string) => {
    setSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [prev.apiProvider]: value },
    }));
    // Key changed, need re-verification
    resetVerification();
  };

  const handleProviderChange = (providerId: ApiProvider) => {
    setSettings(prev => ({
      ...prev,
      apiProvider: providerId,
      apiModel: '',
    }));
    resetVerification();
  };

  // User clicks verify button
  const handleVerifyApiKey = async () => {
    const apiKey = settings.apiKeys[settings.apiProvider];
    if (!apiKey) {
      setVerificationError(t('options.apiKeyEmpty'));
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setFetchedModels([]);

    const result = await modelService.fetchModels(
      settings.apiProvider,
      apiKey,
      settings.apiBaseUrl
    );

    setIsVerifying(false);

    if (result.success && result.models.length > 0) {
      setIsApiKeyVerified(true);
      setFetchedModels(result.models);
      // Auto-select first model if none selected
      if (!settings.apiModel) {
        setSettings(prev => ({ ...prev, apiModel: result.models[0].id }));
      }
    } else {
      setIsApiKeyVerified(false);
      // Build helpful error message
      const rawError = result.error || '';
      let errorMsg = t('options.verifyFailed');
      if (rawError.includes('401') || rawError.includes('Unauthorized')) {
        errorMsg = t('options.verifyErrorInvalidKey');
      } else if (rawError.includes('403') || rawError.includes('Forbidden')) {
        errorMsg = t('options.verifyErrorForbidden');
      } else if (rawError.includes('429')) {
        errorMsg = t('options.verifyErrorRateLimit');
      } else if (rawError.includes('BASE_URL_REQUIRED')) {
        errorMsg = t('options.verifyErrorBaseUrl');
      } else if (rawError.includes('fetch') || rawError.includes('network') || rawError.includes('Failed')) {
        errorMsg = t('options.verifyErrorNetwork');
      } else if (rawError) {
        errorMsg = `${t('options.verifyFailed')}: ${rawError}`;
      }
      setVerificationError(errorMsg);
    }
  };

  return (
    <div className="min-h-screen sb-page">
      <div className="max-w-2xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') })}
              className="w-9 h-9 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 flex items-center justify-center transition-colors"
              title={t('options.backToHome')}
            >
              <Home className="w-5 h-5 text-violet-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{t('options.title')}</h1>
              <p className="sb-muted text-sm">{t('options.subtitleGeneric')}</p>
            </div>
          </div>
          {settings.apiMode === 'proxy' ? (
            <button
              onClick={() => updateSetting('apiMode', 'custom' as ApiMode)}
              className="text-xs sb-muted hover:text-violet-400 transition-colors flex items-center gap-1"
            >
              <Wrench className="w-3 h-3" />
              {t('options.useOwnKey')}
            </button>
          ) : (
            <button
              onClick={() => updateSetting('apiMode', 'proxy' as ApiMode)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              <Rocket className="w-3 h-3" />
              {t('options.backToProxy')}
            </button>
          )}
        </div>

        {/* Settings Form */}
        <div className="space-y-6">

          {/* Proxy Mode Settings */}
          {settings.apiMode === 'proxy' && (
            <div className="sb-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-400" />
                {t('options.accountSubscription')}
              </h2>

              {/* User Profile (when logged in) */}
              {settings.userId ? (
                <div className="mb-4 p-3 sb-card rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="font-medium">{settings.userName || settings.userEmail}</div>
                      <div className="text-xs sb-muted">{t('auth.loggedInAs', { email: settings.userEmail })}</div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const { authService } = await import('../services/auth');
                      await authService.logout();
                      const fresh = await storageService.getSettings();
                      setSettings(fresh);
                    }}
                    className="p-2 rounded-lg sb-card-hover text-red-400 hover:text-red-300"
                    title={t('auth.logout')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mb-4 p-3 sb-card rounded-lg">
                  <p className="text-sm sb-muted mb-2">
                    {t('options.firstTime')}
                  </p>
                  <button
                    onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') })}
                    className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-all"
                  >
                    {t('auth.signIn')} / {t('auth.signUp')}
                  </button>
                </div>
              )}

              {/* Plan & Usage Display */}
              <div className="bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm sb-secondary">
                      {t('options.currentPlan')}
                    </div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      {settings.plan === 'power' ? 'Power' : settings.plan === 'pro' ? 'Pro' : 'Free'}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        settings.plan === 'power' ? 'bg-purple-500/30 text-purple-300' :
                        settings.plan === 'pro' ? 'bg-blue-500/30 text-blue-300' :
                        'bg-gray-500/30 text-gray-300'
                      }`}>
                        {settings.plan === 'power' ? t('options.planUnlimited') :
                         settings.plan === 'pro' ? '200 AI/' + t('options.planMonth') :
                         '15 AI/' + t('options.planMonth')}
                      </span>
                    </div>
                  </div>
                  {settings.plan === 'free' && (
                    <button
                      onClick={async () => {
                        if (!settings.userId) {
                          chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') });
                          return;
                        }
                        try {
                          const data = await apiClient.get<{ checkoutUrl: string }>('/checkout/url?product=pro_monthly');
                          chrome.tabs.create({ url: data.checkoutUrl });
                        } catch {
                          window.alert(t('options.upgradeUnavailable'));
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg font-medium hover:from-violet-600 hover:to-fuchsia-600 transition-all text-sm"
                    >
                      {t('options.upgradePlan')}
                    </button>
                  )}
                  {(settings.plan === 'pro' || settings.plan === 'power') && (
                    <button
                      onClick={async () => {
                        try {
                          const data = await apiClient.get<{ portalUrl: string }>('/subscription/portal');
                          chrome.tabs.create({ url: data.portalUrl });
                        } catch {
                          window.alert(t('options.upgradeUnavailable'));
                        }
                      }}
                      className="px-4 py-2 sb-card sb-card-hover rounded-lg text-sm"
                    >
                      {t('options.manageSubscription')}
                    </button>
                  )}
                </div>

                {/* Usage Progress Bar */}
                {settings.plan !== 'power' && (
                  <div>
                    <div className="flex justify-between text-xs sb-muted mb-1">
                      <span>{t('options.usageThisMonth')}</span>
                      <span>
                        {settings.aiUsageThisMonth} / {settings.plan === 'pro' ? 200 : 15}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          settings.aiUsageThisMonth / (settings.plan === 'pro' ? 200 : 15) > 0.9
                            ? 'bg-red-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${Math.min(100, (settings.aiUsageThisMonth / (settings.plan === 'pro' ? 200 : 15)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Plan Features Info */}
              <div className="mt-4 p-3 sb-card rounded-lg">
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 sb-muted" />
                  {t('options.planFeatures')}
                </div>
                <ul className="text-xs sb-muted space-y-1">
                  {settings.plan === 'free' && (
                    <>
                      <li>• 15 {t('options.aiAnalysesPerMonth')}</li>
                      <li>• {t('options.featureBasicScan')}</li>
                      <li>• {t('options.featureCommunity')}</li>
                    </>
                  )}
                  {settings.plan === 'pro' && (
                    <>
                      <li>• 200 {t('options.aiAnalysesPerMonth')}</li>
                      <li>• {t('options.featureCloudSync')}</li>
                      <li>• {t('options.featurePriority')}</li>
                    </>
                  )}
                  {settings.plan === 'power' && (
                    <>
                      <li>• {t('options.featureUnlimitedAI')}</li>
                      <li>• {t('options.featureBYOK')}</li>
                      <li>• {t('options.featureAllPro')}</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Custom API Key Settings */}
          {settings.apiMode === 'custom' && (
            <div className="sb-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key className="w-4 h-4 text-violet-400" />
                {t('options.apiProvider')}
              </h2>

              {/* Provider Selection - Grid Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {PROVIDER_CONFIGS.map((provider) => {
                  const isSelected = settings.apiProvider === provider.id;
                  const hasKey = Boolean(settings.apiKeys[provider.id]);

                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={`relative p-3 rounded-xl text-sm font-medium transition-all border-2 ${
                        isSelected
                          ? 'border-violet-500 bg-violet-500/20'
                          : 'sb-card sb-card-hover border-transparent'
                      }`}
                    >
                      <div className="text-center">
                        <span className={isSelected ? 'text-violet-300' : 'sb-secondary'}>
                          {provider.name}
                        </span>
                      </div>
                      {/* Key status indicator */}
                      {hasKey && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--bg-primary)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* API Key Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm sb-muted mb-2 flex items-center gap-2">
                    <Key className="w-3.5 h-3.5" />
                    {currentProviderConfig?.name} API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={currentApiKey}
                      onChange={(e) => updateApiKey(e.target.value)}
                      placeholder={currentProviderConfig?.keyPlaceholder || 'your-api-key'}
                      className="w-full sb-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 pr-24"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 sb-muted hover:text-[var(--text-primary)] text-sm"
                    >
                      {showApiKey ? t('options.hide') : t('options.show')}
                    </button>
                  </div>
                  {currentProviderConfig?.keyHelpUrl && (
                    <p className="text-xs sb-muted mt-2 flex items-center gap-1">
                      {t('options.getKeyFrom')}
                      <a
                        href={currentProviderConfig.keyHelpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
                      >
                        {currentProviderConfig.keyHelpUrl.replace('https://', '').split('/')[0]}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>

                {/* Base URL for providers that support it */}
                {currentProviderConfig?.supportsBaseUrl && (
                  <div>
                    <label className="block text-sm sb-muted mb-2">
                      {t('options.baseUrl')}
                    </label>
                    <input
                      type="text"
                      value={settings.apiBaseUrl}
                      onChange={(e) => {
                        updateSetting('apiBaseUrl', e.target.value);
                        resetVerification();
                      }}
                      placeholder={t('options.baseUrlPlaceholder')}
                      className="w-full sb-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                )}

                {/* Verify API Key Button */}
                <div>
                  <button
                    onClick={handleVerifyApiKey}
                    disabled={isVerifying || !currentApiKey}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      isApiKeyVerified
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 cursor-default'
                        : !currentApiKey
                        ? 'sb-card sb-muted cursor-not-allowed opacity-50'
                        : 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50 hover:bg-violet-500/30'
                    }`}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('options.verifying')}
                      </>
                    ) : isApiKeyVerified ? (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {t('options.verifySuccess')}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {t('options.verifyApiKey')}
                      </>
                    )}
                  </button>

                  {/* Verification error with troubleshooting */}
                  {verificationError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-start gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>{verificationError}</p>
                          <p className="text-xs sb-muted mt-2">{t('options.verifyTroubleshoot')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model Selection - Only after successful verification */}
                {isApiKeyVerified && fetchedModels.length > 0 && (
                  <div>
                    <label className="text-sm sb-muted mb-2 flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5" />
                      {t('options.model')}
                      <span className="text-xs text-emerald-400">
                        ({fetchedModels.length} {t('options.modelsAvailable')})
                      </span>
                    </label>
                    <select
                      value={settings.apiModel}
                      onChange={(e) => updateSetting('apiModel', e.target.value)}
                      className="w-full sb-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    >
                      {fetchedModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}{model.description ? ` (${model.description})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Capabilities - Only for proxy mode */}
          {settings.apiMode === 'proxy' && (
            <div className="sb-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                {t('options.aiEngine')}
              </h2>
              <div className="p-4 sb-card rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-400">{t('options.aiReady')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['aiSummary', 'aiTags', 'aiClassify', 'aiTranslate'] as const).map((key) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs sb-muted">
                      <Check className="w-3 h-3 text-violet-400 flex-shrink-0" />
                      {t(`options.${key}`)}
                    </div>
                  ))}
                </div>
                <div className="text-xs sb-muted pt-1 border-t border-white/5">
                  {t('options.aiEngineDesc')}
                </div>
              </div>
            </div>
          )}

          {/* Language */}
          <div className="sb-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              {t('options.language')}
            </h2>
            <div className="flex gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => updateSetting('language', lang.value)}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${settings.language === lang.value
                      ? 'bg-violet-500/30 text-violet-300 ring-1 ring-violet-500/50'
                      : 'sb-card sb-card-hover sb-muted'
                    }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default Snapshot Level */}
          <div className="sb-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-violet-400" />
              {t('options.defaultSnapshot')}
            </h2>
            <div className="flex gap-3">
              {[
                { value: 'L1', label: t('snapshot.L1'), desc: '~10KB' },
                { value: 'L2', label: t('snapshot.L2'), desc: '~100KB' },
                { value: 'L3', label: t('snapshot.L3'), desc: '~1MB' },
              ].map((level) => {
                const isSelected = settings.defaultSnapshotLevel === level.value;
                return (
                  <button
                    key={level.value}
                    onClick={() => updateSetting('defaultSnapshotLevel', level.value as SnapshotLevel)}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'bg-violet-500/30 text-violet-300 ring-1 ring-violet-500/50'
                        : 'sb-card sb-card-hover sb-muted'
                    }`}
                  >
                    <span>{level.label}</span>
                    <div className="text-xs mt-1 opacity-60">
                      {level.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Health Check Interval */}
          <div className="sb-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-violet-400" />
              {t('options.healthCheck')}
            </h2>
            <select
              value={settings.healthCheckInterval}
              onChange={(e) => updateSetting('healthCheckInterval', e.target.value as Settings['healthCheckInterval'])}
              className="w-full sb-input px-4 py-3 text-sm focus:outline-none focus:border-violet-500"
            >
              <option value="daily">{t('options.daily')}</option>
              <option value="weekly">{t('options.weekly')}</option>
              <option value="monthly">{t('options.monthly')}</option>
              <option value="never">{t('options.never')}</option>
            </select>
          </div>

          {/* Auto Options */}
          <div className="sb-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              {t('options.autoFeatures')}
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">{t('options.autoSummary')}</span>
                <input
                  type="checkbox"
                  checked={settings.autoSummary}
                  onChange={(e) => updateSetting('autoSummary', e.target.checked)}
                  className="w-5 h-5 rounded sb-input text-violet-500 focus:ring-violet-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">{t('options.autoTags')}</span>
                <input
                  type="checkbox"
                  checked={settings.autoTags}
                  onChange={(e) => updateSetting('autoTags', e.target.checked)}
                  className="w-5 h-5 rounded sb-input text-violet-500 focus:ring-violet-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm">{t('options.autoEmbedding')}</span>
                <input
                  type="checkbox"
                  checked={settings.autoEmbedding}
                  onChange={(e) => updateSetting('autoEmbedding', e.target.checked)}
                  className="w-5 h-5 rounded sb-input text-violet-500 focus:ring-violet-500"
                />
              </label>
            </div>
          </div>

          {/* Security Protection (only when logged in) */}
          {settings.userId && (
            <div className="sb-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                {t('options.securityProtection')}
              </h2>
              <div className="space-y-5">
                {/* Real-time protection toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex-1 mr-4">
                    <span className="text-sm font-medium">{t('options.realtimeProtection')}</span>
                    <p className="text-xs sb-muted mt-0.5">{t('options.realtimeProtectionDesc')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.realtimeProtection}
                    onChange={(e) => updateSetting('realtimeProtection', e.target.checked)}
                    className="w-5 h-5 rounded sb-input text-violet-500 focus:ring-violet-500"
                  />
                </label>

                {/* Whitelist */}
                <div>
                  <h3 className="text-sm font-medium mb-2">{t('options.whitelist')}</h3>
                  <p className="text-xs sb-muted mb-3">{t('options.whitelistDesc')}</p>

                  {/* Add domain input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={whitelistInput}
                      onChange={(e) => { setWhitelistInput(e.target.value); setWhitelistError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') addWhitelistDomain(); }}
                      placeholder={t('options.whitelistPlaceholder')}
                      className="flex-1 sb-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                    <button
                      onClick={addWhitelistDomain}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                    >
                      {t('options.whitelistAdd')}
                    </button>
                  </div>

                  {whitelistError && (
                    <p className="text-xs text-red-400 mb-2">{whitelistError}</p>
                  )}

                  {/* Domain list */}
                  {settings.whitelistDomains.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {settings.whitelistDomains.map((domain) => (
                        <div key={domain} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 group">
                          <span className="text-sm font-mono">{domain}</span>
                          <button
                            onClick={() => removeWhitelistDomain(domain)}
                            className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title={t('options.whitelistRemove')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs sb-muted italic">{t('options.whitelistEmpty')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Account Security (only when logged in) */}
          {settings.userId && (
            <div className="sb-card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-violet-400" />
                {t('options.accountSecurity')}
              </h2>

              {/* Change Password */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-medium sb-secondary">{t('options.changePassword')}</h3>
                {passwordMsg && (
                  <div className={`p-2 rounded-lg text-sm ${passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {passwordMsg.text}
                  </div>
                )}
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('options.currentPassword')}
                  className="w-full sb-input px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('options.newPassword')}
                  className="w-full sb-input px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('options.confirmPassword')}
                  className="w-full sb-input px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <button
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  onClick={async () => {
                    if (newPassword !== confirmPassword) {
                      setPasswordMsg({ type: 'error', text: t('options.passwordMismatch') });
                      return;
                    }
                    if (newPassword.length < 8) {
                      setPasswordMsg({ type: 'error', text: t('options.passwordTooShort') });
                      return;
                    }
                    setChangingPassword(true);
                    setPasswordMsg(null);
                    try {
                      await authService.changePassword(currentPassword, newPassword);
                      // Log out locally since tokens are revoked by backend
                      await authService.logout();
                      setPasswordMsg({ type: 'success', text: t('options.passwordChangedRelogin') });
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      const fresh = await storageService.getSettings();
                      setSettings(fresh);
                      // Redirect to login after a brief delay
                      setTimeout(() => {
                        chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') });
                      }, 2000);
                    } catch (err) {
                      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : t('options.passwordChangeFailed') });
                    } finally {
                      setChangingPassword(false);
                    }
                  }}
                  className="px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg text-sm hover:bg-violet-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {changingPassword && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t('options.changePassword')}
                </button>
              </div>

              {/* Delete Account */}
              <div className="pt-4 border-t sb-divider">
                <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('options.deleteAccount')}
                </h3>
                <p className="text-xs sb-muted mb-3">{t('options.deleteAccountWarning')}</p>
                <button
                  disabled={deletingAccount}
                  onClick={async () => {
                    const input = window.prompt(t('options.deleteAccountConfirm'));
                    if (input !== 'DELETE') return;
                    setDeletingAccount(true);
                    try {
                      await authService.deleteAccount();
                      window.alert(t('options.deleteAccountSuccess'));
                      window.location.reload();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : t('options.deleteAccountFailed'));
                    } finally {
                      setDeletingAccount(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingAccount && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t('options.deleteAccount')}
                </button>
              </div>
            </div>
          )}

          {/* Save & Home Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all ${saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600'
                }`}
            >
              {saved ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {t('options.saved')}
                </span>
              ) : (
                t('options.save')
              )}
            </button>
            <button
              onClick={() => {
                chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
              }}
              className="px-6 py-4 rounded-xl font-semibold text-lg transition-all sb-card hover:bg-violet-500/10 text-violet-400 flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              {t('options.returnHome')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t sb-divider text-center text-sm sb-muted">
          <p>OrangeDuck v1.1.0</p>
          <p className="mt-1">{t('options.poweredBy')}</p>
          <a
            href="https://your-site.example.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Shield className="w-3 h-3" />
            {t('options.privacyPolicy')}
          </a>
          {/* Danger Zone - hidden in footer */}
          <details className="mt-4">
            <summary className="text-xs sb-muted cursor-pointer hover:text-red-400/60 transition-colors list-none">
              {t('options.dangerZone')}
            </summary>
            <button
              onClick={handleClearAllData}
              className="mt-2 px-3 py-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              {t('options.clearAllData')}
            </button>
          </details>
        </div>
      </div>
    </div>
  );
}
