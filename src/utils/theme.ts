/**
 * Apply theme to the document root element.
 * Supports 'light', 'dark', and 'system' (auto-detect).
 */
import type { Theme } from '../types';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
  } else if (theme === 'dark') {
    root.classList.remove('light');
  } else {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (prefersLight) {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }
}
