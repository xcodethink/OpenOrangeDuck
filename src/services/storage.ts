import type { Settings } from '../types';
import { DEFAULT_SETTINGS, SUPPORTED_LANGUAGES } from '../types/settings';

const SETTINGS_KEY = 'smartBookmarksSettings';

export const storageService = {
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      const stored = result[SETTINGS_KEY];

      if (stored && typeof stored !== 'object') {
        console.warn('Stored settings is not an object, using defaults');
        return DEFAULT_SETTINGS;
      }

      const merged = { ...DEFAULT_SETTINGS, ...(stored || {}) };

      // Migration: update old placeholder proxy endpoint to real backend
      if (merged.proxyEndpoint === 'https://api.smartbookmarks.example.com/v1') {
        merged.proxyEndpoint = DEFAULT_SETTINGS.proxyEndpoint;
      }

      // Migration: default apiMode to proxy (was custom in older versions)
      if (stored?.apiMode === 'custom' && !stored?._migratedApiMode) {
        merged.apiMode = 'proxy';
        // Persist the migration so it's one-time only
        await chrome.storage.local.set({ [SETTINGS_KEY]: { ...stored, apiMode: 'proxy', _migratedApiMode: true } });
      }

      // Migration: map legacy apiKey to anthropic key
      const legacyApiKey = stored?.apiKey as string | undefined;
      if (legacyApiKey && !merged.apiKeys.anthropic) {
        merged.apiKeys = { ...merged.apiKeys, anthropic: legacyApiKey };
      }

      const validLanguages = SUPPORTED_LANGUAGES.map(l => l.value as string);
      if (!validLanguages.includes(merged.language)) {
        merged.language = 'en';
      }

      return merged;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings. Storage may be full.');
    }
  },

  async getApiKey(provider: Settings['apiProvider'] = 'anthropic'): Promise<string> {
    const settings = await this.getSettings();
    return settings.apiKeys[provider] || '';
  },

  async setApiKey(apiKey: string, provider: Settings['apiProvider'] = 'anthropic'): Promise<void> {
    const settings = await this.getSettings();
    await this.saveSettings({
      apiKeys: { ...settings.apiKeys, [provider]: apiKey },
    });
  },

  async getLanguage(): Promise<string> {
    const settings = await this.getSettings();
    return settings.language;
  },

  async setLanguage(language: Settings['language']): Promise<void> {
    await this.saveSettings({ language });
  },
};

export default storageService;
