import { create } from 'zustand';
import { storageService } from '../services/storage';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_KEY = 'smartBookmarksSettings';

interface SettingsState {
  settings: Settings;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
  initStorageListener: () => () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await storageService.getSettings();
      set({ settings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (changes: Partial<Settings>) => {
    try {
      await storageService.saveSettings(changes);
      set({ settings: { ...get().settings, ...changes } });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  // Listen for storage changes from other pages/tabs
  initStorageListener: () => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[SETTINGS_KEY]) {
        const newSettings = changes[SETTINGS_KEY].newValue as Settings;
        if (newSettings) {
          set({ settings: { ...DEFAULT_SETTINGS, ...newSettings } });
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);

    // Return cleanup function
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  },
}));
