export type Language = 'en' | 'zh' | 'vi';

export const SUPPORTED_LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'vi', label: 'Tiếng Việt' },
];
export type Theme = 'dark' | 'light' | 'system';
export type ApiMode = 'proxy' | 'custom';
export type ApiProvider = 'anthropic' | 'openai' | 'gemini' | 'grok' | 'custom';

export interface ApiKeys {
  anthropic: string;
  openai: string;
  gemini: string;
  grok: string;
  custom: string;
}

// Provider configurations
export interface ProviderConfig {
  id: ApiProvider;
  name: string;
  keyPlaceholder: string;
  keyHelpUrl?: string;
  supportsBaseUrl?: boolean;
  supportsDynamicModels?: boolean;  // Can fetch models from API
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    keyPlaceholder: 'sk-ant-api03-...',
    keyHelpUrl: 'https://console.anthropic.com/',
    supportsDynamicModels: true,  // Uses static list internally
  },
  {
    id: 'openai',
    name: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/',
    supportsBaseUrl: true,
    supportsDynamicModels: true,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    supportsDynamicModels: true,
  },
  {
    id: 'grok',
    name: 'Grok',
    keyPlaceholder: 'xai-...',
    keyHelpUrl: 'https://console.x.ai/',
    supportsBaseUrl: true,
    supportsDynamicModels: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    keyPlaceholder: 'your-api-key',
    supportsBaseUrl: true,
    supportsDynamicModels: true,
  },
];

export type PlanType = 'free' | 'pro' | 'power';

export interface Settings {
  // API configuration
  apiMode: ApiMode;
  apiProvider: ApiProvider;
  apiKeys: ApiKeys;
  apiModel: string;
  apiBaseUrl: string;

  // Proxy mode configuration
  proxyEndpoint: string;
  userToken: string;

  // Subscription
  plan: PlanType;
  aiUsageThisMonth: number;

  // Account / Auth
  refreshToken: string;
  userId: string;
  userEmail: string;
  userName: string;
  tokenExpiry: number; // JWT expiry timestamp (ms)

  // Cloud backup
  lastBackupAt: string;

  // General settings
  language: Language;
  theme: Theme;
  defaultSnapshotLevel: 'L1' | 'L2' | 'L3';
  healthCheckInterval: 'daily' | 'weekly' | 'monthly' | 'never';
  autoSummary: boolean;
  autoTags: boolean;
  autoEmbedding: boolean;

  // OrangeDuck real-time protection
  realtimeProtection: boolean;
  whitelistDomains: string[];
}

// TODO: Replace with your own API endpoint
export const DEFAULT_PROXY_ENDPOINT = 'https://your-api.example.com/v1';

function getDefaultLanguage(): Language {
  try {
    const lang = navigator.language?.split('-')[0];
    if (lang === 'zh') return 'zh';
    if (lang === 'vi') return 'vi';
    return 'en';
  } catch {
    return 'en';
  }
}

export const DEFAULT_SETTINGS: Settings = {
  apiMode: 'proxy',
  apiProvider: 'anthropic',
  apiKeys: {
    anthropic: '',
    openai: '',
    gemini: '',
    grok: '',
    custom: '',
  },
  apiModel: 'claude-haiku-4-5-20251001',
  apiBaseUrl: '',
  proxyEndpoint: DEFAULT_PROXY_ENDPOINT,
  userToken: '',
  plan: 'free',
  aiUsageThisMonth: 0,
  refreshToken: '',
  userId: '',
  userEmail: '',
  userName: '',
  tokenExpiry: 0,
  lastBackupAt: '',
  language: getDefaultLanguage(),
  theme: 'dark',
  defaultSnapshotLevel: 'L1',
  healthCheckInterval: 'weekly',
  autoSummary: true,
  autoTags: true,
  autoEmbedding: true,
  realtimeProtection: true,
  whitelistDomains: [],
};
