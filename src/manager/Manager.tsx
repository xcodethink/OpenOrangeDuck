import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookmarkStore } from '../stores/bookmarkStore';
import { useFolderStore } from '../stores/folderStore';
import { useSettingsStore } from '../stores/settingsStore';
import { initializeDatabase, bookmarkService } from '../services/database';
import { storageService } from '../services/storage';
import { detectHomographAttack } from '../utils/homographDetection';
import { detectBrandImpersonation, isKnownBrandRegionalDomain } from '../utils/brandImpersonation';
import { applyTheme } from '../utils/theme';
import Sidebar from './components/Sidebar';
import BookmarkList from './components/BookmarkList';
import DetailPanel from './components/DetailPanel';
import SearchBar from './components/SearchBar';
import FeatureButtons from './components/FeatureButtons';
import TimelineView from './components/TimelineView';
import HelpModal from './components/HelpModal';
import ImportExportModal from './components/ImportExportModal';
import CloudBackupModal from './components/CloudBackupModal';
import { ToastContainer, toast } from '../components/Toast';
import SnapshotViewer from '../components/SnapshotViewer';
import KeyboardShortcuts from '../components/KeyboardShortcuts';
import { ErrorBoundary } from '../components/ErrorBoundary';
import EmptyState from '../components/EmptyState';
import { BookmarkListSkeleton } from '../components/Skeleton';
import FeatureTour from './components/FeatureTour';
import type { Bookmark, SnapshotLevel } from '../types';
import type { Language } from '../types/settings';
import { supportedLanguages } from '../i18n';
import { Library, Sun, Moon, Languages, MessageCircle, HeartPulse, Check, AlertTriangle, X } from 'lucide-react';

const TOUR_COMPLETED_KEY = 'smartBookmarksTourCompleted';

export type StatusFilter = 'all' | 'healthy' | 'dead' | 'new' | 'fraud';

