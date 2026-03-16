import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme } from '../utils/theme';

/**
 * Listens for settings changes (language, theme) from other extension pages
 * via chrome.storage.onChanged and applies them in real-time.
 */
export function useSettingsSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.smartBookmarksSettings) {
        const newSettings = changes.smartBookmarksSettings.newValue;
        if (newSettings) {
          if (newSettings.language && newSettings.language !== i18n.language) {
            i18n.changeLanguage(newSettings.language);
          }
          if (newSettings.theme) {
            applyTheme(newSettings.theme);
          }
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [i18n]);
}
