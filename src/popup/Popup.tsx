import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { storageService } from '../services/storage';
import { initializeDatabase, folderService } from '../services/database';
import { applyTheme } from '../utils/theme';
import { useSettingsSync } from '../hooks/useSettingsSync';
import type { SnapshotLevel, Folder, FolderWithChildren } from '../types';
import { Bookmark, FolderOpen, Camera, Settings, LayoutGrid, Globe } from 'lucide-react';

// Helper to build folder tree for display
function buildFolderTree(folders: Folder[]): FolderWithChildren[] {
  const folderMap = new Map<string, FolderWithChildren>();
  folders.forEach(f => folderMap.set(f.id, { ...f, children: [] }));

  const rootFolders: FolderWithChildren[] = [];
  folders.forEach(f => {
    const node = folderMap.get(f.id)!;
    if (f.parentId && folderMap.has(f.parentId)) {
      const parent = folderMap.get(f.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  const sortByOrder = (items: FolderWithChildren[]) => {
    items.sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      return a.order - b.order;
    });
    items.forEach(item => item.children && sortByOrder(item.children));
  };
  sortByOrder(rootFolders);
  return rootFolders;
}

// Flatten tree with indentation info
function flattenWithIndent(tree: FolderWithChildren[], level = 0): { folder: Folder; level: number }[] {
  const result: { folder: Folder; level: number }[] = [];
  for (const node of tree) {
    result.push({ folder: node, level });
    if (node.children && node.children.length > 0) {
      result.push(...flattenWithIndent(node.children, level + 1));
    }
  }
  return result;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PageInfo {
  url: string;
  title: string;
  favicon: string;
}

export default function Popup() {
  const { t, i18n } = useTranslation();
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [folderId, setFolderId] = useState('all');
  const [snapshotLevel, setSnapshotLevel] = useState<SnapshotLevel>('L1');
  const [folders, setFolders] = useState<Folder[]>([]);

  // Build hierarchical folder list with indentation
  const foldersWithIndent = useMemo(() => {
    const tree = buildFolderTree(folders);
    return flattenWithIndent(tree);
  }, [folders]);

  useSettingsSync();

  useEffect(() => {
    (async () => {
      await initializeDatabase();
      const loadedFolders = await folderService.getAll();
      setFolders(loadedFolders);

      const settings = await storageService.getSettings();
      applyTheme(settings.theme);
      const hasKey = settings.apiMode === 'proxy'
        ? Boolean(settings.userToken)
        : Boolean(settings.apiKeys?.[settings.apiProvider]);
      setHasApiKey(hasKey);
      setSnapshotLevel(settings.defaultSnapshotLevel);

      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url && tab?.title) {
        setPageInfo({
          url: tab.url,
          title: tab.title,
          favicon: tab.favIconUrl || '',
        });
      }
    })();
  }, [i18n]);

  const handleSave = async () => {
    if (!pageInfo) return;

    setStatus('saving');
    setError('');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_BOOKMARK',
        tabId: tab.id,
        url: pageInfo.url,
        folderId,
        snapshotLevel,
      });

      if (response.success) {
        setStatus('saved');
        setTimeout(() => window.close(), 1500);
      } else {
        setStatus('error');
        setError(response.error || t('popup.error'));
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : t('popup.error'));
    }
  };

  const openSettings = () => {
    // Use tabs.create as fallback since openOptionsPage may not work in some contexts
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') });
    window.close();
  };

  const openManager = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
    window.close();
  };


  return (
    <div className="w-80 sb-page">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b sb-divider">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{t('popup.title')}</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="p-3 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-500/30 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">{t('popup.noApiKey')}</p>
                <button
                  onClick={openSettings}
                  className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-medium underline underline-offset-2"
                >
                  {t('popup.openSettings')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Info Card */}
        {pageInfo && (
          <div className="p-3 sb-card">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg sb-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
                {pageInfo.favicon ? (
                  <img
                    src={pageInfo.favicon}
                    alt=""
                    className="w-6 h-6"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Globe className="w-5 h-5 sb-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-sm truncate leading-tight">
                  {pageInfo.title}
                </h2>
                <p className="text-xs sb-muted truncate mt-1">{pageInfo.url}</p>
              </div>
            </div>
          </div>
        )}

        {/* Folder Select */}
        <div>
          <label className="flex items-center gap-1.5 text-xs sb-muted mb-2 font-medium">
            <FolderOpen className="w-3.5 h-3.5" />
            {t('popup.folder')}
          </label>
          <div className="relative">
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full sb-input px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 appearance-none cursor-pointer"
            >
              {foldersWithIndent.map(({ folder, level }) => (
                <option key={folder.id} value={folder.id}>
                  {level > 0 ? '　'.repeat(level) + '└ ' : ''}{folder.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 sb-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Snapshot Level */}
        <div>
          <label className="flex items-center gap-1.5 text-xs sb-muted mb-2 font-medium">
            <Camera className="w-3.5 h-3.5" />
            {t('popup.snapshotLevel')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['L1', 'L2', 'L3'] as SnapshotLevel[]).map((level) => {
              const isSelected = snapshotLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => setSnapshotLevel(level)}
                  className={`relative px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm shadow-violet-500/10'
                      : 'sb-card sb-card-hover sb-secondary'
                  }`}
                >
                  {t(`snapshot.${level}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={status === 'saving' || status === 'saved'}
          className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            status === 'saved'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : status === 'saving'
              ? 'bg-violet-500/50 text-white cursor-wait'
              : status === 'error'
              ? 'bg-red-500/80 text-white'
              : 'sb-button-primary'
          }`}
        >
          {status === 'saving' && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status === 'saved' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'saving'
            ? t('popup.saving')
            : status === 'saved'
            ? t('popup.saved')
            : status === 'error'
            ? error
            : t('common.save')}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t sb-divider flex justify-between">
        <button
          onClick={openManager}
          className="flex items-center gap-1.5 text-xs sb-muted hover:text-[var(--text-primary)] transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {t('popup.openManager')}
        </button>
        <button
          onClick={openSettings}
          className="flex items-center gap-1.5 text-xs sb-muted hover:text-[var(--text-primary)] transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {t('popup.openSettings')}
        </button>
      </div>
    </div>
  );
}