export default function Manager() {
  const { t, i18n } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimelineView, setIsTimelineView] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [snapshotBookmark, setSnapshotBookmark] = useState<Bookmark | null>(null);
  const [snapshotInitialTab, setSnapshotInitialTab] = useState<string>('overview');
  const [snapshotUpdatingLevel, setSnapshotUpdatingLevel] = useState<SnapshotLevel | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [healthProgress, setHealthProgress] = useState<{ checked: number; total: number; phase: string } | null>(null);
  const [healthResults, setHealthResults] = useState<{ total: number; healthy: number; dead: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Ref for filtered bookmarks (used in keyboard handler before const declaration)
  const filteredBookmarksRef = useRef<Bookmark[]>([]);

  // Language dropdown state
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Feature tour
  const [showTour, setShowTour] = useState(false);

  const { bookmarks, selectedId, domainCounts, loadBookmarks, loadAll, loadByFolder, loadByDomain, search, selectBookmark, updateLastVisited, loadDomainCounts } =
    useBookmarkStore();
  const { folders, selectedFolderId, loadFolders, selectFolder } = useFolderStore();
  const { settings, loadSettings, updateSettings, initStorageListener } = useSettingsStore();

  // Initialize
  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        await loadSettings();
        await loadFolders();
        await loadBookmarks();
        await loadDomainCounts();
        setIsInitialized(true);
        // Show feature tour on first visit
        const tourDone = localStorage.getItem(TOUR_COMPLETED_KEY);
        if (!tourDone) setShowTour(true);
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error(t('common.error') + ': ' + (error as Error).message);
      }
    })();
  }, []);

  // Refresh data when tab regains focus (e.g., after Auth page closes or ClassifyPage saves)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        loadSettings();
        loadFolders();
        loadBookmarks();
        loadDomainCounts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isInitialized, loadSettings, loadFolders, loadBookmarks, loadDomainCounts]);

  // Listen for settings changes from other pages (e.g., Options page)
  useEffect(() => {
    const cleanup = initStorageListener();
    return cleanup;
  }, [initStorageListener]);

  // Listen for token expiry warning from apiClient
  useEffect(() => {
    const handleTokenWarning = () => {
      toast.error(t('errors.AUTH_EXPIRED'));
    };
    globalThis.addEventListener('token-expiry-warning', handleTokenWarning);
    return () => globalThis.removeEventListener('token-expiry-warning', handleTokenWarning);
  }, [t]);

  // Listen for health check progress from background
  useEffect(() => {
    const listener = (message: { type: string; checked: number; total: number; phase: string }) => {
      if (message.type === 'HEALTH_CHECK_PROGRESS') {
        setHealthProgress({ checked: message.checked, total: message.total, phase: message.phase });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Apply language setting
  useEffect(() => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  }, [settings.theme, updateSettings]);

  // Load bookmarks when folder changes
  useEffect(() => {
    if (isInitialized) {
      setIsLoading(true);
      if (searchQuery) {
        search(searchQuery).finally(() => setIsLoading(false));
      } else {
        loadByFolder(selectedFolderId).finally(() => setIsLoading(false));
      }
    }
  }, [selectedFolderId, isInitialized]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Focus search (Cmd/Ctrl + K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
        return;
      }

      // Close modals on Escape
      if (e.key === 'Escape') {
        setShowHelp(false);
        setShowImportExport(false);
        setShowCloudBackup(false);
        setShowShortcuts(false);
        setSnapshotBookmark(null);
        setIsBatchMode(false);
        setSelectedIds(new Set());
        return;
      }

      // Toggle views with number keys
      if (e.key === '1') setIsTimelineView(false);
      if (e.key === '3') setIsTimelineView(true);

      // Select all (Cmd/Ctrl + A) when in batch mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && isBatchMode) {
        e.preventDefault();
        setSelectedIds(new Set(filteredBookmarksRef.current.map(b => b.id)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBatchMode]);

  // Handle search with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (!query) {
      // Immediate clear — no debounce needed
      setIsLoading(true);
      loadByFolder(selectedFolderId).finally(() => setIsLoading(false));
      return;
    }
    setIsLoading(true);
    searchTimerRef.current = setTimeout(() => {
      search(query).finally(() => setIsLoading(false));
    }, 300);
  }, [selectedFolderId, search, loadByFolder]);

  // Handle health check
  const handleHealthCheck = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setHealthResults(null);
    setHealthProgress({ checked: 0, total: 0, phase: 'checking' });

    try {
      const response = await chrome.runtime.sendMessage({ type: 'PERFORM_HEALTH_CHECK' });
      await loadBookmarks();
      if (response?.results) {
        setHealthResults(response.results);
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsChecking(false);
      setHealthProgress(null);
    }
  };

  // Handle view snapshot
  const handleViewSnapshot = (bookmark: Bookmark, initialTab?: string) => {
    setSnapshotBookmark(bookmark);
    setSnapshotInitialTab(initialTab || 'overview');
  };

  // Handle snapshot update from viewer
  const handleUpdateSnapshotFromViewer = async (level: SnapshotLevel) => {
    if (!snapshotBookmark || snapshotUpdatingLevel) return;
    setSnapshotUpdatingLevel(level);
    toast.info(t('snapshot.updating'));
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SNAPSHOT',
        bookmarkId: snapshotBookmark.id,
        level,
      });
      if (response.success) {
        toast.success(t('snapshot.updateSuccess'));
        // Reload bookmarks and update the viewer's bookmark
        await loadByFolder(selectedFolderId);
        const updated = await bookmarkService.getById(snapshotBookmark.id);
        if (updated) setSnapshotBookmark(updated);
      } else {
        toast.error(t('snapshot.updateError') + ': ' + (response.error || ''));
      }
    } catch (error) {
      toast.error(t('snapshot.updateError'));
    } finally {
      setSnapshotUpdatingLevel(null);
    }
  };

  // Batch selection handlers
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmMessage = t('batch.deleteConfirm', { count: selectedIds.size });
    if (!confirm(confirmMessage)) return;

    try {
      const ids = Array.from(selectedIds);
      await bookmarkService.bulkDelete(ids);
      await loadByFolder(selectedFolderId);
      await loadFolders();
      await loadDomainCounts();
      toast.success(t('batch.deleteSuccess', { count: selectedIds.size }));
      // Clear detail panel if the selected bookmark was deleted
      if (selectedId && ids.includes(selectedId)) {
        selectBookmark(null);
      }
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setStatusFilter('all'); // Reset filter so list isn't stuck on empty filtered view
    } catch (error) {
      toast.error(t('common.error') + ': ' + (error as Error).message);
    }
  };

  // Handle import complete
  const handleImportComplete = async () => {
    await loadAll();
    await loadFolders();
    await loadDomainCounts();
  };

  // Handle clicking on domain to filter by domain
  const handleDomainClick = useCallback((domain: string) => {
    setSearchQuery('');
    setIsLoading(true);
    selectFolder('all');
    loadByDomain(domain).finally(() => setIsLoading(false));
  }, [loadByDomain, selectFolder]);

  // Handle visiting a bookmark (track last visited time)
  const handleVisit = useCallback((id: string) => {
    updateLastVisited(id);
  }, [updateLastVisited]);

  // Handle refreshing a single bookmark's domain intelligence
  const handleRefreshBookmark = useCallback(async (bookmark: Bookmark) => {
    try {
      const domain = bookmark.domain || new URL(bookmark.url).hostname.replace(/^www\./, '');
      const settings = await storageService.getSettings();
      const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

      // Clear local cache
      try {
        await chrome.storage.local.remove('rdap_cache_' + domain);
      } catch { /* ok */ }

      // Fetch fresh intelligence from backend
      const response = await fetch(`${baseUrl}/public/domain/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: bookmark.url }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json() as {
        success: boolean;
        data?: {
          safeBrowsing: { safe: boolean; threats: string[] };
          cloudflare: { domainRank: number | null; malicious: boolean; phishing: boolean } | null;
          createdDate: string | null;
          dnssec: boolean;
          domainStatus: string[];
        };
      };

      // Quick trust score calculation
      let score = 50;
      const protocol = bookmark.url.startsWith('https:') ? 'https:' : 'http:';
      if (protocol === 'https:') score += 10; else score -= 20;

      if (result.success && result.data) {
        const d = result.data;
        if (d.safeBrowsing?.safe) score += 20; else if (d.safeBrowsing && !d.safeBrowsing.safe) score -= 40;
        if (d.createdDate) {
          const ageYears = (Date.now() - new Date(d.createdDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (ageYears >= 5) score += 15; else if (ageYears >= 1) score += 5; else score -= 15;
        }
        if (d.dnssec) score += 5;
        if (d.domainStatus?.some((s: string) => s.includes('Prohibited'))) score += 5;
        if (d.cloudflare) {
          if (d.cloudflare.malicious) score -= 30;
          else if (d.cloudflare.phishing) score -= 30;
          else score += 5;
          if (d.cloudflare.domainRank != null && d.cloudflare.domainRank <= 10000) score += 10;
        }
      }

      // Brand regional bonus
      if (isKnownBrandRegionalDomain(domain).isBrandRegional) score += 15;

      // Local detections
      const homograph = detectHomographAttack(domain);
      if (homograph?.isHomograph) score -= 25;
      const brand = detectBrandImpersonation(domain);
      if (brand?.isSuspicious) score -= 20;

      score = Math.max(0, Math.min(100, score));
      const riskLevel: 'safe' | 'caution' | 'danger' = score >= 70 ? 'safe' : score >= 40 ? 'caution' : 'danger';

      await bookmarkService.update(bookmark.id, { riskLevel });
      // Refresh list to show updated risk level
      await loadBookmarks();
      toast.success(t('intelligence.refreshed'));
    } catch (err) {
      console.error('Refresh bookmark failed:', err);
      toast.error(t('common.error'));
    }
  }, [loadBookmarks, t]);

  const selectedBookmark = bookmarks.find((b) => b.id === selectedId);

  // Close language dropdown on outside click
  useEffect(() => {
    if (!showLangDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showLangDropdown]);

  // Track domains with registration < 1 year (from RDAP cache)
  const [youngDomains, setYoungDomains] = useState<Set<string>>(new Set());
  useEffect(() => {
    const domains = [...new Set(bookmarks.map(b => b.domain).filter(Boolean))];
    if (domains.length === 0) { setYoungDomains(new Set()); return; }
    const keys = domains.map(d => 'rdap_cache_' + d);
    chrome.storage.local.get(keys).then(result => {
      const oneYearAgo = Date.now() - 365.25 * 24 * 60 * 60 * 1000;
      const young = new Set<string>();
      for (const d of domains) {
        const cached = result['rdap_cache_' + d];
        const created = cached?.data?.createdDate;
        if (created && new Date(created).getTime() > oneYearAgo) {
          young.add(d);
        }
      }
      setYoungDomains(young);
    }).catch(() => {});
  }, [bookmarks]);

  // Calculate folder stats (extended with newSites + fraud)
  const folderStats = {
    total: bookmarks.length,
    healthy: bookmarks.filter(b => b.status === 'healthy').length,
    dead: bookmarks.filter(b => b.status === 'dead').length,
    newSites: bookmarks.filter(b => youngDomains.has(b.domain)).length,
    fraud: bookmarks.filter(b => b.riskLevel === 'danger').length,
  };

  // Apply status filter
  const filteredBookmarks = statusFilter === 'all' ? bookmarks : bookmarks.filter(b => {
    switch (statusFilter) {
      case 'healthy': return b.status === 'healthy';
      case 'dead': return b.status === 'dead';
      case 'new': return youngDomains.has(b.domain);
      case 'fraud': return b.riskLevel === 'danger';
      default: return true;
    }
  });
  filteredBookmarksRef.current = filteredBookmarks;

  const handleStatusFilterChange = useCallback((filter: StatusFilter) => {
    setStatusFilter(prev => prev === filter ? 'all' : filter);
  }, []);

  const handleLanguageChange = useCallback((code: Language) => {
    i18n.changeLanguage(code);
    updateSettings({ language: code });
    setShowLangDropdown(false);
  }, [i18n, updateSettings]);

  // Get current folder name
  const currentFolder = folders.find(f => f.id === selectedFolderId);
  const currentFolderName = currentFolder?.name || '';

  if (!isInitialized) {
    return (
      <div className="w-full h-screen flex items-center justify-center sb-page">
        <div className="text-center">
          <Library className="w-14 h-14 mx-auto mb-4 text-violet-400 animate-pulse" />
          <p className="text-lg sb-muted">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {showTour && (
        <FeatureTour onComplete={() => {
          setShowTour(false);
          localStorage.setItem(TOUR_COMPLETED_KEY, '1');
        }} />
      )}
      <div className="w-full h-screen flex sb-page overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b sb-divider space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchBar value={searchQuery} onChange={handleSearch} />
              </div>
              {/* Language Switcher */}
              <div className="relative" ref={langDropdownRef}>
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="sb-button flex items-center gap-2 px-3 py-2"
                  title={t('options.language')}
                >
                  <Languages className="w-4 h-4 text-violet-400" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-50 sb-card rounded-lg shadow-lg border sb-divider py-1 min-w-[140px]">
                    {supportedLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code as Language)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          i18n.language === lang.code
                            ? 'text-violet-400 bg-violet-500/10'
                            : 'sb-secondary hover:bg-violet-500/5'
                        }`}
                      >
                        {lang.nativeName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="sb-button flex items-center gap-2 px-3 py-2"
                title={settings.theme === 'dark' ? t('options.light') : t('options.dark')}
              >
                {settings.theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="text-xs sb-muted hidden sm:inline">{t('options.light')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-300" />
                    <span className="text-xs sb-muted hidden sm:inline">{t('options.dark')}</span>
                  </>
                )}
              </button>
              {/* Community Link */}
              <a
                href={`https://your-site.example.com/${i18n.language === 'zh' ? 'zh' : 'en'}/report-scam`}
                target="_blank"
                rel="noopener noreferrer"
                className="sb-button flex items-center gap-2 px-3 py-2"
                title={t('feature.community')}
              >
                <MessageCircle className="w-4 h-4 text-violet-400" />
                <span className="text-xs sb-muted hidden sm:inline">{t('feature.community')}</span>
              </a>
            </div>
            <FeatureButtons
              onHelpClick={() => setShowHelp(true)}
              isTimelineView={isTimelineView}
              onToggleView={() => setIsTimelineView(!isTimelineView)}
              onHealthCheck={handleHealthCheck}
              isChecking={isChecking}
              onImportExportClick={() => setShowImportExport(true)}
              onCloudBackupClick={() => setShowCloudBackup(true)}
              onBatchModeClick={toggleBatchMode}
              isBatchMode={isBatchMode}
            />

            {/* Health Check Progress Bar */}
            {isChecking && healthProgress && healthProgress.total > 0 && (
              <div className="sb-card rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-violet-400 animate-pulse" />
                    <span className="sb-muted">
                      {healthProgress.phase === 'retrying'
                        ? t('healthCheck.retrying')
                        : t('healthCheck.progress', {
                            checked: Math.min(healthProgress.checked, healthProgress.total),
                            total: healthProgress.total,
                          })}
                    </span>
                  </div>
                  <span className="text-xs sb-muted">
                    {Math.round((Math.min(healthProgress.checked, healthProgress.total) / healthProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((Math.min(healthProgress.checked, healthProgress.total) / healthProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Health Check Results Banner */}
            {healthResults && !isChecking && (
              <div className={`rounded-lg p-3 flex items-center justify-between ${
                healthResults.dead > 0
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                <div className="flex items-center gap-3">
                  {healthResults.dead > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{t('healthCheck.resultTitle')}</p>
                    <p className="text-xs sb-muted">
                      {healthResults.dead > 0
                        ? t('healthCheck.resultSummary', healthResults)
                        : t('healthCheck.allHealthy', { total: healthResults.total })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHealthResults(null)}
                  className="sb-muted hover:text-[var(--text-primary)] transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Batch Mode Bar */}
            {isBatchMode && selectedIds.size > 0 && (
              <div className="sb-card flex items-center justify-between p-3">
                <span className="text-sm text-violet-300">
                  {t('batch.selected', { count: selectedIds.size })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set(filteredBookmarks.map(b => b.id)))}
                    className="sb-button px-3 py-1 text-xs"
                  >
                    {t('action.selectAll')}
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="sb-button px-3 py-1 text-xs"
                  >
                    {t('action.deselectAll')}
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-md text-white"
                  >
                    {t('action.batchDelete')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <BookmarkListSkeleton />
            ) : bookmarks.length === 0 ? (
              <EmptyState
                type={searchQuery ? 'search' : 'bookmarks'}
                onAction={() => setShowImportExport(true)}
                actionLabel={t('feature.import')}
              />
            ) : isTimelineView ? (
              <TimelineView
                bookmarks={filteredBookmarks}
                selectedId={selectedId}
                onSelect={selectBookmark}
                isBatchMode={isBatchMode}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                folders={folders}
              />
            ) : (
              <BookmarkList
                bookmarks={filteredBookmarks}
                selectedId={selectedId}
                onSelect={selectBookmark}
                searchQuery={searchQuery}
                isBatchMode={isBatchMode}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                onViewSnapshot={handleViewSnapshot}
                folders={folders}
                domainCounts={domainCounts}
                onDomainClick={handleDomainClick}
                onVisit={handleVisit}
                folderStats={folderStats}
                currentFolderName={currentFolderName}
                statusFilter={statusFilter}
                onStatusFilterChange={handleStatusFilterChange}
                onRefreshBookmark={handleRefreshBookmark}
              />
            )}
          </div>
        </div>

        {/* Right Detail Panel */}
        <DetailPanel
          bookmark={selectedBookmark}
          onClose={() => selectBookmark(null)}
          onViewSnapshot={handleViewSnapshot}
          onSnapshotUpdated={() => loadByFolder(selectedFolderId)}
          onDelete={async (id) => {
            await bookmarkService.delete(id);
            selectBookmark(null);
            await loadByFolder(selectedFolderId);
            await loadDomainCounts();
          }}
          onUpdateTitle={async (id, title) => {
            await bookmarkService.update(id, { title });
            await loadByFolder(selectedFolderId);
          }}
        />

        {/* Modals */}
        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        <ImportExportModal
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          onImportComplete={handleImportComplete}
        />
        <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <CloudBackupModal
          isOpen={showCloudBackup}
          onClose={() => setShowCloudBackup(false)}
          isLoggedIn={!!settings.userId}
        />

        {/* Snapshot Viewer */}
        {snapshotBookmark && (
          <SnapshotViewer
            bookmark={snapshotBookmark}
            onClose={() => setSnapshotBookmark(null)}
            initialTab={snapshotInitialTab as 'overview' | 'L1' | 'L2' | 'L3'}
            onUpdateSnapshot={handleUpdateSnapshotFromViewer}
            updatingLevel={snapshotUpdatingLevel}
          />
        )}

        {/* Toast Container */}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
